import type { FollowerOAuthStatus, TwitchBroadcasterInfo } from "@streamops/shared";
import { appConfig } from "../config.js";
import { TwitchOAuthStateStore } from "./twitch-auth.js";
import type { TwitchStoredToken } from "./twitch-token-store.js";
import type { StreamerFollowerTokenStore } from "./streamer-follower-token-store.js";

const FOLLOWER_SCOPE = "moderator:read:followers";
const OAUTH_STATE_PREFIX = "streamer-followers:";
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const TWITCH_USER_ID_PATTERN = /^\d{1,32}$/;

type TwitchTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string[];
  token_type?: string;
};

type TwitchUsersResponse = {
  data?: Array<{
    id?: string;
    login?: string;
    display_name?: string;
    profile_image_url?: string;
  }>;
};

type StreamerFollowerAuthConfig = {
  clientId: string;
  clientSecret: string;
};

type AuthorizationOptions = {
  redirectUri: string;
  returnUrl: string;
  forceVerify?: boolean;
};

export type StreamerFollowerOAuthState = {
  ownerId: string;
  redirectUri: string;
  returnUrl: string;
};

export type StreamerFollowerAccessContext = {
  clientId: string;
  accessToken: string;
  scopes: string[];
  broadcasterId: string;
};

export type StreamerFollowerAuthErrorCode =
  | "NOT_CONNECTED"
  | "MISSING_SCOPES"
  | "TOKEN_EXPIRED"
  | "OWNER_MISMATCH"
  | "INVALID_INPUT"
  | "OAUTH_FAILED";

export class StreamerFollowerAuthError extends Error {
  constructor(
    readonly code: StreamerFollowerAuthErrorCode,
    message: string,
    readonly missingScopes: string[] = []
  ) {
    super(message);
    this.name = "StreamerFollowerAuthError";
  }
}

type FetchLike = typeof fetch;

function requiredOwnerId(value: string): string {
  const ownerId = value.trim();
  if (!TWITCH_USER_ID_PATTERN.test(ownerId)) {
    throw new StreamerFollowerAuthError("INVALID_INPUT", "Twitch broadcaster ID가 올바르지 않습니다.");
  }
  return ownerId;
}

function requiredOAuthValue(value: string, label: string, maxLength = 2048): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new StreamerFollowerAuthError("INVALID_INPUT", `${label} 값이 올바르지 않습니다.`);
  }
  return normalized;
}

function safeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((scope): scope is string => typeof scope === "string").map((scope) => scope.trim()).filter(Boolean))];
}

function missingFollowerScopes(scopes: readonly string[]): string[] {
  return scopes.includes(FOLLOWER_SCOPE) ? [] : [FOLLOWER_SCOPE];
}

function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StreamerFollowerAuthError) return error.message;
  return fallback;
}

export class StreamerFollowerAuthService {
  private readonly refreshInFlight = new Map<string, Promise<TwitchStoredToken>>();
  private readonly refreshFailureByOwner = new Map<string, { updatedAt: string; error: string }>();

  constructor(
    private readonly tokenStore: StreamerFollowerTokenStore,
    private readonly stateStore: TwitchOAuthStateStore,
    private readonly config: StreamerFollowerAuthConfig = {
      clientId: appConfig.twitch.clientId,
      clientSecret: appConfig.twitch.clientSecret
    },
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  createAuthorizationUrl(ownerId: string, options: AuthorizationOptions): string {
    const normalizedOwnerId = requiredOwnerId(ownerId);
    const redirectUri = requiredOAuthValue(options.redirectUri, "Twitch OAuth redirect URI");
    const returnUrl = requiredOAuthValue(options.returnUrl, "Twitch OAuth return URL");
    if (!this.config.clientId) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch OAuth client ID가 설정되지 않았습니다.");
    }

    const stateId = this.stateStore.create({ ownerId: normalizedOwnerId, redirectUri, returnUrl });
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", FOLLOWER_SCOPE);
    url.searchParams.set("state", `${OAUTH_STATE_PREFIX}${stateId}`);
    if (options.forceVerify) url.searchParams.set("force_verify", "true");
    return url.toString();
  }

  isFollowerState(state: string | null | undefined): boolean {
    return Boolean(state?.startsWith(OAUTH_STATE_PREFIX));
  }

  consumeState(state: string | null | undefined): StreamerFollowerOAuthState | undefined {
    if (!this.isFollowerState(state)) return undefined;
    const record = this.stateStore.consumeRecord(state?.slice(OAUTH_STATE_PREFIX.length));
    const ownerId = record?.metadata?.ownerId;
    const redirectUri = record?.metadata?.redirectUri;
    const returnUrl = record?.metadata?.returnUrl;
    if (!ownerId || !redirectUri || !returnUrl || !TWITCH_USER_ID_PATTERN.test(ownerId)) return undefined;
    return { ownerId, redirectUri, returnUrl };
  }

  async connectWithCode(
    code: string,
    options: { ownerId: string; redirectUri: string }
  ): Promise<FollowerOAuthStatus> {
    const ownerId = requiredOwnerId(options.ownerId);
    const redirectUri = requiredOAuthValue(options.redirectUri, "Twitch OAuth redirect URI");
    const oauthCode = requiredOAuthValue(code, "Twitch OAuth code", 512);
    const tokenResponse = await this.exchangeCode(oauthCode, redirectUri);
    const accessToken = tokenResponse.access_token?.trim();
    const refreshToken = tokenResponse.refresh_token?.trim();
    const expiresIn = Number(tokenResponse.expires_in);
    if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch OAuth token 응답이 불완전합니다.");
    }

    const broadcaster = await this.fetchBroadcasterInfo(accessToken);
    if (broadcaster.id !== ownerId) {
      throw new StreamerFollowerAuthError(
        "OWNER_MISMATCH",
        "Twitch 운영 권한 계정이 현재 스트리머 대시보드 소유자와 일치하지 않습니다."
      );
    }

    await this.tokenStore.set(ownerId, {
      accessToken,
      refreshToken,
      tokenType: "bearer",
      scopes: safeScopes(tokenResponse.scope),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      broadcaster,
      updatedAt: new Date().toISOString()
    });
    this.refreshFailureByOwner.delete(ownerId);
    return this.getStatus(ownerId);
  }

  async getStatus(ownerId: string): Promise<FollowerOAuthStatus> {
    const normalizedOwnerId = requiredOwnerId(ownerId);
    const stored = await this.tokenStore.get(normalizedOwnerId);
    if (!stored) return { state: "disconnected", missingScopes: [FOLLOWER_SCOPE] };
    if (stored.broadcaster.id !== normalizedOwnerId) {
      return {
        state: "disconnected",
        missingScopes: [FOLLOWER_SCOPE],
        error: "저장된 Twitch 운영 권한의 소유자가 현재 스트리머와 일치하지 않습니다."
      };
    }

    const knownRefreshFailure = this.refreshFailureByOwner.get(normalizedOwnerId);
    if (knownRefreshFailure?.updatedAt === stored.updatedAt) {
      return {
        state: "token_expired",
        missingScopes: missingFollowerScopes(stored.scopes),
        tokenExpiresAt: stored.expiresAt,
        error: knownRefreshFailure.error
      };
    }
    if (knownRefreshFailure) this.refreshFailureByOwner.delete(normalizedOwnerId);

    let token = stored;
    if (this.isExpired(token)) {
      try {
        token = await this.refreshToken(normalizedOwnerId, token);
      } catch (error) {
        return {
          state: "token_expired",
          missingScopes: missingFollowerScopes(token.scopes),
          tokenExpiresAt: token.expiresAt,
          error: safeErrorMessage(error, "Twitch 운영 권한 token을 갱신하지 못했습니다. 다시 연결해주세요.")
        };
      }
    }

    const missingScopes = missingFollowerScopes(token.scopes);
    return {
      state: missingScopes.length > 0 ? "missing_scopes" : "connected",
      missingScopes,
      tokenExpiresAt: token.expiresAt
    };
  }

  async getAccessContext(
    ownerId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<StreamerFollowerAccessContext> {
    const normalizedOwnerId = requiredOwnerId(ownerId);
    const stored = await this.tokenStore.get(normalizedOwnerId);
    if (!stored) {
      throw new StreamerFollowerAuthError("NOT_CONNECTED", "Twitch 팔로워 관리 운영 권한이 연결되지 않았습니다.");
    }
    if (stored.broadcaster.id !== normalizedOwnerId) {
      throw new StreamerFollowerAuthError(
        "OWNER_MISMATCH",
        "저장된 Twitch 운영 권한의 소유자가 현재 스트리머와 일치하지 않습니다."
      );
    }

    const knownRefreshFailure = this.refreshFailureByOwner.get(normalizedOwnerId);
    if (knownRefreshFailure?.updatedAt === stored.updatedAt) {
      throw new StreamerFollowerAuthError("TOKEN_EXPIRED", knownRefreshFailure.error);
    }
    if (knownRefreshFailure) this.refreshFailureByOwner.delete(normalizedOwnerId);

    const token = this.isExpired(stored) || options.forceRefresh
      ? await this.refreshToken(normalizedOwnerId, stored)
      : stored;
    const missingScopes = missingFollowerScopes(token.scopes);
    if (missingScopes.length > 0) {
      throw new StreamerFollowerAuthError(
        "MISSING_SCOPES",
        "Twitch 팔로워 관리에는 moderator:read:followers scope가 필요합니다.",
        missingScopes
      );
    }
    return {
      clientId: this.config.clientId,
      accessToken: token.accessToken,
      scopes: [...token.scopes],
      broadcasterId: normalizedOwnerId
    };
  }

  async disconnect(ownerId: string): Promise<void> {
    const normalizedOwnerId = requiredOwnerId(ownerId);
    await this.tokenStore.clear(normalizedOwnerId);
    this.refreshFailureByOwner.delete(normalizedOwnerId);
  }

  async markAccessTokenRejected(ownerId: string, rejectedAccessToken: string): Promise<void> {
    const normalizedOwnerId = requiredOwnerId(ownerId);
    const stored = await this.tokenStore.get(normalizedOwnerId);
    if (
      !stored ||
      stored.broadcaster.id !== normalizedOwnerId ||
      !rejectedAccessToken ||
      stored.accessToken !== rejectedAccessToken
    ) return;
    const message = "Twitch 팔로워 관리 token이 만료되었거나 취소되었습니다. 다시 연결해주세요.";
    const invalidated: TwitchStoredToken = {
      ...stored,
      expiresAt: new Date(0).toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await this.tokenStore.setIfUnchanged(normalizedOwnerId, {
      updatedAt: stored.updatedAt,
      refreshToken: stored.refreshToken
    }, invalidated);
    if (saved) {
      this.refreshFailureByOwner.set(normalizedOwnerId, { updatedAt: invalidated.updatedAt, error: message });
    }
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<TwitchTokenResponse> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch OAuth 설정이 부족합니다.");
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
    if (!response.ok) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", `Twitch OAuth token 교환에 실패했습니다. (${response.status})`);
    }
    return (await response.json()) as TwitchTokenResponse;
  }

  private async fetchBroadcasterInfo(accessToken: string): Promise<TwitchBroadcasterInfo> {
    const response = await this.fetchImpl("https://api.twitch.tv/helix/users", {
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": this.config.clientId,
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", `Twitch 사용자 정보 조회에 실패했습니다. (${response.status})`);
    }
    const body = (await response.json()) as TwitchUsersResponse;
    const user = body.data?.[0];
    const id = user?.id?.trim();
    const login = user?.login?.trim();
    const displayName = user?.display_name?.trim();
    if (!id || !TWITCH_USER_ID_PATTERN.test(id) || !login || !displayName) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch 사용자 정보를 확인할 수 없습니다.");
    }
    const profileImageUrl = user?.profile_image_url?.trim();
    return {
      id,
      login,
      displayName,
      ...(profileImageUrl ? { profileImageUrl } : {})
    };
  }

  private async refreshToken(ownerId: string, stored: TwitchStoredToken): Promise<TwitchStoredToken> {
    const current = this.refreshInFlight.get(ownerId);
    if (current) return current;
    const refresh = this.refreshTokenRequest(ownerId, stored).finally(() => {
      this.refreshInFlight.delete(ownerId);
    });
    this.refreshInFlight.set(ownerId, refresh);
    return refresh;
  }

  private async refreshTokenRequest(ownerId: string, stored: TwitchStoredToken): Promise<TwitchStoredToken> {
    if (stored.broadcaster.id !== ownerId) {
      throw new StreamerFollowerAuthError(
        "OWNER_MISMATCH",
        "저장된 Twitch 운영 권한의 소유자가 현재 스트리머와 일치하지 않습니다."
      );
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch OAuth 설정이 부족합니다.");
    }
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken
    });
    const response = await this.fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        const message = "Twitch 팔로워 관리 refresh token이 만료되었거나 취소되었습니다. 다시 연결해주세요.";
        const invalidated: TwitchStoredToken = {
          ...stored,
          expiresAt: new Date(0).toISOString(),
          updatedAt: new Date().toISOString()
        };
        const saved = await this.tokenStore.setIfUnchanged(ownerId, {
          updatedAt: stored.updatedAt,
          refreshToken: stored.refreshToken
        }, invalidated);
        if (!saved) {
          const current = await this.tokenStore.get(ownerId);
          if (!current) {
            throw new StreamerFollowerAuthError("NOT_CONNECTED", "Twitch 팔로워 관리 운영 권한 연결이 해제되었습니다.");
          }
          if (current.broadcaster.id !== ownerId) {
            throw new StreamerFollowerAuthError(
              "OWNER_MISMATCH",
              "저장된 Twitch 운영 권한의 소유자가 현재 스트리머와 일치하지 않습니다."
            );
          }
          this.refreshFailureByOwner.delete(ownerId);
          return current;
        }
        this.refreshFailureByOwner.set(ownerId, { updatedAt: invalidated.updatedAt, error: message });
        throw new StreamerFollowerAuthError("TOKEN_EXPIRED", message);
      }
      throw new StreamerFollowerAuthError("OAUTH_FAILED", `Twitch OAuth token 갱신에 실패했습니다. (${response.status})`);
    }

    const refreshed = (await response.json()) as TwitchTokenResponse;
    const accessToken = refreshed.access_token?.trim();
    const expiresIn = Number(refreshed.expires_in);
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new StreamerFollowerAuthError("OAUTH_FAILED", "Twitch OAuth token 갱신 응답이 불완전합니다.");
    }
    const next: TwitchStoredToken = {
      ...stored,
      accessToken,
      refreshToken: refreshed.refresh_token?.trim() || stored.refreshToken,
      scopes: refreshed.scope ? safeScopes(refreshed.scope) : [...stored.scopes],
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await this.tokenStore.setIfUnchanged(ownerId, {
      updatedAt: stored.updatedAt,
      refreshToken: stored.refreshToken
    }, next);
    if (saved) {
      this.refreshFailureByOwner.delete(ownerId);
      return next;
    }

    const current = await this.tokenStore.get(ownerId);
    if (!current) {
      throw new StreamerFollowerAuthError("NOT_CONNECTED", "Twitch 팔로워 관리 운영 권한 연결이 해제되었습니다.");
    }
    if (current.broadcaster.id !== ownerId) {
      throw new StreamerFollowerAuthError(
        "OWNER_MISMATCH",
        "저장된 Twitch 운영 권한의 소유자가 현재 스트리머와 일치하지 않습니다."
      );
    }
    this.refreshFailureByOwner.delete(ownerId);
    return current;
  }

  private isExpired(token: TwitchStoredToken): boolean {
    return Date.parse(token.expiresAt) <= Date.now() + TOKEN_REFRESH_SKEW_MS;
  }
}
