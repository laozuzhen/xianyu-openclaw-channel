# SSE 消息优化测试指南

## 📋 修改内容总结

### 修改文件
- `xianyu-super-butler-repo/openclaw-plugin/src/inbound-handler.ts`

### 核心改动
1. **添加消息缓存机制**
   - 使用 `Map` 缓存非 final 消息
   - 只在收到 `final` 类型消息时发送

2. **修改 deliver 回调逻辑**
   - 识别消息类型（tool、block、final）
   - 缓存 tool 和 block 消息，不发送
   - 只发送 final 消息

3. **增强日志输出**
   - 记录消息类型和缓存状态
   - 便于调试和验证

---

## 🧪 测试步骤

### 前置条件

1. **确保服务正常运行**
   ```bash
   # 检查 Python 后端
   python xianyu-super-butler-repo/Start.py
   
   # 检查 OpenClaw
   openclaw status
   ```

2. **确认插件已安装**
   ```bash
   # 查看 OpenClaw 插件列表
   openclaw plugin list
   
   # 应该看到 xianyu-channel 插件
   ```

3. **查看日志文件位置**
   - OpenClaw 日志：`~/.openclaw/logs/`
   - Python 日志：控制台输出

---

### 测试场景 1：简单问答

**目的**：验证只发送最后一条消息

**步骤**：
1. 通过闲鱼发送消息：`你好`
2. 观察日志输出
3. 检查闲鱼收到的消息数量

**预期结果**：
- ✅ 日志显示收到多条消息（tool、block、final）
- ✅ 日志显示缓存了 tool 和 block 消息
- ✅ 日志显示只发送了 final 消息
- ✅ 闲鱼只收到 1 条回复

**日志示例**：
```
[Xianyu][default] Received tool message: 工具调用结果...
[Xianyu][default] Cached tool message (not sending): 工具调用结果...
[Xianyu][default] Received block message: AI 正在思考...
[Xianyu][default] Cached block message (not sending): AI 正在思考...
[Xianyu][default] Received final message: 你好！我是 AI 助手...
[Xianyu][default] Sending final reply (from cache): 你好！我是 AI 助手...
[Xianyu][default] Final reply sent successfully
```

---

### 测试场景 2：复杂查询（需要工具调用）

**目的**：验证工具调用消息被正确缓存

**步骤**：
1. 通过闲鱼发送消息：`帮我查询天气`
2. 观察日志输出
3. 检查闲鱼收到的消息数量

**预期结果**：
- ✅ 日志显示收到 tool 消息（工具调用结果）
- ✅ 日志显示缓存了 tool 消息
- ✅ 日志显示收到 final 消息
- ✅ 闲鱼只收到 1 条回复（最终结果）

**日志示例**：
```
[Xianyu][default] Received tool message: 查询天气工具返回：北京今天晴...
[Xianyu][default] Cached tool message (not sending): 查询天气工具返回...
[Xianyu][default] Received final message: 北京今天天气晴朗，温度 20°C...
[Xianyu][default] Sending final reply (from cache): 北京今天天气晴朗...
[Xianyu][default] Final reply sent successfully
```

---

### 测试场景 3：多轮对话

**目的**：验证缓存在多轮对话中正确清理

**步骤**：
1. 通过闲鱼发送消息：`你好`
2. 等待回复
3. 再次发送消息：`再见`
4. 观察日志输出

**预期结果**：
- ✅ 第一轮对话：缓存被正确使用和清理
- ✅ 第二轮对话：使用新的缓存，不受第一轮影响
- ✅ 每轮对话只收到 1 条回复

**日志示例**：
```
# 第一轮
[Xianyu][default] Cached block message (not sending): 思考中...
[Xianyu][default] Sending final reply (from cache): 你好！
[Xianyu][default] Final reply sent successfully

# 第二轮
[Xianyu][default] Cached block message (not sending): 思考中...
[Xianyu][default] Sending final reply (from cache): 再见！
[Xianyu][default] Final reply sent successfully
```

---

### 测试场景 4：并发对话

**目的**：验证多个用户同时对话时缓存隔离

**步骤**：
1. 使用两个不同的闲鱼账号
2. 同时发送消息给 AI
3. 观察日志输出

**预期结果**：
- ✅ 每个用户的缓存独立（通过 `accountId:conversationId` 区分）
- ✅ 每个用户只收到自己的回复
- ✅ 不会出现消息串台

**日志示例**：
```
[Xianyu][account1] Cached block message (not sending): 用户1的回复...
[Xianyu][account2] Cached block message (not sending): 用户2的回复...
[Xianyu][account1] Sending final reply (from cache): 用户1的最终回复...
[Xianyu][account2] Sending final reply (from cache): 用户2的最终回复...
```

---

## 📊 验证指标

### 修改前 vs 修改后对比

| 指标 | 修改前 | 修改后 | 改善 |
|------|--------|--------|------|
| **SSE 推送次数** | 5-10 次 | 1 次 | ✅ 减少 80-90% |
| **用户看到的消息数** | 5-10 条 | 1 条 | ✅ 只看到最终结果 |
| **网络流量** | 高 | 低 | ✅ 减少 80-90% |
| **响应延迟** | 立即 | 稍有延迟 | ⚠️ 等待 final |
| **用户体验** | 混乱 | 清晰 | ✅ 只看到最终回复 |

---

## 🔍 调试技巧

### 1. 查看详细日志

**OpenClaw 日志**：
```bash
# 实时查看日志
tail -f ~/.openclaw/logs/openclaw.log

# 搜索闲鱼相关日志
grep "Xianyu" ~/.openclaw/logs/openclaw.log
```

**Python 日志**：
```bash
# 启动时开启详细日志
python xianyu-super-butler-repo/Start.py --log-level DEBUG
```

### 2. 检查消息类型

在日志中搜索关键词：
- `Received tool message` - 工具调用消息
- `Received block message` - 流式响应块
- `Received final message` - 最终回复
- `Cached` - 消息被缓存
- `Sending final reply` - 发送最终回复

### 3. 验证缓存清理

检查日志中是否有：
- `from cache` - 使用了缓存的消息
- `direct` - 直接发送（没有缓存）

### 4. 检查 SSE 推送

**方法 1：查看 Python 日志**
```bash
# 搜索 publish 调用
grep "消息已发布" xianyu-super-butler-repo/logs/*.log
```

**方法 2：使用浏览器开发者工具**
- 打开 `http://localhost:8000/api/bridge/messages?account_id=default`
- 查看 SSE 事件流
- 应该只看到 1 个 `message` 事件

---

## ⚠️ 常见问题

### 问题 1：收到多条消息

**症状**：闲鱼仍然收到多条消息

**可能原因**：
1. 插件未重新加载
2. 缓存逻辑未生效
3. 消息类型识别错误

**解决方法**：
```bash
# 重启 OpenClaw
openclaw restart

# 检查插件版本
openclaw plugin list

# 查看日志确认消息类型
grep "Received.*message" ~/.openclaw/logs/openclaw.log
```

---

### 问题 2：没有收到任何消息

**症状**：闲鱼没有收到 AI 回复

**可能原因**：
1. final 消息未发送
2. Bridge API 连接断开
3. 缓存未清理

**解决方法**：
```bash
# 检查 Bridge API 状态
curl http://localhost:8000/api/bridge/status

# 查看日志确认 final 消息
grep "Sending final reply" ~/.openclaw/logs/openclaw.log

# 检查缓存状态（添加调试日志）
```

---

### 问题 3：消息延迟过长

**症状**：用户等待时间过长才收到回复

**可能原因**：
1. AI 生成时间长
2. 等待 final 消息

**解决方法**：
- 这是正常行为（等待 AI 完成生成）
- 如果需要实时反馈，考虑使用方案 B（真正的流式输出）

---

## 🚀 下一步优化建议

### 优化 1：添加超时机制

**问题**：如果 AI 生成失败，缓存永远不会清理

**解决方案**：
```typescript
// 添加超时清理
const CACHE_TIMEOUT = 60000; // 60 秒

setTimeout(() => {
  lastMessageCache.delete(cacheKey);
}, CACHE_TIMEOUT);
```

---

### 优化 2：添加"正在输入"提示

**问题**：用户不知道 AI 正在生成

**解决方案**：
```typescript
// 收到第一条 block 消息时发送提示
if (messageKind === "block" && !lastMessageCache.has(cacheKey)) {
  await sendTextMessage({
    apiUrl: xianyuConfig.apiUrl,
    conversationId,
    toUserId: senderId,
    text: "🤔 正在思考中，请稍候...",
    accountId,
  });
}
```

---

### 优化 3：支持配置切换

**问题**：有些用户可能想看到完整的思考过程

**解决方案**：
```typescript
// 在配置中添加选项
const xianyuConfig = getXianyuConfig(cfg, accountId);
const sendMode = xianyuConfig.sendMode || "final-only"; // "final-only" | "all" | "merged"

if (sendMode === "all") {
  // 发送所有消息（方案 B）
} else if (sendMode === "merged") {
  // 合并消息（方案 C）
} else {
  // 只发送 final（方案 A，当前实现）
}
```

---

## 📝 总结

### 已完成
- ✅ 实现消息过滤逻辑
- ✅ 只发送最后一条 final 消息
- ✅ 减少 SSE 推送次数
- ✅ 改善用户体验

### 待测试
- ⏳ 简单问答场景
- ⏳ 复杂查询场景
- ⏳ 多轮对话场景
- ⏳ 并发对话场景

### 后续优化
- 💡 添加超时清理机制
- 💡 添加"正在输入"提示
- 💡 支持配置切换发送模式

---

## 🎯 验收标准

**通过标准**：
1. ✅ 闲鱼只收到 1 条最终回复
2. ✅ 日志显示正确的缓存和发送逻辑
3. ✅ 多轮对话缓存正确清理
4. ✅ 并发对话缓存正确隔离
5. ✅ 没有消息丢失或串台

**如果满足以上所有标准，优化成功！** 🎉
