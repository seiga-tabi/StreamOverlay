import fs from "node:fs";
import path from "node:path";
import type { BotAction, OverlayBannerAction, OverlayVariant, RewardMappingSummary, TwitchRewardRedemptionInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { appConfig } from "../config.js";
import { sanitizeDisplayName, sanitizeViewerInput } from "../core/safe-text.js";

type DefaultOverlayBannerConfig = boolean | {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  variant?: OverlayVariant;
  durationMs?: number;
  mediaUrl?: string;
  mediaAlt?: string;
  soundUrl?: string;
  soundVolume?: number;
  speechEnabled?: boolean;
  speechText?: string;
  speechLanguage?: "ja-JP" | "ko-KR";
  speechRate?: number;
  speechPitch?: number;
  speechVolume?: number;
};

type RewardConfig = {
  name: string;
  cooldownMs?: number;
  maxPerStream?: number;
  defaultOverlayBanner?: DefaultOverlayBannerConfig;
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
    const hasOverlayAction = Boolean(rewardConfig.defaultOverlayBanner) || actionTypes.some((type) => type.startsWith("overlay."));
    return {
      key,
      keyType,
      name: rewardConfig.name,
      rewardId: keyType === "reward_id" ? key : undefined,
      title: keyType === "title" ? key : rewardConfig.name,
      titleFallbackWarning: keyType === "title",
      hasOverlayAction,
      actionTypes,
      cooldownMs: rewardConfig.cooldownMs,
      maxPerStream: rewardConfig.maxPerStream
    };
  });
}

function makeDefaultOverlayBanner(rewardConfig: RewardConfig, event: TwitchRewardRedemptionInternalEvent): OverlayBannerAction | undefined {
  const option = rewardConfig.defaultOverlayBanner;
  if (!option) return undefined;
  if (typeof option === "object" && option.enabled === false) return undefined;

  const user = sanitizeDisplayName(event.userName);
  const rewardTitle = sanitizeViewerInput(event.rewardTitle, 80);
  return {
    type: "overlay.banner",
    title: typeof option === "object" ? option.title ?? rewardTitle : rewardTitle,
    subtitle: typeof option === "object" ? option.subtitle : undefined,
    message: typeof option === "object" ? option.message ?? `${user}님이 ${rewardTitle}을(를) 사용했습니다.` : `${user}님이 ${rewardTitle}을(를) 사용했습니다.`,
    variant: typeof option === "object" ? option.variant ?? "success" : "success",
    durationMs: typeof option === "object" ? option.durationMs ?? 4000 : 4000,
    source: "twitch.reward",
    eventKind: "reward",
    mediaUrl: typeof option === "object" ? option.mediaUrl : undefined,
    mediaAlt: typeof option === "object" ? option.mediaAlt : undefined,
    soundUrl: typeof option === "object" ? option.soundUrl : undefined,
    soundVolume: typeof option === "object" ? option.soundVolume : undefined,
    speechEnabled: typeof option === "object" ? option.speechEnabled : undefined,
    speechText: typeof option === "object" ? option.speechText : undefined,
    speechLanguage: typeof option === "object" ? option.speechLanguage : undefined,
    speechRate: typeof option === "object" ? option.speechRate : undefined,
    speechPitch: typeof option === "object" ? option.speechPitch : undefined,
    speechVolume: typeof option === "object" ? option.speechVolume : undefined
  };
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
      const defaultOverlayBanner = makeDefaultOverlayBanner(rewardConfig, event);
      await ctx.actions.dispatch([
        ...(defaultOverlayBanner ? [defaultOverlayBanner] : []),
        ...rewardConfig.actions
      ], {
        user: sanitizeDisplayName(event.userName),
        userId: event.userId,
        input: sanitizeViewerInput(event.userInput ?? ""),
        rewardTitle: sanitizeViewerInput(event.rewardTitle, 80),
        rewardId: event.rewardId
      }, `reward:${sanitizeViewerInput(event.rewardTitle, 80)}`);
    });
  }
};
