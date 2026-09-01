import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  TWITCH_PUBLIC_VIEWER_SCOPES,
  type TwitchBroadcasterInfo
} from "@streamops/shared";
import { appConfig } from "../config.js";
import { withTransaction } from "../database/transaction.js";
import {
  DiscordParticipationAnnouncementRepository,
  type AnnouncementSettings,
  type AnnouncementTargetInput
} from "../database/repositories/discord-participation-announcement-repository.js";
import {
  type YoroAuthenticationProvider,
  type YoroExternalIdentity,
  type YoroUserPreferences,
  type YoroIdentityProvider,
  type YoroOAuthPurpose,
  YoroAccountRepository
} from "../database/repositories/yoro-account-repository.js";
import {
  decryptDiscordSecret,
  discordPkceChallenge,
  discordSafeToken,
  discordSecretHash,
  encryptDiscordSecret
} from "./discord-oauth-crypto.js";
import {
  decodeTwitchTokenEncryptionKey,
  decryptTwitchTokenDocument,
  encryptTwitchTokenDocument
} from "./twitch-token-encryption.js";
import type {
  PublicTwitchAccessContext,
  PublicTwitchViewerSession
} from "./public-twitch-auth.js";
import {
  isLocalizablePublicDashboardRoute,
  stripPublicUrlLocalePrefix
} from "../routing/public-dashboard-routes.js";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_PROFILE_URL = "https://discord.com/api/v10/users/@me";
const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_PROFILE_URL = "https://api.twitch.tv/helix/users";
const RIOT_AUTHORIZE_URL = "https://auth.riotgames.com/authorize";
const RIOT_TOKEN_URL = "https://auth.riotgames.com/token";
const RECENT_AUTHENTICATION_MS = 15 * 60 * 1_000;
const TWITCH_AVATAR_HOST = "static-cdn.jtvnw.net";
const TWITCH_TOKEN_REFRESH_SKEW_MS = 60 * 1_000;
const TWITCH_CREDENTIAL_VERSION = 1;

export const YORO_OAUTH_COOKIE = "yoro_oauth";
export const YORO_SESSION_COOKIE = "yoro_session";

type FetchLike = typeof fetch;

type AuditLogger = {
  event?: (entry: Record<string, unknown>) => void;
  error?: (entry: Record<string, unknown>) => void;
};

type ProviderProfile = {
  providerSubject: string;
  displayName: string;
  avatarReference?: string;
};

type YoroTwitchCredential = {
  version: typeof TWITCH_CREDENTIAL_VERSION;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: string;
  user: TwitchBroadcasterInfo;
};

type TwitchProviderCompletion = {
  profile: ProviderProfile;
  credential: YoroTwitchCredential;
};

class YoroTwitchCredentialError extends Error {
  constructor(readonly status: "revoked" | "security_failed") {
    super("yoro_twitch_credential_invalid");
    this.name = "YoroTwitchCredentialError";
  }
}

export type PublicYoroIdentity = {
  provider: YoroIdentityProvider;
  displayName: string;
  avatarUrl?: string;
  connectedAt: string;
  lastAuthenticatedAt: string;
  valorantRecordConsent?: boolean;
};

export type PublicYoroAccountSession = {
  authenticated: true;
  csrfToken: string;
  authenticationProvider: YoroAuthenticationProvider;
  identities: readonly PublicYoroIdentity[];
  preferences: YoroUserPreferences;
  connectionCapabilities: Readonly<{
    riotRsoAvailable: boolean;
    riotRsoRequiresTwitchAuthentication: boolean;
  }>;
  /* 공개 계정이 연결한 Twitch identity가 관리자 콘솔(admin_accounts)에 활성 등록되어
     있으면 true. 상단바 프로필 메뉴에 "스트리머 관리" 항목을 보여줄지 여부에만
     쓰이며, 세부 permissions는 노출하지 않습니다(그건 관리자 콘솔 자체 인증이 담당).
     조회 실패/미배선 시 fail-closed로 항상 false/생략됩니다. */
  isStreamerAdmin?: boolean;
};

type AuthenticatedSession = {
  id: string;
  userId: string;
  csrfToken: string;
  csrfTokenHash: Buffer;
  authenticationProvider: YoroAuthenticationProvider;
  authenticatedAt: Date;
};

export type YoroAccountErrorCode =
  | "feature_unavailable"
  | "oauth_failed"
  | "session_required"
  | "recent_authentication_required"
  | "twitch_authentication_required"
  | "csrf_required"
  | "identity_conflict"
  | "last_identity_required"
  | "riot_identity_required"
  | "invalid_input";

export class YoroAccountError extends Error {
  constructor(
    readonly code: YoroAccountErrorCode,
    readonly status: 400 | 401 | 403 | 409 | 503
  ) {
    super(code);
    this.name = "YoroAccountError";
  }
}

function validToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/u.test(value);
}

function validOAuthToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 4096
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validTwitchUserId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,64}$/u.test(value);
}

function validTwitchLogin(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_]{1,64}$/u.test(value);
}

function validRiotPuuid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,128}$/u.test(value);
}

function safeRiotIdPart(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").trim();
  if (
    normalized.length < 1
    || normalized.length > maximum
    || normalized.includes("#")
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) return undefined;
  return normalized;
}

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 32) {
    throw new YoroAccountError("oauth_failed", 401);
  }
  const scopes = value.map((scope) => {
    if (
      typeof scope !== "string"
      || scope.length < 1
      || scope.length > 128
      || !/^[a-z0-9:_-]+$/u.test(scope)
    ) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    return scope;
  });
  return [...new Set(scopes)];
}

function parseStoredTwitchCredential(value: string): YoroTwitchCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new YoroTwitchCredentialError("security_failed");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new YoroTwitchCredentialError("security_failed");
  }
  const record = parsed as Record<string, unknown>;
  const expectedKeys = ["accessToken", "expiresAt", "refreshToken", "scopes", "user", "version"];
  if (
    Object.keys(record).sort().join(",") !== expectedKeys.sort().join(",")
    || record.version !== TWITCH_CREDENTIAL_VERSION
    || !validOAuthToken(record.accessToken)
    || !validOAuthToken(record.refreshToken)
    || typeof record.expiresAt !== "string"
    || !Number.isFinite(Date.parse(record.expiresAt))
  ) {
    throw new YoroTwitchCredentialError("security_failed");
  }
  let scopes: string[];
  try {
    scopes = normalizeScopes(record.scopes);
  } catch {
    throw new YoroTwitchCredentialError("security_failed");
  }
  if (!record.user || typeof record.user !== "object" || Array.isArray(record.user)) {
    throw new YoroTwitchCredentialError("security_failed");
  }
  const user = record.user as Record<string, unknown>;
  const userKeys = Object.keys(user).sort().join(",");
  if (
    (userKeys !== "displayName,id,login" && userKeys !== "displayName,id,login,profileImageUrl")
    || !validTwitchUserId(user.id)
    || !validTwitchLogin(user.login)
    || typeof user.displayName !== "string"
    || user.displayName.length < 1
    || user.displayName.length > 80
  ) {
    throw new YoroTwitchCredentialError("security_failed");
  }
  const profileImageUrl = safeTwitchAvatarUrl(user.profileImageUrl);
  if (user.profileImageUrl !== undefined && !profileImageUrl) {
    throw new YoroTwitchCredentialError("security_failed");
  }
  return {
    version: TWITCH_CREDENTIAL_VERSION,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    scopes,
    expiresAt: record.expiresAt,
    user: {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      ...(profileImageUrl ? { profileImageUrl } : {})
    }
  };
}

function safeReturnPath(value: string | undefined): string {
  if (!value || value.length > 256 || !value.startsWith("/") || value.startsWith("//")) {
    return "/account/connections";
  }
  if (value.includes("\\") || value.includes("#") || /[\u0000-\u001f\u007f]/u.test(value)) {
    return "/account/connections";
  }
  let returnUrl: URL;
  try {
    returnUrl = new URL(value, "https://yoro.invalid");
  } catch {
    return "/account/connections";
  }
  const rawPathname = value.split(/[?#]/u, 1)[0];
  if (
    returnUrl.origin !== "https://yoro.invalid"
    || returnUrl.username
    || returnUrl.password
    || rawPathname !== returnUrl.pathname
  ) {
    return "/account/connections";
  }
  const pathname = returnUrl.pathname;
  /* 공개 화면은 route 목록(public-dashboard-routes)을 단일 원본으로 판정합니다.
     예전에는 로케일 접두사가 있을 때만 이 목록을 보고, 접두사가 없으면 별도
     하드코딩 배열을 봤습니다 — 두 원본이 갈라져 신규 공개 게임(/minecraft,
     /valorant)이 접두사 없는 형태에서만 조용히 /account/connections 로 버려졌습니다.
     이제 접두사 유무와 무관하게 같은 목록으로 판정하므로 공개 route 를 추가할 때
     이 파일을 함께 고칠 필요가 없습니다. */
  if (isLocalizablePublicDashboardRoute(stripPublicUrlLocalePrefix(pathname))) {
    return `${pathname}${returnUrl.search}`;
  }
  /* 공개 route 가 아닌 로그인 후 복귀 지점 — route 목록에 없으므로 여기서 유지합니다. */
  const allowed = ["/account", "/dashboard"];
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? `${pathname}${returnUrl.search}`
    : "/account/connections";
}

function safeTwitchAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.hostname !== TWITCH_AVATAR_HOST
      || url.username
      || url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function publicAvatarUrl(identity: YoroExternalIdentity): string | undefined {
  if (!identity.avatarReference) return undefined;
  if (identity.provider === "twitch") {
    return safeTwitchAvatarUrl(identity.avatarReference);
  }
  if (
    !/^[0-9]{1,32}$/u.test(identity.providerSubject)
    || !/^[a-f0-9_]{1,128}$/u.test(identity.avatarReference)
  ) {
    return undefined;
  }
  return `https://cdn.discordapp.com/avatars/${identity.providerSubject}/${identity.avatarReference}.png?size=64`;
}

export function publicYoroIdentity(identity: YoroExternalIdentity): PublicYoroIdentity {
  const avatarUrl = publicAvatarUrl(identity);
  return {
    provider: identity.provider,
    displayName: identity.displayName,
    ...(avatarUrl ? { avatarUrl } : {}),
    connectedAt: identity.connectedAt,
    lastAuthenticatedAt: identity.lastAuthenticatedAt,
    ...(identity.provider === "riot"
      ? { valorantRecordConsent: identity.valorantRecordConsent === true }
      : {})
  };
}

function cookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function yoroOAuthCookie(value: string): string {
  return cookie(YORO_OAUTH_COOKIE, value, appConfig.discordBotManagement.oauthTtlSeconds);
}

export function yoroSessionCookie(value: string): string {
  return cookie(
    YORO_SESSION_COOKIE,
    value,
    appConfig.discordBotManagement.absoluteTtlSeconds
  );
}

export function clearYoroCookie(name: typeof YORO_OAUTH_COOKIE | typeof YORO_SESSION_COOKIE): string {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export class YoroAccountService {
  private valorantVisibilityInvalidator?: (userId: string) => void;

  /* 늦은 주입 — index.ts 에서 Store 생성 이후 배선합니다(store 는 YoroAccountService
     보다 나중에 만들어져 생성자 주입이 불가합니다). 미배선 시 session() 은
     isStreamerAdmin 을 항상 생략합니다(fail-closed). */
  private streamerAdminLookup?: (twitchUserId: string) => boolean;

  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly pool: Pool,
    private readonly logger?: AuditLogger,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void new YoroAccountRepository(this.pool).expireSessions().catch(() => undefined);
    }, 60_000);
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async beginOAuth(input: {
    provider: YoroIdentityProvider;
    purpose: YoroOAuthPurpose;
    returnPath?: string;
    sessionCookie?: string;
  }): Promise<{ authorizationUrl: string; cookieValue: string }> {
    if (input.provider === "riot") {
      if (!appConfig.riot.rsoEnabled) {
        throw new YoroAccountError("feature_unavailable", 503);
      }
      if (input.purpose !== "link_identity") {
        throw new YoroAccountError("invalid_input", 400);
      }
    }
    let targetUserId: string | undefined;
    if (input.purpose === "link_identity") {
      const authenticated = await this.requireSession(input.sessionCookie);
      if (
        Date.now() - authenticated.authenticatedAt.getTime()
        > RECENT_AUTHENTICATION_MS
      ) {
        throw new YoroAccountError("recent_authentication_required", 401);
      }
      if (
        input.provider === "riot"
        && authenticated.authenticationProvider !== "twitch"
      ) {
        throw new YoroAccountError("twitch_authentication_required", 401);
      }
      targetUserId = authenticated.userId;
    }

    const id = crypto.randomUUID();
    const state = discordSafeToken();
    const binding = discordSafeToken();
    const verifier = input.provider === "discord" ? discordSafeToken(48) : undefined;
    const encryptedVerifier = verifier
      ? encryptDiscordSecret(
          verifier,
          appConfig.discordSaas.tokenEncryptionKey,
          appConfig.discordSaas.tokenEncryptionKeyVersion,
          { sessionId: id, discordUserId: "pending", purpose: "yoro_account_pkce" }
        )
      : undefined;
    await new YoroAccountRepository(this.pool).createOAuthSession({
      id,
      provider: input.provider,
      purpose: input.purpose,
      ...(targetUserId ? { targetUserId } : {}),
      stateHash: discordSecretHash(state),
      cookieBindingHash: discordSecretHash(binding),
      ...(encryptedVerifier ? { encryptedPkceVerifier: encryptedVerifier } : {}),
      returnPath: safeReturnPath(input.returnPath),
      expiresAt: new Date(
        Date.now() + appConfig.discordBotManagement.oauthTtlSeconds * 1_000
      )
    });

    const authorizationUrl = input.provider === "discord"
      ? this.discordAuthorizationUrl(state, verifier!)
      : input.provider === "twitch"
        ? this.twitchAuthorizationUrl(state)
        : this.riotAuthorizationUrl(state);
    this.logger?.event?.({
      type: "yoro.account.oauth_started",
      provider: input.provider,
      purpose: input.purpose
    });
    return { authorizationUrl, cookieValue: binding };
  }

  async completeOAuth(input: {
    provider: YoroIdentityProvider;
    state: string;
    code: string;
    oauthCookie?: string;
    sessionCookie?: string;
  }): Promise<{ sessionToken: string; returnPath: string }> {
    if (
      !validToken(input.state)
      || !validToken(input.oauthCookie)
      || input.code.length < 1
      || input.code.length > 1024
    ) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const repository = new YoroAccountRepository(this.pool);
    const oauth = await repository.consumeOAuthSession({
      provider: input.provider,
      stateHash: discordSecretHash(input.state),
      cookieBindingHash: discordSecretHash(input.oauthCookie)
    });
    if (!oauth) throw new YoroAccountError("oauth_failed", 401);

    try {
      let riotLinkingSession: AuthenticatedSession | undefined;
      if (input.provider === "riot") {
        if (
          !appConfig.riot.rsoEnabled
          || oauth.purpose !== "link_identity"
          || !oauth.target_user_id
        ) {
          throw new YoroAccountError("oauth_failed", 401);
        }
        riotLinkingSession = await this.requireSession(input.sessionCookie);
        if (
          riotLinkingSession.userId !== oauth.target_user_id
          || riotLinkingSession.authenticationProvider !== "twitch"
          || Date.now() - riotLinkingSession.authenticatedAt.getTime()
            > RECENT_AUTHENTICATION_MS
        ) {
          throw new YoroAccountError("twitch_authentication_required", 401);
        }
      }
      const providerResult = input.provider === "discord"
        ? {
            profile: await this.completeDiscordProvider(
              oauth.id,
              oauth.pkce_verifier_encrypted,
              input.code
            )
          }
        : input.provider === "twitch"
          ? await this.completeTwitchProvider(input.code)
          : { profile: await this.completeRiotProvider(input.code) };
      const sessionToken = discordSafeToken();
      const csrfToken = discordSafeToken();
      const now = Date.now();
      await withTransaction(this.pool, async (client) => {
        const transactionRepository = new YoroAccountRepository(client);
        let userId: string;
        if (oauth.purpose === "link_identity") {
          if (!oauth.target_user_id) throw new YoroAccountError("oauth_failed", 401);
          const linked = await transactionRepository.linkIdentity({
            userId: oauth.target_user_id,
            provider: input.provider,
            ...providerResult.profile
          });
          if (linked === "conflict") {
            throw new YoroAccountError("identity_conflict", 409);
          }
          userId = oauth.target_user_id;
          await transactionRepository.revokeUserSessions(userId);
        } else {
          if (input.provider === "riot") {
            throw new YoroAccountError("oauth_failed", 401);
          }
          userId = await transactionRepository.resolveUserForLogin({
            provider: input.provider,
            ...providerResult.profile
          });
        }
        if ("credential" in providerResult) {
          await transactionRepository.upsertTwitchCredential({
            userId,
            encryptedTokenRecord: this.encryptTwitchCredential(
              userId,
              providerResult.credential
            ),
            tokenExpiresAt: new Date(providerResult.credential.expiresAt)
          });
        }
        const authenticationProvider: YoroAuthenticationProvider = input.provider === "riot"
          ? riotLinkingSession!.authenticationProvider
          : input.provider;
        await transactionRepository.createSession({
          id: crypto.randomUUID(),
          userId,
          sessionTokenHash: discordSecretHash(sessionToken),
          csrfTokenHash: discordSecretHash(csrfToken),
          authenticationProvider,
          idleExpiresAt: new Date(
            now + appConfig.discordBotManagement.idleTtlSeconds * 1_000
          ),
          absoluteExpiresAt: new Date(
            now + appConfig.discordBotManagement.absoluteTtlSeconds * 1_000
          )
        });
        await transactionRepository.clearOAuthVerifier(oauth.id);
      });
      this.logger?.event?.({
        type: oauth.purpose === "link_identity"
          ? "yoro.account.identity_linked"
          : "yoro.account.login_completed",
        provider: input.provider
      });
      return {
        sessionToken: `${sessionToken}.${csrfToken}`,
        returnPath: oauth.return_path
      };
    } catch (error) {
      await repository.failOAuthSession(oauth.id).catch(() => undefined);
      this.logger?.error?.({
        type: "yoro.account.oauth_failed",
        provider: input.provider,
        errorCode: error instanceof YoroAccountError ? error.code : "oauth_failed"
      });
      if (error instanceof YoroAccountError) throw error;
      throw new YoroAccountError("oauth_failed", 503);
    }
  }

  async session(cookieValue?: string): Promise<PublicYoroAccountSession | undefined> {
    const authenticated = await this.authenticate(cookieValue);
    if (!authenticated) return undefined;
    const repository = new YoroAccountRepository(this.pool);
    const [identities, preferences] = await Promise.all([
      repository.listIdentities(authenticated.userId),
      repository.getUserPreferences(authenticated.userId)
    ]);
    const safeIdentities = identities.map(publicYoroIdentity);
    const twitchIdentity = identities.find((identity) => identity.provider === "twitch");
    let isStreamerAdmin: boolean | undefined;
    if (twitchIdentity && this.streamerAdminLookup) {
      try {
        isStreamerAdmin = this.streamerAdminLookup(twitchIdentity.providerSubject);
      } catch {
        // 조회 실패는 fail-closed — 관리자 메뉴를 실수로 노출하지 않습니다.
        isStreamerAdmin = false;
      }
    }
    return {
      authenticated: true,
      csrfToken: authenticated.csrfToken,
      authenticationProvider: authenticated.authenticationProvider,
      identities: safeIdentities,
      preferences,
      connectionCapabilities: {
        riotRsoAvailable: appConfig.riot.rsoEnabled,
        riotRsoRequiresTwitchAuthentication:
          appConfig.riot.rsoEnabled
          && (
            authenticated.authenticationProvider !== "twitch"
            || Date.now() - authenticated.authenticatedAt.getTime()
              > RECENT_AUTHENTICATION_MS
          )
      },
      ...(isStreamerAdmin !== undefined ? { isStreamerAdmin } : {})
    };
  }

  /** 최근 Twitch 직접 인증 세션에 연결된 Twitch identity의 twitchUserId만 반환합니다.
      관리자 승격 판정 전용이며 Twitch credential은 조회하지 않습니다. */
  async twitchUserIdForSession(cookieValue?: string): Promise<string | undefined> {
    const authenticated = await this.authenticate(cookieValue);
    if (!authenticated) return undefined;
    if (
      authenticated.authenticationProvider !== "twitch"
      || Date.now() - authenticated.authenticatedAt.getTime()
        > RECENT_AUTHENTICATION_MS
    ) return undefined;
    const identities = await new YoroAccountRepository(this.pool).listIdentities(
      authenticated.userId
    );
    return identities.find((identity) => identity.provider === "twitch")?.providerSubject;
  }

  async updatePreferences(input: {
    sessionCookie?: string;
    csrfToken?: string;
    preferences: YoroUserPreferences;
  }): Promise<YoroUserPreferences> {
    const authenticated = await this.requireMutationSession(
      input.sessionCookie,
      input.csrfToken
    );
    const preferences = await new YoroAccountRepository(this.pool).saveUserPreferences(
      authenticated.userId,
      input.preferences
    );
    this.logger?.event?.({ type: "yoro.account.preferences_updated" });
    return preferences;
  }

  setValorantVisibilityInvalidator(invalidator: (userId: string) => void): void {
    this.valorantVisibilityInvalidator = invalidator;
  }

  setStreamerAdminLookup(lookup: (twitchUserId: string) => boolean): void {
    this.streamerAdminLookup = lookup;
  }

  async updateValorantRecordConsent(input: {
    enabled: boolean;
    sessionCookie?: string;
    csrfToken?: string;
  }): Promise<{ enabled: boolean; consentedAt?: string }> {
    const authenticated = await this.requireMutationSession(input.sessionCookie, input.csrfToken);
    if (authenticated.authenticationProvider !== "twitch") {
      throw new YoroAccountError("twitch_authentication_required", 403);
    }
    if (Date.now() - authenticated.authenticatedAt.getTime() > RECENT_AUTHENTICATION_MS) {
      throw new YoroAccountError("recent_authentication_required", 403);
    }
    const identities = await new YoroAccountRepository(this.pool).listIdentities(authenticated.userId);
    if (!identities.some((identity) => identity.provider === "riot")) {
      throw new YoroAccountError("riot_identity_required", 409);
    }
    const result = await withTransaction(this.pool, async (client) => (
      new YoroAccountRepository(client).setValorantRecordConsent(
        authenticated.userId,
        input.enabled
      )
    ));
    this.valorantVisibilityInvalidator?.(authenticated.userId);
    this.logger?.event?.({
      type: input.enabled
        ? "yoro.account.valorant_record_consent_granted"
        : "yoro.account.valorant_record_consent_revoked"
    });
    return result;
  }

  async authenticateForManagement(cookieValue?: string): Promise<{
    userId: string;
    csrfToken: string;
    csrfTokenHash: Buffer;
  } | undefined> {
    const authenticated = await this.authenticate(cookieValue);
    return authenticated
      ? {
          userId: authenticated.userId,
          csrfToken: authenticated.csrfToken,
          csrfTokenHash: authenticated.csrfTokenHash
        }
      : undefined;
  }

  async getTwitchAccessContext(
    sessionCookie?: string
  ): Promise<(PublicTwitchAccessContext & {
    user: TwitchBroadcasterInfo;
    tokenExpiresAt: string;
  }) | undefined> {
    const session = await this.authenticate(sessionCookie);
    if (!session) return undefined;
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new YoroAccountRepository(client);
        const row = await repository.lockTwitchCredential(session.userId);
        if (!row) return undefined;
        let credential = this.decryptTwitchCredential(
          session.userId,
          row.encrypted_token_record
        );
        const identities = await repository.listIdentities(session.userId);
        if (
          !identities.some((identity) => (
            identity.provider === "twitch"
            && identity.providerSubject === credential.user.id
          ))
        ) {
          throw new YoroTwitchCredentialError("security_failed");
        }
        if (Date.parse(credential.expiresAt) <= Date.now() + TWITCH_TOKEN_REFRESH_SKEW_MS) {
          credential = await this.refreshTwitchCredential(credential);
          await repository.upsertTwitchCredential({
            userId: session.userId,
            encryptedTokenRecord: this.encryptTwitchCredential(session.userId, credential),
            tokenExpiresAt: new Date(credential.expiresAt)
          });
        }
        if (
          TWITCH_PUBLIC_VIEWER_SCOPES.some(
            (requiredScope) => !credential.scopes.includes(requiredScope)
          )
        ) {
          return undefined;
        }
        return {
          clientId: appConfig.twitch.clientId,
          accessToken: credential.accessToken,
          userId: credential.user.id,
          scopes: [...credential.scopes],
          user: { ...credential.user },
          tokenExpiresAt: credential.expiresAt
        };
      });
    } catch (error) {
      if (!(error instanceof YoroTwitchCredentialError)) throw error;
      await new YoroAccountRepository(this.pool)
        .revokeTwitchCredential(session.userId, error.status)
        .catch(() => undefined);
      this.logger?.error?.({
        type: "yoro.account.twitch_credential_rejected",
        errorCode: error.status
      });
      return undefined;
    }
  }

  async adoptTwitchViewerSession(
    sessionCookie: string | undefined,
    viewerSession: PublicTwitchViewerSession
  ): Promise<void> {
    const session = await this.authenticate(sessionCookie);
    if (!session) return;
    const credential: YoroTwitchCredential = {
      version: TWITCH_CREDENTIAL_VERSION,
      accessToken: viewerSession.accessToken,
      refreshToken: viewerSession.refreshToken,
      scopes: [...viewerSession.scopes],
      expiresAt: viewerSession.expiresAt,
      user: { ...viewerSession.user }
    };
    await withTransaction(this.pool, async (client) => {
      const repository = new YoroAccountRepository(client);
      const identities = await repository.listIdentities(session.userId);
      if (
        !identities.some((identity) => (
          identity.provider === "twitch"
          && identity.providerSubject === credential.user.id
        ))
      ) {
        return;
      }
      await repository.upsertTwitchCredential({
        userId: session.userId,
        encryptedTokenRecord: this.encryptTwitchCredential(session.userId, credential),
        tokenExpiresAt: new Date(credential.expiresAt)
      });
    });
  }

  async unlinkIdentity(input: {
    provider: YoroIdentityProvider;
    sessionCookie?: string;
    csrfToken?: string;
  }): Promise<void> {
    const session = await this.requireMutationSession(
      input.sessionCookie,
      input.csrfToken
    );
    await withTransaction(this.pool, async (client) => {
      const repository = new YoroAccountRepository(client);
      if (!await repository.revokeIdentity(session.userId, input.provider)) {
        throw new YoroAccountError("last_identity_required", 409);
      }
      if (input.provider === "twitch") {
        await repository.revokeTwitchCredential(session.userId);
      }
      await repository.revokeUserSessions(session.userId);
    });
    if (input.provider === "riot") this.valorantVisibilityInvalidator?.(session.userId);
    this.logger?.event?.({
      type: "yoro.account.identity_unlinked",
      provider: input.provider
    });
  }

  async logout(cookieValue?: string): Promise<void> {
    const parsed = this.parseSessionCookie(cookieValue);
    if (!parsed) return;
    await new YoroAccountRepository(this.pool).revokeSession(
      discordSecretHash(parsed.sessionToken)
    );
    this.logger?.event?.({ type: "yoro.account.session_revoked" });
  }

  private async authenticate(cookieValue?: string): Promise<AuthenticatedSession | undefined> {
    const parsed = this.parseSessionCookie(cookieValue);
    if (!parsed) return undefined;
    const session = await new YoroAccountRepository(this.pool).findActiveSession(
      discordSecretHash(parsed.sessionToken),
      new Date(Date.now() + appConfig.discordBotManagement.idleTtlSeconds * 1_000)
    );
    if (
      !session
      || !crypto.timingSafeEqual(
        session.csrf_token_hash,
        discordSecretHash(parsed.csrfToken)
      )
    ) return undefined;
    return {
      id: session.id,
      userId: session.user_id,
      csrfToken: parsed.csrfToken,
      csrfTokenHash: session.csrf_token_hash,
      authenticationProvider: session.authentication_provider,
      authenticatedAt: session.authenticated_at
    };
  }

  private async requireSession(cookieValue?: string): Promise<AuthenticatedSession> {
    const session = await this.authenticate(cookieValue);
    if (!session) throw new YoroAccountError("session_required", 401);
    return session;
  }

  private async requireMutationSession(
    cookieValue?: string,
    csrfToken?: string
  ): Promise<AuthenticatedSession> {
    const session = await this.requireSession(cookieValue);
    if (
      !validToken(csrfToken)
      || !crypto.timingSafeEqual(session.csrfTokenHash, discordSecretHash(csrfToken))
    ) {
      throw new YoroAccountError("csrf_required", 403);
    }
    return session;
  }

  private parseSessionCookie(
    value?: string
  ): { sessionToken: string; csrfToken: string } | undefined {
    if (!value || value.length > 300) return undefined;
    const [sessionToken, csrfToken, extra] = value.split(".");
    if (extra !== undefined || !validToken(sessionToken) || !validToken(csrfToken)) {
      return undefined;
    }
    return { sessionToken, csrfToken };
  }

  private discordAuthorizationUrl(state: string, verifier: string): string {
    const url = new URL(DISCORD_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appConfig.discordSaas.clientId);
    url.searchParams.set("scope", "identify");
    url.searchParams.set("redirect_uri", appConfig.discordBotManagement.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", discordPkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  private twitchAuthorizationUrl(state: string): string {
    const url = new URL(TWITCH_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appConfig.twitch.clientId);
    url.searchParams.set("redirect_uri", appConfig.twitch.publicRedirectUri);
    url.searchParams.set("scope", TWITCH_PUBLIC_VIEWER_SCOPES.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  private riotAuthorizationUrl(state: string): string {
    const url = new URL(RIOT_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appConfig.riot.rsoClientId);
    url.searchParams.set("redirect_uri", appConfig.riot.rsoRedirectUri);
    // 계정 소유 확인만 수행하므로 장기 access를 요청하지 않습니다.
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async completeDiscordProvider(
    oauthSessionId: string,
    encryptedVerifier: Buffer | null,
    code: string
  ): Promise<ProviderProfile> {
    if (!encryptedVerifier) throw new YoroAccountError("oauth_failed", 401);
    const verifier = decryptDiscordSecret(
      encryptedVerifier,
      appConfig.discordSaas.tokenEncryptionKey,
      { sessionId: oauthSessionId, discordUserId: "pending", purpose: "yoro_account_pkce" }
    );
    const body = new URLSearchParams({
      client_id: appConfig.discordSaas.clientId,
      client_secret: appConfig.discordSaas.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: appConfig.discordBotManagement.redirectUri,
      code_verifier: verifier
    });
    const token = await this.fetchImpl(DISCORD_TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!token.ok) throw new YoroAccountError("oauth_failed", 401);
    const tokenBody = await token.json() as { access_token?: unknown };
    if (typeof tokenBody.access_token !== "string") {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const profile = await this.fetchImpl(DISCORD_PROFILE_URL, {
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs),
      headers: { Authorization: `Bearer ${tokenBody.access_token}` }
    });
    if (!profile.ok) throw new YoroAccountError("oauth_failed", 401);
    const value = await profile.json() as Record<string, unknown>;
    if (typeof value.id !== "string" || !/^[0-9]{1,32}$/u.test(value.id)) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const displayName = typeof value.global_name === "string" && value.global_name.trim()
      ? value.global_name
      : typeof value.username === "string"
        ? value.username
        : value.id;
    return {
      providerSubject: value.id,
      displayName: displayName.slice(0, 80),
      ...(typeof value.avatar === "string" && /^[a-f0-9_]{1,128}$/u.test(value.avatar)
        ? { avatarReference: value.avatar }
        : {})
    };
  }

  private async completeTwitchProvider(code: string): Promise<TwitchProviderCompletion> {
    const token = await this.fetchImpl(TWITCH_TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appConfig.twitch.clientId,
        client_secret: appConfig.twitch.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: appConfig.twitch.publicRedirectUri
      })
    });
    if (!token.ok) throw new YoroAccountError("oauth_failed", 401);
    const tokenBody = await token.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
      scope?: unknown;
    };
    if (
      !validOAuthToken(tokenBody.access_token)
      || !validOAuthToken(tokenBody.refresh_token)
      || typeof tokenBody.expires_in !== "number"
      || !Number.isFinite(tokenBody.expires_in)
      || tokenBody.expires_in <= 0
      || tokenBody.expires_in > 365 * 24 * 60 * 60
    ) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const scopes = normalizeScopes(tokenBody.scope);
    const profile = await this.fetchImpl(TWITCH_PROFILE_URL, {
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": appConfig.twitch.clientId,
        Authorization: `Bearer ${tokenBody.access_token}`
      }
    });
    if (!profile.ok) throw new YoroAccountError("oauth_failed", 401);
    const value = await profile.json() as {
      data?: Array<{
        id?: unknown;
        login?: unknown;
        display_name?: unknown;
        profile_image_url?: unknown;
      }>;
    };
    const user = value.data?.[0];
    if (
      !user
      || !validTwitchUserId(user.id)
      || !validTwitchLogin(user.login)
    ) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const displayName = typeof user.display_name === "string" && user.display_name.trim()
      ? user.display_name
      : typeof user.login === "string"
        ? user.login
        : user.id;
    const avatarReference = safeTwitchAvatarUrl(user.profile_image_url);
    const safeDisplayName = displayName.slice(0, 80);
    return {
      profile: {
        providerSubject: user.id,
        displayName: safeDisplayName,
        ...(avatarReference ? { avatarReference } : {})
      },
      credential: {
        version: TWITCH_CREDENTIAL_VERSION,
        accessToken: tokenBody.access_token,
        refreshToken: tokenBody.refresh_token,
        scopes,
        expiresAt: new Date(Date.now() + tokenBody.expires_in * 1_000).toISOString(),
        user: {
          id: user.id,
          login: user.login,
          displayName: safeDisplayName,
          ...(avatarReference ? { profileImageUrl: avatarReference } : {})
        }
      }
    };
  }

  private async completeRiotProvider(code: string): Promise<ProviderProfile> {
    const basicCredential = Buffer.from(
      `${appConfig.riot.rsoClientId}:${appConfig.riot.rsoClientSecret}`,
      "utf8"
    ).toString("base64");
    const token = await this.fetchImpl(RIOT_TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.riot.apiTimeoutMs),
      headers: {
        Authorization: `Basic ${basicCredential}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: appConfig.riot.rsoRedirectUri
      })
    });
    if (!token.ok) throw new YoroAccountError("oauth_failed", 401);
    const tokenBody = await token.json() as { access_token?: unknown };
    if (!validOAuthToken(tokenBody.access_token)) {
      throw new YoroAccountError("oauth_failed", 401);
    }

    const account = await this.fetchImpl(
      `https://${appConfig.riot.accountRegion}.api.riotgames.com/riot/account/v1/accounts/me`,
      {
        signal: AbortSignal.timeout(appConfig.riot.apiTimeoutMs),
        headers: { Authorization: `Bearer ${tokenBody.access_token}` }
      }
    );
    if (!account.ok) throw new YoroAccountError("oauth_failed", 401);
    const value = await account.json() as Record<string, unknown>;
    const gameName = safeRiotIdPart(value.gameName, 64);
    const tagLine = safeRiotIdPart(value.tagLine, 32);
    if (!validRiotPuuid(value.puuid) || !gameName || !tagLine) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    return {
      providerSubject: value.puuid,
      displayName: `${gameName}#${tagLine}`.slice(0, 80)
    };
  }

  private twitchCredentialEncryptionKey(): Buffer {
    const key = decodeTwitchTokenEncryptionKey(appConfig.twitch.tokenEncryptionKey);
    if (!key) throw new YoroTwitchCredentialError("security_failed");
    return key;
  }

  private twitchCredentialAad(userId: string): string {
    return `yoro-twitch-viewer:${userId}`;
  }

  private encryptTwitchCredential(
    userId: string,
    credential: YoroTwitchCredential
  ): Buffer {
    const encrypted = encryptTwitchTokenDocument(
      JSON.stringify(credential),
      this.twitchCredentialEncryptionKey(),
      this.twitchCredentialAad(userId)
    );
    return Buffer.from(encrypted, "utf8");
  }

  private decryptTwitchCredential(
    userId: string,
    encryptedRecord: Buffer
  ): YoroTwitchCredential {
    try {
      const decrypted = decryptTwitchTokenDocument(
        encryptedRecord.toString("utf8"),
        this.twitchCredentialEncryptionKey(),
        this.twitchCredentialAad(userId)
      );
      if (decrypted.legacyPlaintext) {
        throw new YoroTwitchCredentialError("security_failed");
      }
      return parseStoredTwitchCredential(decrypted.plaintext);
    } catch (error) {
      if (error instanceof YoroTwitchCredentialError) throw error;
      throw new YoroTwitchCredentialError("security_failed");
    }
  }

  private async refreshTwitchCredential(
    credential: YoroTwitchCredential
  ): Promise<YoroTwitchCredential> {
    const response = await this.fetchImpl(TWITCH_TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appConfig.twitch.clientId,
        client_secret: appConfig.twitch.clientSecret,
        grant_type: "refresh_token",
        refresh_token: credential.refreshToken
      })
    }).catch(() => {
      throw new YoroTwitchCredentialError("revoked");
    });
    if (!response.ok) throw new YoroTwitchCredentialError("revoked");
    const body = await response.json().catch(() => undefined) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
      scope?: unknown;
    } | undefined;
    if (
      !body
      || !validOAuthToken(body.access_token)
      || (body.refresh_token !== undefined && !validOAuthToken(body.refresh_token))
      || typeof body.expires_in !== "number"
      || !Number.isFinite(body.expires_in)
      || body.expires_in <= 0
      || body.expires_in > 365 * 24 * 60 * 60
    ) {
      throw new YoroTwitchCredentialError("security_failed");
    }
    let scopes = credential.scopes;
    if (body.scope !== undefined) {
      try {
        scopes = normalizeScopes(body.scope);
      } catch {
        throw new YoroTwitchCredentialError("security_failed");
      }
    }
    return {
      ...credential,
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? credential.refreshToken,
      scopes,
      expiresAt: new Date(Date.now() + body.expires_in * 1_000).toISOString()
    };
  }

  /* 참여 모집 Discord 알림 대상 (안 A: 스트리머 본인이 켠다). */

  async participationAnnouncement(input: {
    userId: string;
    streamerTwitchUserId: string;
  }): Promise<AnnouncementSettings> {
    return new DiscordParticipationAnnouncementRepository(this.pool).read(input);
  }

  async replaceParticipationAnnouncement(input: {
    userId: string;
    streamerTwitchUserId: string;
    enabled: boolean;
    targets: readonly AnnouncementTargetInput[];
  }): Promise<AnnouncementSettings> {
    return withTransaction(this.pool, async (client) => {
      const repository = new DiscordParticipationAnnouncementRepository(client);
      await repository.replace(input);
      return repository.read(input);
    });
  }
}
