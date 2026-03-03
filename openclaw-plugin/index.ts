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
