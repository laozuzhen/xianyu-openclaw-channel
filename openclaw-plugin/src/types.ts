/**
 * Type definitions for Xianyu (闲鱼) Channel Plugin (Bridge Mode)
 *
 * Provides type safety for:
 * - Bridge API request/response models
 * - SSE message events
 * - Channel configuration
 * - Connection state management
 * - Message deduplication
 */

import type {
  OpenClawConfig,
  OpenClawPluginApi,
  ChannelPlugin as SDKChannelPlugin,
  ChannelGatewayContext as SDKChannelGatewayContext,
  ChannelLogSink as SDKChannelLogSink,
  ChannelAccountSnapshot as SDKChannelAccountSnapshot,
} from "openclaw/plugin-sdk";

// ============ Bridge API Models ============

/** SSE 事件数据 — 从 Bridge_API 推送的消息 */
export interface BridgeMessageEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: "text" | "image" | "system";
  itemId?: string;
  timestamp: number;
  accountId: string;
}

/** POST /api/bridge/send 请求体 */
export interface SendMessageRequest {
  conversationId: string;
  toUserId: string;
  text: string;
  accountId?: string;
}

/** POST /api/bridge/send-media 请求体 */
export interface SendMediaRequest {
  conversationId: string;
  toUserId: string;
  imageUrl: string;
  accountId?: string;
}

/** 发送结果 */
export interface SendResult {
  ok: boolean;
  error?: string;
}

/** POST /api/bridge/confirm-delivery 请求体 */
export interface ConfirmDeliveryRequest {
  orderId: string;
  accountId?: string;
}

/** 发货结果 */
export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

/** GET /api/bridge/accounts 响应中的单个账号 */
export interface BridgeAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  connected: boolean;
}

/** GET /api/bridge/status 响应 */
export interface BridgeStatus {
  running: boolean;
  activeConnections: number;
  messageQueueSize: number;
  accounts: BridgeAccount[];
}


// ============ Channel Configuration ============

/** openclaw.json 中 channels.xianyu 的配置 */
export interface XianyuChannelConfig {
  enabled?: boolean;
  apiUrl: string;
  name?: string;
  dmPolicy?: "open" | "allowlist";
  allowFrom?: string[];
  accounts?: Record<string, {
    apiUrl: string;
    name?: string;
    enabled?: boolean;
  }>;
  maxConnectionAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectJitter?: number;
}

/** 解析后的闲鱼账号 */
export interface ResolvedXianyuAccount {
  accountId: string;
  apiUrl: string;
  bridgeToken?: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
}

// ============ Connection State ============

/** SSE 连接状态机 */
export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  FAILED = "FAILED",
}

/** 连接管理器配置 */
export interface ConnectionManagerConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  jitter: number;
  onStateChange?: (state: ConnectionState, error?: string) => void;
}

// ============ Dedup ============

/** 去重缓存条目 */
export interface DedupEntry {
  timestamp: number;
  inflight: boolean;
}

// ============ OpenClaw SDK Re-exports ============

export interface XianyuPluginModule {
  id: string;
  name: string;
  description?: string;
  configSchema?: unknown;
  register?: (api: OpenClawPluginApi) => void | Promise<void>;
}

export type ChannelLogSink = SDKChannelLogSink;
export type ChannelAccountSnapshot = SDKChannelAccountSnapshot;
export type GatewayStartContext = SDKChannelGatewayContext<ResolvedXianyuAccount>;
export type XianyuChannelPlugin = SDKChannelPlugin<ResolvedXianyuAccount>;

// ============ Account Helper Functions ============

const DEFAULT_ACCOUNT_ID = "default";

/**
 * List all Xianyu account IDs from config.
 * Returns "default" if top-level apiUrl is set,
 * plus any keys from the accounts object.
 */
export function listXianyuAccountIds(cfg: OpenClawConfig): string[] {
  const xianyu = cfg.channels?.xianyu as XianyuChannelConfig | undefined;
  if (!xianyu) {
    return [];
  }

  const accountIds: string[] = [];

  // Top-level config counts as "default" account
  if (xianyu.apiUrl) {
    accountIds.push(DEFAULT_ACCOUNT_ID);
  }

  // Named accounts
  if (xianyu.accounts) {
    accountIds.push(...Object.keys(xianyu.accounts));
  }

  return accountIds;
}

/**
 * Resolve a specific Xianyu account configuration.
 * Falls back to top-level config for "default" account.
 */
export function resolveXianyuAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedXianyuAccount {
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const xianyu = cfg.channels?.xianyu as XianyuChannelConfig | undefined;

  // Default account → top-level config
  if (id === DEFAULT_ACCOUNT_ID) {
    return {
      accountId: id,
      apiUrl: xianyu?.apiUrl ?? "",
      enabled: xianyu?.enabled !== false,
      configured: Boolean(xianyu?.apiUrl),
      name: xianyu?.name,
    };
  }

  // Named account
  const accountConfig = xianyu?.accounts?.[id];
  if (accountConfig) {
    return {
      accountId: id,
      apiUrl: accountConfig.apiUrl,
      enabled: accountConfig.enabled !== false,
      configured: Boolean(accountConfig.apiUrl),
      name: accountConfig.name,
    };
  }

  // Account not found → unconfigured
  return {
    accountId: id,
    apiUrl: "",
    enabled: false,
    configured: false,
  };
}
