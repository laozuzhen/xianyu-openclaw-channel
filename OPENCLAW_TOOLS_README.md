# 闲鱼 OpenClaw 工具集成指南

本文档说明如何在 OpenClaw 中使用闲鱼商品发布工具。

## 📦 已注册的工具

### 1. xianyu_publish_product - 发布单个商品

发布单个商品到闲鱼平台。

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cookie_id | string | ✅ | 闲鱼账号 ID |
| title | string | ❌ | 商品标题（闲鱼页面无标题输入框） |
| description | string | ✅ | 商品描述 |
| price | number | ✅ | 商品价格 |
| images | string[] | ✅ | 图片路径列表 |
| category | string | ❌ | 分类路径 |
| location | string | ❌ | 位置 |
| original_price | number | ❌ | 原价 |
| stock | number | ❌ | 库存（默认 1） |

**示例：**

```json
{
  "cookie_id": "account_001",
  "description": "全新未拆封的 iPhone 15 Pro，256GB，深空黑色。",
  "price": 7999.00,
  "images": ["/uploads/images/iphone1.jpg", "/uploads/images/iphone2.jpg"],
  "original_price": 8999.00
}
```

### 2. xianyu_batch_publish_products - 批量发布商品

批量发布多个商品到闲鱼平台。

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cookie_id | string | ✅ | 闲鱼账号 ID |
| products | array | ✅ | 商品列表（每个商品的参数同上） |

**示例：**

```json
{
  "cookie_id": "account_001",
  "products": [
    {
      "description": "全新 AirPods Pro 2，未拆封。",
      "price": 1599.00,
      "images": ["/uploads/images/airpods1.jpg"]
    },
    {
      "description": "二手 iPad Air 5，128GB，成色 95 新。",
      "price": 3999.00,
      "images": ["/uploads/images/ipad1.jpg", "/uploads/images/ipad2.jpg"]
    }
  ]
}
```

## 🚀 快速开始

### 1. 安装插件

```bash
# 进入 OpenClaw 插件目录
cd xianyu-super-butler-repo/openclaw-plugin

# 安装依赖
npm install

# 构建插件
npm run build
```

### 2. 配置 OpenClaw

在 OpenClaw 配置文件中添加闲鱼插件：

```json
{
  "plugins": [
    {
      "id": "xianyu",
      "path": "./xianyu-super-butler-repo/openclaw-plugin",
      "enabled": true
    }
  ]
}
```

### 3. 使用工具

在 OpenClaw 对话中，AI 会自动识别商品发布需求并调用相应工具。

**示例对话：**

> **用户：** 帮我发布一个商品：二手 iPhone 14，价格 4500 元
>
> **AI：** 好的，我来帮你发布这个商品。
>
> [调用 xianyu_publish_product 工具]
>
> **AI：** 商品发布成功！

## 📝 使用场景

### 场景 1: 单个商品发布

**用户需求：**
- 发布一个商品
- 提供商品描述、价格、图片

**AI 行为：**
- 调用 `xianyu_publish_product` 工具
- 返回发布结果

### 场景 2: 批量商品发布

**用户需求：**
- 批量发布多个商品
- 提供商品列表

**AI 行为：**
- 调用 `xianyu_batch_publish_products` 工具
- 返回批量发布统计结果

### 场景 3: 从 Excel 批量发布

**用户需求：**
- 从 Excel 文件读取商品信息
- 批量发布到闲鱼

**AI 行为：**
1. 读取 Excel 文件（使用 Excel MCP 工具）
2. 解析商品信息
3. 调用 `xianyu_batch_publish_products` 工具
4. 返回发布结果

## 🔧 API 端点

工具通过以下 API 端点与后端通信：

- **单个发布**: `POST http://localhost:8000/api/products/publish`
- **批量发布**: `POST http://localhost:8000/api/products/batch-publish`

确保后端服务正在运行：

```bash
cd xianyu-super-butler-repo
python reply_server.py
```

## ⚠️ 注意事项

### 1. 账号权限

- 用户必须登录系统
- 用户必须拥有对应账号的操作权限
- 账号 Cookie 必须有效

### 2. 图片路径

- 图片路径必须是服务器可访问的路径
- 建议使用 `/uploads/images/` 目录
- 支持多张图片上传

### 3. 商品描述

- 描述是必填项
- 建议详细描述商品状态、规格等信息
- 避免使用违规词汇

### 4. 批量发布

- 建议每批不超过 10 个商品
- 检查每个商品信息的完整性
- 处理批量发布的错误结果

## 🐛 错误处理

### 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| 账号不存在 | cookie_id 无效 | 检查账号 ID 是否正确 |
| Cookie 登录失败 | Cookie 过期或无效 | 重新登录获取 Cookie |
| 图片上传失败 | 图片路径无效 | 检查图片路径是否可访问 |
| 无权操作此账号 | 用户无权限 | 检查账号所有权 |

### 错误响应示例

```json
{
  "success": false,
  "error": "账号不存在: invalid_account_id"
}
```

## 📚 更多文档

- [SKILL.md](./openclaw-plugin/skills/xianyu-product/SKILL.md) - 工具详细说明
- [EXAMPLES.md](./openclaw-plugin/skills/xianyu-product/EXAMPLES.md) - 使用示例
- [README.md](./README.md) - 项目主文档

## 🤝 贡献

如有问题或建议，请提交 Issue 或 Pull Request。

## 📄 许可证

MIT License
