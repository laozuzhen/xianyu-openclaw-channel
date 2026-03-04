---
name: xianyu-product
description: |
  闲鱼商品发布工具。支持单个商品发布和批量发布。当用户提到发布商品、上架商品、批量发布时激活。
---

# 闲鱼商品发布工具

提供两个工具用于闲鱼商品发布操作。

## 工具列表

### 1. xianyu_publish_product - 发布单个商品

发布单个商品到闲鱼平台。

**参数：**

```json
{
  "cookie_id": "账号ID（必填）",
  "title": "商品标题（可选，闲鱼页面没有标题输入框）",
  "description": "商品描述（必填）",
  "price": 99.99,
  "images": ["图片路径1", "图片路径2"],
  "category": "分类路径（可选）",
  "location": "位置（可选）",
  "original_price": 199.99,
  "stock": 1
}
```

**示例：**

```json
{
  "cookie_id": "account_001",
  "description": "全新未拆封的 iPhone 15 Pro，256GB，深空黑色。原价购买，因换新机出售。",
  "price": 7999.00,
  "images": ["/uploads/images/iphone1.jpg", "/uploads/images/iphone2.jpg"],
  "category": "手机/数码",
  "location": "北京市朝阳区",
  "original_price": 8999.00,
  "stock": 1
}
```

**返回：**

```json
{
  "success": true,
  "message": "商品发布成功",
  "product": {
    "title": "商品标题",
    "price": 99.99
  }
}
```

### 2. xianyu_batch_publish_products - 批量发布商品

批量发布多个商品到闲鱼平台。

**参数：**

```json
{
  "cookie_id": "账号ID（必填）",
  "products": [
    {
      "title": "商品1标题（可选）",
      "description": "商品1描述（必填）",
      "price": 99.99,
      "images": ["图片路径1", "图片路径2"],
      "category": "分类路径（可选）",
      "location": "位置（可选）",
      "original_price": 199.99,
      "stock": 1
    },
    {
      "title": "商品2标题（可选）",
      "description": "商品2描述（必填）",
      "price": 199.99,
      "images": ["图片路径3", "图片路径4"]
    }
  ]
}
```

**示例：**

```json
{
  "cookie_id": "account_001",
  "products": [
    {
      "description": "全新 AirPods Pro 2，未拆封。",
      "price": 1599.00,
      "images": ["/uploads/images/airpods1.jpg"],
      "original_price": 1899.00
    },
    {
      "description": "二手 iPad Air 5，128GB，成色 95 新。",
      "price": 3999.00,
      "images": ["/uploads/images/ipad1.jpg", "/uploads/images/ipad2.jpg"],
      "original_price": 4799.00
    }
  ]
}
```

**返回：**

```json
{
  "success": true,
  "message": "批量发布完成: 成功 2/2",
  "results": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "details": [
      {
        "index": 0,
        "success": true,
        "message": "发布成功"
      },
      {
        "index": 1,
        "success": true,
        "message": "发布成功"
      }
    ]
  }
}
```

## 使用流程

### 发布单个商品

1. 准备商品信息（描述、价格、图片等）
2. 调用 `xianyu_publish_product` 工具
3. 等待发布结果

### 批量发布商品

1. 准备多个商品信息列表
2. 调用 `xianyu_batch_publish_products` 工具
3. 查看批量发布结果统计

## 注意事项

- **cookie_id**: 必须是有效的闲鱼账号 ID，且账号 Cookie 必须有效
- **description**: 商品描述是必填项，建议详细描述商品状态、规格等信息
- **price**: 价格必须大于 0
- **images**: 图片路径列表，建议至少上传 1 张图片
- **title**: 闲鱼页面没有标题输入框，此字段可选
- **权限**: 需要用户登录并拥有对应账号的操作权限

## API 端点

- 单个发布: `POST /api/products/publish`
- 批量发布: `POST /api/products/batch-publish`

## 配置

```yaml
channels:
  xianyu:
    tools:
      product: true  # 默认启用
```

## 权限要求

- 用户必须登录
- 用户必须拥有对应账号的操作权限
- 账号 Cookie 必须有效
