# 🐟 闲鱼 × OpenClaw 频道插件

[![GitHub](https://img.shields.io/badge/GitHub-laozuzhen%2Fxianyu--openclaw--channel-blue?logo=github)](https://github.com/laozuzhen/xianyu-openclaw-channel)
[![Python](https://img.shields.io/badge/Python-3.11+-green?logo=python)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green?logo=node.js)](https://nodejs.org/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Channel%20Plugin-purple)](https://github.com/nicepkg/openclaw)

> 将闲鱼二手交易平台的消息接入 [OpenClaw](https://github.com/nicepkg/openclaw) AI Agent，实现智能客服、自动回复、自动发货等功能。

## ✨ 特性

- 🔌 **一键安装** — 克隆仓库，运行安装脚本，搞定
- 🤖 **OpenClaw 集成** — 闲鱼消息直接接入 AI Agent，支持上下文对话
- 🚀 **自动启动** — OpenClaw Gateway 启动时自动拉起闲鱼服务，停止时自动关闭
- 📱 **多账号** — 支持同时管理多个闲鱼账号
- 🚚 **自动发货** — 检测付款消息自动确认发货
- 🔒 **Bridge 模式** — TypeScript 插件通过 HTTP/SSE 桥接 Python 闲鱼服务，安全隔离

## 🏗️ 架构

```
OpenClaw Agent ←→ Channel Plugin (TS) ←HTTP/SSE→ Bridge API (Python) ←WebSocket→ 闲鱼
                   openclaw-plugin/                 reply_server.py
```

- **Channel Plugin**（`openclaw-plugin/`）：TypeScript OpenClaw 频道适配器
- **Bridge API**（`bridge_api.py`）：Python 端 RESTful + SSE 接口
- **闲鱼核心**（`XianyuAutoAsync.py`）：WebSocket 连接、消息处理、自动回复
- Gateway 启动时，插件通过 `registerService` 自动 spawn Python 进程

## 📋 环境要求

| 依赖 | 版本 |
|------|------|
| Python | 3.11+ |
| Node.js | 16+ |
| OpenClaw | 最新版 |

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/laozuzhen/xianyu-openclaw-channel.git
cd xianyu-openclaw-channel
```

### 2. 一键安装

```bash
# Linux/macOS
bash install-openclaw.sh

# Windows
install-openclaw.bat
```

脚本自动完成：
- ✅ Python 虚拟环境 + 依赖安装
- ✅ Node.js 插件依赖安装
- ✅ Bridge Token 自动生成
- ✅ 插件注册到 OpenClaw extensions

可选参数：
```bash
--bridge-token TOKEN   # 指定 Bridge Token（默认自动生成）
--skip-python          # 跳过 Python 依赖（已装过）
--openclaw-only        # 只装 OpenClaw 插件
```

### 3. 配置 OpenClaw

在 `~/.clawdbot/moltbot.json` 中添加闲鱼频道：

#### 单账号配置（推荐）

```json5
{
  "channels": {
    "xianyu": {
      "apiUrl": "http://localhost:8080",
      "enabled": true
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu"
      }
    }
  ]
}
```

**重要**: 
- 不指定 `accountId` 时,默认使用 `"default"`
- 确保闲鱼管理界面中添加的账号 ID 为 `"default"`,或者在配置中明确指定 `accountId`

#### 多账号配置

如果你有多个闲鱼账号,需要为每个账号指定 `accountId`:

```json5
{
  "channels": {
    "xianyu": {
      "accounts": {
        "shop1": {
          "apiUrl": "http://localhost:8080",
          "enabled": true
        },
        "shop2": {
          "apiUrl": "http://localhost:8081",
          "enabled": true
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop1"
      }
    },
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop2"
      }
    }
  ]
}
```

**说明**:
- `accountId` 必须与闲鱼管理界面中添加的账号 ID 一致
- 每个账号需要运行独立的 Python Bridge API 实例(不同端口)
- SSE 连接会自动订阅对应 `accountId` 的消息队列

### 4. 配置闲鱼账号

1. 访问 `http://localhost:8080`（闲鱼管理界面）
2. 默认账号：`admin` / `admin123`（首次登录请改密码）
3. 添加闲鱼账号的 Cookie

**重要**: 
- 添加账号时,账号 ID 必须与 OpenClaw 配置中的 `accountId` 一致
- 单账号模式: 账号 ID 设置为 `"default"`
- 多账号模式: 账号 ID 设置为 `"shop1"`, `"shop2"` 等(与配置对应)

### 5. 启动

```bash
# 方式 A：通过 OpenClaw Gateway（推荐，自动启动 Python 进程）
moltbot start

# 方式 B：手动分别启动
python Start.py                    # 启动闲鱼服务
moltbot start                      # 启动 OpenClaw Gateway
```

> 使用方式 A 时，插件会自动检测 venv 并启动 `Start.py`，无需手动管理 Python 进程。

## 📁 项目结构

```
xianyu-openclaw-channel/
├── openclaw-plugin/           # OpenClaw 频道插件 (TypeScript)
│   ├── index.ts               # 插件入口，注册 channel + service
│   ├── openclaw.plugin.json   # 插件清单
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── bridge-client.ts       # Bridge API HTTP 客户端
│       ├── bridge-process.ts      # Python 进程生命周期管理
│       ├── channel.ts             # 频道定义（SSE 收消息、HTTP 发消息）
│       ├── config.ts              # 配置解析
│       ├── config-schema.ts       # 配置 Schema
│       ├── connection-manager.ts  # SSE 连接管理 + 重连
│       ├── dedup.ts               # 消息去重
│       ├── inbound-handler.ts     # 入站消息处理
│       ├── runtime.ts             # 运行时引用
│       ├── send-service.ts        # 发送消息服务
│       └── types.ts               # 类型定义
├── bridge_api.py              # Bridge API（Python 端 HTTP/SSE）
├── bridge_message_queue.py    # 消息队列
├── Start.py                   # Python 启动入口
├── XianyuAutoAsync.py         # 闲鱼 WebSocket 核心
├── reply_server.py            # FastAPI Web 服务
├── install-openclaw.sh        # 一键安装（Linux/macOS）
├── install-openclaw.bat       # 一键安装（Windows）
├── requirements.txt           # Python 依赖
├── .env.example               # 环境变量模板
└── ...                        # 其他闲鱼自动回复文件
```

## 🔌 Bridge API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/bridge/messages?account_id=<accountId>` | GET (SSE) | 实时消息推送流(订阅特定账号) |
| `/api/bridge/send` | POST | 发送文本消息 |
| `/api/bridge/send-media` | POST | 发送图片消息 |
| `/api/bridge/accounts` | GET | 获取账号列表 |
| `/api/bridge/status` | GET | 获取桥接状态 |
| `/api/bridge/confirm-delivery` | POST | 确认发货 |

**重要**: 
- SSE 端点 `/api/bridge/messages` 需要传递 `account_id` 参数
- `account_id` 对应闲鱼管理界面中的账号 ID
- OpenClaw 插件会自动根据配置的 `accountId` 订阅对应的消息队列

## ⚙️ 高级配置

### 多账号配置

#### 方案 A: 单 Python 实例 + 多账号

如果所有账号在同一个 Python 实例中管理:

```json5
{
  "channels": {
    "xianyu": {
      "accounts": {
        "shop1": {
          "apiUrl": "http://localhost:8080",
          "enabled": true
        },
        "shop2": {
          "apiUrl": "http://localhost:8080",  // 同一个 API 地址
          "enabled": true
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop1"
      }
    },
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop2"
      }
    }
  ]
}
```

**说明**:
- 所有账号共享同一个 Python Bridge API 实例
- 每个 `accountId` 对应闲鱼管理界面中的一个账号
- SSE 连接会根据 `accountId` 订阅不同的消息队列

#### 方案 B: 多 Python 实例 + 多账号

如果每个账号运行独立的 Python 实例:

```json5
{
  "channels": {
    "xianyu": {
      "accounts": {
        "shop1": {
          "apiUrl": "http://localhost:8080",
          "enabled": true
        },
        "shop2": {
          "apiUrl": "http://localhost:8081",  // 不同端口
          "enabled": true
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop1"
      }
    },
    {
      "agentId": "main",
      "match": {
        "channel": "xianyu",
        "accountId": "shop2"
      }
    }
  ]
}
```

**说明**:
- 每个账号运行独立的 Python 进程(不同端口)
- 适合需要完全隔离的场景

### 连接参数

```json5
{
  "channels": {
    "xianyu": {
      "apiUrl": "http://localhost:8080",
      "enabled": true,
      // 可选: 连接重试配置
      "maxConnectionAttempts": 10,        // 最大重连次数
      "initialReconnectDelay": 1000,      // 初始重连延迟(毫秒)
      "maxReconnectDelay": 60000,         // 最大重连延迟(毫秒)
      "reconnectJitter": 0.3              // 重连抖动系数
    }
  }
}
```

### Docker 部署

闲鱼 Python 端也支持 Docker：

```bash
docker-compose up -d
```

详见 `Dockerfile` 和 `docker-compose.yml`。

## 🔧 开发

```bash
# 安装插件开发依赖
cd openclaw-plugin && npm install

# TypeScript 编译
npx tsc

# 开发模式（link 到 OpenClaw）
moltbot plugins install -l ./openclaw-plugin
```

## ❓ 常见问题

**Q: Gateway 启动后 Python 进程没起来？**
A: 检查 `venv/` 是否存在，或者系统 PATH 中是否有 python。插件日志会输出 `[bridge-process]` 前缀的信息。

**Q: SSE 连接一直断开重连？**
A: 
1. 确认 Python 端 `Start.py` 正在运行
2. 检查 `apiUrl` 配置是否正确
3. 确认 `accountId` 与闲鱼管理界面中的账号 ID 一致

**Q: 收不到消息？**
A:
1. 检查 OpenClaw 配置中的 `accountId` 是否与闲鱼管理界面中的账号 ID 一致
2. 查看 Python 日志,确认消息是否被正确发布到队列
3. 查看 OpenClaw 日志,确认 SSE 连接是否订阅了正确的 `account_id`

**Q: 如何查看当前账号 ID？**
A: 访问闲鱼管理界面 `http://localhost:8080`,在账号列表中查看账号 ID 列。

**Q: 如何只用闲鱼自动回复，不用 OpenClaw？**
A: 直接 `python Start.py`，访问 `http://localhost:8080` 使用原生管理界面。

## 📜 致谢

- [xianyu-auto-reply](https://github.com/HJYHJYHJY/xianyu-auto-reply) — 闲鱼自动回复核心
- [OpenClaw](https://github.com/nicepkg/openclaw) — AI Agent 框架
- [openclaw-channel-dingtalk](https://github.com/soimy/openclaw-channel-dingtalk) — 插件架构参考

## ⚖️ 声明

本项目仅供学习研究使用，严禁商业用途。使用者需遵守当地法律法规，使用风险自负。
