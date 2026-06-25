import { appConfig } from "../config.js";
import type { TwitchAuthService } from "./twitch-auth.js";

type TwitchUserProfile = {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
};

type TwitchUsersResponse = {
  data?: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url?: string;
  }>;
};

export type TwitchChannelFollower = {
  userId: string;
  userLogin: string;
  userName: string;
  followedAt: string;
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

type CachedTwitchUserProfile = {
  profile: TwitchUserProfile;
  expiresAt: number;
};

type TwitchApiClientOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const USER_PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const USER_PROFILE_ERROR_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 60_000;

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
  private readonly rateLimitPauseUntilByHost = new Map<string, number>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly auth?: TwitchAuthService, options: TwitchApiClientOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? sleepMs;
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
      });
    this.userProfileRequests.set(safeUserId, request);
    return request;
  }

  async getUserProfileImageUrl(userId: string): Promise<string | undefined> {
    return (await this.getUserProfile(userId))?.profileImageUrl;
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

    return {
      followers,
      total,
      truncated: Boolean(cursor && followers.length >= max)
    };
  }

  private async fetchUserProfile(userId: string): Promise<TwitchUserProfile | undefined> {
    const url = new URL("https://api.twitch.tv/helix/users");
    url.searchParams.set("id", userId);
    const response = await this.request(url, { method: "GET" });
    if (!response?.ok) return undefined;

    const body = (await response.json()) as TwitchUsersResponse;
    const user = body.data?.[0];
    if (!user?.id) return undefined;

    return {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: this.safeHttpsUrl(user.profile_image_url)
    };
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
