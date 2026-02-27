/**
 * PluginRuntime global storage for Xianyu channel plugin.
 *
 * 📦 来源：openclaw-channel-dingtalk-repo/src/runtime.ts
 * 📝 用途：保存 OpenClaw 插件运行时引用，供其他模块访问
 * ✅ 直接复用钉钉插件模式，仅改函数名
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setXianyuRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getXianyuRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Xianyu runtime not initialized");
  }
  return runtime;
}
