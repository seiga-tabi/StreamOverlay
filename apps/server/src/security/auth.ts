import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import { appConfig, originAllowed } from "../config.js";

export type PrincipalType = "PUBLIC" | "DASHBOARD_ADMIN" | "OAUTH_CALLBACK";
export type DashboardRole = "admin" | "streamer";

/* 관리자 부분 권한의 단일 원본. 저장 파일·CLI·HTTP 인가가 모두 이 목록을
   참조해야 새 권한을 추가할 때 한 계층만 빠지는 일을 막을 수 있습니다. */
export const ADMIN_PERMISSIONS = ["streamer_approval", "streamer_profiles:write"] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export type AuthPrincipal =
  | { type: "PUBLIC" }
  | {
      type: "DASHBOARD_ADMIN";
      method: "session" | "token";
      role: DashboardRole;
      sessionId?: string;
      csrfToken?: string;
      twitchUserId?: string;
      /* undefined = 전체 권한(기존 단일 관리자 토큰/세션과 100% 하위호환).
         배열이 있으면 그 목록에 있는 권한만 허용되는 "부분 권한 관리자"입니다. */
      permissions?: readonly AdminPermission[];
      adminAccountId?: string;
      adminAccountLabel?: string;
    }
  | { type: "OAUTH_CALLBACK" };

/* principal이 특정 관리 업무를 수행할 권한이 있는지 판단하는 단일 원본입니다.
   호출부에서 `role !== "admin"` 같은 산발적 체크 대신 이 함수를 씁니다. */
export function principalHasAdminPermission(principal: AuthPrincipal, permission: AdminPermission): boolean {
  if (principal.type !== "DASHBOARD_ADMIN" || principal.role !== "admin") return false;
  if (!principal.permissions) return true;
  return principal.permissions.includes(permission);
}

/** 신규 인가 호출부의 공통 이름. 기존 함수는 하위 호환을 위해 유지합니다. */
export function principalHasPermission(principal: AuthPrincipal, permission: AdminPermission): boolean {
  return principalHasAdminPermission(principal, permission);
}


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
  role: DashboardRole;
  twitchUserId?: string;
  /* 서브 관리자 계정으로 로그인한 세션에만 채워집니다 — 기존 단일
     관리자 토큰/세션은 undefined(전체 권한) 그대로 유지됩니다. */
  permissions?: readonly AdminPermission[];
  adminAccountId?: string;
  adminAccountLabel?: string;
};

export const DASHBOARD_SESSION_COOKIE = "streamops_dashboard_session";
export const ADMIN_DASHBOARD_SESSION_COOKIE = "streamops_admin_session";
export const STREAMER_DASHBOARD_SESSION_COOKIE = "streamops_streamer_session";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_DASHBOARD_SESSIONS = 10_000;

export class DashboardSessionStore {
  private readonly sessions = new Map<string, DashboardSession>();

  create(input: { role?: DashboardRole; twitchUserId?: string; permissions?: readonly AdminPermission[]; adminAccountId?: string; adminAccountLabel?: string } = {}): DashboardSession {
    this.prune();
    const session: DashboardSession = {
      id: crypto.randomBytes(32).toString("base64url"),
      csrfToken: crypto.randomBytes(32).toString("base64url"),
      expiresAt: Date.now() + appConfig.security.dashboardSessionTtlMs,
      role: input.role ?? "admin",
      twitchUserId: input.twitchUserId,
      permissions: input.permissions,
      adminAccountId: input.adminAccountId,
      adminAccountLabel: input.adminAccountLabel
    };
    this.sessions.set(session.id, session);
    while (this.sessions.size > MAX_DASHBOARD_SESSIONS) {
      const oldestId = this.sessions.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.sessions.delete(oldestId);
    }
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

  revokeByTwitchUserId(twitchUserId: string): number {
    const normalizedUserId = twitchUserId.trim();
    if (!normalizedUserId) return 0;
    let revoked = 0;
    for (const [id, session] of this.sessions) {
      if (session.role !== "streamer" || session.twitchUserId !== normalizedUserId) continue;
      this.sessions.delete(id);
      revoked += 1;
    }
    return revoked;
  }

  revokeByAdminAccountId(adminAccountId: string): number {
    const normalizedAccountId = adminAccountId.trim();
    if (!normalizedAccountId) return 0;
    let revoked = 0;
    for (const [id, session] of this.sessions) {
      if (session.adminAccountId !== normalizedAccountId) continue;
      this.sessions.delete(id);
      revoked += 1;
    }
    return revoked;
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
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      continue;
    }
  }
  return cookies;
}

function dashboardSessionCookieNames(expectedRole?: DashboardRole): string[] {
  if (expectedRole === "admin") return [ADMIN_DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_COOKIE];
  if (expectedRole === "streamer") return [STREAMER_DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_COOKIE];
  return [ADMIN_DASHBOARD_SESSION_COOKIE, STREAMER_DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_COOKIE];
}

function dashboardSessionIdsFromRequest(req: IncomingMessage, expectedRole?: DashboardRole): string[] {
  const cookies = parseCookies(req);
  const ids: string[] = [];
  for (const name of dashboardSessionCookieNames(expectedRole)) {
    const id = cookies[name];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function dashboardSessionIdFromRequest(req: IncomingMessage, expectedRole?: DashboardRole): string | undefined {
  return dashboardSessionIdsFromRequest(req, expectedRole)[0];
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(req: IncomingMessage): string | undefined {
  const authorization = headerValue(req.headers.authorization);
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

function dashboardRoleHintFromRequest(req: IncomingMessage): DashboardRole | undefined {
  const surface = headerValue(req.headers["x-streamops-dashboard-surface"]);
  if (surface === "admin" || surface === "streamer") return surface;
  const referer = headerValue(req.headers.referer);
  if (!referer) return undefined;
  try {
    const pathname = new URL(referer).pathname;
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "streamer";
  } catch {
    return undefined;
  }
  return undefined;
}

export function authenticateDashboardRequest(req: IncomingMessage, sessions: DashboardSessionStore, expectedRole?: DashboardRole): AuthPrincipal | undefined {
  if (appConfig.security.localNoAuth && expectedRole !== "streamer") return { type: "DASHBOARD_ADMIN", method: "token", role: "admin" };
  const token = appConfig.security.dashboardAuthToken;
  if (token && expectedRole !== "streamer" && (tokenMatches(token, bearerToken(req)) || tokenMatches(token, headerValue(req.headers["x-streamops-dashboard-token"])))) {
    return { type: "DASHBOARD_ADMIN", method: "token", role: "admin" };
  }
  for (const sessionId of dashboardSessionIdsFromRequest(req, expectedRole)) {
    const session = sessions.get(sessionId);
    if (!session) continue;
    if (expectedRole && session.role !== expectedRole) continue;
    return {
      type: "DASHBOARD_ADMIN",
      method: "session",
      role: session.role,
      sessionId: session.id,
      csrfToken: session.csrfToken,
      twitchUserId: session.twitchUserId,
      permissions: session.permissions,
      adminAccountId: session.adminAccountId,
      adminAccountLabel: session.adminAccountLabel
    };
  }
  return undefined;
}

export function requiredHttpPrincipal(method: string | undefined, pathname: string): PrincipalType {
  if (pathname === "/health" || pathname === "/health/live" || pathname === "/health/ready") return "PUBLIC";
  if (method === "GET" && pathname === "/api/admin/audit-logs") return "DASHBOARD_ADMIN";
  if (method === "POST" && pathname === "/api/inbound-email/cloudflare") return "PUBLIC";
  if (pathname === "/api/dashboard/auth/status" || pathname === "/api/dashboard/auth/check") return "PUBLIC";
  if (method === "GET" && (
    pathname === "/api/minecraft/items"
    || pathname === "/api/minecraft/recipes"
    || pathname === "/api/minecraft/enchants"
    || pathname === "/api/minecraft/patch-notes"
  )) return "PUBLIC";
  if (method === "GET" && pathname.startsWith("/api/palworld/")) return "PUBLIC";
  if (method === "GET" && pathname.startsWith("/api/valorant/")) return "PUBLIC";
  /* 미니게임 기록 API — dashboard 인증이 아니라 YORO 계정 세션을 쓰므로 여기서는
     PUBLIC 으로 통과시키고, 라우트가 직접 세션·Origin 을 검사해 401/403 을 냅니다
     (계정 API 들이 같은 방식입니다). 리더보드·공유 조회는 비로그인도 봐야 합니다. */
  if (
    pathname === "/api/games/reaction/leaderboard"
    || pathname === "/api/games/reaction/records"
    || pathname === "/api/games/reaction/records/me"
    || /^\/api\/games\/reaction\/records\/[A-Za-z0-9_-]{8,64}$/u.test(pathname)
  ) return "PUBLIC";
  /* 스트리머 추천 게시판 — 미니게임 기록과 같은 방식입니다. dashboard 인증이 아니라
     공개 로그인(YORO 계정 세션 또는 공개 Twitch 뷰어 세션)을 쓰므로 여기서는 PUBLIC 으로
     통과시키고, 라우트가 직접 세션·Origin 을 검사해 401/403 을 냅니다. 목록과 글 조회는
     비로그인도 봐야 합니다(채널 주소만 로그인 뒤로 갑니다). */
  if (
    pathname === "/api/public/streamers"
    || /^\/api\/public\/streamers\/profile\/(twitch|chzzk|youtube)\/[^/]{1,240}$/u.test(pathname)
    || /^\/api\/public\/streamers\/[a-z0-9][a-z0-9_-]{0,63}(\/(avatar|vote|comments))?$/u.test(pathname)
    || /^\/api\/public\/streamers\/[a-z0-9][a-z0-9_-]{0,63}\/comments\/[a-z0-9][a-z0-9_-]{0,63}\/report$/u.test(pathname)
  ) return "PUBLIC";
  if (
    (method === "GET" && pathname === "/api/twitch-extension/viewer")
    || (method === "POST" && (
      pathname === "/api/twitch-extension/join"
      || pathname === "/api/twitch-extension/cancel"
    ))
  ) return "PUBLIC";
  if (method === "GET" && (
    pathname === "/api/lol/profile" ||
    pathname === "/api/lol/profile-state" ||
    pathname === "/api/lol/suggestions" ||
    pathname === "/api/lol/matches" ||
    pathname === "/api/lol/match-ranks" ||
    pathname === "/api/lol/match-build" ||
    pathname === "/api/lol/match-detail" ||
    pathname === "/api/public/locale"
  )) return "PUBLIC";
  if (
    pathname === "/api/public/twitch/status" ||
    pathname === "/api/public/twitch/followed-lol" ||
    pathname === "/api/public/twitch/riot-id-request" ||
    pathname === "/api/public/twitch/logout" ||
    (pathname === "/api/public/participation/state" && method === "GET") ||
    (pathname === "/api/public/participation/discovery" && method === "GET") ||
    (pathname === "/api/public/participation/join" && method === "POST") ||
    (pathname === "/api/public/participation/cancel" && method === "POST") ||
    /^\/api\/public\/participation\/sessions\/[^/]+(?:\/(?:join|cancel|check-in|rejoin|skip))?$/.test(pathname) ||
    (method === "GET" && pathname === "/api/public/aram/augments") ||
    (method === "GET" && pathname === "/api/public/game-boxart") ||
    (method === "GET" && pathname === "/api/public/patch-notes") ||
    (method === "GET" && pathname === "/api/public/patch-notes/summary") ||
    (method === "GET" && pathname === "/api/public/patch-notes/changes") ||
    (method === "GET" && pathname === "/api/public/patch-notes/keyart")
  ) return "PUBLIC";
  if (method === "GET" && (pathname === "/api/public/twitch/auth/start" || pathname === "/api/public/twitch/auth/callback")) return "OAUTH_CALLBACK";
  if (
    method === "GET"
    && (
      /^\/api\/account\/oauth\/(?:discord|twitch|riot)\/start$/u.test(pathname)
      || pathname === "/api/account/oauth/riot/callback"
    )
  ) return "OAUTH_CALLBACK";
  if (
    method === "GET"
    && pathname === "/api/account/oauth/riot/logout/callback"
  ) return "OAUTH_CALLBACK";
  if (
    pathname === "/api/account/session"
    || pathname === "/api/account/preferences"
    || pathname === "/api/account/logout"
    || pathname === "/api/account/streamer"
    || pathname.startsWith("/api/account/streamer/")
    || pathname === "/api/account/riot/valorant-record-consent"
    || /^\/api\/account\/connections\/(?:discord|twitch|riot)$/u.test(pathname)
  ) return "PUBLIC";
  if (method === "GET" && (pathname === "/api/twitch/auth/start" || pathname === "/api/twitch/auth/callback")) return "OAUTH_CALLBACK";
  if (
    pathname === "/api/discord/session"
    || pathname === "/api/discord/onboarding/guilds"
    || pathname === "/api/discord/onboarding/guild"
    || pathname === "/api/discord/oauth/logout"
  ) return "PUBLIC";
  if (method === "GET" && (pathname === "/api/discord/oauth/start" || pathname === "/api/discord/oauth/callback")) {
    return "OAUTH_CALLBACK";
  }
  if (
    (method === "GET" || method === "HEAD")
    && (pathname === "/api/discord/bot/install" || pathname === "/api/discord/status")
  ) return "PUBLIC";
  if (
    method === "GET"
    && (
      pathname === "/api/discord/management/connect/start"
      || pathname === "/api/discord/management/oauth/start"
      || pathname === "/api/discord/management/oauth/callback"
    )
  ) return "OAUTH_CALLBACK";
  if (
    pathname === "/api/discord/management/connect/session"
    || pathname === "/api/discord/management/guilds/claim"
    || pathname === "/api/discord/management/session"
    || pathname === "/api/discord/management/logout"
    || /^\/api\/discord\/management\/organizations\/[^/]+\/bot-control$/u.test(pathname)
    || /^\/api\/discord\/management\/organizations\/[^/]+\/game-servers(?:\/[^/]+(?:\/palworld-rest(?:\/(?:test|save|refresh|remove))?)?)?$/u.test(pathname)
  ) return "PUBLIC";
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

type StreamerDashboardRule = {
  method?: string;
  path?: string;
  prefix?: string;
};

const STREAMER_DASHBOARD_API_RULES: StreamerDashboardRule[] = [
  { method: "GET", path: "/api/dashboard/auth/status" },
  { method: "POST", path: "/api/dashboard/auth/logout" },
  { method: "GET", path: "/api/dashboard/palworld-server" },
  { method: "POST", path: "/api/dashboard/palworld-server/test" },
  { method: "POST", path: "/api/dashboard/palworld-server/save" },
  { method: "POST", path: "/api/dashboard/palworld-server/refresh" },
  { method: "POST", path: "/api/dashboard/palworld-server/remove" },
  { method: "GET", path: "/api/followers" },
  { method: "POST", path: "/api/followers/refresh" },
  { method: "POST", path: "/api/followers/oauth/start" },
  { method: "GET", path: "/api/participation/queue" },
  { method: "GET", path: "/api/participation/state" },
  { method: "GET", path: "/api/participation/game-monitor" },
  { method: "POST", path: "/api/participation/game-monitor" },
  { method: "GET", path: "/api/participation/streamer-profile" },
  { method: "POST", path: "/api/participation/streamer-riot-id" },
  { method: "POST", path: "/api/participation/streamer-profile-link" },
  { method: "POST", path: "/api/participation/streamer-profile/refresh" },
  { method: "POST", path: "/api/participation/manual-control" },
  { method: "POST", path: "/api/participation/profile/refresh" },
  { method: "POST", path: "/api/participation/role-override" },
  { method: "POST", path: "/api/participation/entry-status" },
  { prefix: "/api/lol-operations" }
];

export function streamerDashboardRequestAllowed(method: string | undefined, pathname: string): boolean {
  const requestMethod = method ?? "GET";
  return STREAMER_DASHBOARD_API_RULES.some((rule) => {
    if (rule.method && rule.method !== requestMethod) return false;
    if (rule.path && rule.path === pathname) return true;
    return Boolean(rule.prefix && (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)));
  });
}

/* 모든 관리자(부분 권한 포함)에게 항상 허용되는 기본 엔드포인트 — 세션
   조회/로그아웃처럼 권한과 무관하게 필요한 것만 담습니다. */
const ADMIN_BASELINE_API_RULES: StreamerDashboardRule[] = [
  { method: "GET", path: "/api/dashboard/auth/status" },
  { method: "POST", path: "/api/dashboard/auth/logout" }
];

/* 부분 권한(permissions 배열이 있는) 관리자가 그 권한으로 접근 가능한
   엔드포인트 화이트리스트입니다. 새 AdminPermission을 추가할 때마다 여기에도
   대응하는 규칙을 등록해야 합니다 — 등록을 빠뜨리면 그 권한은 사실상 아무
   엔드포인트도 열어주지 못하는 방향으로 fail-closed 됩니다(반대로 열리는
   방향의 실수보다 안전). */
const ADMIN_PERMISSION_API_RULES: Record<AdminPermission, StreamerDashboardRule[]> = {
  streamer_approval: [
    { method: "GET", path: "/api/participation/streamer-riot-id-requests" },
    { method: "POST", path: "/api/participation/streamer-riot-id-requests/admin-register" },
    { method: "POST", path: "/api/participation/streamer-riot-id-requests/resolve" },
    { method: "POST", path: "/api/participation/streamer-riot-id-requests/dashboard-access" }
    /* grant-admin / revoke-admin(관리자 권한 부여·회수)은 의도적으로 등록하지
       않습니다 — 부분 권한 관리자가 다른 계정에 권한을 뿌리는 권한 상승을 막기
       위해 full_admin(permissions === undefined)만 호출할 수 있어야 합니다. */
  ],
  "streamer_profiles:write": [
    { method: "GET", path: "/api/dashboard/streamer-profiles" },
    { method: "POST", path: "/api/dashboard/streamer-profiles" },
    { method: "PUT", prefix: "/api/dashboard/streamer-profiles" },
    { method: "DELETE", prefix: "/api/dashboard/streamer-profiles" }
  ]
};

function adminSubAccountRequestAllowed(method: string | undefined, pathname: string, permissions: readonly AdminPermission[]): boolean {
  const requestMethod = method ?? "GET";
  const matchesRule = (rule: StreamerDashboardRule): boolean => {
    if (rule.method && rule.method !== requestMethod) return false;
    if (rule.path && rule.path === pathname) return true;
    return Boolean(rule.prefix && (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)));
  };
  if (ADMIN_BASELINE_API_RULES.some(matchesRule)) return true;
  return permissions.some((permission) => (
    Object.hasOwn(ADMIN_PERMISSION_API_RULES, permission)
    && ADMIN_PERMISSION_API_RULES[permission].some(matchesRule)
  ));
}

export function authorizeHttpRequest(req: IncomingMessage, pathname: string, sessions: DashboardSessionStore): AuthResult {
  const required = requiredHttpPrincipal(req.method, pathname);
  if (required === "PUBLIC") return { ok: true, principal: { type: "PUBLIC" } };
  if (required === "OAUTH_CALLBACK") return { ok: true, principal: { type: "OAUTH_CALLBACK" } };

  const principal = authenticateDashboardRequest(req, sessions, dashboardRoleHintFromRequest(req));
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
  if (principal.type === "DASHBOARD_ADMIN" && principal.role === "streamer" && !streamerDashboardRequestAllowed(req.method, pathname)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "streamer dashboard role is not allowed for this endpoint" };
  }
  if (principal.type === "DASHBOARD_ADMIN" && principal.role === "admin" && principal.permissions && !adminSubAccountRequestAllowed(req.method, pathname, principal.permissions)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "admin sub-account permissions do not allow this endpoint" };
  }
  return { ok: true, principal };
}

function dashboardCookieNameForRole(role: DashboardRole): string {
  return role === "streamer" ? STREAMER_DASHBOARD_SESSION_COOKIE : ADMIN_DASHBOARD_SESSION_COOKIE;
}

function expiredDashboardSessionCookie(name: string): string {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function dashboardSessionCookie(session: DashboardSession): string[] {
  const maxAge = Math.max(1, Math.trunc((session.expiresAt - Date.now()) / 1000));
  const sessionCookie = [
    `${dashboardCookieNameForRole(session.role)}=${encodeURIComponent(session.id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
  return [sessionCookie, expiredDashboardSessionCookie(DASHBOARD_SESSION_COOKIE)];
}

export function clearDashboardSessionCookie(role?: DashboardRole): string[] {
  const names = role
    ? [dashboardCookieNameForRole(role), DASHBOARD_SESSION_COOKIE]
    : [ADMIN_DASHBOARD_SESSION_COOKIE, STREAMER_DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_COOKIE];
  return names.map(expiredDashboardSessionCookie);
}

export function clientIp(req: IncomingMessage): string {
  if (appConfig.security.trustProxy) {
    const forwardedFor = headerValue(req.headers["x-forwarded-for"]);
    if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.socket?.remoteAddress ?? "unknown";
}
