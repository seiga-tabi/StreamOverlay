import { getDashboardCsrfToken, runtimeConfig, setDashboardCsrfToken } from "../runtime-config";

const API_BASE = runtimeConfig().apiBase ?? import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type DashboardAuthStatus = {
  required: boolean;
  configured?: boolean;
  authenticated: boolean;
  csrfToken?: string;
  expiresAt?: string;
};

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
    credentials: "include"
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function apiPostForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { ...csrfHeaders() },
    body
  });
  if (!response.ok) throw new Error(await errorMessage(path, response));
  return (await response.json()) as T;
}

export async function getDashboardAuthStatus(): Promise<DashboardAuthStatus> {
  const response = await fetch(`${API_BASE}/api/dashboard/auth/status`, { credentials: "include" });
  if (!response.ok) throw new Error(await errorMessage("/api/dashboard/auth/status", response));
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function checkDashboardAuthToken(token: string): Promise<DashboardAuthStatus> {
  const response = await fetch(`${API_BASE}/api/dashboard/auth/check`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  if (!response.ok) throw new Error(await errorMessage("/api/dashboard/auth/check", response));
  const status = (await response.json()) as DashboardAuthStatus;
  if (status.csrfToken) setDashboardCsrfToken(status.csrfToken);
  return status;
}

export async function logoutDashboardSession(): Promise<void> {
  await fetch(`${API_BASE}/api/dashboard/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: "{}"
  });
}

export const apiBase = API_BASE;
