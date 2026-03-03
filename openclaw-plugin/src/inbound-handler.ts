/**
 * 入站消息处理
 * �?BridgeMessageEvent 转换�?OpenClaw 入站消息格式
 *
 * 📦 模式来源：openclaw-channel-dingtalk-repo 的入站处理流�?
 * 📝 用途：接收 Bridge_API SSE 推送的消息，转换并分发�?Agent
 * �?支持为不同用户创建独�?session
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { BridgeMessageEvent, ChannelLogSink, XianyuChannelConfig } from "./types";
import { getXianyuRuntime } from "./runtime";
import { resolveXianyuAccount } from "./config";

export interface HandleBridgeMessageParams {
  cfg: OpenClawConfig;
  accountId: string;
  data: BridgeMessageEvent;
  log?: ChannelLogSink;
}

/**
 * 获取闲鱼频道配置
 */
function getXianyuConfig(cfg: OpenClawConfig, accountId?: string): XianyuChannelConfig {
  const account = resolveXianyuAccount(cfg, accountId);
  const xianyu = cfg.channels?.xianyu as XianyuChannelConfig | undefined;
  return {
    ...xianyu,
    apiUrl: account.apiUrl,
  };
}

/**
 * 处理来自 Bridge_API 的入站消�?
 *
 * 完整流程�?
 * 1. 解析路由 (resolveAgentRoute) �?生成 sessionKey
 * 2. 解析存储路径 (resolveStorePath)
 * 3. 创建上下�?(finalizeInboundContext)
 * 4. 记录 session (recordInboundSession)
 * 5. 分发回复 (dispatchReplyWithBufferedBlockDispatcher)
 */
export async function handleBridgeMessage(
  params: HandleBridgeMessageParams,
): Promise<void> {
  const { cfg, accountId, data, log } = params;
  const rt = getXianyuRuntime();

  log?.info?.(`[Xianyu][${accountId}] Processing inbound message: ${data.messageId}`);
  log?.debug?.(`[Xianyu][${accountId}] 消息详细内容: ${JSON.stringify(data)}`);

  // 忽略系统消息
  if (data.contentType === "system") {
    log?.debug?.(`[Xianyu][${accountId}] Ignoring system message`);
    return;
  }

  // 忽略空内�?
  if (!data.content || !data.content.trim()) {
    log?.debug?.(`[Xianyu][${accountId}] Ignoring empty message`);
    return;
  }

  const senderId = data.senderId;
  const senderName = data.senderName || "Unknown";
  const conversationId = data.conversationId;

  // 1) 解析路由 �?决定使用哪个 agent，生�?sessionKey
  const route = rt.channel.routing.resolveAgentRoute({
    cfg,
    channel: "xianyu",
    accountId,
    peer: { kind: "direct", id: senderId },
  });

  log?.debug?.(`[Xianyu][${accountId}] Route resolved: agentId=${route.agentId}, sessionKey=${route.sessionKey}`);

  // 2) 解析 session 存储路径
  const storePath = rt.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });

  // 3) 构建消息体（带时间戳等元信息�?
  const envelopeOptions = rt.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = rt.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const fromLabel = `${senderName} (${senderId})`;
  const body = rt.channel.reply.formatInboundEnvelope({
    channel: "Xianyu",
    from: fromLabel,
    timestamp: data.timestamp,
    body: data.content,
    chatType: "direct",
    sender: { name: senderName, id: senderId },
    previousTimestamp,
    envelope: envelopeOptions,
  });

  // 4) 创建完整上下�?
  const ctx = rt.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: data.content,
    CommandBody: data.content,
    From: senderId,
    To: senderId,
    SessionKey: route.sessionKey,
    AccountId: accountId,
    ChatType: "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName,
    SenderId: senderId,
    Provider: "xianyu",
    Surface: "xianyu",
    MessageSid: data.messageId,
    Timestamp: data.timestamp,
    MediaPath: data.contentType === "image" ? (data as any).imageUrl : undefined,
    MediaType: data.contentType === "image" ? "image" : undefined,
    CommandAuthorized: true,
    OriginatingChannel: "xianyu",
    OriginatingTo: senderId,
  });

  // 5) 记录入站 session
  await rt.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctx.SessionKey || route.sessionKey,
    ctx,
    updateLastRoute: { sessionKey: route.mainSessionKey, channel: "xianyu", to: senderId, accountId },
    onRecordError: (err: unknown) => {
      log?.error?.(`[Xianyu][${accountId}] Failed to record inbound session: ${String(err)}`);
    },
  });

  log?.info?.(`[Xianyu][${accountId}] Inbound: from=${senderName} text="${data.content.slice(0, 50)}..."`);

  // 6) 分发回复（使用缓冲块分发器，支持流式响应�?
  const xianyuConfig = getXianyuConfig(cfg, accountId);

  await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    cfg,
    dispatcherOptions: {
      responsePrefix: "",
      deliver: async (payload: any, info?: { kind: string }) => {
        try {
          const textToSend = payload.markdown || payload.text;
          if (!textToSend) {
            return;
          }

          log?.debug?.(`[Xianyu][${accountId}] Delivering reply: ${textToSend.slice(0, 100)}...`);

          // 调用发送服�?
          const result = await sendTextMessage({
            apiUrl: xianyuConfig.apiUrl,
            conversationId,
            toUserId: senderId,
            text: textToSend,
            accountId,
          });

          if (!result.ok) {
            log?.error?.(`[Xianyu][${accountId}] Send failed: ${result.error}`);
            throw new Error(result.error || "Send failed");
          }

          log?.debug?.(`[Xianyu][${accountId}] Reply sent successfully`);
        } catch (err: any) {
          log?.error?.(`[Xianyu][${accountId}] Reply delivery failed: ${err.message}`);
          throw err;
        }
      },
    },
  });
}

/**
 * 发送文本消息到 Bridge API
 */
async function sendTextMessage(params: {
  apiUrl: string;
  conversationId: string;
  toUserId: string;
  text: string;
  accountId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { apiUrl, conversationId, toUserId, text, accountId } = params;

  try {
    const response = await fetch(`${apiUrl}/api/bridge/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        toUserId,
        text,
        accountId: accountId || "default",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = (await response.json()) as { ok: boolean; error?: string };
    return result;
    return result;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}