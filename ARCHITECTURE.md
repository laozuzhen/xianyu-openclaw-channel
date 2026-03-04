# 闲鱼 OpenClaw 插件架构说明

## 核心概念映射

根据 OpenClaw 官方文档 (`moltbot/docs/concepts/multi-agent.md` 和 `session.md`)，以下是关键概念的正确理解：

### 1. **agentId** (智能体ID)
- **定义**: 一个"大脑"(brain)，包含独立的 workspace + agentDir + session store
- **示例**: `"main"`, `"home"`, `"work"`
- **用途**: 隔离不同的 AI 人格/工作区
- **闲鱼映射**: 频道绑定到的智能体（通常是 `"main"`）

### 2. **accountId** (账户ID)
- **定义**: 一个频道账户实例 (channel account instance)
- **示例**: WhatsApp 账户 `"personal"` vs `"biz"`
- **用途**: 同一个频道(如 WhatsApp)的不同登录账号
- **闲鱼映射**: `cookie_id`（闲鱼账号标识，如 "account1", "account2"）

### 3. **sessionKey** (会话密钥)
- **格式**: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>`
- **示例**: `agent:main:xianyu:account1:dm:user123456`
- **用途**: 唯一标识一个对话会话
- **闲鱼映射**: 
  - `agentId`: 绑定的智能体（如 "main"）
  - `channel`: "xianyu"
  - `accountId`: cookie_id（闲鱼账号）
  - `peerId`: 买家用户ID

### 4. **binding** (绑定规则)
- **定义**: 将入站消息路由到 agentId
- **匹配条件**: `(channel, accountId, peer)` + 可选的 guild/team ids
- **示例**:
```json
{
  "agentId": "main",
  "match": { "channel": "xianyu", "accountId": "account1" }
}
```

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Routing Layer (bindings)                          │    │
│  │  - Match: (channel="xianyu", accountId="account1") │    │
│  │  - Route to: agentId="main"                        │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Agent: main                                       │    │
│  │  - Workspace: ~/clawd                              │    │
│  │  - Sessions: ~/.clawdbot/agents/main/sessions     │    │
│  │                                                     │    │
│  │  Session Keys:                                     │    │
│  │  - agent:main:xianyu:account1:dm:user123456       │    │
│  │  - agent:main:xianyu:account1:dm:user789012       │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Xianyu Channel Plugin                             │    │
│  │  - accountId: "account1" (cookie_id)               │    │
│  │  - BridgeClient: SSE 订阅 account_id=account1      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ SSE: /api/bridge/messages?account_id=account1
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Python Bridge API                           │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  BridgeMessageQueue                                │    │
│  │  - account1: Queue[BridgeMessage]                  │    │
│  │  - account2: Queue[BridgeMessage]                  │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  XianyuAutoAsync                                   │    │
│  │  - cookie_id: "account1"                           │    │
│  │  - publish(cookie_id, message)                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 消息流程

### 入站消息 (Inbound)

1. **闲鱼平台** → 买家发送消息
2. **XianyuAutoAsync** → 监听消息，调用 `bridge_queue.publish(cookie_id, message)`
3. **BridgeMessageQueue** → 将消息放入对应 `cookie_id` 的队列
4. **SSE 端点** → 客户端订阅 `/api/bridge/messages?account_id=<cookie_id>`
5. **BridgeClient** → 接收 SSE 消息
6. **Channel Plugin** → 调用 `handleBridgeMessage()`
7. **Routing Layer** → 根据 `(channel="xianyu", accountId=cookie_id)` 路由到 `agentId`
8. **Agent** → 生成 sessionKey: `agent:<agentId>:xianyu:<accountId>:dm:<peerId>`
9. **LLM** → 处理消息并生成回复

### 出站消息 (Outbound)

1. **Agent** → 生成回复文本
2. **Channel Plugin** → 调用 `sendText()` 或 `sendMedia()`
3. **SendService** → 调用 Bridge API: `POST /api/bridge/send`
4. **XianyuAutoAsync** → 发送消息到闲鱼平台
5. **闲鱼平台** → 买家收到消息

## 关键修复

### 问题
- `BridgeClient.connectSSE()` 没有传递 `account_id` 参数
- Python SSE 端点默认使用 `account_id="default"`，导致无法订阅到正确的消息队列

### 修复
1. **BridgeClient.connectSSE()** - 添加 `accountId` 参数，构建 URL: `/api/bridge/messages?account_id=<accountId>`
2. **ConnectionManager.connect()** - 传递 `this.accountId` 给 `connectSSE()`
3. **channel.ts** - 确保使用正确的 `account.accountId` (即 `cookie_id`)

### 修复后的代码

```typescript
// BridgeClient.connectSSE()
async connectSSE(
  accountId: string, // 新增参数
  onMessage: (msg: BridgeMessageEvent) => void,
  signal: AbortSignal,
  lastEventId?: string,
  onConnected?: () => void,
): Promise<void> {
  // 构建 SSE URL，传递 account_id 参数
  const url = `${this.apiUrl}/api/bridge/messages?account_id=${encodeURIComponent(accountId)}`;
  // ...
}

// ConnectionManager.connect()
await this.bridgeClient.connectSSE(
  this.accountId, // 传递 accountId
  onMessage,
  this.abortController.signal,
  this.lastEventId,
  () => { /* onConnected */ }
);
```

## 配置示例

### OpenClaw 配置 (`~/.clawdbot/moltbot.json`)

```json5
{
  "agents": {
    "list": [
      {
        "id": "main",
        "workspace": "~/clawd",
        "default": true
      }
    ]
  },
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "account1"
      }
    }
  ],
  "channels": {
    "xianyu": {
      "accounts": {
        "account1": {
          "apiUrl": "http://localhost:8765",
          "enabled": true
        }
      }
    }
  }
}
```

### Python 配置 (`.env`)

```bash
# 闲鱼账号 cookie_id (对应 OpenClaw 的 accountId)
COOKIE_ID=account1
```

## 多账号支持

### 场景: 两个闲鱼账号

```json5
{
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "xianyu", "accountId": "shop1" }
    },
    {
      "agentId": "main",
      "match": { "channel": "xianyu", "accountId": "shop2" }
    }
  ],
  "channels": {
    "xianyu": {
      "accounts": {
        "shop1": {
          "apiUrl": "http://localhost:8765",
          "enabled": true
        },
        "shop2": {
          "apiUrl": "http://localhost:8766",
          "enabled": true
        }
      }
    }
  }
}
```

每个账号运行独立的 Python Bridge API 实例:
- `shop1`: `http://localhost:8765` (COOKIE_ID=shop1)
- `shop2`: `http://localhost:8766` (COOKIE_ID=shop2)

## 参考文档

- [OpenClaw Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw Session Management](https://docs.openclaw.ai/concepts/session)
- [OpenClaw Channel Configuration](https://docs.openclaw.ai/gateway/configuration)
