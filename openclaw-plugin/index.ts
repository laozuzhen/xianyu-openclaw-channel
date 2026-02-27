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
