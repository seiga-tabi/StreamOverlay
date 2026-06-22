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
  twitchUserId: string;
  twitchUserName: string;
  riotGameName: string;
  riotTagLine: string;
  riotPuuid?: string;
  requestedRole?: string;
  createdAt: string;
};

export type SystemInternalEvent = {
  type:
    | "system.started"
    | "bridge.connected"
    | "bridge.disconnected"
    | "obs.status";
  id: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type BotStatus = {
  server: "online" | "offline";
  twitch: "connected" | "disconnected" | "disabled";
  stream: "online" | "offline" | "unknown";
  bridge: "connected" | "disconnected";
  obs: "connected" | "disconnected" | "unknown";
  participation: "open" | "closed";
  startedAt?: string;
  lastStreamOnlineAt?: string;
  lastStreamOfflineAt?: string;
  postStreamReportReady?: boolean;
};
