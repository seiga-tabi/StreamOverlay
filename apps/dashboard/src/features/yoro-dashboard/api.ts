import type {
  FollowerManagementResponse,
  FollowerOAuthStatus,
  LolOperationsState,
  ParticipationGame,
  ParticipationListingVisibility,
  ParticipationState,
  ParticipationStatus,
  TwitchExtensionSettingsInput,
  TwitchExtensionSettingsResponse
} from "@streamops/shared";
import { runtimeConfig } from "../../runtime-config";
import type { DashboardStreamerInfo } from "../../api/client";

export type YoroStreamerApprovalStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

export type YoroStreamerStatus = {
  twitchConnected: boolean;
  twitchPermissionReady: boolean;
  approval: {
    status: YoroStreamerApprovalStatus;
    enabled: boolean;
    requestedAt?: string;
    reviewedAt?: string;
  };
  followerPermission: FollowerOAuthStatus;
  profile?: {
    twitchLogin: string;
    twitchDisplayName: string;
    twitchProfileImageUrl?: string;
    riotGameName?: string;
    riotTagLine?: string;
  };
  summary?: {
    activeFollowers: number;
    knownFollowers: number;
    /** 최근 7일 신규 팔로워. 예전 응답에는 없어서 optional 로 둡니다. */
    newFollowers7d?: number;
    lastSnapshotAt?: string;
  };
};

function apiBase(): string {
  return runtimeConfig().apiBase
    ?? import.meta.env?.VITE_API_BASE
    ?? "http://localhost:3000";
}

class YoroDashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "YoroDashboardApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    credentials: "include"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as
      | { code?: unknown; error?: unknown }
      | undefined;
    const code = typeof body?.code === "string"
      ? body.code
      : `streamer_api_${response.status}`;
    const message = typeof body?.error === "string" ? body.error : code;
    throw new YoroDashboardApiError(message, response.status, code);
  }
  return await response.json() as T;
}

function mutationHeaders(csrfToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Yoro-CSRF": csrfToken
  };
}

export function getYoroStreamerStatus(signal?: AbortSignal): Promise<YoroStreamerStatus> {
  return request<YoroStreamerStatus>("/api/account/streamer", { signal });
}

export function applyForStreamer(
  riotId: string,
  csrfToken: string
): Promise<Pick<YoroStreamerStatus, "approval" | "profile">> {
  return request("/api/account/streamer/apply", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({ riotId })
  });
}

export function startFollowerPermission(
  csrfToken: string
): Promise<{ url: string }> {
  return request("/api/account/streamer/permissions/start", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: "{}"
  });
}

export function getYoroFollowers(): Promise<FollowerManagementResponse> {
  return request("/api/account/streamer/followers");
}

export function refreshYoroFollowers(
  csrfToken: string
): Promise<FollowerManagementResponse> {
  return request("/api/account/streamer/followers/refresh?limit=5000", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: "{}"
  });
}

export type StreamerRiotAccount = {
  id: string;
  riotGameName: string;
  riotTagLine: string;
  riotId: string;
  status: "pending" | "approved" | "rejected";
  isMain: boolean;
  requestedAt: string;
  updatedAt: string;
  reviewedAt?: string;
  note?: string;
};

export type StreamerRiotAccountsResponse = {
  accounts: StreamerRiotAccount[];
  limit: { sub: number };
};

export function getYoroRiotAccounts(signal?: AbortSignal): Promise<StreamerRiotAccountsResponse> {
  return request("/api/account/streamer/riot-ids", { signal });
}

export function addYoroRiotAccount(
  riotId: string,
  csrfToken: string
): Promise<StreamerRiotAccountsResponse> {
  return request("/api/account/streamer/riot-ids", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({ riotId })
  });
}

export function setYoroMainRiotAccount(
  accountId: string,
  csrfToken: string
): Promise<StreamerRiotAccountsResponse> {
  return request("/api/account/streamer/riot-ids/main", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({ accountId })
  });
}

export function deleteYoroRiotAccount(
  accountId: string,
  csrfToken: string
): Promise<StreamerRiotAccountsResponse> {
  return request(`/api/account/streamer/riot-ids/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    headers: mutationHeaders(csrfToken)
  });
}

export async function updateYoroRiotId(
  riotId: string,
  csrfToken: string
): Promise<DashboardStreamerInfo> {
  const profile = await request<{
    twitchLogin: string;
    twitchDisplayName: string;
    twitchProfileImageUrl?: string;
    riotGameName: string;
    riotTagLine: string;
  }>("/api/account/streamer/riot-id", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({ riotId })
  });
  return {
    twitchUserId: "",
    ...profile,
    dashboardEnabled: true
  };
}

export type ParticipationSessionAction =
  | "start"
  | "finish"
  | "open"
  | "close"
  | "show_queue"
  | "select_next"
  | "finish_game";

export function getYoroParticipation(signal?: AbortSignal): Promise<ParticipationState> {
  return request("/api/account/streamer/participation", { signal });
}

export function updateYoroParticipationSession(
  input: {
    action: ParticipationSessionAction;
    game?: ParticipationGame;
    maxQueueSize?: number;
    allowRejoin?: boolean;
    checkInSeconds?: number;
    listingVisibility?: ParticipationListingVisibility;
    expectedRevision?: number;
  },
  csrfToken: string
): Promise<{ ok: true; action: ParticipationSessionAction; state: LolOperationsState }> {
  return request("/api/account/streamer/participation/session", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify(input)
  });
}

export function updateYoroParticipationEntry(
  entryId: string,
  status: Extract<ParticipationStatus, "selected" | "checked_in" | "in_game" | "played" | "skipped" | "no_show">,
  csrfToken: string,
  expectedRevision?: number
): Promise<ParticipationState> {
  return request("/api/account/streamer/participation/entry-status", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({ entryId, status, ...(expectedRevision === undefined ? {} : { expectedRevision }) })
  });
}

export function selectYoroParticipationEntries(
  entryIds: string[],
  csrfToken: string,
  expectedRevision?: number
): Promise<ParticipationState> {
  return request("/api/account/streamer/participation/entry-status", {
    method: "POST",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify({
      entryIds,
      status: "selected",
      ...(expectedRevision === undefined ? {} : { expectedRevision })
    })
  });
}

export function getTwitchExtensionSettings(
  signal?: AbortSignal
): Promise<TwitchExtensionSettingsResponse> {
  return request("/api/account/streamer/twitch-extension", { signal });
}

export function saveTwitchExtensionSettings(
  value: TwitchExtensionSettingsInput,
  csrfToken: string
): Promise<TwitchExtensionSettingsResponse> {
  return request("/api/account/streamer/twitch-extension", {
    method: "PUT",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify(value)
  });
}

/* 참여 모집 Discord 알림 설정.
 *
 * 후보 채널·역할은 서버가 Bot 보고 캐시에서 내려줍니다. 사용자가 채널 ID를
 * 직접 입력하는 경로는 만들지 않습니다 — 후보 밖 채널은 서버가 거부합니다.
 */
export type ParticipationAnnounceDeliverable =
  | "ok"
  | "missing_channel"
  | "missing_permission"
  | "bot_removed"
  | "blocked_by_guild";

export type ParticipationAnnounceEntry = { id: string; name: string };

export type ParticipationAnnounceTarget = {
  organizationId: string;
  organizationName: string;
  discordGuildId: string;
  guildDisplayName: string;
  channelId: string;
  channelName?: string;
  mentionRoleId?: string;
  mentionRoleName?: string;
  deliverable: ParticipationAnnounceDeliverable;
  lastDeliveredAt?: string;
};

export type ParticipationAnnounceCandidate = {
  organizationId: string;
  organizationName: string;
  discordGuildId: string;
  guildDisplayName: string;
  channels: ParticipationAnnounceEntry[];
  channelsTruncated: boolean;
  roles: ParticipationAnnounceEntry[];
  announcementAllowed: boolean;
};

export type ParticipationAnnounceSettings = {
  enabled: boolean;
  targets: ParticipationAnnounceTarget[];
  available: ParticipationAnnounceCandidate[];
};

export type ParticipationAnnounceInput = {
  enabled: boolean;
  targets: Array<{
    organizationId: string;
    discordGuildId: string;
    channelId: string;
    mentionRoleId?: string;
  }>;
};

export async function getParticipationAnnouncement(
  signal?: AbortSignal
): Promise<ParticipationAnnounceSettings | undefined> {
  try {
    return await request("/api/account/streamer/participation/announcement", { signal });
  } catch (error) {
    /* 이 GET의 404는 전역 feature flag가 꺼진 상태입니다. PUT의 404는
       Organization 경계 오류일 수 있으므로 저장 경로에서는 숨기지 않습니다. */
    if (error instanceof YoroDashboardApiError && error.status === 404) return undefined;
    throw error;
  }
}

export function saveParticipationAnnouncement(
  value: ParticipationAnnounceInput,
  csrfToken: string
): Promise<ParticipationAnnounceSettings> {
  return request("/api/account/streamer/participation/announcement", {
    method: "PUT",
    headers: mutationHeaders(csrfToken),
    body: JSON.stringify(value)
  });
}
