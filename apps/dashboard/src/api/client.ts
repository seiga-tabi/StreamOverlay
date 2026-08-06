import { getDashboardCsrfToken, runtimeConfig, setDashboardCsrfToken } from "../runtime-config";
import type { CommunityModerationSnapshot } from "@streamops/shared";

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
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: DashboardStreamerProfileLink[];
  dashboardEnabled?: boolean;
};

export type DashboardSnapshot = {
  type: "dashboard.snapshot";
  status: unknown;
  events: unknown[];
  actions: unknown[];
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

export class DashboardApiError extends Error {
  readonly name = "DashboardApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

function surfaceHeaders(): Record<string, string> {
  return { "X-StreamOps-Dashboard-Surface": "admin" };
}

function csrfHeaders(): Record<string, string> {
  const csrfToken = getDashboardCsrfToken();
  return csrfToken ? { "X-StreamOps-CSRF": csrfToken } : {};
}

async function responseError(path: string, response: Response): Promise<DashboardApiError> {
  const fallback = `${path} failed: ${response.status}`;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { code?: unknown; error?: unknown; message?: unknown };
      const detail = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
      const code = typeof body.code === "string" && /^[a-z0-9_]{1,64}$/i.test(body.code)
        ? body.code
        : undefined;
      return new DashboardApiError(detail ? `${fallback} - ${detail}` : fallback, response.status, code);
    }
    const detail = (await response.text()).trim();
    return new DashboardApiError(detail ? `${fallback} - ${detail}` : fallback, response.status);
  } catch {
    return new DashboardApiError(fallback, response.status);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...surfaceHeaders() }
  });
  if (!response.ok) throw await responseError(path, response);
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders(), ...csrfHeaders() },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await responseError(path, response);
  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...surfaceHeaders(), ...csrfHeaders() }
  });
  if (!response.ok) throw await responseError(path, response);
  return (await response.json()) as T;
}

export async function getDashboardAuthStatus(): Promise<DashboardAuthStatus> {
  const query = new URLSearchParams({ surface: "admin" });
  const response = await fetch(`${API_BASE}/api/dashboard/auth/status?${query.toString()}`, {
    credentials: "include",
    headers: { ...surfaceHeaders() }
  });
  if (!response.ok) throw await responseError("/api/dashboard/auth/status", response);
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function checkDashboardAuthToken(token: string): Promise<DashboardAuthStatus> {
  const response = await fetch(`${API_BASE}/api/dashboard/auth/check`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders() },
    body: JSON.stringify({ token })
  });
  if (!response.ok) throw await responseError("/api/dashboard/auth/check", response);
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function logoutDashboardSession(): Promise<void> {
  const query = new URLSearchParams({ surface: "admin" });
  await fetch(`${API_BASE}/api/dashboard/auth/logout?${query.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...surfaceHeaders(), ...csrfHeaders() },
    body: "{}"
  });
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [status, events, actions] = await Promise.all([
    apiGet<unknown>("/api/status"),
    apiGet<unknown[]>("/api/events/recent"),
    apiGet<unknown[]>("/api/actions/recent")
  ]);
  return { type: "dashboard.snapshot", status, events, actions };
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
