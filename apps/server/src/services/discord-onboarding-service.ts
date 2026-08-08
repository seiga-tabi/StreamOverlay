import crypto from "node:crypto";
import type { Pool } from "pg";
import { appConfig } from "../config.js";
import { withTransaction } from "../database/transaction.js";
import { SafeDatabaseError } from "../database/errors.js";
import {
  DiscordOnboardingRepository,
  type DiscordAuthenticatedSession,
  type DiscordGuildCandidateRecord,
  type DiscordSetupIssuedVia
} from "../database/repositories/discord-onboarding-repository.js";
import { YoroAccountRepository } from "../database/repositories/yoro-account-repository.js";
import { DiscordGuildDirectoryRepository } from "../database/repositories/discord-guild-directory-repository.js";
import {
  DiscordAnnouncementDispatchRepository,
  type AnnouncementDispatchTarget
} from "../database/repositories/discord-participation-announcement-repository.js";
import {
  decryptDiscordSecret,
  discordPkceChallenge,
  discordSafeToken,
  discordSecretHash,
  encryptDiscordSecret
} from "./discord-oauth-crypto.js";
import {
  isDiscordSnowflake,
  type DiscordGuildDirectoryReportRequest
} from "@streamops/shared";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
// Discord Administrator permission bit입니다. 설치 이후 기능이 늘어나더라도
// Organization 운영자가 권한을 다시 추가하지 않도록 최초 초대에서 명시적으로 요청합니다.
const DISCORD_BOT_ADMINISTRATOR_PERMISSIONS = "8";
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const SETUP_RETURN_PATH = "/dashboard/organizations";

export const DISCORD_ONBOARDING_COOKIE = "yoro_discord_onboarding";

export type DiscordOnboardingErrorCode =
  | "feature_disabled"
  | "database_unavailable"
  | "setup_session_invalid"
  | "setup_session_expired"
  | "setup_session_consumed"
  | "discord_session_unavailable"
  | "discord_oauth_failed"
  | "discord_response_invalid"
  | "guild_permission_required"
  | "guild_already_connected"
  | "discord_identity_mismatch"
  | "guild_binding_mismatch"
  | "bot_installation_required"
  | "setup_session_active"
  | "organization_permission_required"
  | "entitlement_exceeded"
  | "csrf_required";

export class DiscordOnboardingError extends Error {
  constructor(
    readonly code: DiscordOnboardingErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 503
  ) {
    super(code);
    this.name = "DiscordOnboardingError";
  }
}

type DiscordTokenRecord = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  scope: "identify guilds";
};

type DiscordTokenResponse = {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

type DiscordProfileResponse = {
  id?: unknown;
  username?: unknown;
  global_name?: unknown;
  avatar?: unknown;
};

type DiscordGuildResponse = {
  id?: unknown;
  name?: unknown;
  icon?: unknown;
  owner?: unknown;
  permissions?: unknown;
};

export type DiscordManageableGuild = Readonly<{
  id: string;
  name: string;
  iconUrl?: string;
  manageable: true;
}>;

export type DiscordOnboardingSessionView = Readonly<{
  authenticated: true;
  csrfToken: string;
  guilds: readonly DiscordManageableGuild[];
  organizations: readonly { id: string; displayName: string }[];
}>;

export type DiscordWebManagementSessionView = Readonly<{
  authenticated: true;
  csrfToken: string;
  installedGuilds: readonly (DiscordManageableGuild & { botInstalled: true })[];
  missingBotGuilds: readonly (DiscordManageableGuild & { botInstalled: false })[];
  organizations: readonly { id: string; displayName: string }[];
}>;

type AuditLogger = {
  event?: (entry: Record<string, unknown>) => void;
  error?: (entry: Record<string, unknown>) => void;
};

type FetchLike = typeof fetch;

function validSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,32}$/u.test(value);
}

function safeName(value: unknown, fallback: string, maximum: number): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, maximum);
  return normalized || fallback;
}

function avatarReference(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-f0-9_]{1,128}$/iu.test(value)
    ? value
    : undefined;
}

export function parseDiscordManageableGuild(value: DiscordGuildResponse): DiscordManageableGuild | undefined {
  if (!validSnowflake(value.id)) return undefined;
  if (typeof value.permissions !== "string" || !/^[0-9]{1,80}$/u.test(value.permissions)) return undefined;
  let permissions: bigint;
  try {
    permissions = BigInt(value.permissions);
  } catch {
    return undefined;
  }
  const manageable = value.owner === true
    || (permissions & ADMINISTRATOR) === ADMINISTRATOR
    || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
  if (!manageable) return undefined;
  const icon = avatarReference(value.icon);
  return Object.freeze({
    id: value.id,
    name: safeName(value.name, `Discord ${value.id}`, 120),
    ...(icon ? {
      iconUrl: `https://cdn.discordapp.com/icons/${value.id}/${icon}.webp?size=128`
    } : {}),
    manageable: true as const
  });
}

function parseCookieBinding(cookieValue: string | undefined): {
  binding: string;
  csrfToken: string;
} | undefined {
  if (!cookieValue || cookieValue.length > 256) return undefined;
  const [binding, csrfToken, extra] = cookieValue.split(".");
  if (
    extra !== undefined
    || !binding
    || !csrfToken
    || !/^[A-Za-z0-9_-]{32,128}$/u.test(binding)
    || !/^[A-Za-z0-9_-]{32,128}$/u.test(csrfToken)
  ) return undefined;
  return { binding, csrfToken };
}

function safeSetupToken(value: string): string {
  if (!/^[A-Za-z0-9_-]{32,128}$/u.test(value)) {
    throw new DiscordOnboardingError("setup_session_invalid", 404);
  }
  return value;
}

export function discordOnboardingCookie(value: string): string {
  return [
    `${DISCORD_ONBOARDING_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${appConfig.discordSaas.oauthSessionTtlSeconds}`,
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function clearDiscordOnboardingCookie(): string {
  return [
    `${DISCORD_ONBOARDING_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    appConfig.nodeEnv === "production" ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function buildDiscordBotInstallUrl(
  applicationId: string
): string {
  if (!isDiscordSnowflake(applicationId)) {
    throw new DiscordOnboardingError("feature_disabled", 404);
  }
  const target = new URL(DISCORD_AUTHORIZE_URL);
  target.searchParams.set("client_id", applicationId);
  target.searchParams.set("scope", "applications.commands bot");
  target.searchParams.set(
    "permissions",
    DISCORD_BOT_ADMINISTRATOR_PERMISSIONS
  );
  return target.toString();
}

export function discordBotInstallUrl(): string {
  return buildDiscordBotInstallUrl(appConfig.discordBotInternal.applicationId);
}

export function buildDiscordSetupReturnUrl(
  setupToken: string,
  publicBaseUrl = appConfig.publicBaseUrl
): string {
  const url = new URL(SETUP_RETURN_PATH, publicBaseUrl);
  url.searchParams.set("setup", safeSetupToken(setupToken));
  return url.toString();
}

export class DiscordOnboardingService {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly pool: Pool,
    private readonly logger?: AuditLogger,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void this.expireSessions().catch(() => undefined);
    }, 60_000);
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async issueSetupSession(input: {
    applicationId?: string;
    guildId?: string;
    userId?: string;
    issuedVia?: DiscordSetupIssuedVia;
  } = {}): Promise<{ url: string; expiresAt: string }> {
    const issuedVia = input.issuedVia ?? "operator_test";
    const repository = new DiscordOnboardingRepository(this.pool);
    // 만료 시각이 지난 세션이 다음 명령을 막지 않도록 새 발급 직전에 상태를 정리합니다.
    await repository.expireSessions();
    if (issuedVia === "bot_command") {
      if (
        !isDiscordSnowflake(input.applicationId)
        || !isDiscordSnowflake(input.guildId)
        || !isDiscordSnowflake(input.userId)
      ) {
        throw new DiscordOnboardingError("setup_session_invalid", 404);
      }
      const installed = await repository.activeBotInstallationExists({
          applicationId: input.applicationId,
          guildId: input.guildId
        });
      if (!installed) {
        throw new DiscordOnboardingError("bot_installation_required", 409);
      }
    }
    if (
      issuedVia === "web_management"
      && input.applicationId !== appConfig.discordBotInternal.applicationId
    ) {
      throw new DiscordOnboardingError("setup_session_invalid", 404);
    }
    const token = discordSafeToken();
    const expiresAt = new Date(Date.now() + appConfig.discordSaas.setupLinkTtlSeconds * 1_000);
    try {
      await repository.issueSetupSession({
        id: crypto.randomUUID(),
        tokenHash: discordSecretHash(token),
        expiresAt,
        issuedVia,
        ...(issuedVia === "bot_command" ? {
          requestedDiscordGuildId: input.guildId,
          requestedByDiscordUserId: input.userId
        } : {}),
        ...(issuedVia === "bot_command" || issuedVia === "web_management"
          ? { requestedApplicationId: input.applicationId }
          : {})
      });
    } catch (error) {
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw new DiscordOnboardingError("setup_session_active", 409);
      }
      throw error;
    }
    this.logger?.event?.({ type: "discord.setup.issued", expiresAt: expiresAt.toISOString() });
    return {
      url: buildDiscordSetupReturnUrl(token),
      expiresAt: expiresAt.toISOString()
    };
  }

  async beginWebManagementOAuth(): Promise<{
    authorizationUrl: string;
    cookieValue: string;
  }> {
    const issued = await this.issueSetupSession({
      issuedVia: "web_management",
      applicationId: appConfig.discordBotInternal.applicationId
    });
    const setupToken = new URL(issued.url).searchParams.get("setup");
    if (!setupToken) {
      throw new DiscordOnboardingError("discord_session_unavailable", 503);
    }
    return this.beginOAuth(setupToken, "web_management_connect");
  }

  async isWebManagementCookie(cookieValue?: string): Promise<boolean> {
    const cookie = parseCookieBinding(cookieValue);
    if (!cookie) return false;
    const issuedVia = await new DiscordOnboardingRepository(this.pool)
      .issuedViaByCookieBinding(discordSecretHash(cookie.binding));
    return issuedVia === "web_management";
  }

  async observeBotInstallation(input: {
    applicationId: string;
    guildId: string;
  }): Promise<void> {
    if (
      !isDiscordSnowflake(input.applicationId)
      || !isDiscordSnowflake(input.guildId)
      || input.applicationId !== appConfig.discordBotInternal.applicationId
    ) {
      throw new DiscordOnboardingError("setup_session_invalid", 404);
    }
    await new DiscordOnboardingRepository(this.pool).observeBotInstallation(input);
    this.logger?.event?.({ type: "discord.installation.observed" });
  }

  /**
   * 봇이 보고한 채널·역할 후보를 캐시에 저장합니다.
   *
   * 서버가 봇을 호출하지 않기 위해 방향을 뒤집은 구조입니다. 설치되지 않은
   * Guild 보고는 저장하지 않고 조용히 무시합니다 — 봇은 아직 YORO 와 연결되지
   * 않은 Guild 에도 들어가 있을 수 있고, 그것은 오류가 아닙니다.
   */
  async reportGuildDirectory(
    input: DiscordGuildDirectoryReportRequest
  ): Promise<{ stored: boolean }> {
    if (input.applicationId !== appConfig.discordBotInternal.applicationId) {
      throw new DiscordOnboardingError("setup_session_invalid", 404);
    }
    const stored = await new DiscordGuildDirectoryRepository(this.pool)
      .replaceReport(input);
    this.logger?.event?.({
      type: "discord.guild_directory.reported",
      stored,
      channels: input.channels.length,
      roles: input.roles.length
    });
    return { stored };
  }

  async listAnnouncementTargets(
    applicationId: string
  ): Promise<readonly AnnouncementDispatchTarget[]> {
    if (applicationId !== appConfig.discordBotInternal.applicationId) {
      throw new DiscordOnboardingError("setup_session_invalid", 404);
    }
    return new DiscordAnnouncementDispatchRepository(this.pool)
      .listDispatchable(applicationId);
  }

  async recordAnnouncementPublished(input: {
    targetId: string;
    messageId: string;
    publicSessionId: string;
    state: "recruiting" | "closed";
    waiting?: number;
  }): Promise<void> {
    await new DiscordAnnouncementDispatchRepository(this.pool).recordPublished(input);
  }

  async recordAnnouncementFailure(input: {
    targetId: string;
    deliverable: "missing_channel" | "missing_permission" | "bot_removed";
    dropMessage: boolean;
  }): Promise<void> {
    await new DiscordAnnouncementDispatchRepository(this.pool).recordFailure(input);
  }

  async revokeBotInstallation(input: {
    applicationId: string;
    guildId: string;
  }): Promise<void> {
    if (
      !isDiscordSnowflake(input.applicationId)
      || !isDiscordSnowflake(input.guildId)
      || input.applicationId !== appConfig.discordBotInternal.applicationId
    ) {
      throw new DiscordOnboardingError("setup_session_invalid", 404);
    }
    await new DiscordOnboardingRepository(this.pool).revokeBotInstallation(input);
    this.logger?.event?.({ type: "discord.installation.revoked" });
  }

  async beginOAuth(
    setupToken: string,
    purpose: "setup" | "web_management_connect" = "setup"
  ): Promise<{
    authorizationUrl: string;
    cookieValue: string;
  }> {
    const oauthSessionId = crypto.randomUUID();
    const state = discordSafeToken();
    const binding = discordSafeToken();
    const csrfToken = discordSafeToken();
    const verifier = discordSafeToken(48);
    const expiresAt = new Date(Date.now() + appConfig.discordSaas.oauthSessionTtlSeconds * 1_000);
    const encryptedVerifier = encryptDiscordSecret(
      verifier,
      appConfig.discordSaas.tokenEncryptionKey,
      appConfig.discordSaas.tokenEncryptionKeyVersion,
      {
        sessionId: oauthSessionId,
        discordUserId: "pending",
        purpose: purpose === "setup" ? "pkce_verifier" : "pkce_verifier:web_management_connect"
      }
    );
    const created = await withTransaction(this.pool, async (client) =>
      new DiscordOnboardingRepository(client).beginOAuthSession({
        setupTokenHash: discordSecretHash(safeSetupToken(setupToken)),
        oauthSessionId,
        stateHash: discordSecretHash(state),
        cookieBindingHash: discordSecretHash(binding),
        csrfTokenHash: discordSecretHash(csrfToken),
        encryptedPkceVerifier: encryptedVerifier,
        expiresAt
      })
    );
    if (!created) throw new DiscordOnboardingError("setup_session_expired", 404);
    const authorizationUrl = new URL(DISCORD_AUTHORIZE_URL);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", appConfig.discordSaas.clientId);
    authorizationUrl.searchParams.set("scope", "identify guilds");
    authorizationUrl.searchParams.set("redirect_uri", appConfig.discordSaas.redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", discordPkceChallenge(verifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    this.logger?.event?.({
      type: "discord.oauth.started",
      correlationId: oauthSessionId
    });
    return {
      authorizationUrl: authorizationUrl.toString(),
      cookieValue: `${binding}.${csrfToken}`
    };
  }

  async completeOAuth(input: {
    state: string;
    code: string;
    cookieValue?: string;
    targetUserId?: string;
  }): Promise<DiscordSetupIssuedVia> {
    const cookie = parseCookieBinding(input.cookieValue);
    if (
      !cookie
      || !/^[A-Za-z0-9_-]{32,128}$/u.test(input.state)
      || input.code.length < 1
      || input.code.length > 1024
    ) {
      throw new DiscordOnboardingError("discord_oauth_failed", 401);
    }
    const oauth = await withTransaction(this.pool, async (client) =>
      new DiscordOnboardingRepository(client).consumeOAuthState({
        stateHash: discordSecretHash(input.state),
        cookieBindingHash: discordSecretHash(cookie.binding)
      })
    );
    if (!oauth) throw new DiscordOnboardingError("discord_oauth_failed", 401);

    let verifier: string;
    try {
      verifier = decryptDiscordSecret(
        oauth.encryptedPkceVerifier,
        appConfig.discordSaas.tokenEncryptionKey,
        {
          sessionId: oauth.id,
          discordUserId: "pending",
          purpose: oauth.issuedVia === "web_management"
            ? "pkce_verifier:web_management_connect"
            : "pkce_verifier"
        }
      );
    } catch {
      await new DiscordOnboardingRepository(this.pool).markEncryptionFailed(oauth.id);
      throw new DiscordOnboardingError("discord_session_unavailable", 503);
    }

    try {
      const token = await this.exchangeCode(input.code, verifier);
      const profile = await this.fetchProfile(token.accessToken);
      const manageableGuilds = await this.fetchManageableGuilds(token.accessToken);
      if (oauth.issuedVia === "web_management" && !input.targetUserId) {
        throw new DiscordOnboardingError("discord_session_unavailable", 401);
      }
      if (
        oauth.issuedVia === "bot_command"
        && oauth.requestedByDiscordUserId !== profile.id
      ) {
        await new DiscordOnboardingRepository(this.pool).revokeBoundSession({
          oauthSessionId: oauth.id,
          setupSessionId: oauth.setupSessionId
        });
        throw new DiscordOnboardingError("discord_identity_mismatch", 403);
      }
      const guilds = oauth.requestedDiscordGuildId
        ? manageableGuilds.filter((guild) => guild.id === oauth.requestedDiscordGuildId)
        : manageableGuilds;
      if (oauth.requestedDiscordGuildId && guilds.length !== 1) {
        await new DiscordOnboardingRepository(this.pool).revokeBoundSession({
          oauthSessionId: oauth.id,
          setupSessionId: oauth.setupSessionId
        });
        throw new DiscordOnboardingError("guild_permission_required", 403);
      }
      await withTransaction(this.pool, async (client) => {
        const repository = new DiscordOnboardingRepository(client);
        const identity = await repository.upsertDiscordIdentity({
          identityId: crypto.randomUUID(),
          userId: oauth.issuedVia === "web_management"
            ? input.targetUserId!
            : crypto.randomUUID(),
          ...(oauth.issuedVia === "web_management"
            ? { requiredUserId: input.targetUserId! }
            : {}),
          discordUserId: profile.id,
          displayName: profile.displayName,
          ...(profile.avatarReference ? { avatarReference: profile.avatarReference } : {})
        });
        const encryptedToken = encryptDiscordSecret(
          JSON.stringify(token),
          appConfig.discordSaas.tokenEncryptionKey,
          appConfig.discordSaas.tokenEncryptionKeyVersion,
          {
            sessionId: oauth.id,
            discordUserId: profile.id,
            purpose: oauth.issuedVia === "web_management"
              ? "oauth_token:web_management_connect"
              : "oauth_token"
          }
        );
        await repository.authenticateOAuthSession({
          oauthSessionId: oauth.id,
          setupSessionId: oauth.setupSessionId,
          identityId: identity.identityId,
          encryptedTokenRecord: encryptedToken,
          tokenExpiresAt: new Date(token.expiresAt)
        });
        await repository.replaceGuildCandidates(oauth.id, guilds);
      });
      this.logger?.event?.({
        type: "discord.oauth.completed",
        correlationId: oauth.id
      });
      return oauth.issuedVia;
    } catch (error) {
      try {
        await new DiscordOnboardingRepository(this.pool).revokeBoundSession({
          oauthSessionId: oauth.id,
          setupSessionId: oauth.setupSessionId
        });
      } catch {
        this.logger?.error?.({
          type: "discord.oauth.discard_failed",
          correlationId: oauth.id,
          errorCode: "discord_session_unavailable"
        });
      }
      this.logger?.error?.({
        type: "discord.oauth.failed",
        correlationId: oauth.id,
        errorCode: error instanceof DiscordOnboardingError ? error.code : "discord_oauth_failed"
      });
      if (error instanceof DiscordOnboardingError) throw error;
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw new DiscordOnboardingError("discord_identity_mismatch", 403);
      }
      throw new DiscordOnboardingError("discord_oauth_failed", 503);
    }
  }

  async session(cookieValue?: string): Promise<DiscordOnboardingSessionView | undefined> {
    const cookie = parseCookieBinding(cookieValue);
    if (!cookie) return undefined;
    const repository = new DiscordOnboardingRepository(this.pool);
    const session = await repository.findAuthenticatedByCookie(discordSecretHash(cookie.binding));
    if (!session || !crypto.timingSafeEqual(session.csrfTokenHash, discordSecretHash(cookie.csrfToken))) {
      return undefined;
    }
    await this.decryptToken(session);
    const [guilds, organizations] = await Promise.all([
      repository.listGuildCandidates(session.oauthSessionId),
      repository.listOwnedOrganizations(session.internalUserId)
    ]);
    return Object.freeze({
      authenticated: true as const,
      csrfToken: cookie.csrfToken,
      guilds: guilds.map((guild) => ({ ...guild, manageable: true as const })),
      organizations
    });
  }

  async webManagementSession(
    cookieValue?: string
  ): Promise<DiscordWebManagementSessionView | undefined> {
    const cookie = parseCookieBinding(cookieValue);
    if (!cookie) return undefined;
    const repository = new DiscordOnboardingRepository(this.pool);
    const session = await repository.findAuthenticatedByCookie(discordSecretHash(cookie.binding));
    if (
      !session
      || session.issuedVia !== "web_management"
      || session.requestedApplicationId !== appConfig.discordBotInternal.applicationId
      || !crypto.timingSafeEqual(session.csrfTokenHash, discordSecretHash(cookie.csrfToken))
    ) {
      return undefined;
    }
    await this.decryptToken(session);
    const [guilds, organizations] = await Promise.all([
      repository.listGuildCandidatesByInstallation(
        session.oauthSessionId,
        appConfig.discordBotInternal.applicationId
      ),
      repository.listOwnedOrganizations(session.internalUserId)
    ]);
    return Object.freeze({
      authenticated: true as const,
      csrfToken: cookie.csrfToken,
      installedGuilds: guilds.installed.map((guild) => ({
        ...guild,
        manageable: true as const,
        botInstalled: true as const
      })),
      missingBotGuilds: guilds.missing.map((guild) => ({
        ...guild,
        manageable: true as const,
        botInstalled: false as const
      })),
      organizations
    });
  }

  async connectGuild(input: {
    cookieValue?: string;
    csrfToken?: string;
    guildId: string;
    organizationId?: string;
  }): Promise<{
    guild: { id: string; name: string };
    organization: { id: string; displayName: string };
    managementSessionToken?: string;
    yoroSessionToken: string;
  }> {
    const cookie = parseCookieBinding(input.cookieValue);
    if (!cookie || !input.csrfToken || input.csrfToken !== cookie.csrfToken) {
      throw new DiscordOnboardingError("csrf_required", 403);
    }
    const repository = new DiscordOnboardingRepository(this.pool);
    const session = await repository.findAuthenticatedByCookie(discordSecretHash(cookie.binding));
    if (!session || !crypto.timingSafeEqual(session.csrfTokenHash, discordSecretHash(input.csrfToken))) {
      throw new DiscordOnboardingError("discord_session_unavailable", 401);
    }
    const discardWebManagementSession = async (): Promise<void> => {
      if (session.issuedVia !== "web_management") return;
      try {
        await repository.revokeByCookie(discordSecretHash(cookie.binding));
      } catch {
        this.logger?.error?.({
          type: "discord.oauth.discard_failed",
          correlationId: session.oauthSessionId,
          errorCode: "discord_session_unavailable"
        });
      }
    };
    if (!validSnowflake(input.guildId)) {
      await discardWebManagementSession();
      throw new DiscordOnboardingError("guild_permission_required", 403);
    }
    if (
      session.requestedDiscordGuildId
      && session.requestedDiscordGuildId !== input.guildId
    ) {
      await discardWebManagementSession();
      throw new DiscordOnboardingError("guild_binding_mismatch", 403);
    }
    if (
      session.requestedByDiscordUserId
      && session.requestedByDiscordUserId !== session.discordUserId
    ) {
      await discardWebManagementSession();
      throw new DiscordOnboardingError("discord_identity_mismatch", 403);
    }
    const token = await this.decryptToken(session);
    const verifiedGuild = (await this.fetchManageableGuilds(token.accessToken))
      .find((guild) => guild.id === input.guildId);
    if (!verifiedGuild) {
      this.logger?.event?.({
        type: "discord.guild.connection_rejected",
        errorCode: "guild_permission_required"
      });
      await discardWebManagementSession();
      throw new DiscordOnboardingError("guild_permission_required", 403);
    }

    const managementSessionToken = session.issuedVia === "web_management"
      ? discordSafeToken()
      : undefined;
    const managementCsrfToken = session.issuedVia === "web_management"
      ? discordSafeToken()
      : undefined;
    const now = Date.now();
    const managementSession = managementSessionToken && managementCsrfToken
      ? {
          id: crypto.randomUUID(),
          sessionTokenHash: discordSecretHash(managementSessionToken),
          csrfTokenHash: discordSecretHash(managementCsrfToken),
          idleExpiresAt: new Date(
            now + appConfig.discordBotManagement.idleTtlSeconds * 1_000
          ),
          absoluteExpiresAt: new Date(
            now + appConfig.discordBotManagement.absoluteTtlSeconds * 1_000
          )
        }
      : undefined;
    const yoroSessionToken = discordSafeToken();
    const yoroCsrfToken = discordSafeToken();
    const yoroSession = {
      id: crypto.randomUUID(),
      userId: session.internalUserId,
      sessionTokenHash: discordSecretHash(yoroSessionToken),
      csrfTokenHash: discordSecretHash(yoroCsrfToken),
      authenticationProvider: "discord" as const,
      idleExpiresAt: new Date(
        now + appConfig.discordBotManagement.idleTtlSeconds * 1_000
      ),
      absoluteExpiresAt: new Date(
        now + appConfig.discordBotManagement.absoluteTtlSeconds * 1_000
      )
    };
    let result: {
      guild: { id: string; name: string };
      organization: { id: string; displayName: string };
    };
    try {
      result = await withTransaction(this.pool, async (client) => {
        const transactional = new DiscordOnboardingRepository(client);
      const lockedSetup = await transactional.lockSetupForConnection(
        session.setupSessionId,
        session.discordIdentityId
      );
      if (lockedSetup?.status === "completed") {
        throw new DiscordOnboardingError("setup_session_consumed", 409);
      }
      if (
        !lockedSetup
        || (lockedSetup.status !== "authenticated" && lockedSetup.status !== "guild_selected")
        || lockedSetup.issuedVia !== session.issuedVia
      ) {
        throw new DiscordOnboardingError("setup_session_expired", 409);
      }
      if (lockedSetup.requestedApplicationId) {
        try {
          await transactional.requireObservedBotInstallation({
            guildId: verifiedGuild.id,
            applicationId: lockedSetup.requestedApplicationId
          });
        } catch {
          throw new DiscordOnboardingError("bot_installation_required", 409);
        }
      }
      const connectedOrganization = await transactional.connectedGuildOrganization(verifiedGuild.id);
      if (connectedOrganization) {
        if (input.organizationId && connectedOrganization !== input.organizationId) {
          throw new DiscordOnboardingError("guild_already_connected", 409);
        }
        const membership = await transactional.organizationMembership(
          session.internalUserId,
          connectedOrganization
        );
        if (!membership) {
          throw new DiscordOnboardingError("guild_already_connected", 409);
        }
        await transactional.completeExistingGuild({
          setupSessionId: session.setupSessionId,
          oauthSessionId: session.oauthSessionId,
          organizationId: connectedOrganization,
          discordGuildId: verifiedGuild.id,
          installationId: crypto.randomUUID(),
          ...(lockedSetup.requestedApplicationId
            ? { applicationId: lockedSetup.requestedApplicationId }
            : {}),
          ...(managementSession
            ? { userId: session.internalUserId, managementSession }
            : {})
        });
        await new YoroAccountRepository(client).createSession(yoroSession);
        return {
          guild: { id: verifiedGuild.id, name: verifiedGuild.name },
          organization: {
            id: connectedOrganization,
            displayName: membership.displayName
          }
        };
      }
      let organizationId = input.organizationId;
      let organizationDisplayName = verifiedGuild.name;
      if (organizationId) {
        if (!await transactional.ownedOrganizationExists(session.internalUserId, organizationId)) {
          throw new DiscordOnboardingError("organization_permission_required", 403);
        }
        const organizations = await transactional.listOwnedOrganizations(session.internalUserId);
        const selected = organizations.find((organization) => organization.id === organizationId);
        if (!selected) throw new DiscordOnboardingError("organization_permission_required", 403);
        organizationDisplayName = selected.displayName;
      } else {
        organizationId = crypto.randomUUID();
        await transactional.createOrganizationForGuild({
          organizationId,
          userId: session.internalUserId,
          displayName: verifiedGuild.name
        });
      }
      if (input.organizationId) {
        try {
          await transactional.requireDiscordGuildCapacity(organizationId);
        } catch (error) {
          if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
            throw new DiscordOnboardingError("entitlement_exceeded", 409);
          }
          throw error;
        }
      }
      await transactional.connectGuild({
        guildRecordId: crypto.randomUUID(),
        organizationId,
        discordGuildId: verifiedGuild.id,
        displayName: verifiedGuild.name,
        setupSessionId: session.setupSessionId,
        oauthSessionId: session.oauthSessionId,
        actorUserId: session.internalUserId,
        auditId: crypto.randomUUID(),
        targetHash: discordSecretHash(verifiedGuild.id),
        ...(session.requestedApplicationId ? {
          installationId: crypto.randomUUID(),
          applicationId: session.requestedApplicationId
        } : {}),
        ...(managementSession ? { managementSession } : {})
      });
        await new YoroAccountRepository(client).createSession(yoroSession);
        return {
          guild: { id: verifiedGuild.id, name: verifiedGuild.name },
          organization: { id: organizationId, displayName: organizationDisplayName }
        };
      });
    } catch (error) {
      await discardWebManagementSession();
      throw error;
    }
    this.logger?.event?.({
      type: "discord.guild.connected",
      organizationId: result.organization.id,
      guildId: result.guild.id
    });
    return {
      ...result,
      ...(managementSessionToken && managementCsrfToken
        ? { managementSessionToken: `${managementSessionToken}.${managementCsrfToken}` }
        : {}),
      yoroSessionToken: `${yoroSessionToken}.${yoroCsrfToken}`
    };
  }

  async logout(cookieValue?: string): Promise<void> {
    const cookie = parseCookieBinding(cookieValue);
    if (!cookie) return;
    await new DiscordOnboardingRepository(this.pool).revokeByCookie(
      discordSecretHash(cookie.binding)
    );
  }

  async expireSessions(): Promise<number> {
    const expired = await new DiscordOnboardingRepository(this.pool).expireSessions();
    if (expired > 0) this.logger?.event?.({ type: "discord.setup.expired", count: expired });
    return expired;
  }

  private async decryptToken(session: DiscordAuthenticatedSession): Promise<DiscordTokenRecord> {
    let plaintext: string;
    try {
      plaintext = decryptDiscordSecret(
        session.encryptedTokenRecord,
        appConfig.discordSaas.tokenEncryptionKey,
        {
          sessionId: session.oauthSessionId,
          discordUserId: session.discordUserId,
          purpose: session.issuedVia === "web_management"
            ? "oauth_token:web_management_connect"
            : "oauth_token"
        }
      );
    } catch {
      await new DiscordOnboardingRepository(this.pool).markEncryptionFailed(session.oauthSessionId);
      throw new DiscordOnboardingError("discord_session_unavailable", 503);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      throw new DiscordOnboardingError("discord_session_unavailable", 503);
    }
    const record = parsed as Partial<DiscordTokenRecord>;
    if (
      typeof record.accessToken !== "string"
      || record.tokenType !== "Bearer"
      || record.scope !== "identify guilds"
      || typeof record.expiresAt !== "string"
      || Date.parse(record.expiresAt) <= Date.now()
    ) {
      throw new DiscordOnboardingError("discord_session_unavailable", 401);
    }
    return record as DiscordTokenRecord;
  }

  private async exchangeCode(code: string, verifier: string): Promise<DiscordTokenRecord> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: appConfig.discordSaas.redirectUri,
      client_id: appConfig.discordSaas.clientId,
      client_secret: appConfig.discordSaas.clientSecret,
      code_verifier: verifier
    });
    const response = await this.fetchImpl(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs)
    });
    if (!response.ok) throw new DiscordOnboardingError("discord_oauth_failed", 503);
    const token = await response.json() as DiscordTokenResponse;
    const scopes = typeof token.scope === "string"
      ? token.scope.split(/\s+/u).filter(Boolean).sort().join(" ")
      : "";
    if (
      typeof token.access_token !== "string"
      || token.access_token.length < 16
      || token.token_type !== "Bearer"
      || !Number.isFinite(token.expires_in)
      || Number(token.expires_in) <= 0
      || scopes !== "guilds identify"
    ) {
      throw new DiscordOnboardingError("discord_response_invalid", 503);
    }
    return {
      accessToken: token.access_token,
      tokenType: "Bearer",
      expiresAt: new Date(Date.now() + Number(token.expires_in) * 1_000).toISOString(),
      scope: "identify guilds"
    };
  }

  private async fetchProfile(accessToken: string): Promise<{
    id: string;
    displayName: string;
    avatarReference?: string;
  }> {
    const response = await this.discordGet("/users/@me", accessToken);
    const profile = await response.json() as DiscordProfileResponse;
    if (!validSnowflake(profile.id)) {
      throw new DiscordOnboardingError("discord_response_invalid", 503);
    }
    const avatar = avatarReference(profile.avatar);
    return {
      id: profile.id,
      displayName: safeName(profile.global_name ?? profile.username, `Discord ${profile.id}`, 80),
      ...(avatar ? { avatarReference: avatar } : {})
    };
  }

  private async fetchManageableGuilds(accessToken: string): Promise<DiscordManageableGuild[]> {
    const response = await this.discordGet("/users/@me/guilds", accessToken);
    const raw = await response.json() as unknown;
    if (!Array.isArray(raw) || raw.length > 500) {
      throw new DiscordOnboardingError("discord_response_invalid", 503);
    }
    return raw
      .map((value) => parseDiscordManageableGuild(value as DiscordGuildResponse))
      .filter((value): value is DiscordManageableGuild => Boolean(value))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }

  private async discordGet(pathname: string, accessToken: string): Promise<Response> {
    const response = await this.fetchImpl(`${DISCORD_API_BASE}${pathname}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(appConfig.discordSaas.apiTimeoutMs)
    });
    if (!response.ok) throw new DiscordOnboardingError("discord_oauth_failed", 503);
    return response;
  }
}
