# 闲鱼商品发布工具使用示例

## 示例 1: 发布单个商品（基础）

**用户请求：**
> 帮我发布一个商品：二手 iPhone 14，价格 4500 元

**AI 调用：**

```json
{
  "tool": "xianyu_publish_product",
  "arguments": {
    "cookie_id": "account_001",
    "description": "二手 iPhone 14，128GB，成色 9 成新，无磕碰，功能正常。",
    "price": 4500.00,
    "images": []
  }
}
```

## 示例 2: 发布单个商品（完整信息）

**用户请求：**
> 发布一个全新的 MacBook Pro，原价 12999，现价 11999，位置在上海

**AI 调用：**

```json
{
  "tool": "xianyu_publish_product",
  "arguments": {
    "cookie_id": "account_001",
    "description": "全新未拆封 MacBook Pro 14 英寸，M3 芯片，16GB 内存，512GB 存储。原价购买，因工作需要换 Windows 笔记本出售。",
    "price": 11999.00,
    "images": ["/uploads/images/macbook1.jpg", "/uploads/images/macbook2.jpg"],
    "category": "电脑/办公",
    "location": "上海市浦东新区",
    "original_price": 12999.00,
    "stock": 1
  }
}
```

## 示例 3: 批量发布商品

**用户请求：**
> 批量发布 3 个商品：AirPods Pro 1599 元、iPad Air 3999 元、Apple Watch 2499 元

**AI 调用：**

```json
{
  "tool": "xianyu_batch_publish_products",
  "arguments": {
    "cookie_id": "account_001",
    "products": [
      {
        "description": "全新 AirPods Pro 2，未拆封，支持主动降噪和空间音频。",
        "price": 1599.00,
        "images": ["/uploads/images/airpods1.jpg"],
        "original_price": 1899.00
      },
      {
        "description": "二手 iPad Air 5，128GB，成色 95 新，无划痕，功能完好。",
        "price": 3999.00,
        "images": ["/uploads/images/ipad1.jpg", "/uploads/images/ipad2.jpg"],
        "original_price": 4799.00
      },
      {
        "description": "Apple Watch Series 9，45mm，GPS 版本，9 成新，配原装表带。",
        "price": 2499.00,
        "images": ["/uploads/images/watch1.jpg"],
        "original_price": 3199.00
      }
    ]
  }
}
```

## 示例 4: 从 Excel 批量发布

**用户请求：**
> 从 Excel 文件读取商品信息并批量发布

**AI 工作流：**

1. 读取 Excel 文件
2. 解析商品信息
3. 调用批量发布工具

```json
{
  "tool": "xianyu_batch_publish_products",
  "arguments": {
    "cookie_id": "account_001",
    "products": [
      {
        "description": "从 Excel 读取的商品描述 1",
        "price": 99.99,
        "images": ["/uploads/images/product1.jpg"]
      },
      {
        "description": "从 Excel 读取的商品描述 2",
        "price": 199.99,
        "images": ["/uploads/images/product2.jpg"]
      }
    ]
  }
}
```

## 示例 5: 错误处理

**场景：账号不存在**

```json
{
  "success": false,
  "error": "账号不存在: invalid_account_id"
}
```

**场景：Cookie 无效**

```json
{
  "success": false,
  "error": "Cookie 登录失败"
}
```

**场景：批量发布部分失败**

```json
{
  "success": true,
  "message": "批量发布完成: 成功 2/3",
  "results": {
    "total": 3,
    "success": 2,
    "failed": 1,
    "details": [
      {
        "index": 0,
        "success": true,
        "message": "发布成功"
      },
      {
        "index": 1,
        "success": false,
        "message": "图片上传失败"
      },
      {
        "index": 2,
        "success": true,
        "message": "发布成功"
      }
    ]
  }
}
```

## 最佳实践

### 1. 商品描述

- 详细描述商品状态（全新/二手/成色）
- 说明商品规格（型号、容量、颜色等）
- 提及购买渠道和原因
- 标注功能是否正常

### 2. 图片上传

- 至少上传 1 张清晰的商品图片
- 多角度展示商品状态
- 图片路径必须是服务器可访问的路径

### 3. 价格设置

- 参考市场价格
- 如果是二手商品，根据成色合理定价
- 可以设置 original_price 显示原价

### 4. 批量发布

- 建议每批不超过 10 个商品
- 检查每个商品信息的完整性
- 处理批量发布的错误结果

### 5. 账号管理

- 确保 cookie_id 有效
- 定期更新账号 Cookie
- 检查账号权限
