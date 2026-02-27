/**
 * 入站消息处理
 * 将 BridgeMessageEvent 转换为 OpenClaw 入站消息格式
 *
 * 📦 模式来源：openclaw-channel-dingtalk-repo 的入站处理流程
 * 📝 用途：接收 Bridge_API SSE 推送的消息，转换并分发给 Agent
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { BridgeMessageEvent, ChannelLogSink } from "./types";
import { getXianyuRuntime } from "./runtime";

export interface HandleBridgeMessageParams {
  cfg: OpenClawConfig;
  accountId: string;
  data: BridgeMessageEvent;
  log?: ChannelLogSink;
}

/**
 * 处理来自 Bridge_API 的入站消息
 *
 * 将 BridgeMessageEvent 转换为 OpenClaw 标准入站消息格式，
 * 通过 runtime 的 reply dispatcher 分发给 Agent。
 */
export async function handleBridgeMessage(
  params: HandleBridgeMessageParams,
): Promise<void> {
  const { cfg, accountId, data, log } = params;
  const rt = getXianyuRuntime();

  log?.info?.(`[${accountId}] Processing inbound message: ${data.messageId}`);
  log?.debug?.(`[${accountId}] 消息详细内容: ${JSON.stringify(data)}`);

  // 将 BridgeMessageEvent 转换为 OpenClaw 入站消息格式
  const inboundMessage = {
    channelId: "xianyu",
    accountId,
    from: data.senderId,
    fromName: data.senderName,
    to: accountId,
    sessionKey: data.conversationId,
    chatType: "direct" as const,
    body: data.content,
    messageId: data.messageId,
    timestamp: data.timestamp,
    meta: {
      itemId: data.itemId,
      contentType: data.contentType,
    },
  };

  // 使用 runtime 的 reply dispatcher 分发消息
  // 具体 API 取决于 OpenClaw SDK 版本，这里使用通用模式
  await (rt as any).channel?.reply?.dispatchInbound?.(inboundMessage);
}
