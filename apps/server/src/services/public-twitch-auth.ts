import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { TwitchBroadcasterInfo } from "@streamops/shared";
import { TWITCH_PUBLIC_VIEWER_SCOPES } from "@streamops/shared";
import { appConfig } from "../config.js";
import { TwitchOAuthStateStore } from "./twitch-auth.js";

type TwitchTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
};

type TwitchUsersResponse = {
  data?: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url?: string;
  }>;
};

export type PublicTwitchViewerSession = {
  id: string;
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  scopes: string[];
  expiresAt: string;
  user: TwitchBroadcasterInfo;
  createdAt: string;
  updatedAt: string;
};

export type PublicTwitchViewerStatus = {
  connected: boolean;
  configured: boolean;
  requiredScopes: string[];
  missingScopes: string[];
  user?: TwitchBroadcasterInfo;
  tokenExpiresAt?: string;
};

export type PublicTwitchAccessContext = {
  clientId: string;
  accessToken: string;
  userId: string;
  scopes: string[];
};

type PublicTwitchAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dashboardBaseUrl: string;
};

type FetchLike = typeof fetch;

export const PUBLIC_TWITCH_VIEWER_SESSION_COOKIE = "loltrace_twitch_viewer_session";

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PUBLIC_TWITCH_OAUTH_STATE_PREFIX = "public:";
const MAX_PUBLIC_TWITCH_SESSIONS = 10_000;

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

function findMissingScopes(requiredScopes: readonly string[], grantedScopes: readonly string[]): string[] {
  const granted = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function publicTwitchViewerSessionIdFromRequest(req: IncomingMessage): string | undefined {
  return parseCookies(req)[PUBLIC_TWITCH_VIEWER_SESSION_COOKIE];
}

export function publicTwitchViewerSessionCookie(session: PublicTwitchViewerSession): string {
  const expiresAt = Date.parse(session.expiresAt);
  const maxAge = Number.isFinite(expiresAt)
    ? Math.max(1, Math.trunc((expiresAt - Date.now()) / 1000))
    : Math.trunc(DEFAULT_SESSION_TTL_MS / 1000);
  return [
    `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=${encodeURIComponent(session.id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function clearPublicTwitchViewerSessionCookie(): string {
  return [
    `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export class PublicTwitchViewerSessionStore {
  private readonly sessions = new Map<string, PublicTwitchViewerSession>();

  create(input: Omit<PublicTwitchViewerSession, "id" | "createdAt" | "updatedAt">): PublicTwitchViewerSession {
    this.prune();
    const now = new Date().toISOString();
    const session: PublicTwitchViewerSession = {
      ...input,
      id: randomBytes(32).toString("base64url"),
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(session.id, session);
    while (this.sessions.size > MAX_PUBLIC_TWITCH_SESSIONS) {
      const oldestId = this.sessions.keys().next().value as string | undefined;
      if (!oldestId) break;
      this.sessions.delete(oldestId);
    }
    return { ...session };
  }

  get(id: string | undefined): PublicTwitchViewerSession | undefined {
    if (!id) return undefined;
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return { ...session, user: { ...session.user } };
  }

  set(session: PublicTwitchViewerSession): PublicTwitchViewerSession {
    const next = { ...session, user: { ...session.user }, updatedAt: new Date().toISOString() };
    this.sessions.set(next.id, next);
    return { ...next, user: { ...next.user } };
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
      if (Date.parse(session.expiresAt) <= now) this.sessions.delete(id);
    }
  }
}

export class PublicTwitchAuthService {
  private readonly requiredScopes = [...TWITCH_PUBLIC_VIEWER_SCOPES];

  constructor(
    private readonly sessions: PublicTwitchViewerSessionStore,
    private readonly stateStore: TwitchOAuthStateStore,
    private readonly config: PublicTwitchAuthConfig = {
      clientId: appConfig.twitch.clientId,
      clientSecret: appConfig.twitch.clientSecret,
      redirectUri: appConfig.twitch.publicRedirectUri,
      dashboardBaseUrl: appConfig.dashboardBaseUrl
    },
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  createAuthorizationUrl(forceVerify = false, redirectUri = this.config.redirectUri): string {
    if (!this.config.clientId || !redirectUri) {
      throw new Error("Twitch 공개 로그인 client ID 또는 redirect URI가 설정되지 않았습니다.");
    }
    const state = `${PUBLIC_TWITCH_OAUTH_STATE_PREFIX}${this.stateStore.create({ redirectUri })}`;
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", this.requiredScopes.join(" "));
    url.searchParams.set("state", state);
    if (forceVerify) url.searchParams.set("force_verify", "true");
    return url.toString();
  }

  isPublicState(state: string | null | undefined): boolean {
    return Boolean(state?.startsWith(PUBLIC_TWITCH_OAUTH_STATE_PREFIX));
  }

  verifyState(state: string | null | undefined): boolean {
    return Boolean(this.consumeState(state));
  }

  consumeState(state: string | null | undefined): { redirectUri?: string } | undefined {
    if (!this.isPublicState(state)) return undefined;
    const record = this.stateStore.consumeRecord(state?.slice(PUBLIC_TWITCH_OAUTH_STATE_PREFIX.length));
    if (!record) return undefined;
    return { redirectUri: record.metadata?.redirectUri };
  }

  async connectWithCode(code: string, redirectUri = this.config.redirectUri): Promise<PublicTwitchViewerSession> {
    if (!code.trim() || code.length > 512) throw new Error("Twitch OAuth code가 유효하지 않습니다.");
    const tokenResponse = await this.exchangeCode(code, redirectUri);
    const user = await this.fetchViewerInfo(tokenResponse.access_token);
    if (!tokenResponse.refresh_token) throw new Error("Twitch refresh token이 응답에 없습니다.");
    return this.sessions.create({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: "bearer",
      scopes: tokenResponse.scope ?? [],
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      user
    });
  }

  async getStatus(sessionId: string | undefined): Promise<PublicTwitchViewerStatus> {
    const session = await this.getFreshSession(sessionId);
    const configured = Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri);
    if (!session) {
      return {
        connected: false,
        configured,
        requiredScopes: this.requiredScopes,
        missingScopes: this.requiredScopes
      };
    }
    const missingScopes = findMissingScopes(this.requiredScopes, session.scopes);
    return {
      connected: missingScopes.length === 0,
      configured,
      requiredScopes: this.requiredScopes,
      missingScopes,
      user: session.user,
      tokenExpiresAt: session.expiresAt
    };
  }

  async getAccessContext(sessionId: string | undefined): Promise<PublicTwitchAccessContext | undefined> {
    const session = await this.getFreshSession(sessionId);
    if (!session) return undefined;
    if (findMissingScopes(this.requiredScopes, session.scopes).length > 0) return undefined;
    return {
      clientId: this.config.clientId,
      accessToken: session.accessToken,
      userId: session.user.id,
      scopes: session.scopes
    };
  }

  disconnect(sessionId: string | undefined): void {
    this.sessions.revoke(sessionId);
  }

  private async getFreshSession(sessionId: string | undefined): Promise<PublicTwitchViewerSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) > Date.now() + TOKEN_REFRESH_SKEW_MS) return session;
    return this.refreshToken(session).catch(() => {
      this.sessions.revoke(session.id);
      return undefined;
    });
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<TwitchTokenResponse> {
    if (!this.config.clientId || !this.config.clientSecret || !redirectUri) {
      throw new Error("Twitch 공개 로그인 설정이 부족합니다.");
    }
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    });
    const response = await this.fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) throw new Error(`Twitch 공개 로그인 token 교환 실패: ${response.status}`);
    return (await response.json()) as TwitchTokenResponse;
  }

  private async refreshToken(session: PublicTwitchViewerSession): Promise<PublicTwitchViewerSession> {
    if (!this.config.clientId || !this.config.clientSecret) throw new Error("Twitch 공개 로그인 설정이 부족합니다.");
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    });
    const response = await this.fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) throw new Error(`Twitch 공개 로그인 token 갱신 실패: ${response.status}`);
    const refreshed = (await response.json()) as TwitchTokenResponse;
    return this.sessions.set({
      ...session,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? session.refreshToken,
      scopes: refreshed.scope ?? session.scopes,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    });
  }

  private async fetchViewerInfo(accessToken: string): Promise<TwitchBroadcasterInfo> {
    const response = await this.fetchImpl("https://api.twitch.tv/helix/users", {
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": this.config.clientId,
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) throw new Error(`Twitch 사용자 조회 실패: ${response.status}`);
    const body = (await response.json()) as TwitchUsersResponse;
    const user = body.data?.[0];
    if (!user?.id) throw new Error("Twitch 사용자 정보를 찾을 수 없습니다.");
    return {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url
    };
  }
}
