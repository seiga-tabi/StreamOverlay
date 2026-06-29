export const TWITCH_MVP_SCOPES = ["user:read:chat", "user:write:chat", "channel:read:redemptions"] as const;
export const TWITCH_PUBLIC_VIEWER_SCOPES = ["user:read:follows", "user:read:subscriptions"] as const;

export const TWITCH_OPTIONAL_SCOPES = [
  "channel:manage:redemptions",
  "channel:read:subscriptions",
  "bits:read",
  "moderator:read:followers",
  "channel:manage:broadcast"
] as const;

export const TWITCH_EVENTSUB_SUBSCRIPTION_TYPES = [
  "stream.online",
  "stream.offline",
  "channel.chat.message",
  "channel.channel_points_custom_reward_redemption.add",
  "channel.subscribe",
  "channel.subscription.message",
  "channel.cheer",
  "channel.raid",
  "channel.follow"
] as const;

export type TwitchConnectionState = "connected" | "disconnected" | "token_expired" | "missing_scopes";

export type TwitchEventSubSubscriptionType = (typeof TWITCH_EVENTSUB_SUBSCRIPTION_TYPES)[number];

export type TwitchEventSubWebSocketState = "disabled" | "connected" | "disconnected" | "reconnecting";

export type TwitchEventSubSubscriptionRuntimeState = "pending" | "active" | "failed" | "skipped";

export type TwitchEventSubSubscriptionStatus = {
  type: TwitchEventSubSubscriptionType | string;
  version: string;
  enabled: boolean;
  status: TwitchEventSubSubscriptionRuntimeState;
  requiredScopes: string[];
  missingScopes: string[];
  error?: string;
  subscribedAt?: string;
};

export type TwitchEventSubStatus = {
  websocket: TwitchEventSubWebSocketState;
  sessionId?: string;
  activeSubscriptions: number;
  failedSubscriptions: TwitchEventSubSubscriptionStatus[];
  missingScopes: string[];
  lastEventAt?: string;
  subscriptions: TwitchEventSubSubscriptionStatus[];
};

export type TwitchChatMode = "broadcaster" | "bot";

export type TwitchChatSendFailure = {
  id: string;
  messagePreview: string;
  reason: string;
  statusCode?: number;
  createdAt: string;
};

export type TwitchChatStatus = {
  mode: TwitchChatMode;
  queueSize: number;
  throttleMs: number;
  cooldownMs: number;
  maxMessageLength: number;
  lastSentAt?: string;
  lastFailureAt?: string;
  recentFailures: TwitchChatSendFailure[];
};

export type TwitchBroadcasterInfo = {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
};

export type TwitchConnectionStatus = {
  state: TwitchConnectionState;
  connected: boolean;
  source: "oauth" | "env" | "none";
  broadcaster?: TwitchBroadcasterInfo;
  grantedScopes: string[];
  requiredScopes: string[];
  optionalScopes: string[];
  enabledOptionalScopes: string[];
  missingScopes: string[];
  tokenExpiresAt?: string;
  eventSub?: TwitchEventSubStatus;
  chat?: TwitchChatStatus;
  legacyConfigured?: boolean;
  error?: string;
};

export type RewardMappingSummary = {
  key: string;
  keyType: "reward_id" | "title";
  name: string;
  rewardId?: string;
  title?: string;
  titleFallbackWarning: boolean;
  hasOverlayAction: boolean;
  actionTypes: string[];
  cooldownMs?: number;
  maxPerStream?: number;
};

export function findMissingScopes(requiredScopes: readonly string[], grantedScopes: readonly string[]): string[] {
  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}
