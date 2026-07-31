import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  isManagementOrganizationId,
  type BotManagementGameServer,
  type BotManagementOrganization,
  type CreatePalworldGameServerInput,
  type DiscordBotControlOverview,
  type UpdateDiscordBotControlInput
} from "@streamops/shared";
import { appConfig } from "../config.js";
import { SafeDatabaseError } from "../database/errors.js";
import { withTransaction } from "../database/transaction.js";
import { DiscordManagementRepository } from "../database/repositories/discord-management-repository.js";
import { DiscordBotControlRepository } from "../database/repositories/discord-bot-control-repository.js";
import {
  decryptDiscordSecret,
  discordPkceChallenge,
  discordSafeToken,
  discordSecretHash,
  encryptDiscordSecret
} from "./discord-oauth-crypto.js";
import type { YoroAccountService } from "./yoro-account-service.js";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_PROFILE_URL = "https://discord.com/api/v10/users/@me";
const MANAGEMENT_RETURN_PATH = "/dashboard/organizations";

export const DISCORD_MANAGEMENT_OAUTH_COOKIE = "yoro_discord_management_oauth";
export const DISCORD_MANAGEMENT_SESSION_COOKIE = "yoro_discord_management";

export type DiscordManagementErrorCode =
  | "feature_disabled"
  | "database_unavailable"
  | "oauth_failed"
  | "identity_not_connected"
  | "organization_required"
  | "session_required"
  | "csrf_required"
  | "permission_required"
  | "not_found"
  | "entitlement_exceeded"
  | "revision_conflict"
  | "rate_limited"
  | "invalid_input";

export class DiscordManagementError extends Error {
  constructor(
    readonly code: DiscordManagementErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503
  ) {
    super(code);
    this.name = "DiscordManagementError";
  }
}

type ManagementSession = {
  id: string;
  userId: string;
  csrfTokenHash: Buffer;
};

type AuditLogger = {
  event?: (entry: Record<string, unknown>) => void;
  error?: (entry: Record<string, unknown>) => void;
};

type FetchLike = typeof fetch;

function validToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/u.test(value);
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

export function discordManagementOAuthCookie(value: string): string {
  return cookie(
    DISCORD_MANAGEMENT_OAUTH_COOKIE,
    value,
    appConfig.discordBotManagement.oauthTtlSeconds
  );
}

export function discordManagementSessionCookie(value: string): string {
  return cookie(
    DISCORD_MANAGEMENT_SESSION_COOKIE,
    value,
    appConfig.discordBotManagement.absoluteTtlSeconds
  );
}

export function clearDiscordManagementCookie(name: string): string {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export class DiscordManagementService {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly pool: Pool,
    private readonly logger?: AuditLogger,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly yoroAccounts?: YoroAccountService
  ) {}

  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void new DiscordManagementRepository(this.pool).expireSessions().catch(() => undefined);
    }, 60_000);
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async beginLogin(): Promise<{ authorizationUrl: string; cookieValue: string }> {
    const id = crypto.randomUUID();
    const state = discordSafeToken();
    const binding = discordSafeToken();
    const verifier = discordSafeToken(48);
    const expiresAt = new Date(
      Date.now() + appConfig.discordBotManagement.oauthTtlSeconds * 1_000
    );
    const encryptedVerifier = encryptDiscordSecret(
      verifier,
      appConfig.discordSaas.tokenEncryptionKey,
      appConfig.discordSaas.tokenEncryptionKeyVersion,
      { sessionId: id, discordUserId: "pending", purpose: "management_pkce" }
    );
    await new DiscordManagementRepository(this.pool).createOAuthSession({
      id,
      stateHash: discordSecretHash(state),
      cookieBindingHash: discordSecretHash(binding),
      encryptedPkceVerifier: encryptedVerifier,
      expiresAt
    });
    const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", appConfig.discordSaas.clientId);
    authorizationUrl.searchParams.set("scope", "identify");
    authorizationUrl.searchParams.set(
      "redirect_uri",
      appConfig.discordBotManagement.redirectUri
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", discordPkceChallenge(verifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    this.logger?.event?.({ type: "discord.management.login_started" });
    return { authorizationUrl: authorizationUrl.toString(), cookieValue: binding };
  }

  async completeLogin(input: {
    state: string;
    code: string;
    oauthCookie?: string;
  }): Promise<{ sessionToken: string }> {
    if (
      !validToken(input.state)
      || !validToken(input.oauthCookie)
      || input.code.length < 1
      || input.code.length > 1024
    ) {
      throw new DiscordManagementError("oauth_failed", 401);
    }
    const repository = new DiscordManagementRepository(this.pool);
    const oauth = await repository.consumeOAuthState({
      stateHash: discordSecretHash(input.state),
      cookieBindingHash: discordSecretHash(input.oauthCookie)
    });
    if (!oauth) throw new DiscordManagementError("oauth_failed", 401);
    let verifier: string;
    try {
      verifier = decryptDiscordSecret(
        oauth.pkce_verifier_encrypted,
        appConfig.discordSaas.tokenEncryptionKey,
        { sessionId: oauth.id, discordUserId: "pending", purpose: "management_pkce" }
      );
    } catch {
      await repository.clearOAuthSecret(oauth.id, true);
      throw new DiscordManagementError("oauth_failed", 401);
    }
    try {
      const accessToken = await this.exchangeCode(input.code, verifier);
      const discordUserId = await this.fetchProfileId(accessToken);
      const identity = await repository.findIdentityByDiscordUser(discordUserId);
      if (!identity) throw new DiscordManagementError("identity_not_connected", 403);
      if (!await repository.userHasOrganization(identity.userId)) {
        throw new DiscordManagementError("organization_required", 403);
      }
      const sessionToken = discordSafeToken();
      const csrfToken = discordSafeToken();
      const now = Date.now();
      await withTransaction(this.pool, async (client) => {
        const transactionRepository = new DiscordManagementRepository(client);
        await transactionRepository.createSession({
          id: crypto.randomUUID(),
          userId: identity.userId,
          sessionTokenHash: discordSecretHash(sessionToken),
          csrfTokenHash: discordSecretHash(csrfToken),
          idleExpiresAt: new Date(
            now + appConfig.discordBotManagement.idleTtlSeconds * 1_000
          ),
          absoluteExpiresAt: new Date(
            now + appConfig.discordBotManagement.absoluteTtlSeconds * 1_000
          )
        });
        await transactionRepository.clearOAuthSecret(oauth.id);
      });
      this.logger?.event?.({ type: "discord.management.login_completed" });
      return { sessionToken: `${sessionToken}.${csrfToken}` };
    } catch (error) {
      await repository.clearOAuthSecret(oauth.id, true).catch(() => undefined);
      this.logger?.error?.({
        type: "discord.management.login_failed",
        errorCode: error instanceof DiscordManagementError ? error.code : "oauth_failed"
      });
      if (error instanceof DiscordManagementError) throw error;
      throw new DiscordManagementError("oauth_failed", 503);
    }
  }

  async session(cookieValue?: string): Promise<{
    authenticated: true;
    csrfToken: string;
    organizations: readonly BotManagementOrganization[];
  } | undefined> {
    const authenticated = await this.authenticate(cookieValue);
    if (!authenticated) return undefined;
    const organizations = await new DiscordManagementRepository(this.pool)
      .listOrganizations(authenticated.userId);
    return {
      authenticated: true,
      csrfToken: authenticated.csrfToken,
      organizations
    };
  }

  async listGameServers(input: {
    cookieValue?: string;
    organizationId: string;
  }): Promise<readonly BotManagementGameServer[]> {
    const authenticated = await this.requireSession(input.cookieValue);
    const repository = new DiscordManagementRepository(this.pool);
    const membership = await repository.requireMembership(
      authenticated.userId,
      input.organizationId
    );
    return repository.listGameServers(membership.context, membership.role);
  }

  async botControl(input: {
    cookieValue?: string;
    organizationId: string;
  }): Promise<DiscordBotControlOverview> {
    const authenticated = await this.requireSession(input.cookieValue);
    try {
      const membershipRepository = new DiscordManagementRepository(this.pool);
      const membership = await membershipRepository.requireMembership(
        authenticated.userId,
        input.organizationId
      );
      return new DiscordBotControlRepository(this.pool).overview({
        context: membership.context,
        role: membership.role,
        applicationId: appConfig.discordBotInternal.applicationId,
        globalPrefixCommandsEnabled:
          appConfig.discordBotInternal.prefixCommandsEnabled
      });
    } catch (error) {
      if (
        error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
      ) {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    }
  }

  async updateBotControl(input: {
    cookieValue?: string;
    csrfToken?: string;
    organizationId: string;
    value: UpdateDiscordBotControlInput;
  }): Promise<DiscordBotControlOverview> {
    const authenticated = await this.requireMutationSession(
      input.cookieValue,
      input.csrfToken
    );
    try {
      return await withTransaction(this.pool, async (client) => {
        const membership = await new DiscordManagementRepository(client)
          .requireMembership(authenticated.userId, input.organizationId);
        return new DiscordBotControlRepository(client).update({
          context: membership.context,
          role: membership.role,
          applicationId: appConfig.discordBotInternal.applicationId,
          globalPrefixCommandsEnabled:
            appConfig.discordBotInternal.prefixCommandsEnabled,
          value: input.value
        });
      });
    } catch (error) {
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw new DiscordManagementError("revision_conflict", 409);
      }
      if (
        error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
      ) {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    }
  }

  async createGameServer(input: {
    cookieValue?: string;
    csrfToken?: string;
    organizationId: string;
    value: CreatePalworldGameServerInput;
  }): Promise<BotManagementGameServer> {
    const authenticated = await this.requireMutationSession(
      input.cookieValue,
      input.csrfToken
    );
    try {
      return await withTransaction(this.pool, async (client) => {
        const repository = new DiscordManagementRepository(client);
        const membership = await repository.requireMembership(
          authenticated.userId,
          input.organizationId
        );
        return repository.createGameServer({
          context: membership.context,
          role: membership.role,
          displayName: input.value.displayName,
          region: input.value.region
        });
      });
    } catch (error) {
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw new DiscordManagementError("entitlement_exceeded", 409);
      }
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_REFERENCE_INVALID") {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    }
  }

  async authorizeGameServerRestConnection(input: {
    cookieValue?: string;
    csrfToken?: string;
    organizationId: string;
    gameServerId: string;
    mutation: boolean;
  }): Promise<string> {
    const authenticated = input.mutation
      ? await this.requireMutationSession(input.cookieValue, input.csrfToken)
      : await this.requireSession(input.cookieValue);
    try {
      const repository = new DiscordManagementRepository(this.pool);
      const membership = await repository.requireMembership(
        authenticated.userId,
        input.organizationId
      );
      if (
        input.mutation
        && membership.role !== "owner"
        && membership.role !== "manager"
      ) {
        throw new DiscordManagementError("permission_required", 403);
      }
      const servers = await repository.listGameServers(
        membership.context,
        membership.role
      );
      const server = servers.find((candidate) =>
        candidate.id === input.gameServerId && candidate.isEnabled
      );
      if (!server) throw new DiscordManagementError("not_found", 404);
      return `organization:${input.organizationId}:server:${input.gameServerId}`;
    } catch (error) {
      if (error instanceof DiscordManagementError) throw error;
      if (
        error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
      ) {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    }
  }

  async deleteGameServer(input: {
    cookieValue?: string;
    csrfToken?: string;
    organizationId: string;
    gameServerId: string;
    beforeDelete?: (ownerId: string) => Promise<void>;
  }): Promise<void> {
    const authenticated = await this.requireMutationSession(
      input.cookieValue,
      input.csrfToken
    );
    try {
      const authorizationRepository = new DiscordManagementRepository(this.pool);
      const membership = await authorizationRepository.requireMembership(
        authenticated.userId,
        input.organizationId
      );
      if (membership.role !== "owner") {
        throw new DiscordManagementError("permission_required", 403);
      }
      const servers = await authorizationRepository.listGameServers(
        membership.context,
        membership.role
      );
      if (!servers.some((server) => server.id === input.gameServerId)) {
        throw new DiscordManagementError("not_found", 404);
      }
      await input.beforeDelete?.(
        `organization:${input.organizationId}:server:${input.gameServerId}`
      );
    } catch (error) {
      if (error instanceof DiscordManagementError) throw error;
      if (
        error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
      ) {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    }
    const deleted = await withTransaction(this.pool, async (client) => {
      const repository = new DiscordManagementRepository(client);
      const membership = await repository.requireMembership(
        authenticated.userId,
        input.organizationId
      );
      return repository.deleteGameServer({
        context: membership.context,
        role: membership.role,
        gameServerId: input.gameServerId
      });
    }).catch((error: unknown) => {
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_REFERENCE_INVALID") {
        throw new DiscordManagementError("permission_required", 403);
      }
      throw error;
    });
    if (!deleted) throw new DiscordManagementError("not_found", 404);
  }

  async logout(cookieValue?: string): Promise<void> {
    const parsed = this.parseSessionCookie(cookieValue);
    if (!parsed) return;
    await this.yoroAccounts?.logout(cookieValue);
    await new DiscordManagementRepository(this.pool).revokeSession(
      discordSecretHash(parsed.sessionToken)
    );
    this.logger?.event?.({ type: "discord.management.session_revoked" });
  }

  private async authenticate(cookieValue?: string): Promise<
    (ManagementSession & { csrfToken: string }) | undefined
  > {
    const parsed = this.parseSessionCookie(cookieValue);
    if (!parsed) return undefined;
    const yoroSession = await this.yoroAccounts?.authenticateForManagement(cookieValue);
    if (yoroSession) {
      return {
        id: "yoro-session",
        userId: yoroSession.userId,
        csrfTokenHash: yoroSession.csrfTokenHash,
        csrfToken: yoroSession.csrfToken
      };
    }
    const nextIdleExpiry = new Date(
      Date.now() + appConfig.discordBotManagement.idleTtlSeconds * 1_000
    );
    const session = await new DiscordManagementRepository(this.pool).findActiveSession(
      discordSecretHash(parsed.sessionToken),
      nextIdleExpiry
    );
    if (
      !session
      || !crypto.timingSafeEqual(session.csrf_token_hash, discordSecretHash(parsed.csrfToken))
    ) return undefined;
    return {
      id: session.id,
      userId: session.user_id,
      csrfTokenHash: session.csrf_token_hash,
      csrfToken: parsed.csrfToken
    };
  }

  private async requireSession(cookieValue?: string): Promise<
    ManagementSession & { csrfToken: string }
  > {
    const session = await this.authenticate(cookieValue);
    if (!session) throw new DiscordManagementError("session_required", 401);
    return session;
  }

  private async requireMutationSession(
    cookieValue?: string,
    csrfToken?: string
  ): Promise<ManagementSession & { csrfToken: string }> {
    const session = await this.requireSession(cookieValue);
    if (
      !validToken(csrfToken)
      || !crypto.timingSafeEqual(discordSecretHash(csrfToken), session.csrfTokenHash)
    ) {
      throw new DiscordManagementError("csrf_required", 403);
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

  private async exchangeCode(code: string, verifier: string): Promise<string> {
    const response = await this.fetchImpl(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: appConfig.discordBotManagement.redirectUri,
        client_id: appConfig.discordSaas.clientId,
        client_secret: appConfig.discordSaas.clientSecret,
        code_verifier: verifier
      }),
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs)
    });
    if (!response.ok) throw new DiscordManagementError("oauth_failed", 503);
    const body = await response.json() as Record<string, unknown>;
    const scope = typeof body.scope === "string"
      ? body.scope.split(/\s+/u).filter(Boolean).sort().join(" ")
      : "";
    if (
      typeof body.access_token !== "string"
      || body.access_token.length < 16
      || body.token_type !== "Bearer"
      || scope !== "identify"
    ) {
      throw new DiscordManagementError("oauth_failed", 503);
    }
    return body.access_token;
  }

  private async fetchProfileId(accessToken: string): Promise<string> {
    const response = await this.fetchImpl(DISCORD_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs)
    });
    if (!response.ok) throw new DiscordManagementError("oauth_failed", 503);
    const body = await response.json() as Record<string, unknown>;
    if (typeof body.id !== "string" || !/^[0-9]{1,32}$/u.test(body.id)) {
      throw new DiscordManagementError("oauth_failed", 503);
    }
    return body.id;
  }

}

export function discordManagementReturnUrl(status?: "error"): string {
  const target = new URL(MANAGEMENT_RETURN_PATH, appConfig.dashboardBaseUrl);
  if (status) target.searchParams.set("status", status);
  return target.toString();
}

export function requireManagementOrganizationId(value: string): string {
  if (!isManagementOrganizationId(value)) {
    throw new DiscordManagementError("not_found", 404);
  }
  return value;
}
