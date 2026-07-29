import crypto from "node:crypto";
import type { Pool } from "pg";
import { appConfig } from "../config.js";
import { withTransaction } from "../database/transaction.js";
import {
  type YoroExternalIdentity,
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

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_PROFILE_URL = "https://discord.com/api/v10/users/@me";
const TWITCH_AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_PROFILE_URL = "https://api.twitch.tv/helix/users";
const RECENT_AUTHENTICATION_MS = 15 * 60 * 1_000;

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

type AuthenticatedSession = {
  id: string;
  userId: string;
  csrfToken: string;
  csrfTokenHash: Buffer;
  authenticationProvider: YoroIdentityProvider;
  authenticatedAt: Date;
};

export type YoroAccountErrorCode =
  | "feature_unavailable"
  | "oauth_failed"
  | "session_required"
  | "recent_authentication_required"
  | "csrf_required"
  | "identity_conflict"
  | "last_identity_required"
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

function safeReturnPath(value: string | undefined): string {
  if (!value || value.length > 256 || !value.startsWith("/") || value.startsWith("//")) {
    return "/account/connections";
  }
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)) {
    return "/account/connections";
  }
  const allowed = [
    "/",
    "/bot",
    "/bot/manage",
    "/account",
    "/account/connections",
    "/lol",
    "/palworld",
    "/participation",
    "/community",
    "/dashboard"
  ];
  return allowed.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))
    ? value
    : "/account/connections";
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
    let targetUserId: string | undefined;
    if (input.purpose === "link_identity") {
      const authenticated = await this.requireSession(input.sessionCookie);
      if (
        Date.now() - authenticated.authenticatedAt.getTime()
        > RECENT_AUTHENTICATION_MS
      ) {
        throw new YoroAccountError("recent_authentication_required", 401);
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
      : this.twitchAuthorizationUrl(state);
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
      const profile = input.provider === "discord"
        ? await this.completeDiscordProvider(oauth.id, oauth.pkce_verifier_encrypted, input.code)
        : await this.completeTwitchProvider(input.code);
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
            ...profile
          });
          if (linked === "conflict") {
            throw new YoroAccountError("identity_conflict", 409);
          }
          userId = oauth.target_user_id;
          await transactionRepository.revokeUserSessions(userId);
        } else {
          userId = await transactionRepository.resolveUserForLogin({
            provider: input.provider,
            ...profile
          });
        }
        await transactionRepository.createSession({
          id: crypto.randomUUID(),
          userId,
          sessionTokenHash: discordSecretHash(sessionToken),
          csrfTokenHash: discordSecretHash(csrfToken),
          authenticationProvider: input.provider,
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

  async session(cookieValue?: string): Promise<{
    authenticated: true;
    csrfToken: string;
    authenticationProvider: YoroIdentityProvider;
    identities: readonly Omit<YoroExternalIdentity, "providerSubject">[];
  } | undefined> {
    const authenticated = await this.authenticate(cookieValue);
    if (!authenticated) return undefined;
    const identities = await new YoroAccountRepository(this.pool)
      .listIdentities(authenticated.userId);
    const safeIdentities = identities.map((identity) => ({
      provider: identity.provider,
      displayName: identity.displayName,
      ...(identity.avatarReference ? { avatarReference: identity.avatarReference } : {}),
      connectedAt: identity.connectedAt,
      lastAuthenticatedAt: identity.lastAuthenticatedAt
    }));
    return {
      authenticated: true,
      csrfToken: authenticated.csrfToken,
      authenticationProvider: authenticated.authenticationProvider,
      identities: safeIdentities
    };
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
      await repository.revokeUserSessions(session.userId);
    });
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

  private async completeTwitchProvider(code: string): Promise<ProviderProfile> {
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
    const tokenBody = await token.json() as { access_token?: unknown };
    if (typeof tokenBody.access_token !== "string") {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const profile = await this.fetchImpl(TWITCH_PROFILE_URL, {
      signal: AbortSignal.timeout(appConfig.twitch.apiTimeoutMs),
      headers: {
        "Client-Id": appConfig.twitch.clientId,
        Authorization: `Bearer ${tokenBody.access_token}`
      }
    });
    if (!profile.ok) throw new YoroAccountError("oauth_failed", 401);
    const value = await profile.json() as {
      data?: Array<{ id?: unknown; login?: unknown; display_name?: unknown }>;
    };
    const user = value.data?.[0];
    if (!user || typeof user.id !== "string" || !/^[0-9]{1,64}$/u.test(user.id)) {
      throw new YoroAccountError("oauth_failed", 401);
    }
    const displayName = typeof user.display_name === "string" && user.display_name.trim()
      ? user.display_name
      : typeof user.login === "string"
        ? user.login
        : user.id;
    return {
      providerSubject: user.id,
      displayName: displayName.slice(0, 80)
    };
  }
}
