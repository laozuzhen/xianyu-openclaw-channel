/**
 * 出站消息发送服务
 * 通过 BridgeClient 发送文本和媒体消息
 *
 * 📦 模式来源：openclaw-channel-dingtalk-repo 的出站处理
 * 📝 用途：Agent 回复消息时，通过 Bridge_API 转发到闲鱼买家
 */

import { BridgeClient } from "./bridge-client";
import type { SendResult } from "./types";

const TEXT_CHUNK_LIMIT = 2000;

/** 将长文本按字符数分块 */
export function chunkText(
  text: string,
  limit: number = TEXT_CHUNK_LIMIT,
): string[] {
  if (text.length <= limit) {
    return [text];
  }
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += limit) {
    chunks.push(text.slice(i, i + limit));
  }
  return chunks;
}

/** 发送文本消息（自动分块） */
export async function sendText(params: {
  apiUrl: string;
  conversationId: string;
  toUserId: string;
  text: string;
}): Promise<SendResult> {
  const client = new BridgeClient(params.apiUrl);
  const chunks = chunkText(params.text);

  for (const chunk of chunks) {
    const result = await client.sendText(
      params.conversationId,
      params.toUserId,
      chunk,
    );
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/** 发送媒体消息 */
export async function sendMedia(params: {
  apiUrl: string;
  conversationId: string;
  toUserId: string;
  imageUrl: string;
}): Promise<SendResult> {
  const client = new BridgeClient(params.apiUrl);
  return client.sendMedia(
    params.conversationId,
    params.toUserId,
    params.imageUrl,
  );
}
