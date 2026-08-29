export type InternalEvent =
  | TwitchChatMessageInternalEvent
  | TwitchRewardRedemptionInternalEvent
  | TwitchStreamStatusInternalEvent
  | TwitchSubscriptionInternalEvent
  | TwitchSubscriptionMessageInternalEvent
  | TwitchCheerInternalEvent
  | TwitchRaidInternalEvent
  | TwitchFollowInternalEvent
  | ParticipationEntryCreatedInternalEvent
  | ParticipationEntryRemovedInternalEvent
  | SystemInternalEvent;

export type TwitchChatMessageFragment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "emote";
      text: string;
      id: string;
      emoteSetId?: string;
    };

export type TwitchChatMessageInternalEvent = {
  type: "twitch.chatMessage";
  id: string;
  broadcasterUserId: string;
  chatterUserId: string;
  chatterUserName: string;
  message: string;
  fragments?: TwitchChatMessageFragment[];
  createdAt: string;
  raw?: unknown;
};

export type TwitchRewardRedemptionInternalEvent = {
  type: "twitch.rewardRedemption";
  id: string;
  broadcasterUserId: string;
  userId: string;
  userName: string;
  rewardId: string;
  rewardTitle: string;
  userInput?: string;
  createdAt: string;
  raw?: unknown;
};

export type TwitchStreamStatusInternalEvent = {
  type: "twitch.streamOnline" | "twitch.streamOffline";
  id: string;
  broadcasterUserId: string;
  createdAt: string;
  raw?: unknown;
};

export type TwitchSubscriptionInternalEvent = {
  type: "twitch.subscription";
  id: string;
  broadcasterUserId: string;
  userId: string;
  userName: string;
  tier: string;
  isGift: boolean;
  createdAt: string;
};

export type TwitchSubscriptionMessageInternalEvent = {
  type: "twitch.subscriptionMessage";
  id: string;
  broadcasterUserId: string;
  userId: string;
  userName: string;
  tier: string;
  cumulativeMonths: number;
  streakMonths?: number;
  message?: string;
  createdAt: string;
};

export type TwitchCheerInternalEvent = {
  type: "twitch.cheer";
  id: string;
  broadcasterUserId: string;
  userId?: string;
  userName?: string;
  bits: number;
  message?: string;
  isAnonymous: boolean;
  createdAt: string;
};

export type TwitchRaidInternalEvent = {
  type: "twitch.raid";
  id: string;
  fromBroadcasterUserId: string;
  fromBroadcasterUserName: string;
  toBroadcasterUserId: string;
  toBroadcasterUserName: string;
  viewers: number;
  createdAt: string;
};

export type TwitchFollowInternalEvent = {
  type: "twitch.follow";
  id: string;
  broadcasterUserId: string;
  userId: string;
  userName: string;
  followedAt?: string;
  createdAt: string;
};

export type ParticipationEntryCreatedInternalEvent = {
  type: "participation.entryCreated";
  id: string;
  entryId: string;
  streamerId?: string;
  twitchUserId: string;
  twitchUserName: string;
  riotGameName: string;
  riotTagLine: string;
  riotPuuid?: string;
  requestedRole?: string;
  createdAt: string;
};

/* 취소/스킵/거절로 참여 큐에서 빠지는 모든 종료 상태를 하나로 묶는다 — 다시보기
   후보 무효화 관점에서는 "더 이상 active 하지 않다"만 중요하고 사유는 중요하지
   않다(2026-08-29, buildPublicLolTwitchStream 개선). */
export type ParticipationEntryRemovedInternalEvent = {
  type: "participation.entryRemoved";
  id: string;
  entryId: string;
  streamerId?: string;
  twitchUserId: string;
  riotGameName?: string;
  riotTagLine?: string;
  reason: "cancelled" | "skipped" | "rejected";
  createdAt: string;
};

export type SystemInternalEvent = {
  type: "system.started";
  id: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type BotStatus = {
  server: "online" | "offline";
  twitch: "connected" | "disconnected" | "disabled";
  stream: "online" | "offline" | "unknown";
  participation: "open" | "closed";
  startedAt?: string;
  lastStreamOnlineAt?: string;
  lastStreamOfflineAt?: string;
  postStreamReportReady?: boolean;
};
