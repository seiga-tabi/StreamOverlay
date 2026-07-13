import { getDashboardCsrfToken, runtimeConfig, setDashboardCsrfToken } from "../runtime-config";
import type { CommunityModerationSnapshot, StreamerTournament, TournamentUpsertInput } from "@streamops/shared";

const API_BASE = runtimeConfig().apiBase ?? import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type DashboardStreamerProfileLink = {
  id: string;
  url: string;
  label: string;
  platform?: string;
};

export type DashboardStreamerInfo = {
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  twitchProfileImageUrl?: string;
  riotGameName: string;
  riotTagLine: string;
  overlaySlug?: string;
  overlayKey?: string;
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: DashboardStreamerProfileLink[];
  dashboardEnabled?: boolean;
};

export type DashboardAuthStatus = {
  required: boolean;
  configured?: boolean;
  authenticated: boolean;
  role?: "admin" | "streamer";
  csrfToken?: string;
  expiresAt?: string;
  streamer?: DashboardStreamerInfo;
};

export type DashboardAuthSurface = "admin" | "streamer";

let dashboardAuthSurface: DashboardAuthSurface = "admin";

export function setDashboardAuthSurface(surface: DashboardAuthSurface): void {
  dashboardAuthSurface = surface;
}

function surfaceHeaders(surface: DashboardAuthSurface = dashboardAuthSurface): Record<string, string> {
  return { "X-StreamOps-Dashboard-Surface": surface };
}

function csrfHeaders(): Record<string, string> {
  const csrfToken = getDashboardCsrfToken();
  return csrfToken ? { "X-StreamOps-CSRF": csrfToken } : {};
}

async function errorMessage(path: string, response: Response): Promise<string> {
  const fallback = `${path} failed: ${response.status}`;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { error?: unknown; message?: unknown };
      const detail = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
      return detail ? `${fallback} - ${detail}` : fallback;
    }
    const detail = (await response.text()).trim();
    return detail ? `${fallback} - ${detail}` : fallback;
  } catch {
    return fallback;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...surfaceHeaders() }
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders(), ...csrfHeaders() },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...surfaceHeaders(), ...csrfHeaders() }
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { ...surfaceHeaders(), ...csrfHeaders() },
    body
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function getDashboardAuthStatus(surface: DashboardAuthSurface = dashboardAuthSurface): Promise<DashboardAuthStatus> {
  setDashboardAuthSurface(surface);
  const query = new URLSearchParams({ surface });
  const response = await fetch(`${API_BASE}/api/dashboard/auth/status?${query.toString()}`, {
    credentials: "include",
    headers: { ...surfaceHeaders(surface) }
  });
  if (!response.ok) throw new Error(await errorMessage("/api/dashboard/auth/status", response));
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function checkDashboardAuthToken(token: string): Promise<DashboardAuthStatus> {
  setDashboardAuthSurface("admin");
  const response = await fetch(`${API_BASE}/api/dashboard/auth/check`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders("admin") },
    body: JSON.stringify({ token })
  });
  if (!response.ok) throw new Error(await errorMessage("/api/dashboard/auth/check", response));
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function logoutDashboardSession(surface: DashboardAuthSurface = dashboardAuthSurface): Promise<void> {
  const query = new URLSearchParams({ surface });
  await fetch(`${API_BASE}/api/dashboard/auth/logout?${query.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders(surface), ...csrfHeaders() },
    body: "{}"
  });
}

export async function updateStreamerProfileLink(body: {
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: Array<{
    id?: string;
    url: string;
    label?: string;
    platform?: string;
  }>;
}): Promise<DashboardStreamerInfo> {
  const result = await apiPost<{ streamer: DashboardStreamerInfo }>("/api/participation/streamer-profile-link", body);
  return result.streamer;
}

export async function updateStreamerRiotId(riotId: string): Promise<DashboardStreamerInfo> {
  const result = await apiPost<{ streamer: DashboardStreamerInfo }>("/api/participation/streamer-riot-id", { riotId });
  return result.streamer;
}

export async function getDashboardTournaments(): Promise<StreamerTournament[]> {
  const result = await apiGet<{ tournaments: StreamerTournament[] }>("/api/tournaments");
  return result.tournaments;
}

export async function saveDashboardTournament(body: TournamentUpsertInput): Promise<StreamerTournament[]> {
  const result = await apiPost<{ tournament: StreamerTournament; tournaments: StreamerTournament[] }>("/api/tournaments", body);
  return result.tournaments;
}

export async function deleteDashboardTournament(id: string): Promise<StreamerTournament[]> {
  const result = await apiDelete<{ tournaments: StreamerTournament[] }>(`/api/tournaments/${encodeURIComponent(id)}`);
  return result.tournaments;
}

export async function getCommunityModeration(): Promise<CommunityModerationSnapshot> {
  return apiGet<CommunityModerationSnapshot>("/api/community/moderation");
}

export async function updateCommunityPostVisibility(input: {
  postId: string;
  visibility: "visible" | "hidden";
  reason?: string;
}): Promise<CommunityModerationSnapshot> {
  return apiPost<CommunityModerationSnapshot>(
    `/api/community/moderation/posts/${encodeURIComponent(input.postId)}/visibility`,
    { visibility: input.visibility, reason: input.reason }
  );
}

export async function updateCommunityUserSanction(input: {
  twitchUserId: string;
  twitchLogin?: string;
  active: boolean;
  reason?: string;
  expiresAt?: string;
}): Promise<CommunityModerationSnapshot> {
  return apiPost<CommunityModerationSnapshot>(
    `/api/community/moderation/users/${encodeURIComponent(input.twitchUserId)}/sanction`,
    input
  );
}

export const apiBase = API_BASE;
