/**
 * Message deduplication module (TTL Map, 60s window, 1000 entry cap).
 *
 * 📦 来源：直接复制 openclaw-channel-dingtalk-repo/src/dedup.ts
 * 📝 用途：通用消息去重逻辑，防止 Agent 重复处理同一条消息
 */
const processedMessages = new Map<string, number>();
const MESSAGE_DEDUP_TTL = 60000;
const MESSAGE_DEDUP_MAX_SIZE = 1000;
let messageCounter = 0;

export function isMessageProcessed(dedupKey: string): boolean {
  const now = Date.now();
  const expiresAt = processedMessages.get(dedupKey);
  if (expiresAt === undefined) {
    return false;
  }
  if (now >= expiresAt) {
    processedMessages.delete(dedupKey);
    return false;
  }
  return true;
}

export function markMessageProcessed(dedupKey: string): void {
  const expiresAt = Date.now() + MESSAGE_DEDUP_TTL;
  processedMessages.set(dedupKey, expiresAt);

  if (processedMessages.size > MESSAGE_DEDUP_MAX_SIZE) {
    const now = Date.now();
    for (const [key, expiry] of processedMessages.entries()) {
      if (now >= expiry) {
        processedMessages.delete(key);
      }
    }
    if (processedMessages.size > MESSAGE_DEDUP_MAX_SIZE) {
      const removeCount = processedMessages.size - MESSAGE_DEDUP_MAX_SIZE;
      let removed = 0;
      for (const key of processedMessages.keys()) {
        processedMessages.delete(key);
        if (++removed >= removeCount) {
          break;
        }
      }
    }
    return;
  }

  messageCounter++;
  if (messageCounter >= 10) {
    messageCounter = 0;
    const now = Date.now();
    for (const [key, expiry] of processedMessages.entries()) {
      if (now >= expiry) {
        processedMessages.delete(key);
      }
    }
  }
}
