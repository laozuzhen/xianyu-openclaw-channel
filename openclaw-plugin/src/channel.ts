/**
 * Xianyu (闲鱼) Channel Plugin — Bridge Mode
 *
 * 核心频道定义文件，实现 OpenClaw ChannelPlugin 接口。
 * 通过 Python Bridge_API 桥接闲鱼消息，支持 SSE 实时推送。
 *
 * 📦 模式来源：openclaw-channel-dingtalk-repo/src/channel.ts
 * 📝 简化为桥接模式（无 DWClient，无群聊，无 AI Card）
 */

import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { XianyuConfigSchema } from "./config-schema";
import { getConfig, listXianyuAccountIds, resolveXianyuAccount } from "./config";
import { BridgeClient } from "./bridge-client";
import { ConnectionManager } from "./connection-manager";
import { ConnectionState } from "./types";
import type {
  BridgeMessageEvent,
  GatewayStartContext,
  XianyuChannelPlugin,
  ResolvedXianyuAccount,
} from "./types";
import { isMessageProcessed, markMessageProcessed } from "./dedup";
import { handleBridgeMessage } from "./inbound-handler";
import { sendText as sendTextService, sendMedia as sendMediaService } from "./send-service";

const processingDedupKeys = new Set<string>();

export const xianyuPlugin: XianyuChannelPlugin = {
  id: "xianyu",
  meta: {
    id: "xianyu",
    label: "Xianyu",
    selectionLabel: "Xianyu (闲鱼)",
    docsPath: "/channels/xianyu",
    blurb: "闲鱼二手交易平台消息频道（桥接模式）",
    aliases: ["xy", "goofish"],
  },
  configSchema: buildChannelConfigSchema(XianyuConfigSchema),
  capabilities: {
    chatTypes: ["direct"] as Array<"direct">,
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.xianyu"] },
  config: {
    listAccountIds: (cfg: OpenClawConfig): string[] => listXianyuAccountIds(cfg),
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) =>
      resolveXianyuAccount(cfg, accountId),
    defaultAccountId: (): string => "default",
    isConfigured: (account: ResolvedXianyuAccount): boolean => account.configured,
    describeAccount: (account: ResolvedXianyuAccount) => ({
      accountId: account.accountId,
      name: account.name || "Xianyu",
      enabled: account.enabled,
      configured: account.configured,
    }),
  },
  outbound: {
    deliveryMode: "direct" as const,
    resolveTarget: ({ to }: any) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false as const,
          error: new Error("Xianyu message requires --to <conversationId>"),
        };
      }
      const targetId = trimmed.replace(/^(xianyu|xy|goofish):/i, "");
      return { ok: true as const, to: targetId };
    },
    sendText: async ({ cfg, to, text, accountId, sessionKey, log }: any) => {
      const account = resolveXianyuAccount(cfg, accountId);
      // sessionKey 用于多会话隔离，每个买家对话有独立的 sessionKey
      // 如果没有 sessionKey，使用 to (conversationId) 作为默认值
      const effectiveConversationId = sessionKey || to;
      log?.debug?.(`[xianyu] sendText: to=${to}, sessionKey=${sessionKey}, effectiveConversationId=${effectiveConversationId}`);
      const result = await sendTextService({
        apiUrl: account.apiUrl,
        bridgeToken: account.bridgeToken,
        conversationId: effectiveConversationId,
        toUserId: to,
        text,
        accountId: account.accountId,
      });
      if (!result.ok) {
        throw new Error(result.error || "sendText failed");
      }
      return { channel: "xianyu", messageId: crypto.randomUUID() };
    },
    sendMedia: async ({ cfg, to, mediaUrl, accountId, sessionKey, log }: any) => {
      const account = resolveXianyuAccount(cfg, accountId);
      // sessionKey 用于多会话隔离，每个买家对话有独立的 sessionKey
      const effectiveConversationId = sessionKey || to;
      log?.debug?.(`[xianyu] sendMedia: to=${to}, sessionKey=${sessionKey}, effectiveConversationId=${effectiveConversationId}`);
      const result = await sendMediaService({
        apiUrl: account.apiUrl,
        bridgeToken: account.bridgeToken,
        conversationId: effectiveConversationId,
        toUserId: to,
        imageUrl: mediaUrl || "",
        accountId: account.accountId,
      });
      if (!result.ok) {
        throw new Error(result.error || "sendMedia failed");
      }
      return { channel: "xianyu", messageId: crypto.randomUUID() };
    },
  },
  gateway: {
    startAccount: async (ctx: GatewayStartContext) => {
      const { account, cfg, abortSignal } = ctx;
      if (!account.apiUrl) {
        throw new Error("Xianyu apiUrl is required");
      }

      ctx.log?.info?.(`[${account.accountId}] Initializing Xianyu Bridge client...`);

      const bridgeClient = new BridgeClient(account.apiUrl);

      const onMessage = async (data: BridgeMessageEvent) => {
        const dedupKey = data.messageId;
        if (!dedupKey) {
          ctx.log?.warn?.(`[${account.accountId}] No messageId for dedup`);
          await handleBridgeMessage({ cfg, accountId: account.accountId, data, log: ctx.log });
          return;
        }
        if (isMessageProcessed(dedupKey)) {
          ctx.log?.debug?.(`[${account.accountId}] Skipping duplicate: ${dedupKey}`);
          return;
        }
        if (processingDedupKeys.has(dedupKey)) {
          ctx.log?.debug?.(`[${account.accountId}] Skipping in-flight: ${dedupKey}`);
          return;
        }
        processingDedupKeys.add(dedupKey);
        try {
          // 收到消息时打印调试日志
          ctx.log?.debug?.(`[${account.accountId}] 收到消息: ${JSON.stringify(data)}`);
          await handleBridgeMessage({ cfg, accountId: account.accountId, data, log: ctx.log });
          markMessageProcessed(dedupKey);
        } finally {
          processingDedupKeys.delete(dedupKey);
        }
      };

      let stopped = false;

      // Resolve connection config from full channel config
      const fullConfig = getConfig(cfg, account.accountId);

      const connectionConfig = {
        maxAttempts: fullConfig.maxConnectionAttempts ?? 10,
        initialDelay: fullConfig.initialReconnectDelay ?? 1000,
        maxDelay: fullConfig.maxReconnectDelay ?? 60000,
        jitter: fullConfig.reconnectJitter ?? 0.3,
        onStateChange: (state: ConnectionState, error?: string) => {
          if (stopped) return;
          ctx.log?.debug?.(
            `[${account.accountId}] Connection state: ${state}${error ? ` (${error})` : ""}`,
          );
          if (state === ConnectionState.CONNECTED) {
            ctx.setStatus({
              ...ctx.getStatus(),
              running: true,
              lastStartAt: Date.now(),
              lastError: null,
            });
          } else if (state === ConnectionState.FAILED || state === ConnectionState.DISCONNECTED) {
            ctx.setStatus({
              ...ctx.getStatus(),
              running: false,
              lastError: error || `Connection ${state.toLowerCase()}`,
            });
          }
        },
      };

      const connectionManager = new ConnectionManager(
        bridgeClient,
        account.accountId,
        connectionConfig,
        ctx.log,
      );

      // Register abort listener before connect()
      if (abortSignal) {
        if (abortSignal.aborted) {
          throw new Error("Connection aborted before start");
        }
        abortSignal.addEventListener("abort", () => {
          if (stopped) return;
          stopped = true;
          ctx.log?.info?.(`[${account.accountId}] Abort signal received, stopping...`);
          connectionManager.stop();
          ctx.setStatus({
            ...ctx.getStatus(),
            running: false,
            lastStopAt: Date.now(),
          });
        });
      }

      try {
        // 后台启动 SSE 连接，不阻塞插件启动
        connectionManager.connect(onMessage).catch((err: any) => {
          ctx.log?.error?.(`[${account.accountId}] Bridge SSE connection failed: ${err.message}`);
          ctx.setStatus({
            ...ctx.getStatus(),
            running: false,
            lastError: err.message,
          });
        });

        ctx.setStatus({
          ...ctx.getStatus(),
          running: false,
          lastStartAt: Date.now(),
        });

        ctx.log?.info?.(`[${account.accountId}] Bridge SSE connection started in background`);
      } catch (err: any) {
        ctx.log?.error?.(`[${account.accountId}] Failed to establish connection: ${err.message}`);
        ctx.setStatus({
          ...ctx.getStatus(),
          running: false,
          lastError: err.message,
        });
      }

      return {
        stop: () => {
          if (stopped) return;
          stopped = true;
          ctx.log?.info?.(`[${account.accountId}] Stopping Bridge client...`);
          connectionManager.stop();
          ctx.setStatus({
            ...ctx.getStatus(),
            running: false,
            lastStopAt: Date.now(),
          });
        },
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts: any[]) => {
      return accounts.flatMap((account) => {
        if (!account.configured) {
          return [
            {
              channel: "xianyu",
              accountId: account.accountId,
              kind: "config" as const,
              message: "Account not configured (missing apiUrl)",
            },
          ];
        }
        return [];
      });
    },
    buildChannelSummary: ({ snapshot }: any) => ({
      configured: snapshot?.configured ?? false,
      running: snapshot?.running ?? false,
      lastStartAt: snapshot?.lastStartAt ?? null,
      lastStopAt: snapshot?.lastStopAt ?? null,
      lastError: snapshot?.lastError ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }: any) => {
      if (!account.configured) {
        return { ok: false, error: "Not configured" };
      }
      try {
        const client = new BridgeClient(account.apiUrl);
        const status = await client.getStatus();
        return { ok: true, details: { running: status.running } };
      } catch (error: any) {
        return { ok: false, error: error.message };
      }
    },
    buildAccountSnapshot: ({ account, runtime, snapshot, probe }: any) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? snapshot?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? snapshot?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? snapshot?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? snapshot?.lastError ?? null,
      probe,
    }),
  },
};
