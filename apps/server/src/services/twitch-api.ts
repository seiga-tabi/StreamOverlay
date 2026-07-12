import { appConfig } from "../config.js";
import type { TwitchAuthService } from "./twitch-auth.js";

type TwitchUserProfile = {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
};

export type TwitchApiAccessContext = {
  clientId: string;
  accessToken: string;
  scopes: string[];
};

type TwitchUsersResponse = {
  data?: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url?: string;
  }>;
};

export type TwitchStreamStatus = {
  userId: string;
  userLogin: string;
  userName: string;
  title?: string;
  gameId?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
};

type TwitchStreamsResponse = {
  data?: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id?: string;
    game_name?: string;
    title?: string;
    viewer_count?: number;
    started_at?: string;
    thumbnail_url?: string;
  }>;
};

export type TwitchChannelFollower = {
  userId: string;
  userLogin: string;
  userName: string;
  followedAt: string;
  profileImageUrl?: string;
};

type TwitchChannelFollowersResponse = {
  total?: number;
  data?: Array<{
    user_id: string;
    user_login: string;
    user_name: string;
    followed_at: string;
  }>;
  pagination?: {
    cursor?: string;
  };
};

export type TwitchFollowedChannel = {
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  profileImageUrl?: string;
  followedAt: string;
};

type TwitchFollowedChannelsResponse = {
  total?: number;
  data?: Array<{
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    followed_at: string;
  }>;
  pagination?: {
    cursor?: string;
  };
};

export type TwitchUserSubscription = {
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  tier: string;
  isGift: boolean;
  gifterId?: string;
  gifterLogin?: string;
  gifterName?: string;
};

type TwitchUserSubscriptionResponse = {
  data?: Array<{
    broadcaster_id: string;
    broadcaster_login: string;
    broadcaster_name: string;
    tier: string;
    is_gift?: boolean;
    gifter_id?: string;
    gifter_login?: string;
    gifter_name?: string;
  }>;
};

type CachedTwitchUserProfile = {
  profile: TwitchUserProfile;
  expiresAt: number;
};

type CachedTwitchUserSubscription = {
  subscription?: TwitchUserSubscription;
  expiresAt: number;
};

type CachedTwitchStreamStatus = {
  stream?: TwitchStreamStatus;
  expiresAt: number;
};

type CachedTwitchAppAccessContext = {
  context: TwitchApiAccessContext;
  expiresAt: number;
};

type TwitchApiClientOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const USER_PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const USER_PROFILE_ERROR_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAM_STATUS_LIVE_CACHE_TTL_MS = 10 * 1000;
const STREAM_STATUS_OFFLINE_CACHE_TTL_MS = 30 * 1000;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000;
const APP_ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;
const TWITCH_MEMORY_CACHE_MAX = 2000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeHost(url: string | URL): string {
  try {
    return new URL(String(url)).host;
  } catch {
    return "api.twitch.tv";
  }
}

function headerNumber(response: Response, name: string): number | undefined {
  const raw = response.headers.get(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export class TwitchApiClient {
  private readonly userProfileCache = new Map<string, CachedTwitchUserProfile>();
  private readonly userProfileRequests = new Map<string, Promise<TwitchUserProfile | undefined>>();
  private readonly userSubscriptionCache = new Map<string, CachedTwitchUserSubscription>();
  private readonly streamStatusCache = new Map<string, CachedTwitchStreamStatus>();
  private readonly streamStatusRequests = new Map<string, Promise<TwitchStreamStatus | undefined>>();
  private readonly streamStatusCacheVersions = new Map<string, number>();
  private streamStatusGlobalCacheVersion = 0;
  private appAccessContext?: CachedTwitchAppAccessContext;
  private readonly rateLimitPauseUntilByHost = new Map<string, number>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly auth?: TwitchAuthService, options: TwitchApiClientOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? sleepMs;
  }

  private pruneCache<K, V>(cache: Map<K, V>, maxSize = TWITCH_MEMORY_CACHE_MAX): void {
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }

  isConfigured(): boolean {
    return Boolean(appConfig.twitch.clientId && appConfig.twitch.userAccessToken && appConfig.twitch.broadcasterId);
  }

  async getBroadcasterId(): Promise<string | undefined> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: true });
    return authContext?.broadcasterId;
  }

  async getChatSenderId(): Promise<string | undefined> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: true });
    return authContext?.senderId;
  }

  async getEventSubAccessContext(): Promise<{
    broadcasterId: string;
    senderId: string;
    scopes: string[];
  } | undefined> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: false });
    if (!authContext || authContext.source !== "oauth") return undefined;
    return {
      broadcasterId: authContext.broadcasterId,
      senderId: authContext.senderId,
      scopes: authContext.scopes
    };
  }

  async createEventSubSubscription(type: string, version: string, condition: Record<string, string>, sessionId: string): Promise<"created" | "duplicate"> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: false });
    if (!authContext) throw new Error("Twitch API is not configured");
    const body = {
      type,
      version,
      condition,
      transport: {
        method: "websocket",
        session_id: sessionId
      }
    };
    const response = await this.request("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (response?.status === 409) return "duplicate";
    if (!response?.ok) throw new Error(`EventSub subscription failed: ${type}: ${response?.status ?? "not_configured"}`);
    return "created";
  }

  async updateRedemptionStatus(input: {
    rewardId: string;
    redemptionId: string;
    status: "FULFILLED" | "CANCELED";
  }): Promise<void> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: true });
    if (!authContext) return;
    const url = new URL("https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions");
    url.searchParams.set("broadcaster_id", authContext.broadcasterId);
    url.searchParams.set("reward_id", input.rewardId);
    url.searchParams.set("id", input.redemptionId);
    const response = await this.request(url, {
      method: "PATCH",
      body: JSON.stringify({ status: input.status })
    });
    if (!response?.ok) throw new Error(`Redemption update failed: ${response?.status ?? "not_configured"}`);
  }

  async getUserProfile(userId: string): Promise<TwitchUserProfile | undefined> {
    const safeUserId = userId.trim();
    if (!/^\d{1,32}$/.test(safeUserId)) return undefined;

    const cached = this.userProfileCache.get(safeUserId);
    if (cached && cached.expiresAt > Date.now()) return cached.profile;

    const pending = this.userProfileRequests.get(safeUserId);
    if (pending) return pending;

    const request = this.fetchUserProfile(safeUserId)
      .then((profile) => {
        if (profile) {
          this.userProfileCache.set(safeUserId, { profile, expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS });
          return profile;
        }
        this.userProfileCache.set(safeUserId, {
          profile: { id: safeUserId, login: "", displayName: "" },
          expiresAt: Date.now() + USER_PROFILE_ERROR_CACHE_TTL_MS
        });
        return undefined;
      })
      .finally(() => {
        this.userProfileRequests.delete(safeUserId);
        this.pruneCache(this.userProfileCache);
      });
    this.userProfileRequests.set(safeUserId, request);
    return request;
  }

  async getUserProfileImageUrl(userId: string): Promise<string | undefined> {
    return (await this.getUserProfile(userId))?.profileImageUrl;
  }

  async getUserProfiles(userIds: readonly string[], context?: TwitchApiAccessContext): Promise<Map<string, TwitchUserProfile>> {
    const safeUserIds = [...new Set(userIds.map((userId) => userId.trim()).filter((userId) => /^\d{1,32}$/.test(userId)))];
    const profiles = new Map<string, TwitchUserProfile>();
    const missingUserIds: string[] = [];

    for (const userId of safeUserIds) {
      const cached = this.userProfileCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        if (cached.profile.login || cached.profile.displayName || cached.profile.profileImageUrl) {
          profiles.set(userId, cached.profile);
        }
        continue;
      }
      missingUserIds.push(userId);
    }

    for (let index = 0; index < missingUserIds.length; index += 100) {
      const chunk = missingUserIds.slice(index, index + 100);
      const fetchedProfiles = await this.fetchUserProfiles(chunk, context);
      for (const [userId, profile] of fetchedProfiles) {
        this.userProfileCache.set(userId, { profile, expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS });
        profiles.set(userId, profile);
      }
      for (const userId of chunk) {
        if (fetchedProfiles.has(userId)) continue;
        this.userProfileCache.set(userId, {
          profile: { id: userId, login: "", displayName: "" },
          expiresAt: Date.now() + USER_PROFILE_ERROR_CACHE_TTL_MS
        });
      }
    }

    this.pruneCache(this.userProfileCache);
    return profiles;
  }

  clearStreamStatusCache(userId?: string): void {
    const safeUserId = userId?.trim();
    if (safeUserId) {
      this.streamStatusCache.delete(safeUserId);
      this.streamStatusRequests.delete(safeUserId);
      this.streamStatusCacheVersions.set(safeUserId, (this.streamStatusCacheVersions.get(safeUserId) ?? 0) + 1);
      this.pruneCache(this.streamStatusCacheVersions);
      return;
    }
    this.streamStatusCache.clear();
    this.streamStatusRequests.clear();
    this.streamStatusCacheVersions.clear();
    this.streamStatusGlobalCacheVersion += 1;
  }

  async getStreamByUserId(userId: string): Promise<TwitchStreamStatus | undefined> {
    const safeUserId = userId.trim();
    if (!/^\d{1,32}$/.test(safeUserId)) return undefined;

    const cached = this.streamStatusCache.get(safeUserId);
    if (cached && cached.expiresAt > Date.now()) return cached.stream;

    const pending = this.streamStatusRequests.get(safeUserId);
    if (pending) return pending;

    const cacheVersion = this.streamStatusCacheVersion(safeUserId);
    const request = this.fetchStreamByUserId(safeUserId)
      .then((stream) => {
        if (this.streamStatusCacheVersion(safeUserId) === cacheVersion) {
          this.streamStatusCache.set(safeUserId, {
            stream,
            expiresAt: Date.now() + (stream ? STREAM_STATUS_LIVE_CACHE_TTL_MS : STREAM_STATUS_OFFLINE_CACHE_TTL_MS)
          });
        }
        return stream;
      })
      .finally(() => {
        this.streamStatusRequests.delete(safeUserId);
        this.pruneCache(this.streamStatusCache);
      });
    this.streamStatusRequests.set(safeUserId, request);
    return request;
  }

  async getStreamByUserLogin(login: string): Promise<TwitchStreamStatus | undefined> {
    const safeLogin = login.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,32}$/.test(safeLogin)) return undefined;

    const cacheKey = `login:${safeLogin}`;
    const cached = this.streamStatusCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.stream;

    const pending = this.streamStatusRequests.get(cacheKey);
    if (pending) return pending;

    const cacheVersion = this.streamStatusCacheVersion(cacheKey);
    const request = this.fetchStreamByUserLogin(safeLogin)
      .then((stream) => {
        if (this.streamStatusCacheVersion(cacheKey) === cacheVersion) {
          this.streamStatusCache.set(cacheKey, {
            stream,
            expiresAt: Date.now() + (stream ? STREAM_STATUS_LIVE_CACHE_TTL_MS : STREAM_STATUS_OFFLINE_CACHE_TTL_MS)
          });
        }
        return stream;
      })
      .finally(() => {
        this.streamStatusRequests.delete(cacheKey);
        this.pruneCache(this.streamStatusCache);
      });
    this.streamStatusRequests.set(cacheKey, request);
    return request;
  }

  private streamStatusCacheVersion(userId: string): string {
    return `${this.streamStatusGlobalCacheVersion}:${this.streamStatusCacheVersions.get(userId) ?? 0}`;
  }

  async getStreamsByUserIds(context: TwitchApiAccessContext, userIds: readonly string[]): Promise<Map<string, TwitchStreamStatus>> {
    const safeUserIds = [...new Set(userIds.map((userId) => userId.trim()).filter((userId) => /^\d{1,32}$/.test(userId)))].slice(0, 100);
    const streams = new Map<string, TwitchStreamStatus>();
    if (safeUserIds.length === 0) return streams;

    const url = new URL("https://api.twitch.tv/helix/streams");
    for (const userId of safeUserIds) url.searchParams.append("user_id", userId);
    const response = await this.requestWithAccessContext(url, { method: "GET" }, context);
    if (!response.ok) throw new Error(`Twitch stream lookup failed: ${response.status}`);
    const body = (await response.json()) as TwitchStreamsResponse;
    for (const stream of body.data ?? []) {
      if (!stream.user_id) continue;
      streams.set(stream.user_id, {
        userId: stream.user_id,
        userLogin: stream.user_login,
        userName: stream.user_name || stream.user_login,
        title: stream.title,
        gameId: stream.game_id,
        gameName: stream.game_name,
        viewerCount: typeof stream.viewer_count === "number" ? Math.max(0, Math.trunc(stream.viewer_count)) : undefined,
        startedAt: stream.started_at,
        thumbnailUrl: this.safeHttpsUrl(stream.thumbnail_url)
      });
    }
    return streams;
  }

  async getChannelFollowers(limit = 5000): Promise<{
    followers: TwitchChannelFollower[];
    total?: number;
    truncated: boolean;
  }> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: false });
    if (!authContext) throw new Error("Twitch OAuth user access token이 없습니다.");
    if (!authContext.scopes.includes("moderator:read:followers")) {
      throw new Error("moderator:read:followers scope가 필요합니다.");
    }

    const followers: TwitchChannelFollower[] = [];
    let cursor: string | undefined;
    let total: number | undefined;
    const max = Math.max(1, Math.min(Math.trunc(limit), 5000));

    do {
      const url = new URL("https://api.twitch.tv/helix/channels/followers");
      url.searchParams.set("broadcaster_id", authContext.broadcasterId);
      url.searchParams.set("first", String(Math.min(100, max - followers.length)));
      if (cursor) url.searchParams.set("after", cursor);

      const response = await this.request(url, { method: "GET" });
      if (!response?.ok) throw new Error(`Twitch follower lookup failed: ${response?.status ?? "not_configured"}`);
      const body = (await response.json()) as TwitchChannelFollowersResponse;
      total = typeof body.total === "number" ? body.total : total;

      for (const item of body.data ?? []) {
        if (!item.user_id) continue;
        followers.push({
          userId: item.user_id,
          userLogin: item.user_login,
          userName: item.user_name || item.user_login || item.user_id,
          followedAt: item.followed_at
        });
      }
      cursor = body.pagination?.cursor;
    } while (cursor && followers.length < max);

    const profiles = await this.getUserProfiles(followers.map((follower) => follower.userId));
    for (const follower of followers) {
      follower.profileImageUrl = profiles.get(follower.userId)?.profileImageUrl;
    }

    return {
      followers,
      total,
      truncated: Boolean(cursor && followers.length >= max)
    };
  }

  async getFollowedChannels(context: TwitchApiAccessContext & { userId: string }, limit = 100): Promise<{
    channels: TwitchFollowedChannel[];
    total?: number;
    truncated: boolean;
  }> {
    const safeUserId = context.userId.trim();
    if (!/^\d{1,32}$/.test(safeUserId)) throw new Error("Twitch user_id가 유효하지 않습니다.");
    if (!context.scopes.includes("user:read:follows")) {
      throw new Error("user:read:follows scope가 필요합니다.");
    }

    const channels: TwitchFollowedChannel[] = [];
    let cursor: string | undefined;
    let total: number | undefined;
    const max = Math.max(1, Math.min(Math.trunc(limit), 1000));

    do {
      const url = new URL("https://api.twitch.tv/helix/channels/followed");
      url.searchParams.set("user_id", safeUserId);
      url.searchParams.set("first", String(Math.min(100, max - channels.length)));
      if (cursor) url.searchParams.set("after", cursor);

      const response = await this.requestWithAccessContext(url, { method: "GET" }, context);
      if (!response.ok) throw new Error(`Twitch followed channel lookup failed: ${response.status}`);
      const body = (await response.json()) as TwitchFollowedChannelsResponse;
      total = typeof body.total === "number" ? body.total : total;

      for (const item of body.data ?? []) {
        if (!item.broadcaster_id) continue;
        channels.push({
          broadcasterId: item.broadcaster_id,
          broadcasterLogin: item.broadcaster_login,
          broadcasterName: item.broadcaster_name || item.broadcaster_login || item.broadcaster_id,
          followedAt: item.followed_at
        });
      }
      cursor = body.pagination?.cursor;
    } while (cursor && channels.length < max);

    const profiles = await this.getUserProfiles(channels.map((channel) => channel.broadcasterId), context);
    for (const channel of channels) {
      channel.profileImageUrl = profiles.get(channel.broadcasterId)?.profileImageUrl;
    }

    return {
      channels,
      total,
      truncated: Boolean(cursor && channels.length >= max)
    };
  }

  async checkUserSubscriptions(
    context: TwitchApiAccessContext & { userId: string },
    broadcasterIds: readonly string[]
  ): Promise<Map<string, TwitchUserSubscription>> {
    const safeUserId = context.userId.trim();
    if (!/^\d{1,32}$/.test(safeUserId)) throw new Error("Twitch user_id가 유효하지 않습니다.");
    if (!context.scopes.includes("user:read:subscriptions")) {
      throw new Error("user:read:subscriptions scope가 필요합니다.");
    }

    const safeBroadcasterIds = [...new Set(broadcasterIds.map((id) => id.trim()).filter((id) => /^\d{1,32}$/.test(id)))].slice(0, 100);
    const subscriptions = new Map<string, TwitchUserSubscription>();
    const missingBroadcasterIds: string[] = [];

    for (const broadcasterId of safeBroadcasterIds) {
      const cacheKey = `${safeUserId}:${broadcasterId}`;
      const cached = this.userSubscriptionCache.get(cacheKey);
      if (cached && cached.expiresAt > this.now()) {
        if (cached.subscription) subscriptions.set(broadcasterId, cached.subscription);
        continue;
      }
      missingBroadcasterIds.push(broadcasterId);
    }

    for (const broadcasterId of missingBroadcasterIds) {
      const subscription = await this.fetchUserSubscription(context, safeUserId, broadcasterId);
      this.userSubscriptionCache.set(`${safeUserId}:${broadcasterId}`, {
        subscription,
        expiresAt: this.now() + USER_SUBSCRIPTION_CACHE_TTL_MS
      });
      if (subscription) subscriptions.set(broadcasterId, subscription);
    }

    this.pruneCache(this.userSubscriptionCache);
    return subscriptions;
  }

  private async fetchUserProfile(userId: string): Promise<TwitchUserProfile | undefined> {
    return (await this.fetchUserProfiles([userId])).get(userId);
  }

  private async fetchUserProfiles(userIds: readonly string[], context?: TwitchApiAccessContext): Promise<Map<string, TwitchUserProfile>> {
    const profiles = new Map<string, TwitchUserProfile>();
    if (userIds.length === 0) return profiles;

    const url = new URL("https://api.twitch.tv/helix/users");
    for (const userId of userIds.slice(0, 100)) url.searchParams.append("id", userId);
    const response = context
      ? await this.requestWithAccessContext(url, { method: "GET" }, context)
      : await this.request(url, { method: "GET" });
    if (!response?.ok) return profiles;

    const body = (await response.json()) as TwitchUsersResponse;
    for (const user of body.data ?? []) {
      if (!user?.id) continue;
      profiles.set(user.id, {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: this.safeHttpsUrl(user.profile_image_url)
      });
    }

    return profiles;
  }

  private async fetchUserSubscription(
    context: TwitchApiAccessContext,
    userId: string,
    broadcasterId: string
  ): Promise<TwitchUserSubscription | undefined> {
    const url = new URL("https://api.twitch.tv/helix/subscriptions/user");
    url.searchParams.set("broadcaster_id", broadcasterId);
    url.searchParams.set("user_id", userId);
    const response = await this.requestWithAccessContext(url, { method: "GET" }, context);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Twitch user subscription lookup failed: ${response.status}`);

    const body = (await response.json()) as TwitchUserSubscriptionResponse;
    const item = body.data?.[0];
    if (!item?.broadcaster_id) return undefined;
    return {
      broadcasterId: item.broadcaster_id,
      broadcasterLogin: item.broadcaster_login,
      broadcasterName: item.broadcaster_name || item.broadcaster_login || item.broadcaster_id,
      tier: item.tier,
      isGift: Boolean(item.is_gift),
      gifterId: item.gifter_id,
      gifterLogin: item.gifter_login,
      gifterName: item.gifter_name
    };
  }

  private async fetchStreamByUserId(userId: string): Promise<TwitchStreamStatus | undefined> {
    const url = new URL("https://api.twitch.tv/helix/streams");
    url.searchParams.set("user_id", userId);
    return this.fetchStream(url);
  }

  private async fetchStreamByUserLogin(login: string): Promise<TwitchStreamStatus | undefined> {
    const url = new URL("https://api.twitch.tv/helix/streams");
    url.searchParams.set("user_login", login);
    return this.fetchStream(url);
  }

  private async fetchStream(url: URL): Promise<TwitchStreamStatus | undefined> {
    let response = await this.request(url, { method: "GET" });
    if (!response?.ok) {
      const appContext = await this.getAppAccessContext();
      response = appContext ? await this.requestWithAccessContext(url, { method: "GET" }, appContext) : response;
    }
    if (!response) throw new Error("Twitch stream lookup failed: not_configured");
    if (!response.ok) throw new Error(`Twitch stream lookup failed: ${response.status}`);

    const body = (await response.json()) as TwitchStreamsResponse;
    const stream = body.data?.[0];
    if (!stream?.user_id) return undefined;
    return {
      userId: stream.user_id,
      userLogin: stream.user_login,
      userName: stream.user_name || stream.user_login,
      title: stream.title,
      gameId: stream.game_id,
      gameName: stream.game_name,
      viewerCount: typeof stream.viewer_count === "number" ? Math.max(0, Math.trunc(stream.viewer_count)) : undefined,
      startedAt: stream.started_at,
      thumbnailUrl: this.safeHttpsUrl(stream.thumbnail_url)
    };
  }

  private async getAppAccessContext(): Promise<TwitchApiAccessContext | undefined> {
    if (!appConfig.twitch.clientId || !appConfig.twitch.clientSecret) return undefined;
    if (this.appAccessContext && this.appAccessContext.expiresAt > this.now() + APP_ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return this.appAccessContext.context;
    }

    const url = new URL("https://id.twitch.tv/oauth2/token");
    const host = safeHost(url);
    await this.waitForRateLimit(host);
    const body = new URLSearchParams({
      client_id: appConfig.twitch.clientId,
      client_secret: appConfig.twitch.clientSecret,
      grant_type: "client_credentials"
    });
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    this.observeRateLimit(host, response);
    if (!response.ok) return undefined;

    const token = await response.json() as {
      access_token?: string;
      expires_in?: number;
      scope?: string[];
    };
    const accessToken = typeof token.access_token === "string" ? token.access_token.trim() : "";
    if (!accessToken) return undefined;
    const expiresInMs = Math.max(60_000, Math.trunc(Number(token.expires_in ?? 3600)) * 1000);
    const context: TwitchApiAccessContext = {
      clientId: appConfig.twitch.clientId,
      accessToken,
      scopes: Array.isArray(token.scope) ? token.scope.filter((scope): scope is string => typeof scope === "string") : []
    };
    this.appAccessContext = {
      context,
      expiresAt: this.now() + expiresInMs
    };
    return context;
  }

  private safeHttpsUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private async request(url: string | URL, init: RequestInit): Promise<Response | undefined> {
    const authContext = await this.auth?.getAccessContext({ refreshIfExpired: true, allowLegacy: true });
    if (!authContext) return undefined;
    const host = safeHost(url);
    await this.waitForRateLimit(host);

    const response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": authContext.clientId,
        Authorization: `Bearer ${authContext.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
    this.observeRateLimit(host, response);

    if (response.status !== 401 || authContext.source !== "oauth" || !this.auth) return response;
    const refreshed = await this.auth.refreshAfterUnauthorized();
    if (!refreshed) return response;
    const retryContext = await this.auth.getAccessContext({ refreshIfExpired: true, allowLegacy: false });
    if (!retryContext) return response;
    await this.waitForRateLimit(host);
    const retryResponse = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": retryContext.clientId,
        Authorization: `Bearer ${retryContext.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
    this.observeRateLimit(host, retryResponse);
    return retryResponse;
  }

  private async requestWithAccessContext(url: string | URL, init: RequestInit, context: TwitchApiAccessContext): Promise<Response> {
    const host = safeHost(url);
    await this.waitForRateLimit(host);
    const response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": context.clientId,
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
    this.observeRateLimit(host, response);
    return response;
  }

  private async waitForRateLimit(host: string): Promise<void> {
    const pauseUntil = this.rateLimitPauseUntilByHost.get(host) ?? 0;
    const waitMs = pauseUntil - this.now();
    if (waitMs > 0) await this.sleep(waitMs);
  }

  private observeRateLimit(host: string, response: Response): void {
    const resetSeconds = headerNumber(response, "ratelimit-reset");
    const resetAt = resetSeconds ? resetSeconds * 1000 : undefined;
    const retryAfterSeconds = headerNumber(response, "retry-after");
    const retryAfterUntil = retryAfterSeconds ? this.now() + Math.max(0, retryAfterSeconds * 1000) : undefined;
    const remaining = headerNumber(response, "ratelimit-remaining");

    let pauseUntil: number | undefined;
    if (response.status === 429) {
      pauseUntil = resetAt && resetAt > this.now()
        ? resetAt
        : retryAfterUntil ?? this.now() + DEFAULT_RATE_LIMIT_BACKOFF_MS;
    } else if (remaining !== undefined && remaining <= 0 && resetAt && resetAt > this.now()) {
      pauseUntil = resetAt;
    }

    if (!pauseUntil) return;
    this.rateLimitPauseUntilByHost.set(host, Math.max(this.rateLimitPauseUntilByHost.get(host) ?? 0, pauseUntil));
  }
}
