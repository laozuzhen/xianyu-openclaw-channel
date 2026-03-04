# Session 隔离功能质量检查报告

## 📋 审查范围
- **文件**: `xianyu-super-butler-repo/openclaw-plugin/src/inbound-handler.ts`
- **审查时间**: 2025-01-XX
- **审查标准**: 苛刻模式（零容忍）

---

## ✅ 通过的检查项

### 1. Session Key 生成逻辑正确
- ✅ 使用 `rt.channel.routing.resolveAgentRoute()` 生成 sessionKey
- ✅ 传入 `peer: { kind: "direct", id: conversationId }` 作为路由参数
- ✅ 底层调用 `buildAgentPeerSessionKey()` 基于 `conversationId` 生成唯一 key
- ✅ Session key 格式：`agent:{agentId}:{channel}:dm:{conversationId}` (dmScope=per-channel-peer)

### 2. 消息缓存机制设计合理
- ✅ 使用 `Map<string, string>` 缓存非 final 消息
- ✅ 缓存 key 格式：`${accountId}:${conversationId}`（包含对话 ID）
- ✅ 只在收到 `final` 消息时发送，减少网络流量

### 3. 基础错误处理完善
- ✅ 忽略系统消息和空内容
- ✅ 捕获发送失败异常并记录日志
- ✅ 记录 session 失败时有错误回调

---

## ⚠️ 发现的问题

### 🔴 严重问题 (Critical)

#### 问题 1: Session 隔离不完整 - 消息缓存仍使用 `senderId`

**问题描述**:
虽然 session key 已经正确使用 `conversationId`，但消息缓存的 key 仍然包含 `senderId`，导致**多个买家在同一商品对话时会串台**。

**代码位置**:
```typescript
// 第 148 行
const cacheKey = `${accountId}:${conversationId}`;
```

**问题分析**:
- 当前缓存 key：`${accountId}:${conversationId}`
- 看似正确，但实际上 `conversationId` 在闲鱼场景下可能是 **商品 ID**，而不是唯一的对话 ID
- 如果多个买家同时咨询同一商品，他们的 `conversationId` 相同，会导致：
  - 买家 A 的消息被缓存
  - 买家 B 发消息时，缓存被覆盖
  - 买家 A 收到 final 时，发送的是买家 B 的消息内容

**正确的缓存 key 应该是**:
```typescript
const cacheKey = `${accountId}:${conversationId}:${senderId}`;
```

**修复建议**:
```typescript
// 修改第 148 行
- const cacheKey = `${accountId}:${conversationId}`;
+ const cacheKey = `${accountId}:${conversationId}:${senderId}`;
```

**影响范围**: 🔴 **高危** - 会导致用户收到错误的回复内容

---

#### 问题 2: Session Key 生成依赖 `dmScope` 配置，但未验证配置正确性

**问题描述**:
Session key 的生成依赖 `cfg.session?.dmScope` 配置，但代码中没有验证该配置是否正确设置。如果配置错误，会导致 session 隔离失效。

**代码位置**:
```typescript
// resolve-route.ts 第 169 行
const dmScope = input.cfg.session?.dmScope ?? "main";
```

**问题分析**:
- 默认值是 `"main"`，意味着**所有 DM 对话共享同一个 session**
- 闲鱼场景下必须设置为 `"per-channel-peer"` 或 `"per-account-channel-peer"` 才能隔离
- 如果用户忘记配置或配置错误，session 隔离会完全失效

**修复建议**:
在 `inbound-handler.ts` 中添加配置验证：

```typescript
// 在 handleBridgeMessage 函数开头添加
const dmScope = cfg.session?.dmScope;
if (dmScope !== "per-channel-peer" && dmScope !== "per-account-channel-peer") {
  log?.warn?.(
    `[Xianyu][${accountId}] ⚠️ dmScope 配置错误: "${dmScope}"，` +
    `闲鱼场景必须设置为 "per-channel-peer" 或 "per-account-channel-peer" 才能隔离 session`
  );
}
```

**影响范围**: 🔴 **高危** - 配置错误会导致所有对话串台

---

#### 问题 3: 缓存清理不完整 - 只清理 final 消息的缓存

**问题描述**:
当前只在发送 final 消息后清理缓存，但如果：
- Agent 返回多条 final 消息（异常情况）
- 发送失败后抛出异常
- 用户长时间不回复

缓存会一直占用内存，导致**内存泄漏**。

**代码位置**:
```typescript
// 第 165 行
lastMessageCache.delete(cacheKey);
```

**问题分析**:
- 缓存只在成功发送 final 消息后清理
- 如果发送失败（第 159 行抛出异常），缓存不会被清理
- 长时间运行后，缓存会无限增长

**修复建议**:
1. 使用 `try-finally` 确保缓存一定被清理：

```typescript
try {
  const result = await sendTextMessage({...});
  if (!result.ok) {
    log?.error?.(`[Xianyu][${accountId}] Send failed: ${result.error}`);
    throw new Error(result.error || "Send failed");
  }
  log?.debug?.(`[Xianyu][${accountId}] Final reply sent successfully`);
} finally {
  // 无论成功失败，都清理缓存
  lastMessageCache.delete(cacheKey);
}
```

2. 添加缓存过期机制（推荐）：

```typescript
interface CacheEntry {
  text: string;
  timestamp: number;
}

const lastMessageCache = new Map<string, CacheEntry>();

// 定期清理过期缓存（例如 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of lastMessageCache.entries()) {
    if (now - entry.timestamp > 5 * 60 * 1000) {
      lastMessageCache.delete(key);
    }
  }
}, 60 * 1000); // 每分钟检查一次
```

**影响范围**: 🔴 **高危** - 长时间运行会导致内存泄漏

---

### 🟡 中等问题 (Medium)

#### 问题 4: `conversationId` 为空时的处理不充分

**问题描述**:
代码中获取 `conversationId` 后没有验证是否为空，直接传递给路由解析。如果为空，会生成错误的 session key。

**代码位置**:
```typescript
// 第 75 行
const conversationId = data.conversationId;

// 第 82 行 - 直接使用，未验证
peer: { kind: "direct", id: conversationId },
```

**问题分析**:
- 如果 `conversationId` 为空字符串或 undefined
- 生成的 session key 会是：`agent:main:xianyu:dm:` 或 `agent:main:xianyu:dm:unknown`
- 所有空 conversationId 的对话会共享同一个 session

**修复建议**:
```typescript
const conversationId = data.conversationId;
if (!conversationId || !conversationId.trim()) {
  log?.error?.(`[Xianyu][${accountId}] Missing conversationId, cannot route message`);
  return; // 拒绝处理
}
```

**影响范围**: 🟡 **中等** - 异常数据会导致 session 混乱

---

#### 问题 5: 并发对话时的竞态条件

**问题描述**:
当同一个 `conversationId` 的多条消息几乎同时到达时，可能出现竞态条件：
- 消息 1 缓存 "text1"
- 消息 2 覆盖缓存为 "text2"
- 消息 1 的 final 到达，发送 "text2"（错误）
- 消息 2 的 final 到达，缓存已被清空，发送空内容（错误）

**代码位置**:
```typescript
// 第 154-167 行 - 缓存逻辑
```

**问题分析**:
- 当前缓存是全局共享的 `Map`
- 没有并发控制机制
- 多条消息的 `deliver` 回调可能交错执行

**修复建议**:
使用消息 ID 作为缓存 key 的一部分：

```typescript
// 修改缓存 key 包含消息 ID
const cacheKey = `${accountId}:${conversationId}:${senderId}:${data.messageId}`;
```

或者使用队列机制，确保同一对话的消息串行处理。

**影响范围**: 🟡 **中等** - 高并发场景下可能出现消息错乱

---

### 🔵 轻微问题 (Minor)

#### 问题 6: 重复的 `return result;` 语句

**问题描述**:
`sendTextMessage` 函数中有重复的 `return` 语句。

**代码位置**:
```typescript
// 第 195-196 行
const result = (await response.json()) as { ok: boolean; error?: string };
return result;
return result; // 重复
```

**修复建议**:
```typescript
- return result;
- return result;
+ return result;
```

**影响范围**: 🔵 **轻微** - 不影响功能，但代码不规范

---

#### 问题 7: 日志中的中文乱码

**问题描述**:
代码注释中有乱码字符（可能是编码问题）。

**代码位置**:
```typescript
// 第 3 行
* �?BridgeMessageEvent 转换�?OpenClaw 入站消息格式
```

**修复建议**:
确保文件使用 UTF-8 编码保存，修复乱码：
```typescript
- * �?BridgeMessageEvent 转换�?OpenClaw 入站消息格式
+ * 将 BridgeMessageEvent 转换为 OpenClaw 入站消息格式
```

**影响范围**: 🔵 **轻微** - 不影响功能，但影响代码可读性

---

#### 问题 8: 缺少类型注解

**问题描述**:
`deliver` 回调函数的 `payload` 参数类型是 `any`，缺少类型安全。

**代码位置**:
```typescript
// 第 143 行
deliver: async (payload: any, info?: { kind: string }) => {
```

**修复建议**:
定义明确的类型：
```typescript
interface DeliverPayload {
  markdown?: string;
  text?: string;
}

deliver: async (payload: DeliverPayload, info?: { kind: string }) => {
```

**影响范围**: 🔵 **轻微** - 不影响功能，但降低类型安全性

---

## 📊 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **代码正确性** | 4/10 | Session key 生成正确，但缓存逻辑有严重缺陷 |
| **边界处理** | 3/10 | 缺少 conversationId 空值检查，配置验证不足 |
| **错误处理** | 5/10 | 基础错误处理完善，但缓存清理不完整 |
| **代码质量** | 6/10 | 结构清晰，但有重复代码和类型安全问题 |

**综合评分**: **4.5/10** 🔴

---

## 🎯 改进建议

### 立即修复（阻断性问题）

1. **修复缓存 key** - 添加 `senderId` 避免串台
2. **添加配置验证** - 确保 `dmScope` 配置正确
3. **修复缓存清理** - 使用 `try-finally` 和过期机制

### 短期改进（重要但不紧急）

4. **添加 conversationId 验证** - 拒绝空值
5. **优化并发处理** - 使用消息 ID 作为缓存 key

### 长期优化（代码质量）

6. **修复重复代码** - 删除重复的 `return`
7. **修复编码问题** - 确保 UTF-8 编码
8. **增强类型安全** - 添加明确的类型注解

---

## 🔍 测试建议

### 必须测试的场景

1. **多买家同时咨询同一商品**
   - 买家 A 和买家 B 同时发消息
   - 验证回复内容不会串台

2. **配置错误场景**
   - 设置 `dmScope: "main"`
   - 验证是否有警告日志

3. **发送失败场景**
   - 模拟 Bridge API 返回错误
   - 验证缓存是否被清理

4. **空 conversationId 场景**
   - 发送 `conversationId: ""`
   - 验证是否被拒绝处理

5. **并发消息场景**
   - 同一对话快速发送 10 条消息
   - 验证回复顺序和内容正确性

---

## 📝 修复后的完整代码（关键部分）

```typescript
// 1. 添加配置验证
export async function handleBridgeMessage(
  params: HandleBridgeMessageParams,
): Promise<void> {
  const { cfg, accountId, data, log } = params;
  const rt = getXianyuRuntime();

  // ✅ 验证 dmScope 配置
  const dmScope = cfg.session?.dmScope;
  if (dmScope !== "per-channel-peer" && dmScope !== "per-account-channel-peer") {
    log?.warn?.(
      `[Xianyu][${accountId}] ⚠️ dmScope="${dmScope}"，建议设置为 "per-channel-peer"`
    );
  }

  // ... 省略其他代码 ...

  const conversationId = data.conversationId;
  
  // ✅ 验证 conversationId 不为空
  if (!conversationId || !conversationId.trim()) {
    log?.error?.(`[Xianyu][${accountId}] Missing conversationId, rejecting message`);
    return;
  }

  // ... 省略路由解析代码 ...

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

          // ✅ 修复缓存 key - 添加 senderId
          const cacheKey = `${accountId}:${conversationId}:${senderId}`;
          const messageKind = info?.kind || "unknown";

          if (messageKind === "final") {
            const cachedText = lastMessageCache.get(cacheKey);
            const finalText = cachedText || textToSend;
            
            try {
              const result = await sendTextMessage({
                apiUrl: xianyuConfig.apiUrl,
                conversationId,
                toUserId: senderId,
                text: finalText,
                accountId,
              });

              if (!result.ok) {
                log?.error?.(`[Xianyu][${accountId}] Send failed: ${result.error}`);
                throw new Error(result.error || "Send failed");
              }

              log?.debug?.(`[Xianyu][${accountId}] Final reply sent successfully`);
            } finally {
              // ✅ 确保缓存一定被清理
              lastMessageCache.delete(cacheKey);
            }
          } else {
            lastMessageCache.set(cacheKey, textToSend);
          }
        } catch (err: any) {
          log?.error?.(`[Xianyu][${accountId}] Reply delivery failed: ${err.message}`);
          throw err;
        }
      },
    },
  });
}
```

---

## ✅ 验收标准

修复完成后，必须满足以下条件：

1. ✅ 多买家同时咨询同一商品，回复内容不串台
2. ✅ 配置错误时有明确的警告日志
3. ✅ 发送失败后缓存被正确清理
4. ✅ 空 conversationId 被拒绝处理
5. ✅ 并发消息场景下回复正确
6. ✅ 长时间运行（24 小时）内存不增长

---

## 🚨 风险评估

| 风险 | 概率 | 影响 | 优先级 |
|------|------|------|--------|
| 多买家串台 | 高 | 严重 | P0 |
| 配置错误导致隔离失效 | 中 | 严重 | P0 |
| 内存泄漏 | 中 | 严重 | P0 |
| 空 conversationId 导致混乱 | 低 | 中等 | P1 |
| 并发竞态条件 | 低 | 中等 | P1 |

**建议**: 立即修复所有 P0 问题后再上线。

---

**报告生成时间**: 2025-01-XX  
**审查人**: Kiro AI (Ultrawork Mode)  
**审查标准**: 苛刻模式 - 零容忍失败
