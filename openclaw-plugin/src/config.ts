/**
 * Xianyu channel configuration helpers.
 *
 * 📦 来源：基于 openclaw-channel-dingtalk-repo/src/config.ts 的模式
 * 📝 用途：从 OpenClaw 配置中解析闲鱼频道配置，支持多账号
 */
import type { OpenClawConfig } from "openclaw/plugin-sdk";

/**
 * Inline type — will be replaced by ./types import once types.ts is created.
 */
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

export interface ResolvedXianyuAccount {
  accountId: string;
  apiUrl: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
}

const DEFAULT_ACCOUNT_ID = "default";

/**
 * Resolve Xianyu config for an account.
 * Falls back to top-level config for single-account setups.
 */
export function getConfig(cfg: OpenClawConfig, accountId?: string): XianyuChannelConfig {
  const xianyuCfg = cfg?.channels?.xianyu as XianyuChannelConfig | undefined;
  if (!xianyuCfg) {
    return {} as XianyuChannelConfig;
  }
  if (accountId && xianyuCfg.accounts?.[accountId]) {
    return xianyuCfg.accounts[accountId] as XianyuChannelConfig;
  }
  return xianyuCfg;
}

export function isConfigured(cfg: OpenClawConfig, accountId?: string): boolean {
  const config = getConfig(cfg, accountId);
  return Boolean(config.apiUrl);
}

/**
 * List all Xianyu account IDs from config.
 */
export function listXianyuAccountIds(cfg: OpenClawConfig): string[] {
  const xianyu = cfg?.channels?.xianyu as XianyuChannelConfig | undefined;
  if (!xianyu) {
    return [];
  }

  const accountIds: string[] = [];

  // Top-level config counts as the default account
  if (xianyu.apiUrl) {
    accountIds.push(DEFAULT_ACCOUNT_ID);
  }

  if (xianyu.accounts) {
    accountIds.push(...Object.keys(xianyu.accounts));
  }

  return accountIds;
}

/**
 * Resolve a specific Xianyu account configuration.
 */
export function resolveXianyuAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedXianyuAccount {
  const xianyu = cfg?.channels?.xianyu as XianyuChannelConfig | undefined;

  // 如果没有指定 accountId，尝试从 accounts 中获取第一个可用的账号
  if (!accountId || accountId === DEFAULT_ACCOUNT_ID) {
    // 优先使用 accounts 中的第一个账号
    if (xianyu?.accounts && Object.keys(xianyu.accounts).length > 0) {
      const firstAccountId = Object.keys(xianyu.accounts)[0];
      const account = xianyu.accounts[firstAccountId];
      return {
        accountId: firstAccountId,
        apiUrl: account.apiUrl ?? xianyu.apiUrl ?? "",
        bridgeToken: (account as any).bridgeToken ?? (xianyu as any).bridgeToken,
        enabled: account.enabled ?? true,
        configured: Boolean(account.apiUrl ?? xianyu.apiUrl),
        name: account.name,
      };
    }

    // 回退到顶层配置
    return {
      accountId: DEFAULT_ACCOUNT_ID,
      apiUrl: xianyu?.apiUrl ?? "",
      bridgeToken: (xianyu as any)?.bridgeToken,
      enabled: xianyu?.enabled ?? true,
      configured: Boolean(xianyu?.apiUrl),
      name: xianyu?.name,
    };
  }

  const account = xianyu?.accounts?.[accountId];
  if (account) {
    return {
      accountId: accountId,
      apiUrl: account.apiUrl,
      bridgeToken: (account as any).bridgeToken,
      enabled: account.enabled ?? true,
      configured: Boolean(account.apiUrl),
      name: account.name,
    };
  }

  return {
    accountId: accountId,
    apiUrl: "",
    enabled: false,
    configured: false,
  };
}
