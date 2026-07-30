import { runtimeConfig } from "../../runtime-config";
import type {
  PublicTwitchFollowedLolChannel,
  PublicTwitchFollowedLolResponse,
  PublicTwitchSubscriptionChannel,
  PublicTwitchViewerStatus,
} from "../public-lol/types/public-lol";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? [...value]
    : undefined;
}

function parsePublicTwitchStatus(value: unknown): PublicTwitchViewerStatus {
  if (!isRecord(value) || typeof value.connected !== "boolean" || typeof value.configured !== "boolean") {
    throw new Error("Twitch 상태 응답 형식이 올바르지 않습니다.");
  }
  const requiredScopes = parseStringArray(value.requiredScopes);
  const missingScopes = parseStringArray(value.missingScopes);
  if (!requiredScopes || !missingScopes || !isOptionalString(value.tokenExpiresAt)) {
    throw new Error("Twitch 상태 응답 형식이 올바르지 않습니다.");
  }
  const parsed: PublicTwitchViewerStatus = {
    connected: value.connected,
    configured: value.configured,
    requiredScopes,
    missingScopes,
  };
  if (value.tokenExpiresAt !== undefined) parsed.tokenExpiresAt = value.tokenExpiresAt;
  if (value.user !== undefined) {
    if (
      !isRecord(value.user)
      || !isNonEmptyString(value.user.id)
      || !isNonEmptyString(value.user.login)
      || !isNonEmptyString(value.user.displayName)
      || !isOptionalString(value.user.profileImageUrl)
    ) {
      throw new Error("Twitch 사용자 응답 형식이 올바르지 않습니다.");
    }
    parsed.user = {
      id: value.user.id,
      login: value.user.login,
      displayName: value.user.displayName,
      ...(value.user.profileImageUrl === undefined ? {} : { profileImageUrl: value.user.profileImageUrl }),
    };
  }
  if (value.streamerRiotRequest !== undefined) {
    const request = value.streamerRiotRequest;
    if (
      !isRecord(request)
      || !["pending", "approved", "rejected"].includes(String(request.status))
      || (request.dashboardEnabled !== undefined && typeof request.dashboardEnabled !== "boolean")
    ) {
      throw new Error("Twitch 스트리머 상태 응답 형식이 올바르지 않습니다.");
    }
    parsed.streamerRiotRequest = request as NonNullable<PublicTwitchViewerStatus["streamerRiotRequest"]>;
  }
  return parsed;
}

function parseFollowedChannel(value: unknown): PublicTwitchFollowedLolChannel {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.twitchUserId)
    || !isNonEmptyString(value.twitchLogin)
    || !isNonEmptyString(value.twitchDisplayName)
    || !isNonEmptyString(value.followedAt)
    || typeof value.isLive !== "boolean"
    || !isOptionalString(value.profileImageUrl)
    || !isOptionalString(value.channelUrl)
    || !isOptionalString(value.title)
    || !isOptionalString(value.gameName)
    || !isOptionalString(value.startedAt)
    || !isOptionalString(value.thumbnailUrl)
    || (value.viewerCount !== undefined && !isNonNegativeInteger(value.viewerCount))
  ) {
    throw new Error("Twitch 팔로우 채널 응답 형식이 올바르지 않습니다.");
  }
  return value as PublicTwitchFollowedLolChannel;
}

function parseSubscription(value: unknown): PublicTwitchSubscriptionChannel {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.twitchUserId)
    || !isNonEmptyString(value.twitchLogin)
    || !isNonEmptyString(value.twitchDisplayName)
    || !isNonEmptyString(value.tier)
    || !isNonEmptyString(value.tierLabel)
    || typeof value.isGift !== "boolean"
    || !isOptionalString(value.profileImageUrl)
    || !isOptionalString(value.channelUrl)
    || !isOptionalString(value.gifterName)
  ) {
    throw new Error("Twitch 구독 채널 응답 형식이 올바르지 않습니다.");
  }
  return value as PublicTwitchSubscriptionChannel;
}

function parsePublicTwitchFollowed(value: unknown): PublicTwitchFollowedLolResponse {
  if (
    !isRecord(value)
    || typeof value.connected !== "boolean"
    || typeof value.truncated !== "boolean"
    || !isNonNegativeInteger(value.matchedCount)
    || typeof value.subscriptionScopeGranted !== "boolean"
    || (value.total !== undefined && !isNonNegativeInteger(value.total))
    || !Array.isArray(value.channels)
    || !Array.isArray(value.subscriptions)
  ) {
    throw new Error("Twitch 팔로우 응답 형식이 올바르지 않습니다.");
  }
  return {
    connected: value.connected,
    ...(value.total === undefined ? {} : { total: value.total }),
    truncated: value.truncated,
    matchedCount: value.matchedCount,
    subscriptionScopeGranted: value.subscriptionScopeGranted,
    subscriptions: value.subscriptions.map(parseSubscription),
    channels: value.channels.map(parseFollowedChannel),
  };
}

async function readPublicTwitchError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown; error?: unknown };
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // 공개 오류 본문이 JSON이 아니면 안정적인 상태 메시지를 사용합니다.
  }
  return `Twitch API 요청 실패: ${response.status}`;
}

function publicApiBase(): string {
  const configuredBase = typeof window === "undefined" ? undefined : runtimeConfig().apiBase;
  return configuredBase ?? import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";
}

type PublicTwitchCacheEntry<T> = {
  value: T;
  freshUntil: number;
  reusableUntil: number;
};

type PublicTwitchRequestOptions = {
  force?: boolean;
  includeSubscriptions?: boolean;
};

const PUBLIC_TWITCH_STATUS_FRESH_MS = 30_000;
const PUBLIC_TWITCH_FOLLOWED_FRESH_MS = 15_000;
const PUBLIC_TWITCH_REUSABLE_MS = 5 * 60_000;

let statusCache: PublicTwitchCacheEntry<PublicTwitchViewerStatus> | undefined;
let followedChannelsCache: PublicTwitchCacheEntry<PublicTwitchFollowedLolResponse> | undefined;
let followedSubscriptionsCache: PublicTwitchCacheEntry<PublicTwitchFollowedLolResponse> | undefined;
let statusRequest: Promise<PublicTwitchViewerStatus> | undefined;
const followedRequests = new Map<boolean, Promise<PublicTwitchFollowedLolResponse>>();
let cacheGeneration = 0;

function reusableValue<T>(entry: PublicTwitchCacheEntry<T> | undefined): T | undefined {
  return entry && entry.reusableUntil > Date.now() ? entry.value : undefined;
}

function freshValue<T>(entry: PublicTwitchCacheEntry<T> | undefined): T | undefined {
  return entry && entry.freshUntil > Date.now() ? entry.value : undefined;
}

function cacheEntry<T>(value: T, freshMs: number): PublicTwitchCacheEntry<T> {
  const now = Date.now();
  return {
    value,
    freshUntil: now + freshMs,
    reusableUntil: now + PUBLIC_TWITCH_REUSABLE_MS,
  };
}

function waitForSharedRequest<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    request.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export function peekPublicTwitchStatus(): PublicTwitchViewerStatus | undefined {
  return reusableValue(statusCache);
}

export function peekPublicTwitchFollowedChannels(): PublicTwitchFollowedLolResponse | undefined {
  return reusableValue(followedSubscriptionsCache) ?? reusableValue(followedChannelsCache);
}

export function invalidatePublicTwitchClientCache(): void {
  cacheGeneration += 1;
  statusCache = undefined;
  followedChannelsCache = undefined;
  followedSubscriptionsCache = undefined;
  statusRequest = undefined;
  followedRequests.clear();
}

export function getPublicTwitchStatus(
  signal?: AbortSignal,
  options: PublicTwitchRequestOptions = {},
): Promise<PublicTwitchViewerStatus> {
  const cached = options.force ? undefined : freshValue(statusCache);
  if (cached) return waitForSharedRequest(Promise.resolve(cached), signal);
  if (!statusRequest) {
    const requestGeneration = cacheGeneration;
    const request = (async () => {
      const response = await fetch(`${publicApiBase()}/api/public/twitch/status`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(await readPublicTwitchError(response));
      const status = parsePublicTwitchStatus(await response.json());
      if (requestGeneration === cacheGeneration) {
        statusCache = cacheEntry(status, PUBLIC_TWITCH_STATUS_FRESH_MS);
        if (!status.connected) {
          followedChannelsCache = undefined;
          followedSubscriptionsCache = undefined;
        }
      }
      return status;
    })();
    statusRequest = request;
    void request.then(() => {
      if (statusRequest === request) statusRequest = undefined;
    }, () => {
      if (statusRequest === request) statusRequest = undefined;
    });
  }
  return waitForSharedRequest(statusRequest!, signal);
}

export function getPublicTwitchFollowedChannels(
  signal?: AbortSignal,
  options: PublicTwitchRequestOptions = {},
): Promise<PublicTwitchFollowedLolResponse> {
  const includeSubscriptions = options.includeSubscriptions === true;
  const cached = options.force
    ? undefined
    : includeSubscriptions
      ? freshValue(followedSubscriptionsCache)
      : freshValue(followedSubscriptionsCache) ?? freshValue(followedChannelsCache);
  if (cached) return waitForSharedRequest(Promise.resolve(cached), signal);
  let followedRequest = followedRequests.get(includeSubscriptions);
  if (!followedRequest) {
    const requestGeneration = cacheGeneration;
    const request = (async () => {
      const query = includeSubscriptions ? "limit=100" : "limit=100&includeSubscriptions=0";
      const response = await fetch(`${publicApiBase()}/api/public/twitch/followed-lol?${query}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(await readPublicTwitchError(response));
      const followed = parsePublicTwitchFollowed(await response.json());
      if (requestGeneration === cacheGeneration) {
        if (includeSubscriptions) {
          followedSubscriptionsCache = cacheEntry(followed, PUBLIC_TWITCH_FOLLOWED_FRESH_MS);
        } else {
          followedChannelsCache = cacheEntry(followed, PUBLIC_TWITCH_FOLLOWED_FRESH_MS);
        }
      }
      return followed;
    })();
    followedRequests.set(includeSubscriptions, request);
    followedRequest = request;
    void request.then(() => {
      if (followedRequests.get(includeSubscriptions) === request) {
        followedRequests.delete(includeSubscriptions);
      }
    }, () => {
      if (followedRequests.get(includeSubscriptions) === request) {
        followedRequests.delete(includeSubscriptions);
      }
    });
  }
  return waitForSharedRequest(followedRequest, signal);
}

export async function logoutPublicTwitch(signal?: AbortSignal): Promise<void> {
  try {
    const response = await fetch(`${publicApiBase()}/api/public/twitch/logout`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(await readPublicTwitchError(response));
  } finally {
    invalidatePublicTwitchClientCache();
  }
}

export function publicTwitchLoginUrl(returnTo: string): string {
  const query = new URLSearchParams({ return_to: returnTo });
  return `${publicApiBase()}/api/public/twitch/auth/start?${query.toString()}`;
}
