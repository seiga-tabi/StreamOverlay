import type {
  BotAction,
  TwitchCheerInternalEvent,
  TwitchFollowInternalEvent,
  TwitchRaidInternalEvent,
  TwitchSubscriptionInternalEvent,
  TwitchSubscriptionMessageInternalEvent
} from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { sanitizeDisplayName, sanitizeViewerInput } from "../core/safe-text.js";
import { loadAlertOverlayConfig, type AlertOverlayConfig, type AlertOverlayKey, type AlertOverlayPreset } from "../services/alert-overlay-config.js";

const DISPLAY_COMMENT_MAX_LENGTH = 160;
const SPEECH_COMMENT_MAX_LENGTH = 80;

function cleanPreset(preset: AlertOverlayPreset | undefined): AlertOverlayPreset {
  if (!preset || preset.enabled === false) return {};
  return Object.fromEntries(
    Object.entries(preset).filter(([key, value]) => key !== "enabled" && value !== undefined && value !== "")
  ) as AlertOverlayPreset;
}

function withPreset(
  config: AlertOverlayConfig,
  key: AlertOverlayKey,
  action: BotAction & { type: "overlay.banner" }
): BotAction {
  const defaults = cleanPreset(config.defaults);
  const preset = cleanPreset(config[key]);
  return {
    ...action,
    ...defaults,
    ...preset,
    title: preset.title ?? action.title,
    subtitle: preset.subtitle ?? defaults.subtitle ?? action.subtitle,
    message: preset.message ?? action.message,
    variant: preset.variant ?? action.variant,
    durationMs: preset.durationMs ?? defaults.durationMs ?? action.durationMs,
    speechText: preset.speechText ?? action.speechText ?? defaults.speechText,
    source: action.source
  };
}

function subscriptionTierLabel(tier: string): string {
  const normalized = tier.trim().toLowerCase();
  if (normalized === "prime") return "Prime";
  if (normalized === "1000") return "Tier 1";
  if (normalized === "2000") return "Tier 2";
  if (normalized === "3000") return "Tier 3";
  return normalized ? tier : "Tier 1";
}

function subscriptionTierSpeech(tier: string): string {
  const normalized = tier.trim().toLowerCase();
  if (normalized === "prime") return "プライム";
  if (normalized === "1000") return "ティア1";
  if (normalized === "2000") return "ティア2";
  if (normalized === "3000") return "ティア3";
  return normalized ? tier : "ティア1";
}

function appendCommentForDisplay(base: string, comment: string): string {
  return comment ? `${base}\nコメント: ${comment}` : base;
}

function appendCommentForSpeech(base: string, comment: string): string {
  return comment ? `${base}コメント、${comment}` : base;
}

function subscriptionMessage(event: TwitchSubscriptionInternalEvent): BotAction[] {
  const user = sanitizeDisplayName(event.userName);
  const tier = subscriptionTierLabel(event.tier);
  const tierSpeech = subscriptionTierSpeech(event.tier);
  const message = event.isGift
    ? `${user}さん、${tier}ギフトサブありがとうございます。`
    : `${user}さん、${tier}サブスクありがとうございます。`;
  const speechText = event.isGift
    ? `${user}さん、${tierSpeech}のギフトサブありがとうございます。`
    : `${user}さん、${tierSpeech}のサブスクありがとうございます。`;
  const config = loadAlertOverlayConfig();
  return [withPreset(config, "subscription", {
    type: "overlay.banner",
    title: event.isGift ? "ギフトサブありがとう" : "サブスクありがとう",
    subtitle: "구독 감사합니다",
    message,
    variant: event.isGift ? "success" : "info",
    durationMs: 5000,
    source: "twitch.subscription",
    eventKind: "subscription",
    speechEnabled: true,
    speechText,
    speechLanguage: "ja-JP"
  })];
}

function resubscriptionMessage(event: TwitchSubscriptionMessageInternalEvent): BotAction[] {
  const user = sanitizeDisplayName(event.userName);
  const months = Math.max(1, Math.trunc(event.cumulativeMonths || 1));
  const displayComment = sanitizeViewerInput(event.message ?? "", DISPLAY_COMMENT_MAX_LENGTH);
  const speechComment = sanitizeViewerInput(event.message ?? "", SPEECH_COMMENT_MAX_LENGTH);
  const baseMessage = `${user}さん、${months}か月のサブスクありがとうございます。`;
  const baseSpeech = `${user}さん、${months}か月のサブスクありがとうございます。`;
  const config = loadAlertOverlayConfig();
  return [withPreset(config, "subscriptionMessage", {
    type: "overlay.banner",
    title: "サブスクメッセージ",
    subtitle: "구독 메시지",
    message: appendCommentForDisplay(baseMessage, displayComment),
    variant: "success",
    durationMs: 5500,
    source: "twitch.subscription_message",
    eventKind: "subscription_message",
    speechEnabled: true,
    speechText: appendCommentForSpeech(baseSpeech, speechComment),
    speechLanguage: "ja-JP"
  })];
}

function cheerMessage(event: TwitchCheerInternalEvent): BotAction[] {
  const user = event.isAnonymous ? "匿名" : sanitizeDisplayName(event.userName, "viewer");
  const bits = Math.max(0, Math.trunc(event.bits));
  const displayComment = sanitizeViewerInput(event.message ?? "", DISPLAY_COMMENT_MAX_LENGTH);
  const speechComment = sanitizeViewerInput(event.message ?? "", SPEECH_COMMENT_MAX_LENGTH);
  const variant = bits >= 1000 ? "danger" : bits >= 300 ? "warning" : "success";
  const baseMessage = `${user}さん、${bits} Bitsありがとうございます。`;
  const baseSpeech = `${user}さん、${bits}ビッツありがとうございます。`;
  const config = loadAlertOverlayConfig();
  return [withPreset(config, "cheer", {
    type: "overlay.banner",
    title: `${bits} Bits`,
    subtitle: "ビッツありがとう / 비트 감사합니다",
    message: appendCommentForDisplay(baseMessage, displayComment),
    variant,
    durationMs: bits >= 1000 ? 7000 : 5000,
    source: "twitch.cheer",
    eventKind: "cheer",
    speechEnabled: true,
    speechText: appendCommentForSpeech(baseSpeech, speechComment),
    speechLanguage: "ja-JP"
  })];
}

function raidMessage(event: TwitchRaidInternalEvent): BotAction[] {
  const user = sanitizeDisplayName(event.fromBroadcasterUserName);
  const viewers = Math.max(0, Math.trunc(event.viewers));
  const config = loadAlertOverlayConfig();
  return [withPreset(config, "raid", {
    type: "overlay.banner",
    title: "レイドありがとう",
    subtitle: "레이드 감사합니다",
    message: `${user}さんが${viewers}人とレイドしました。`,
    variant: "success",
    durationMs: 7000,
    source: "twitch.raid",
    eventKind: "raid",
    speechEnabled: true,
    speechLanguage: "ja-JP"
  })];
}

function followMessage(event: TwitchFollowInternalEvent): BotAction[] {
  const user = sanitizeDisplayName(event.userName);
  const config = loadAlertOverlayConfig();
  return [withPreset(config, "follow", {
    type: "overlay.banner",
    title: "フォローありがとう",
    subtitle: "팔로우 감사합니다",
    message: `${user}さんがフォローしました。`,
    variant: "info",
    durationMs: 5000,
    source: "twitch.follow",
    eventKind: "follow",
    speechEnabled: true,
    speechLanguage: "ja-JP"
  })];
}

export const twitchOverlayModule: BotModule = {
  name: "twitch-overlay",
  setup(ctx) {
    ctx.events.on<TwitchSubscriptionInternalEvent>("twitch.subscription", async (event) => {
      const user = sanitizeDisplayName(event.userName);
      await ctx.actions.dispatch(subscriptionMessage(event), {
        user,
        tier: subscriptionTierLabel(event.tier),
        isGift: event.isGift
      }, "twitch.subscription");
    });

    ctx.events.on<TwitchSubscriptionMessageInternalEvent>("twitch.subscriptionMessage", async (event) => {
      const user = sanitizeDisplayName(event.userName);
      const message = sanitizeViewerInput(event.message ?? "", DISPLAY_COMMENT_MAX_LENGTH);
      await ctx.actions.dispatch(resubscriptionMessage(event), {
        user,
        tier: subscriptionTierLabel(event.tier),
        months: Math.max(1, Math.trunc(event.cumulativeMonths || 1)),
        message
      }, "twitch.subscription_message");
    });

    ctx.events.on<TwitchCheerInternalEvent>("twitch.cheer", async (event) => {
      const user = event.isAnonymous ? "匿名" : sanitizeDisplayName(event.userName, "viewer");
      const bits = Math.max(0, Math.trunc(event.bits));
      const message = sanitizeViewerInput(event.message ?? "", DISPLAY_COMMENT_MAX_LENGTH);
      await ctx.actions.dispatch(cheerMessage(event), {
        user,
        bits,
        message
      }, "twitch.cheer");
    });

    ctx.events.on<TwitchRaidInternalEvent>("twitch.raid", async (event) => {
      await ctx.actions.dispatch(raidMessage(event), {}, "twitch.raid");
    });

    ctx.events.on<TwitchFollowInternalEvent>("twitch.follow", async (event) => {
      await ctx.actions.dispatch(followMessage(event), {}, "twitch.follow");
    });
  }
};
