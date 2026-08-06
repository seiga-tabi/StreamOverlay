import fs from "node:fs";
import path from "node:path";
import type { BotAction, RewardMappingSummary, TwitchRewardRedemptionInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { appConfig } from "../config.js";
import { sanitizeDisplayName, sanitizeViewerInput } from "../core/safe-text.js";

type RewardConfig = {
  name: string;
  cooldownMs?: number;
  maxPerStream?: number;
  actions: BotAction[];
};

type RewardsConfig = Record<string, RewardConfig>;

export type RewardActionConfigResolution = {
  rewardConfig?: RewardConfig;
  key?: string;
  matchedBy?: "reward_id" | "title";
};

function loadConfig(): RewardsConfig {
  const filePath = path.join(appConfig.paths.config, "reward-actions.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as RewardsConfig;
}

function looksLikeRewardId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^reward[_-]/i.test(value);
}

export function getRewardMappingSummaries(config: RewardsConfig = loadConfig()): RewardMappingSummary[] {
  return Object.entries(config).map(([key, rewardConfig]) => {
    const keyType = looksLikeRewardId(key) ? "reward_id" : "title";
    const actionTypes = rewardConfig.actions.map((action) => action.type);
    return {
      key,
      keyType,
      name: rewardConfig.name,
      rewardId: keyType === "reward_id" ? key : undefined,
      title: keyType === "title" ? key : rewardConfig.name,
      titleFallbackWarning: keyType === "title",
      actionTypes,
      cooldownMs: rewardConfig.cooldownMs,
      maxPerStream: rewardConfig.maxPerStream
    };
  });
}

export function resolveRewardActionConfig(
  config: RewardsConfig,
  event: Pick<TwitchRewardRedemptionInternalEvent, "rewardId" | "rewardTitle">
): RewardActionConfigResolution {
  if (event.rewardId && config[event.rewardId]) {
    return { rewardConfig: config[event.rewardId], key: event.rewardId, matchedBy: "reward_id" };
  }
  if (event.rewardTitle && config[event.rewardTitle]) {
    return { rewardConfig: config[event.rewardTitle], key: event.rewardTitle, matchedBy: "title" };
  }
  return {};
}

export const rewardsModule: BotModule = {
  name: "rewards",
  setup(ctx) {
    const config = loadConfig();
    const lastUsed = new Map<string, number>();
    const usageCount = new Map<string, number>();

    ctx.events.on<TwitchRewardRedemptionInternalEvent>("twitch.rewardRedemption", async (event) => {
      const { rewardConfig, key, matchedBy } = resolveRewardActionConfig(config, event);
      if (!rewardConfig) return;
      if (matchedBy === "title") {
        ctx.logger.event({
          type: "reward.title_fallback_used",
          severity: "warning",
          rewardTitle: sanitizeViewerInput(event.rewardTitle, 80),
          userName: sanitizeDisplayName(event.userName)
        });
      }

      const now = Date.now();
      const usageKey = key ?? event.rewardId ?? event.rewardTitle;
      const last = lastUsed.get(usageKey) ?? 0;
      if (rewardConfig.cooldownMs && now - last < rewardConfig.cooldownMs) {
        ctx.logger.event({ type: "reward.cooldown_skipped", rewardTitle: sanitizeViewerInput(event.rewardTitle, 80), userName: sanitizeDisplayName(event.userName) });
        return;
      }
      const count = usageCount.get(usageKey) ?? 0;
      if (rewardConfig.maxPerStream && count >= rewardConfig.maxPerStream) {
        ctx.logger.event({ type: "reward.max_per_stream_skipped", rewardTitle: sanitizeViewerInput(event.rewardTitle, 80), userName: sanitizeDisplayName(event.userName) });
        return;
      }

      lastUsed.set(usageKey, now);
      usageCount.set(usageKey, count + 1);
      await ctx.actions.dispatch(rewardConfig.actions, {
        streamerId: event.broadcasterUserId,
        user: sanitizeDisplayName(event.userName),
        userId: event.userId,
        input: sanitizeViewerInput(event.userInput ?? ""),
        rewardTitle: sanitizeViewerInput(event.rewardTitle, 80),
        rewardId: event.rewardId
      }, `reward:${sanitizeViewerInput(event.rewardTitle, 80)}`);
    });
  }
};
