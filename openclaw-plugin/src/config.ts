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
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const xianyu = cfg?.channels?.xianyu as XianyuChannelConfig | undefined;

  if (id === DEFAULT_ACCOUNT_ID) {
    return {
      accountId: id,
      apiUrl: xianyu?.apiUrl ?? "",
      enabled: xianyu?.enabled ?? true,
      configured: Boolean(xianyu?.apiUrl),
      name: xianyu?.name,
    };
  }

  const account = xianyu?.accounts?.[id];
  if (account) {
    return {
      accountId: id,
      apiUrl: account.apiUrl,
      enabled: account.enabled ?? true,
      configured: Boolean(account.apiUrl),
      name: account.name,
    };
  }

  return {
    accountId: id,
    apiUrl: "",
    enabled: false,
    configured: false,
  };
}
