/**
 * Bridge API HTTP/SSE 客户端
 * 负责与 Python 端 Bridge_API 通信
 *
 * 使用 Node.js 原生 fetch API，不依赖第三方库
 * SSE 解析使用 fetch + ReadableStream（支持自定义 headers）
 */

import type {
  BridgeMessageEvent,
  SendResult,
  DeliveryResult,
  BridgeAccount,
  BridgeStatus,
} from "./types";

export class BridgeClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    // 去除尾部斜杠
    this.apiUrl = apiUrl.replace(/\/+$/, "");
  }

  /** 获取请求头 */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }

  /**
   * 建立 SSE 连接，持续接收消息
   * 使用 fetch + ReadableStream 解析 SSE 事件流
   * 连接断开时抛出错误（由 connection-manager 处理重连）
   *
   * @param accountId - 闲鱼账号ID (对应 cookie_id)，用于订阅特定账号的消息
   * @param onConnected - 可选回调，fetch 成功且流就绪后立即调用（用于精确的连接状态检测）
   */
  async connectSSE(
    accountId: string,
    onMessage: (msg: BridgeMessageEvent) => void,
    signal: AbortSignal,
    lastEventId?: string,
    onConnected?: () => void,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
    if (lastEventId) {
      headers["Last-Event-ID"] = lastEventId;
    }

    // 构建 SSE URL，传递 account_id 参数订阅特定账号的消息
    const url = `${this.apiUrl}/api/bridge/messages?account_id=${encodeURIComponent(accountId)}`;
    const response = await fetch(url, { headers, signal });

    if (!response.ok) {
      throw new Error(
        `SSE connection failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = response.body;
    if (!body) {
      throw new Error("SSE response has no body");
    }

    // fetch 成功，流已就绪 — 通知调用方连接已建立
    onConnected?.();

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // SSE 解析状态
    let currentEvent = "";
    let currentData = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // 保留最后一个不完整的行
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line === "") {
            // 空行 = 事件分隔符，派发事件
            if (currentData) {
              this.dispatchSSEEvent(
                currentEvent || "message",
                currentData.trimEnd(),
                onMessage,
              );
            }
            currentEvent = "";
            currentData = "";
            continue;
          }

          if (line.startsWith(":")) {
            // 注释行，忽略
            continue;
          }

          const colonIdx = line.indexOf(":");
          let field: string;
          let val: string;

          if (colonIdx === -1) {
            field = line;
            val = "";
          } else {
            field = line.slice(0, colonIdx);
            // 跳过冒号后的可选空格
            val = line[colonIdx + 1] === " "
              ? line.slice(colonIdx + 2)
              : line.slice(colonIdx + 1);
          }

          switch (field) {
            case "event":
              currentEvent = val;
              break;
            case "data":
              currentData += (currentData ? "\n" : "") + val;
              break;
            // retry、id 等字段忽略
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 流正常结束 = 服务端关闭连接
    throw new Error("SSE connection closed by server");
  }

  /** 解析并派发 SSE 事件 */
  private dispatchSSEEvent(
    event: string,
    data: string,
    onMessage: (msg: BridgeMessageEvent) => void,
  ): void {
    if (event !== "message") return;

    try {
      const parsed = JSON.parse(data) as BridgeMessageEvent;
      onMessage(parsed);
    } catch {
      // 解析失败，跳过该消息
    }
  }

  /** 发送文本消息 */
  async sendText(
    conversationId: string,
    toUserId: string,
    text: string,
    accountId?: string,
  ): Promise<SendResult> {
    return this.post("/api/bridge/send", { conversationId, toUserId, text, accountId });
  }

  /** 发送图片消息 */
  async sendMedia(
    conversationId: string,
    toUserId: string,
    imageUrl: string,
    accountId?: string,
  ): Promise<SendResult> {
    return this.post("/api/bridge/send-media", {
      conversationId,
      toUserId,
      imageUrl,
      accountId,
    });
  }

  /** 获取账号列表 */
  async getAccounts(): Promise<BridgeAccount[]> {
    return this.get<BridgeAccount[]>("/api/bridge/accounts");
  }

  /** 获取连接状态 */
  async getStatus(): Promise<BridgeStatus> {
    return this.get<BridgeStatus>("/api/bridge/status");
  }

  /** 确认发货 */
  async confirmDelivery(
    orderId: string,
    accountId?: string,
  ): Promise<DeliveryResult> {
    return this.post("/api/bridge/confirm-delivery", { orderId, accountId });
  }

  /** 通用 GET 请求 */
  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`GET ${path} failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /** 通用 POST 请求，非 2xx 转为 { ok: false, error } */
  private async post<T extends { ok: boolean; error?: string }>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    try {
      // 确保请求体正确编码
      const jsonBody = JSON.stringify(body);
      console.log(`[BridgeClient] POST ${path}`, jsonBody.substring(0, 200));

      const response = await fetch(`${this.apiUrl}${path}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: jsonBody,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        console.error(`[BridgeClient] POST ${path} failed: ${response.status}`, text);
        return { ok: false, error: `${response.status}: ${text}` } as T;
      }

      const result = await response.json() as T;
      console.log(`[BridgeClient] POST ${path} result:`, JSON.stringify(result).substring(0, 100));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message } as T;
    }
  }
}
