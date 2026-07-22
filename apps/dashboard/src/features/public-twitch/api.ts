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

export async function getPublicTwitchStatus(signal?: AbortSignal): Promise<PublicTwitchViewerStatus> {
  const response = await fetch(`${publicApiBase()}/api/public/twitch/status`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(await readPublicTwitchError(response));
  return parsePublicTwitchStatus(await response.json());
}

export async function getPublicTwitchFollowedChannels(signal?: AbortSignal): Promise<PublicTwitchFollowedLolResponse> {
  const response = await fetch(`${publicApiBase()}/api/public/twitch/followed-lol?limit=100`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(await readPublicTwitchError(response));
  return parsePublicTwitchFollowed(await response.json());
}

export async function logoutPublicTwitch(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${publicApiBase()}/api/public/twitch/logout`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(await readPublicTwitchError(response));
}

export function publicTwitchLoginUrl(returnTo: string): string {
  const query = new URLSearchParams({ return_to: returnTo });
  return `${publicApiBase()}/api/public/twitch/auth/start?${query.toString()}`;
}
