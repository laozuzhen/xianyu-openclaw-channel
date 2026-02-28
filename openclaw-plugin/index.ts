/**
 * Xianyu (闲鱼) Channel Plugin entry point for OpenClaw.
 *
 * 📦 来源：openclaw-channel-dingtalk-repo/index.ts
 * 📝 用途：注册闲鱼频道插件到 OpenClaw 插件系统
 * ✅ 复用钉钉插件入口模式，适配闲鱼 Bridge 模式
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
        const account = accountId || "default";
        try {
          const response = await fetch(`http://localhost:8080/api/bridge/confirm-delivery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, accountId: account }),
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
          limit: { type: "number", description: "返回订单数量（可选，默认20）" },
          accountId: { type: "string", description: "账号ID（可选）" },
        },
      },
      async execute(_id: string, params: unknown) {
        const { status, limit, accountId } = params as any;
        const account = accountId || "default";
        try {
          const queryParams = new URLSearchParams();
          if (status) queryParams.set("status", status);
          if (limit) queryParams.set("limit", String(limit));
          queryParams.set("accountId", account);
          const response = await fetch(`http://localhost:8080/api/orders?${queryParams}`);
          const result = await response.json();
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: {} };
        } catch (e: any) {
          return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true, details: {} };
        }
      },
    });

    // 注册 Bridge 进程服务 — Gateway 启动时自动启动 Python 进程
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