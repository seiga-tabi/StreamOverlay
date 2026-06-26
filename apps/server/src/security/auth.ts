import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appConfig, originAllowed } from "../config.js";

export type PrincipalType = "PUBLIC" | "DASHBOARD_ADMIN" | "OVERLAY_CLIENT" | "BRIDGE_SERVICE" | "OAUTH_CALLBACK";

export type AuthPrincipal =
  | { type: "PUBLIC" }
  | { type: "DASHBOARD_ADMIN"; method: "session" | "token"; sessionId?: string; csrfToken?: string }
  | { type: "OVERLAY_CLIENT" }
  | { type: "BRIDGE_SERVICE" }
  | { type: "OAUTH_CALLBACK" };

export type AuthFailureCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "CSRF_REQUIRED"
  | "ORIGIN_DENIED";

export type AuthResult =
  | { ok: true; principal: AuthPrincipal }
  | { ok: false; status: 401 | 403; code: AuthFailureCode; message: string };

export type DashboardSession = {
  id: string;
  csrfToken: string;
  expiresAt: number;
};

export const DASHBOARD_SESSION_COOKIE = "streamops_dashboard_session";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class DashboardSessionStore {
  private readonly sessions = new Map<string, DashboardSession>();

  create(): DashboardSession {
    this.prune();
    const session: DashboardSession = {
      id: crypto.randomBytes(32).toString("base64url"),
      csrfToken: crypto.randomBytes(32).toString("base64url"),
      expiresAt: Date.now() + appConfig.security.dashboardSessionTtlMs
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string | undefined): DashboardSession | undefined {
    if (!id) return undefined;
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  revoke(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }

  clear(): void {
    this.sessions.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }
}

export function tokenMatches(expected: string, candidate: string | undefined): boolean {
  if (!expected || !candidate) return false;
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  if (expectedBuffer.byteLength !== candidateBuffer.byteLength) return false;
  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

export function dashboardSessionIdFromRequest(req: IncomingMessage): string | undefined {
  return parseCookies(req)[DASHBOARD_SESSION_COOKIE];
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(req: IncomingMessage): string | undefined {
  const authorization = headerValue(req.headers.authorization);
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

export function authenticateDashboardRequest(req: IncomingMessage, sessions: DashboardSessionStore): AuthPrincipal | undefined {
  if (appConfig.security.localNoAuth) return { type: "DASHBOARD_ADMIN", method: "token" };
  const token = appConfig.security.dashboardAuthToken;
  if (!token) return undefined;
  if (tokenMatches(token, bearerToken(req)) || tokenMatches(token, headerValue(req.headers["x-streamops-dashboard-token"]))) {
    return { type: "DASHBOARD_ADMIN", method: "token" };
  }
  const session = sessions.get(dashboardSessionIdFromRequest(req));
  if (!session) return undefined;
  return { type: "DASHBOARD_ADMIN", method: "session", sessionId: session.id, csrfToken: session.csrfToken };
}

export function requiredHttpPrincipal(method: string | undefined, pathname: string): PrincipalType {
  if (pathname === "/health" || pathname === "/health/live" || pathname === "/health/ready") return "PUBLIC";
  if (pathname === "/api/dashboard/auth/status" || pathname === "/api/dashboard/auth/check") return "PUBLIC";
  if (method === "GET" && (
    pathname === "/api/lol/profile" ||
    pathname === "/api/lol/suggestions" ||
    pathname === "/api/lol/matches" ||
    pathname === "/api/lol/match-ranks" ||
    pathname === "/api/public/locale"
  )) return "PUBLIC";
  if (pathname === "/api/public/twitch/status" || pathname === "/api/public/twitch/followed-lol" || pathname === "/api/public/twitch/logout") return "PUBLIC";
  if (method === "GET" && (pathname === "/api/public/twitch/auth/start" || pathname === "/api/public/twitch/auth/callback")) return "OAUTH_CALLBACK";
  if (method === "GET" && (pathname === "/api/twitch/auth/start" || pathname === "/api/twitch/auth/callback")) return "OAUTH_CALLBACK";
  if (pathname.startsWith("/api/")) return "DASHBOARD_ADMIN";
  return "PUBLIC";
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const origin = headerValue(req.headers.origin);
  if (origin) return origin;
  const referer = headerValue(req.headers.referer);
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function stateChangingRequestHasTrustedOrigin(req: IncomingMessage): boolean {
  const method = req.method ?? "GET";
  if (!STATE_CHANGING_METHODS.has(method)) return true;
  const origin = requestOrigin(req);
  if (!origin) return false;
  return originAllowed(origin);
}

function csrfValid(req: IncomingMessage, principal: AuthPrincipal): boolean {
  if (principal.type !== "DASHBOARD_ADMIN" || principal.method !== "session") return true;
  if (!STATE_CHANGING_METHODS.has(req.method ?? "GET")) return true;
  const header = headerValue(req.headers["x-streamops-csrf"]);
  return tokenMatches(principal.csrfToken ?? "", header);
}

export function authorizeHttpRequest(req: IncomingMessage, pathname: string, sessions: DashboardSessionStore): AuthResult {
  const required = requiredHttpPrincipal(req.method, pathname);
  if (required === "PUBLIC") return { ok: true, principal: { type: "PUBLIC" } };
  if (required === "OAUTH_CALLBACK") return { ok: true, principal: { type: "OAUTH_CALLBACK" } };

  const principal = authenticateDashboardRequest(req, sessions);
  if (!principal) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "dashboard authentication required" };
  }
  if (required !== principal.type) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "principal is not allowed for this endpoint" };
  }
  if (principal.type === "DASHBOARD_ADMIN" && principal.method === "session" && !stateChangingRequestHasTrustedOrigin(req)) {
    return { ok: false, status: 403, code: "ORIGIN_DENIED", message: "trusted Origin or Referer header is required" };
  }
  if (!csrfValid(req, principal)) {
    return { ok: false, status: 403, code: "CSRF_REQUIRED", message: "valid CSRF token is required" };
  }
  return { ok: true, principal };
}

export function dashboardSessionCookie(session: DashboardSession): string {
  const maxAge = Math.max(1, Math.trunc((session.expiresAt - Date.now()) / 1000));
  return [
    `${DASHBOARD_SESSION_COOKIE}=${encodeURIComponent(session.id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function clearDashboardSessionCookie(): string {
  return [
    `${DASHBOARD_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function clientIp(req: IncomingMessage): string {
  if (appConfig.security.trustProxy) {
    const forwardedFor = headerValue(req.headers["x-forwarded-for"]);
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.socket?.remoteAddress ?? "unknown";
}
