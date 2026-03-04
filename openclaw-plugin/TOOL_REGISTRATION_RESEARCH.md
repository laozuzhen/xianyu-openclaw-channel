# OpenClaw 工具注册机制研究总结

## 研究目标

研究现有 OpenClaw 插件（飞书、微信、钉钉）的工具注册方式，为闲鱼插件实现商品发布工具注册。

## 研究对象

- `clawdbot-feishu-repo` - 飞书插件
- `openclaw-china-repo` - 微信插件
- `openclaw-channel-dingtalk-repo` - 钉钉插件
- `xianyu-super-butler-repo/openclaw-plugin` - 闲鱼插件（现有实现）

## 核心发现

### 1. 工具注册位置

**工具在插件入口文件 `index.ts` 的 `register()` 函数中注册。**

```typescript
const plugin: XianyuPluginModule = {
  id: "xianyu",
  name: "Xianyu Channel",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    // 1. 注册频道
    api.registerChannel({ plugin: xianyuPlugin });
    
    // 2. 注册工具
    api.registerTool({
      name: "tool_name",
      label: "工具显示名称",
      description: "工具描述",
      parameters: { /* JSON Schema */ },
      async execute(_id: string, params: unknown) {
        // 工具执行逻辑
      }
    });
  }
};
```

### 2. 工具注册 API

**`api.registerTool()` 接口定义：**

```typescript
interface ToolDefinition {
  name: string;              // 工具唯一标识（如：xianyu_publish_product）
  label: string;             // 工具显示名称
  description: string;       // 工具描述（AI 会看到）
  parameters: {              // JSON Schema 格式的参数定义
    type: "object";
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
    required?: string[];
  };
  async execute(
    _id: string,             // 工具调用 ID
    params: unknown          // 参数对象
  ): Promise<{
    content: Array<{
      type: "text";
      text: string;
    }>;
    isError?: boolean;
    details: {};
  }>;
}
```

### 3. 后端 API 调用模式

**闲鱼插件使用 `fetch` 直接调用后端 Bridge API：**

```typescript
async execute(_id: string, params: unknown) {
  const { orderId, accountId } = params as any;
  try {
    const response = await fetch(`http://localhost:8080/api/bridge/confirm-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, accountId: accountId || "default" }),
    });
    const result = await response.json();
    return { 
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }], 
      details: {} 
    };
  } catch (e: any) {
    return { 
      content: [{ type: "text", text: `Error: ${e.message}` }], 
      isError: true, 
      details: {} 
    };
  }
}
```

### 4. 现有闲鱼插件工具

闲鱼插件已注册以下工具：

| 工具名称 | 功能 | 后端 API |
|---------|------|---------|
| `xianyu_confirm_delivery` | 确认发货 | `POST /api/bridge/confirm-delivery` |
| `xianyu_get_orders` | 获取订单 | `GET /api/orders` |
| `xianyu_create_product` | 创建商品 | `POST /api/bridge/products` |
| `xianyu_create_card` | 创建发货卡片 | `POST /api/bridge/cards` |
| `xianyu_create_delivery_rule` | 创建发货规则 | `POST /api/bridge/delivery-rules` |

### 5. 后端 API 现状

**商品发布相关 API：**

- ✅ `POST /api/bridge/products` - 已定义但未实现（返回 "Product creation endpoint ready"）
- ✅ `GET /api/bridge/products` - 已定义但未实现（返回空列表）

**商品发布器实现：**

- ✅ `product_publisher.py` - 完整的 Playwright 自动化发布实现
- ✅ `XianyuProductPublisher` 类 - 支持单个商品发布
- ✅ `ProductInfo` 数据类 - 商品信息结构

**缺失部分：**

- ❌ Bridge API 未调用 `product_publisher.py`
- ❌ 批量发布接口未实现

## 实现方案

### 方案 1：直接调用 product_publisher（推荐）

**优点：**
- 复用现有完整实现
- 功能完善（防检测、重试、截图）
- 配置化（支持热加载）

**实现步骤：**

1. 在 `bridge_api.py` 中导入 `XianyuProductPublisher`
2. 修改 `POST /api/bridge/products` 实现
3. 添加 `POST /api/bridge/products/batch` 批量发布接口
4. 在 `index.ts` 中注册工具

### 方案 2：简化版 API（不推荐）

直接在 Bridge API 中实现简化的发布逻辑，但会失去现有的防检测、重试等功能。

## 工具参数设计

### 工具 1：发布单个商品

```typescript
{
  name: "xianyu_publish_product",
  label: "发布商品",
  description: "发布单个商品到闲鱼",
  parameters: {
    type: "object",
    properties: {
      cookie_id: { type: "string", description: "账号 Cookie ID" },
      title: { type: "string", description: "商品标题（可选，AI 生成）" },
      description: { type: "string", description: "商品描述" },
      price: { type: "number", description: "商品价格" },
      images: { 
        type: "array", 
        items: { type: "string" },
        description: "商品图片 URL 列表" 
      },
      category: { type: "string", description: "商品分类（可选）" },
      location: { type: "string", description: "发货地（可选）" },
      original_price: { type: "number", description: "原价（可选）" },
      stock: { type: "number", description: "库存（可选，默认 1）" }
    },
    required: ["cookie_id", "description", "price", "images"]
  }
}
```

### 工具 2：批量发布商品

```typescript
{
  name: "xianyu_batch_publish_products",
  label: "批量发布商品",
  description: "批量发布多个商品到闲鱼",
  parameters: {
    type: "object",
    properties: {
      cookie_id: { type: "string", description: "账号 Cookie ID" },
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            images: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            location: { type: "string" },
            original_price: { type: "number" },
            stock: { type: "number" }
          },
          required: ["description", "price", "images"]
        },
        description: "商品列表"
      }
    },
    required: ["cookie_id", "products"]
  }
}
```

## 后端 API 设计

### API 1：发布单个商品

```
POST /api/publish/single

Request Body:
{
  "cookie_id": "account_1",
  "title": "商品标题",
  "description": "商品描述",
  "price": 99.99,
  "images": ["path/to/image1.jpg", "path/to/image2.jpg"],
  "category": "数码产品/手机",
  "location": "北京市/朝阳区",
  "original_price": 199.99,
  "stock": 1
}

Response:
{
  "ok": true,
  "product_id": "123456",
  "product_url": "https://www.goofish.com/item/123456"
}
```

### API 2：批量发布商品

```
POST /api/publish/batch

Request Body:
{
  "cookie_id": "account_1",
  "products": [
    {
      "title": "商品1",
      "description": "描述1",
      "price": 99.99,
      "images": ["path/to/image1.jpg"]
    },
    {
      "title": "商品2",
      "description": "描述2",
      "price": 199.99,
      "images": ["path/to/image2.jpg"]
    }
  ]
}

Response:
{
  "ok": true,
  "results": [
    {
      "success": true,
      "product_id": "123456",
      "product_url": "https://www.goofish.com/item/123456"
    },
    {
      "success": false,
      "error": "图片上传失败"
    }
  ],
  "total": 2,
  "success_count": 1,
  "failed_count": 1
}
```

## 关键注意事项

1. **Cookie 管理**：确保 `cookie_id` 对应的 Cookie 有效且已登录
2. **图片路径**：支持本地路径和 URL，需要处理路径解析
3. **错误处理**：完善的错误信息返回（验证码、登录失败、上传失败等）
4. **进度回调**：支持 SSE 推送发布进度（可选）
5. **并发控制**：批量发布时避免触发反爬机制
6. **配置热加载**：支持运行时修改 `product_publisher_config.yml`

## 参考代码位置

- **工具注册示例**：`xianyu-super-butler-repo/openclaw-plugin/index.ts` (第 24-176 行)
- **Bridge API 示例**：`xianyu-super-butler-repo/bridge_api.py` (第 1-300 行)
- **商品发布器**：`xianyu-super-butler-repo/product_publisher.py` (完整实现)
- **BridgeClient**：`xianyu-super-butler-repo/openclaw-plugin/src/bridge-client.ts` (HTTP 客户端)

## 下一步行动

1. ✅ 生成研究总结文档
2. ✅ 在 `bridge_api.py` 中实现商品发布 API
3. ✅ 在 `index.ts` 中注册商品发布工具
4. ⏳ 测试工具调用流程
5. ⏳ 更新 README 文档

## 实现总结

### 已完成的工作

#### 1. 后端 API 实现（`bridge_api.py`）

**新增接口：**

- `POST /api/publish/single` - 发布单个商品
  - 从 Cookie Manager 获取账号 Cookie
  - 初始化 `XianyuProductPublisher`
  - 执行登录和商品发布
  - 返回商品 ID 和 URL

- `POST /api/publish/batch` - 批量发布商品
  - 复用同一个浏览器会话
  - 逐个发布商品列表
  - 返回每个商品的发布结果统计

**关键实现细节：**

```python
# 单个商品发布
publisher = XianyuProductPublisher(
    cookie_id=body.cookie_id,
    cookies_str=cookies_str,
    headless=True
)
await publisher.init_browser()
await publisher.login_with_cookie()
success, product_id, product_url = await publisher.publish_product(product)
await publisher.close()
```

#### 2. 工具注册实现（`index.ts`）

**新增工具：**

1. **`xianyu_publish_product`** - 发布单个商品
   - 参数：cookie_id, title, description, price, images, category, location, original_price, stock
   - 必填：cookie_id, description, price, images
   - 返回：友好的成功/失败消息

2. **`xianyu_batch_publish_products`** - 批量发布商品
   - 参数：cookie_id, products[]
   - 必填：cookie_id, products
   - 返回：批量发布统计和详细结果

**工具调用示例：**

```typescript
// AI 可以这样调用工具
{
  "tool": "xianyu_publish_product",
  "parameters": {
    "cookie_id": "account_1",
    "title": "全新 iPhone 15 Pro",
    "description": "全新未拆封，支持验机",
    "price": 7999,
    "images": ["/path/to/image1.jpg", "/path/to/image2.jpg"],
    "category": "数码产品/手机/苹果",
    "location": "北京市/朝阳区",
    "original_price": 8999,
    "stock": 1
  }
}
```

### 技术亮点

1. **完整的错误处理**：
   - Cookie 不存在检查
   - 登录失败处理
   - 发布失败回滚
   - 详细的错误日志

2. **复用现有实现**：
   - 直接使用 `product_publisher.py` 的完整功能
   - 保留防检测、重试、截图等特性
   - 支持配置热加载

3. **友好的返回格式**：
   - 成功时显示商品 ID 和链接
   - 失败时显示具体错误原因
   - 批量发布时显示统计信息

### 测试建议

1. **单元测试**：
   - 测试 API 参数验证
   - 测试 Cookie 不存在的情况
   - 测试发布失败的错误处理

2. **集成测试**：
   - 使用真实 Cookie 测试单个商品发布
   - 测试批量发布（2-3 个商品）
   - 测试图片上传功能

3. **端到端测试**：
   - 在 OpenClaw 中调用工具
   - 验证 AI 能否正确使用工具
   - 检查返回消息的可读性

### 已知限制

1. **图片路径**：目前仅支持本地路径，URL 下载功能需要在 `product_publisher.py` 中实现
2. **并发限制**：批量发布时串行执行，避免触发反爬
3. **浏览器资源**：每次发布都会启动新的浏览器实例，可考虑复用

### 后续优化方向

1. **进度推送**：通过 SSE 推送发布进度到前端
2. **图片预处理**：支持 URL 下载、图片压缩、水印添加
3. **智能标题生成**：集成 AI 根据描述生成吸引人的标题
4. **发布模板**：支持保存和复用商品发布模板
5. **定时发布**：支持设置发布时间，自动在指定时间发布

---

**实现完成时间**：2025-01-XX  
**实现者**：Kiro AI Assistant
