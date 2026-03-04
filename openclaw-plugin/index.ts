/**
 * Xianyu (闲鱼) Channel Plugin entry point for OpenClaw.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { xianyuPlugin } from "./src/channel";
import { BridgeProcessManager } from "./src/bridge-process";
import { setXianyuRuntime } from "./src/runtime";
import type { XianyuPluginModule } from "./src/types";

const bridgeManager = new BridgeProcessManager();

const plugin: XianyuPluginModule = {
  id: "xianyu",
  name: "Xianyu Channel",
  description: "Xianyu (闲鱼) messaging channel via Bridge mode",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    setXianyuRuntime(api.runtime);
    api.registerChannel({ plugin: xianyuPlugin });

    // 注册确认发货工具
    api.registerTool({
      name: "xianyu_confirm_delivery",
      label: "确认发货",
      description: "确认闲鱼订单发货",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "订单ID" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
        required: ["orderId"],
      },
      async execute(_id: string, params: unknown) {
        const { orderId, accountId } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/confirm-delivery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, accountId: accountId || "default" }),
          });
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册获取订单列表工具
    api.registerTool({
      name: "xianyu_get_orders",
      label: "获取订单",
      description: "获取闲鱼订单列表",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "订单状态筛选（可选）" },
          limit: { type: "number", description: "返回订单数量（可选）" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
      },
      async execute(_id: string, params: unknown) {
        const { status, limit, accountId } = params as any;
        try {
          const queryParams = new URLSearchParams();
          if (status) queryParams.set("status", status);
          if (limit) queryParams.set("limit", String(limit));
          queryParams.set("accountId", accountId || "default");
          const response = await fetch(`http://localhost:8080/api/orders?${queryParams}`);
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册创建商品工具
    api.registerTool({
      name: "xianyu_create_product",
      label: "创建商品",
      description: "在闲鱼创建并发布商品",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "商品标题" },
          price: { type: "number", description: "商品价格" },
          description: { type: "string", description: "商品描述（可选）" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
        required: ["title", "price"],
      },
      async execute(_id: string, params: unknown) {
        const { title, price, description, accountId } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, price, description, accountId: accountId || "default" }),
          });
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册创建发货卡片工具
    api.registerTool({
      name: "xianyu_create_card",
      label: "创建发货卡片",
      description: "创建闲鱼发货内容卡片",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "卡片名称" },
          type: { type: "string", description: "卡片类型(text/image/api)" },
          content: { type: "string", description: "卡片内容" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
        required: ["name", "type", "content"],
      },
      async execute(_id: string, params: unknown) {
        const { name, type, content, accountId } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/cards`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, type, content, accountId: accountId || "default" }),
          });
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册创建发货规则工具
    api.registerTool({
      name: "xianyu_create_delivery_rule",
      label: "创建发货规则",
      description: "创建闲鱼自动发货规则",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "触发关键词" },
          cardId: { type: "number", description: "关联的卡片ID" },
          enabled: { type: "boolean", description: "是否启用" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
        required: ["keyword", "cardId"],
      },
      async execute(_id: string, params: unknown) {
        const { keyword, cardId, enabled, accountId } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/delivery-rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword, cardId, enabled: enabled ?? true, accountId: accountId || "default" }),
          });
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册发布单个商品工具
    api.registerTool({
      name: "xianyu_publish_product",
      label: "发布商品",
      description: `发布单个商品到闲鱼平台。支持自动填写商品信息、上传图片、选择分类和位置。

⚠️ 使用前提:
- 必须有有效的账号 Cookie（包含 unb 和 _m_h5_tk 字段）
- 图片必须是本地文件路径（不支持 URL）
- 确保图片文件存在且格式正确（jpg/png/gif）

📝 使用示例:
{
  "cookie_id": "user123",
  "title": "iPhone 15 Pro Max 256GB 深空黑",
  "description": "全新未拆封，国行正品，支持验机。配件齐全，包含充电线、说明书等。",
  "price": 8999,
  "images": [
    "/path/to/front.jpg",
    "/path/to/back.jpg",
    "/path/to/box.jpg"
  ],
  "category": "数码产品/手机/苹果",
  "location": "北京市/朝阳区",
  "original_price": 9999,
  "stock": 1
}

💡 注意事项:
- 标题建议包含品牌、型号、规格等关键信息
- 描述要详细，包含商品状态、配件、售后等信息
- 图片建议 3-9 张，展示商品各个角度
- 价格单位为元（人民币）
- 如果图片上传失败率超过 30%，发布将被终止
- 分类和位置虽然可选，但建议填写以提高商品曝光率`,
      parameters: {
        type: "object",
        properties: {
          cookie_id: { 
            type: "string", 
            description: "账号 Cookie ID（必填）" 
          },
          title: { 
            type: "string", 
            description: "商品标题（可选，如不提供则使用默认标题）" 
          },
          description: { 
            type: "string", 
            description: "商品描述（必填）" 
          },
          price: { 
            type: "number", 
            description: "商品价格（必填，单位：元）" 
          },
          images: { 
            type: "array", 
            items: { type: "string" },
            description: "商品图片路径列表（必填，支持本地路径或 URL）" 
          },
          category: { 
            type: "string", 
            description: "商品分类（可选，如：数码产品/手机/苹果）" 
          },
          location: { 
            type: "string", 
            description: "发货地（可选，如：北京市/朝阳区）" 
          },
          original_price: { 
            type: "number", 
            description: "原价（可选，用于显示折扣）" 
          },
          stock: { 
            type: "number", 
            description: "库存数量（可选，默认 1）" 
          },
        },
        required: ["cookie_id", "description", "price", "images"],
      },
      async execute(_id: string, params: unknown) {
        const { cookie_id, title, description, price, images, category, location, original_price, stock } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/publish/single`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cookie_id, 
              title, 
              description, 
              price, 
              images, 
              category, 
              location, 
              original_price, 
              stock 
            }),
          });
          const result = await response.json();
          
          if (result.ok) {
            return { 
              content: [{ 
                type: "text", 
                text: `✅ 商品发布成功！\n\n商品ID: ${result.product_id}\n商品链接: ${result.product_url || '暂无'}` 
              }], 
              details: {} 
            };
          } else {
            return { 
              content: [{ 
                type: "text", 
                text: `❌ 商品发布失败: ${result.error}` 
              }], 
              isError: true, 
              details: {} 
            };
          }
        } catch (e: any) {
          return { 
            content: [{ 
              type: "text", 
              text: `❌ 请求失败: ${e.message}` 
            }], 
            isError: true, 
            details: {} 
          };
        }
      },
    });

    // 注册批量发布商品工具
    api.registerTool({
      name: "xianyu_batch_publish_products",
      label: "批量发布商品",
      description: `批量发布多个商品到闲鱼平台。适用于需要一次性发布多个商品的场景。

⚠️ 使用前提:
- 必须有有效的账号 Cookie
- 所有图片必须是本地文件路径
- 建议每批不超过 10 个商品

📝 使用示例:
{
  "cookie_id": "user123",
  "products": [
    {
      "title": "iPhone 15 Pro Max",
      "description": "全新未拆封，国行正品",
      "price": 8999,
      "images": ["/path/to/iphone1.jpg", "/path/to/iphone2.jpg"],
      "category": "数码产品/手机/苹果",
      "location": "北京市/朝阳区"
    },
    {
      "title": "MacBook Pro M3",
      "description": "2024 款，16GB 内存",
      "price": 15999,
      "images": ["/path/to/mac1.jpg", "/path/to/mac2.jpg"],
      "category": "数码产品/电脑/苹果",
      "location": "北京市/朝阳区"
    }
  ]
}

💡 注意事项:
- 批量发布会依次发布每个商品，不是并行发布
- 单个商品失败不会影响其他商品的发布
- 发布过程可能需要较长时间（每个商品约 30-60 秒）
- 建议在发布前检查所有图片路径是否正确
- 可以通过返回结果查看每个商品的发布状态`,
      parameters: {
        type: "object",
        properties: {
          cookie_id: { 
            type: "string", 
            description: "账号 Cookie ID（必填）" 
          },
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "商品标题（可选）" },
                description: { type: "string", description: "商品描述（必填）" },
                price: { type: "number", description: "商品价格（必填）" },
                images: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "商品图片路径列表（必填）" 
                },
                category: { type: "string", description: "商品分类（可选）" },
                location: { type: "string", description: "发货地（可选）" },
                original_price: { type: "number", description: "原价（可选）" },
                stock: { type: "number", description: "库存数量（可选）" },
              },
              required: ["description", "price", "images"],
            },
            description: "商品列表（必填）"
          }
        },
        required: ["cookie_id", "products"],
      },
      async execute(_id: string, params: unknown) {
        const { cookie_id, products } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/publish/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie_id, products }),
          });
          const result = await response.json();
          
          if (result.ok) {
            const summary = `✅ 批量发布完成！\n\n总数: ${result.total}\n成功: ${result.success_count}\n失败: ${result.failed_count}\n\n详细结果:\n`;
            const details = result.results.map((r: any, i: number) => {
              if (r.success) {
                return `${i+1}. ✅ 成功 - ID: ${r.product_id}, URL: ${r.product_url || '暂无'}`;
              } else {
                return `${i+1}. ❌ 失败 - ${r.error}`;
              }
            }).join('\n');
            
            return { 
              content: [{ 
                type: "text", 
                text: summary + details 
              }], 
              details: {} 
            };
          } else {
            return { 
              content: [{ 
                type: "text", 
                text: `❌ 批量发布失败: ${result.error}` 
              }], 
              isError: true, 
              details: {} 
            };
          }
        } catch (e: any) {
          return { 
            content: [{ 
              type: "text", 
              text: `❌ 请求失败: ${e.message}` 
            }], 
            isError: true, 
            details: {} 
          };
        }
      },
    });

    // 注册商品搜索工具
    api.registerTool({
      name: "xianyu_search_products",
      label: "搜索商品",
      description: "在闲鱼平台搜索商品，返回商品列表。可用于市场调研、竞品分析、价格监控等场景。",
      parameters: {
        type: "object",
        properties: {
          cookie_id: {
            type: "string",
            description: "账号 Cookie ID（必填）"
          },
          keyword: {
            type: "string",
            description: "搜索关键词（必填）"
          },
          max_pages: {
            type: "number",
            description: "最大爬取页数（可选，默认1页，建议不超过5页）"
          }
        },
        required: ["cookie_id", "keyword"],
      },
      async execute(_id: string, params: unknown) {
        const { cookie_id, keyword, max_pages } = params as any;
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/spider/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cookie_id, 
              keyword, 
              max_pages: max_pages || 1 
            }),
          });
          const result = await response.json();

          if (result.ok) {
            const summary = `✅ 搜索完成！\n\n关键词: ${result.keyword}\n总结果数: ${result.total_results}\n新增记录: ${result.new_records}\n\n`;
            
            if (result.new_records > 0) {
              return {
                content: [{
                  type: "text",
                  text: summary + `新增商品ID: ${result.new_record_ids.join(', ')}\n\n💡 提示：可以使用 xianyu_get_spider_products 工具查看详细商品信息。`
                }],
                details: {}
              };
            } else {
              return {
                content: [{
                  type: "text",
                  text: summary + `⚠️ 没有新增商品（可能已存在于数据库中）`
                }],
                details: {}
              };
            }
          } else {
            return {
              content: [{
                type: "text",
                text: `❌ 搜索失败: ${result.error}`
              }],
              isError: true,
              details: {}
            };
          }
        } catch (e: any) {
          return {
            content: [{
              type: "text",
              text: `❌ 请求失败: ${e.message}`
            }],
            isError: true,
            details: {}
          };
        }
      },
    });

    // 注册获取爬虫商品列表工具
    api.registerTool({
      name: "xianyu_get_spider_products",
      label: "获取爬虫商品",
      description: "获取已爬取的闲鱼商品列表，支持分页查询。",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "number",
            description: "页码（可选，默认1）"
          },
          limit: {
            type: "number",
            description: "每页数量（可选，默认20）"
          }
        },
      },
      async execute(_id: string, params: unknown) {
        const { page, limit } = params as any;
        try {
          const queryParams = new URLSearchParams();
          if (page) queryParams.set("page", String(page));
          if (limit) queryParams.set("limit", String(limit));
          
          const response = await fetch(`http://localhost:8080/api/bridge/spider/products?${queryParams}`);
          const result = await response.json();

          if (result.ok) {
            const summary = `✅ 查询成功！\n\n总数: ${result.total}\n当前页: ${result.page}\n每页数量: ${result.limit}\n\n`;
            
            if (result.products.length > 0) {
              const productList = result.products.map((p: any, i: number) => {
                return `${i+1}. ${p.title}\n   价格: ${p.price}\n   地区: ${p.area}\n   卖家: ${p.seller}\n   链接: ${p.link}`;
              }).join('\n\n');
              
              return {
                content: [{
                  type: "text",
                  text: summary + productList
                }],
                details: {}
              };
            } else {
              return {
                content: [{
                  type: "text",
                  text: summary + `⚠️ 暂无商品数据`
                }],
                details: {}
              };
            }
          } else {
            return {
              content: [{
                type: "text",
                text: `❌ 查询失败: ${result.error}`
              }],
              isError: true,
              details: {}
            };
          }
        } catch (e: any) {
          return {
            content: [{
              type: "text",
              text: `❌ 请求失败: ${e.message}`
            }],
            isError: true,
            details: {}
          };
        }
      },
    });

    // 注册 Bridge 进程服务
    (api as any).registerService({
      id: "xianyu-bridge",
      start: async (ctx: any) => {
        await bridgeManager.start(ctx.logger);
      },
      stop: async () => {
        await bridgeManager.stop();
      },
    });
  },
};

export default plugin;
