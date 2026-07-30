import type {
  FollowerManagementResponse,
  FollowerOAuthStatus
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
    lastSnapshotAt?: string;
  };
};

function apiBase(): string {
  return runtimeConfig().apiBase
    ?? import.meta.env?.VITE_API_BASE
    ?? "http://localhost:3000";
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
    throw new Error(message);
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
