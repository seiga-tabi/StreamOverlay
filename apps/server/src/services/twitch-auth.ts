import { randomBytes } from "node:crypto";
import type { TwitchBroadcasterInfo, TwitchConnectionStatus } from "@streamops/shared";
import { TWITCH_MVP_SCOPES, TWITCH_OPTIONAL_SCOPES, findMissingScopes } from "@streamops/shared";
import { appConfig } from "../config.js";
import type { TwitchStoredToken, TwitchTokenStore } from "./twitch-token-store.js";

type OAuthStateRecord = {
  state: string;
  expiresAt: number;
};

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

type TwitchAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dashboardBaseUrl: string;
  userAccessToken?: string;
  broadcasterId?: string;
  chatSenderId?: string;
  extraScopes?: string[];
};

type FetchLike = typeof fetch;

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

export function resolveTwitchScopes(extraScopes: readonly string[] = []): {
  requiredScopes: string[];
  optionalScopes: string[];
  enabledOptionalScopes: string[];
} {
  const optionalSet = new Set<string>(TWITCH_OPTIONAL_SCOPES);
  const enabledOptionalScopes = extraScopes.filter((scope) => optionalSet.has(scope));
  return {
    requiredScopes: [...TWITCH_MVP_SCOPES, ...enabledOptionalScopes],
    optionalScopes: [...TWITCH_OPTIONAL_SCOPES],
    enabledOptionalScopes
  };
}

export class TwitchOAuthStateStore {
  private readonly states = new Map<string, OAuthStateRecord>();

  constructor(private readonly ttlMs = DEFAULT_STATE_TTL_MS, private readonly now = () => Date.now()) {}

  create(): string {
    this.cleanup();
    const state = randomBytes(24).toString("base64url");
    this.states.set(state, { state, expiresAt: this.now() + this.ttlMs });
    return state;
  }

  consume(state: string | null | undefined): boolean {
    if (!state) return false;
    const record = this.states.get(state);
    if (!record) return false;
    this.states.delete(state);
    return record.expiresAt >= this.now();
  }

  private cleanup(): void {
    const now = this.now();
    for (const [state, record] of this.states) {
      if (record.expiresAt < now) this.states.delete(state);
    }
  }
}

export class TwitchAuthService {
  private readonly scopes: ReturnType<typeof resolveTwitchScopes>;

  constructor(
    private readonly tokenStore: TwitchTokenStore,
    private readonly stateStore: TwitchOAuthStateStore,
    private readonly config: TwitchAuthConfig = {
      clientId: appConfig.twitch.clientId,
      clientSecret: appConfig.twitch.clientSecret,
      redirectUri: appConfig.twitch.redirectUri,
      dashboardBaseUrl: appConfig.dashboardBaseUrl,
      userAccessToken: appConfig.twitch.userAccessToken,
      broadcasterId: appConfig.twitch.broadcasterId,
      chatSenderId: appConfig.twitch.chatSenderId,
      extraScopes: appConfig.twitch.extraScopes
    },
    private readonly fetchImpl: FetchLike = fetch
  ) {
    this.scopes = resolveTwitchScopes(this.config.extraScopes ?? []);
  }

  createAuthorizationUrl(forceVerify = false): string {
    if (!this.config.clientId || !this.config.redirectUri) {
      throw new Error("Twitch OAuth client ID 또는 redirect URI가 설정되지 않았습니다.");
    }

    const state = this.stateStore.create();
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", this.scopes.requiredScopes.join(" "));
    url.searchParams.set("state", state);
    if (forceVerify) url.searchParams.set("force_verify", "true");
    return url.toString();
  }

  verifyState(state: string | null | undefined): boolean {
    return this.stateStore.consume(state);
  }

  getScopes(): TwitchConnectionStatus {
    return {
      state: "disconnected",
      connected: false,
      source: "none",
      grantedScopes: [],
      requiredScopes: this.scopes.requiredScopes,
      optionalScopes: this.scopes.optionalScopes,
      enabledOptionalScopes: this.scopes.enabledOptionalScopes,
      missingScopes: this.scopes.requiredScopes,
      legacyConfigured: this.hasLegacyToken()
    };
  }

  async getStatus(): Promise<TwitchConnectionStatus> {
    const token = await this.tokenStore.get();
    const base = {
      requiredScopes: this.scopes.requiredScopes,
      optionalScopes: this.scopes.optionalScopes,
      enabledOptionalScopes: this.scopes.enabledOptionalScopes,
      legacyConfigured: this.hasLegacyToken()
    };

    if (!token) {
      return {
        ...base,
        state: "disconnected",
        connected: false,
        source: "none",
        grantedScopes: [],
        missingScopes: this.scopes.requiredScopes
      };
    }

    const missingScopes = findMissingScopes(this.scopes.requiredScopes, token.scopes);
    const expired = this.isExpired(token);
    return {
      ...base,
      state: expired ? "token_expired" : missingScopes.length > 0 ? "missing_scopes" : "connected",
      connected: !expired && missingScopes.length === 0,
      source: "oauth",
      broadcaster: token.broadcaster,
      grantedScopes: token.scopes,
      missingScopes,
      tokenExpiresAt: token.expiresAt
    };
  }

  async connectWithCode(code: string): Promise<TwitchConnectionStatus> {
    if (!this.verifyCodeInput(code)) throw new Error("Twitch OAuth code가 유효하지 않습니다.");
    const tokenResponse = await this.exchangeCode(code);
    const broadcaster = await this.fetchBroadcasterInfo(tokenResponse.access_token);
    await this.saveToken(tokenResponse, broadcaster);
    return this.getStatus();
  }

  async refreshStoredToken(): Promise<TwitchStoredToken | undefined> {
    const stored = await this.tokenStore.get();
    if (!stored) return undefined;
    return this.refreshToken(stored);
  }

  async disconnect(): Promise<void> {
    await this.tokenStore.clear();
  }

  async getAccessContext(options: { refreshIfExpired?: boolean; allowLegacy?: boolean } = {}): Promise<{
    clientId: string;
    accessToken: string;
    broadcasterId: string;
    senderId: string;
    scopes: string[];
    source: "oauth" | "env";
  } | undefined> {
    const stored = await this.tokenStore.get();
    if (stored) {
      const token = this.isExpired(stored) && options.refreshIfExpired ? await this.refreshToken(stored) : stored;
      if (!this.isExpired(token)) {
        return {
          clientId: this.config.clientId,
          accessToken: token.accessToken,
          broadcasterId: token.broadcaster.id,
          senderId: token.broadcaster.id,
          scopes: token.scopes,
          source: "oauth"
        };
      }
    }

    if (options.allowLegacy && this.hasLegacyToken()) {
      const broadcasterId = this.config.broadcasterId ?? "";
      return {
        clientId: this.config.clientId,
        accessToken: this.config.userAccessToken ?? "",
        broadcasterId,
        senderId: this.config.chatSenderId || broadcasterId,
        scopes: [],
        source: "env"
      };
    }

    return undefined;
  }

  async refreshAfterUnauthorized(): Promise<boolean> {
    const stored = await this.tokenStore.get();
    if (!stored?.refreshToken) return false;
    await this.refreshToken(stored);
    return true;
  }

  async fetchBroadcasterInfo(accessToken: string): Promise<TwitchBroadcasterInfo> {
    const response = await this.fetchImpl("https://api.twitch.tv/helix/users", {
      headers: {
        "Client-Id": this.config.clientId,
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) throw new Error(`Twitch broadcaster lookup failed: ${response.status}`);
    const body = (await response.json()) as TwitchUsersResponse;
    const user = body.data?.[0];
    if (!user?.id) throw new Error("Twitch broadcaster 정보를 찾을 수 없습니다.");
    return {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url
    };
  }

  private async exchangeCode(code: string): Promise<TwitchTokenResponse> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri) {
      throw new Error("Twitch OAuth 설정이 부족합니다.");
    }
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri
    });
    const response = await this.fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) throw new Error(`Twitch OAuth token exchange failed: ${response.status}`);
    return (await response.json()) as TwitchTokenResponse;
  }

  private async refreshToken(stored: TwitchStoredToken): Promise<TwitchStoredToken> {
    if (!this.config.clientId || !this.config.clientSecret) throw new Error("Twitch OAuth 설정이 부족합니다.");
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken
    });
    const response = await this.fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) throw new Error(`Twitch OAuth refresh failed: ${response.status}`);
    const refreshed = (await response.json()) as TwitchTokenResponse;
    const next = await this.saveToken(
      { ...refreshed, refresh_token: refreshed.refresh_token ?? stored.refreshToken, scope: refreshed.scope ?? stored.scopes },
      stored.broadcaster
    );
    return next;
  }

  private async saveToken(tokenResponse: TwitchTokenResponse, broadcaster: TwitchBroadcasterInfo): Promise<TwitchStoredToken> {
    if (!tokenResponse.access_token || !tokenResponse.refresh_token) throw new Error("Twitch token 응답이 불완전합니다.");
    const token: TwitchStoredToken = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: "bearer",
      scopes: tokenResponse.scope ?? [],
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      broadcaster,
      updatedAt: new Date().toISOString()
    };
    await this.tokenStore.set(token);
    return token;
  }

  private isExpired(token: TwitchStoredToken): boolean {
    return Date.parse(token.expiresAt) <= Date.now() + TOKEN_REFRESH_SKEW_MS;
  }

  private hasLegacyToken(): boolean {
    return Boolean(this.config.clientId && this.config.userAccessToken && this.config.broadcasterId);
  }

  private verifyCodeInput(code: string): boolean {
    return typeof code === "string" && code.trim().length > 0 && code.length <= 512;
  }
}
