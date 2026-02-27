/**
 * Zod v4 schema for Xianyu channel configuration.
 *
 * 📦 来源：基于 openclaw-channel-dingtalk-repo 的配置模式
 * 📝 用途：验证 openclaw.json 中 channels.xianyu 的配置结构
 */
import { z } from "zod";

const XianyuAccountSchema = z.object({
  apiUrl: z.string(),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const XianyuConfigSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string(),
  name: z.string().optional(),
  dmPolicy: z.enum(["open", "allowlist"]).optional(),
  allowFrom: z.array(z.string()).optional(),
  accounts: z.record(z.string(), XianyuAccountSchema).optional(),
  // 连接配置
  maxConnectionAttempts: z.number().optional(),
  initialReconnectDelay: z.number().optional(),
  maxReconnectDelay: z.number().optional(),
  reconnectJitter: z.number().optional(),
});

export type XianyuConfigInput = z.input<typeof XianyuConfigSchema>;
