# 🐟 闲鱼 × OpenClaw 频道插件

[![GitHub](https://img.shields.io/badge/GitHub-laozuzhen%2Fxianyu--openclaw--channel-blue?logo=github)](https://github.com/laozuzhen/xianyu-openclaw-channel)
[![Python](https://img.shields.io/badge/Python-3.11+-green?logo=python)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green?logo=node.js)](https://nodejs.org/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Channel%20Plugin-purple)](https://github.com/nicepkg/openclaw)

> 将闲鱼二手交易平台的消息接入 [OpenClaw](https://github.com/nicepkg/openclaw) AI Agent，实现智能客服、自动回复、自动发货、商品发布等功能。

## ✨ 特性

- 🔌 **一键安装** — 克隆仓库，运行安装脚本，搞定
- 🤖 **OpenClaw 集成** — 闲鱼消息直接接入 AI Agent，支持上下文对话
- 🚀 **自动启动** — OpenClaw Gateway 启动时自动拉起闲鱼服务，停止时自动关闭
- 📱 **多账号** — 支持同时管理多个闲鱼账号
- 🚚 **自动发货** — 检测付款消息自动确认发货
- 🛒 **商品发布** — 支持单个/批量商品发布（API + 工具）
- 🔍 **商品搜索** — 爬取闲鱼商品信息，市场调研
- 🔒 **Bridge 模式** — TypeScript 插件通过 HTTP/SSE 桥接 Python 闲鱼服务，安全隔离

## 🏗️ 架构

```
OpenClaw Agent ←→ Channel Plugin (TS) ←HTTP/SSE→ Bridge API (Python) ←WebSocket→ 闲鱼
                   openclaw-plugin/                 reply_server.py
```

- **Channel Plugin**（`openclaw-plugin/`）：TypeScript OpenClaw 频道适配器
- **Bridge API**（`bridge_api.py`）：Python 端 RESTful + SSE 接口
- **闲鱼核心**（`XianyuAutoAsync.py`）：WebSocket 连接、消息处理、自动回复
- **商品发布器**（`product_publisher.py`）：Playwright 自动化发布商品
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

### 3. 配置 OpenClaw

在 `~/.openclaw/openclaw.json` 中添加配置：

#### 插件加载配置（必须）

```json5
{
  "plugins": {
    "allow": ["xianyu"],
    "load": {
      "paths": ["<扩展目录>/xianyu/openclaw-plugin"]
    },
    "entries": {
      "xianyu": {
        "enabled": true
      }
    }
  }
}
```

#### 频道配置

```json5
{
  "channels": {
    "xianyu": {
      "accounts": {
        "2207836320265_1": {  // 账号ID，对应闲鱼管理界面中的Cookie ID
          "apiUrl": "http://localhost:8080"
        }
      },
      "enabled": true
    }
  }
}
```

#### Agent 绑定配置

```json5
{
  "agentMatch": [
    {
      "agentId": "xianyu-kefu",  // 绑定到闲鱼客服 agent
      "match": {
        "accountId": "2207836320265_1",
        "channel": "xianyu"
      }
    }
  ]
}
```

### 4. 配置闲鱼账号

1. 访问 `http://localhost:8080`（闲鱼管理界面）
2. 默认账号：`admin` / `admin123`（首次登录请改密码）
3. 添加闲鱼账号的 Cookie

**重要**: 
- 添加账号时，账号 ID 必须与 OpenClaw 配置中的 `accountId` 一致
- Cookie 必须包含 `unb` 和 `_m_h5_tk` 字段

### 5. 启动

```bash
# 启动 Python 后端
python Start.py

# 重启 OpenClaw Gateway 使配置生效
openclaw gateway restart
```

## 🛠️ 可用工具

闲鱼插件注册了以下工具供 AI Agent 调用：

| 工具名称 | 说明 |
|---------|------|
| `xianyu_publish_product` | 发布单个商品到闲鱼 |
| `xianyu_batch_publish_products` | 批量发布多个商品 |
| `xianyu_get_orders` | 获取订单列表 |
| `xianyu_confirm_delivery` | 确认订单发货 |
| `xianyu_create_card` | 创建发货内容卡片 |
| `xianyu_create_delivery_rule` | 创建自动发货规则 |
| `xianyu_search_products` | 搜索闲鱼商品 |
| `xianyu_get_spider_products` | 获取已爬取的商品列表 |

### 商品发布示例

```
用户：帮我发布一个商品
Agent：好的，请提供商品信息...
[调用 xianyu_publish_product 工具]
```

**工具参数说明**：

```json
{
  "cookie_id": "2207836320265_1",  // 必填：账号 Cookie ID
  "title": "商品标题",              // 可选
  "description": "商品描述",        // 必填
  "price": 99.9,                   // 必填：价格（元）
  "images": ["/path/to/image.jpg"], // 必填：图片路径列表
  "category": "数码产品/手机",       // 可选
  "location": "北京市/朝阳区"        // 可选
}
```

## ⚠️ 商品发布注意事项

### 1. 规格选择问题

**问题描述**：发布页面有时会自动选中商品规格，导致发布按钮禁用。

**解决方案**：
- 当前代码已处理：自动跳过规格选择
- 如遇到问题，检查 `product_publisher_config.yml` 中的 `category_selector` 配置
- **不要使用** `button:has-text("添加规格类型")` 作为选择器，会误点添加规格按钮

### 2. 滑块验证

**现状**：闲鱼发布商品的滑块验证已升级为**双物体拼接**类型，需要拖动滑块使两个物体完整拼接。

**解决方案**：
- 方案 A：使用可见模式（`headless=False`），人工辅助完成验证
- 方案 B：接入第三方打码服务
- 方案 C：发布前手动完成验证

### 3. 发布验证

发布成功的判断依据：
1. 页面 URL 从 `/publish` 跳转到 `/item?id=xxx`
2. 能解析到 `product_id` 和 `product_url`

## 🔌 Bridge API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/bridge/messages` | GET (SSE) | 实时消息推送流 |
| `/api/bridge/send` | POST | 发送文本消息 |
| `/api/bridge/send-media` | POST | 发送图片消息 |
| `/api/bridge/accounts` | GET | 获取账号列表 |
| `/api/bridge/status` | GET | 获取桥接状态 |
| `/api/bridge/confirm-delivery` | POST | 确认发货 |
| `/api/bridge/publish/single` | POST | 发布单个商品 |
| `/api/bridge/publish/batch` | POST | 批量发布商品 |
| `/api/bridge/spider/search` | POST | 搜索商品 |
| `/api/bridge/logs` | GET | 获取后端日志 |

## 📁 项目结构

```
xianyu-openclaw-channel/
├── openclaw-plugin/           # OpenClaw 频道插件 (TypeScript)
│   ├── index.ts               # 插件入口，注册 channel + service + tools
│   └── src/
│       ├── channel.ts             # 频道定义
│       ├── bridge-client.ts       # Bridge API 客户端
│       └── ...
├── bridge_api.py              # Bridge API（Python 端 HTTP/SSE）
├── product_publisher.py       # 商品发布器（Playwright）
├── product_publisher_config.yml # 发布器配置
├── Start.py                   # Python 启动入口
├── XianyuAutoAsync.py         # 闲鱼 WebSocket 核心
└── reply_server.py            # FastAPI Web 服务
```

## ❓ 常见问题

### Q: 工具没有注册到 OpenClaw？

**A**: 检查以下几点：

1. **插件是否在 `plugins.allow` 列表中**：
```json
"plugins": {
  "allow": ["xianyu", ...]
}
```

2. **插件路径是否配置**：
```json
"plugins": {
  "load": {
    "paths": ["<扩展目录>/xianyu/openclaw-plugin"]
  }
}
```

3. **重启 Gateway**：
```bash
openclaw gateway restart
```

### Q: 收不到闲鱼消息？

**A**: 
1. 检查 Python 后端是否运行：`python Start.py`
2. 检查 `accountId` 是否与 Cookie ID 一致
3. 查看 SSE 连接日志

### Q: 商品发布失败？

**A**: 
1. 检查 Cookie 是否有效
2. 确认图片路径存在且格式正确
3. 查看后端日志：`GET /api/bridge/logs`
4. 使用可见模式测试：修改 `product_publisher.py` 中的 `headless=False`

### Q: Gateway 启动后 Python 进程没起来？

**A**: 
- 检查 `venv/` 是否存在
- 查看插件日志中的 `[bridge-process]` 前缀信息
- 确认系统 PATH 中有 python

### Q: 如何只用闲鱼自动回复，不用 OpenClaw？

**A**: 直接 `python Start.py`，访问 `http://localhost:8080` 使用原生管理界面。

## 📝 更新日志

### 2026-03-08
- 🐛 修复商品发布时误点"添加规格类型"按钮的问题
- ✨ 改进发布验证逻辑
- 📝 更新文档，添加工具注册说明

### 2026-03-07
- ✨ 添加商品发布 API 和工具
- ✨ 添加商品搜索功能
- ✨ 添加后端日志 API

## 📜 致谢

- [xianyu-auto-reply](https://github.com/HJYHJYHJY/xianyu-auto-reply) — 闲鱼自动回复核心
- [OpenClaw](https://github.com/nicepkg/openclaw) — AI Agent 框架
- [openclaw-channel-dingtalk](https://github.com/soimy/openclaw-channel-dingtalk) — 插件架构参考

## ⚖️ 声明

本项目仅供学习研究使用，严禁商业用途。使用者需遵守当地法律法规，使用风险自负。
