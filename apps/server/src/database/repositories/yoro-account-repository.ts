import crypto from "node:crypto";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, requireBoundedText, type RepositoryQueryable } from "./types.js";

export type YoroIdentityProvider = "discord" | "twitch";
export type YoroOAuthPurpose = "login" | "link_identity";

export type YoroOAuthSessionRow = {
  id: string;
  provider: YoroIdentityProvider;
  purpose: YoroOAuthPurpose;
  target_user_id: string | null;
  pkce_verifier_encrypted: Buffer | null;
  return_path: string;
};

export type YoroSessionRow = {
  id: string;
  user_id: string;
  csrf_token_hash: Buffer;
  authentication_provider: YoroIdentityProvider;
  authenticated_at: Date;
};

export type YoroTwitchCredentialRow = {
  user_id: string;
  encrypted_token_record: Buffer;
  token_expires_at: Date;
};

export type YoroExternalIdentity = Readonly<{
  provider: YoroIdentityProvider;
  providerSubject: string;
  displayName: string;
  avatarReference?: string;
  connectedAt: string;
  lastAuthenticatedAt: string;
}>;

export type YoroDashboardPage =
  | "overview"
  | "account"
  | "organizations"
  | "settings";

export type YoroUserPreferences = Readonly<{
  locale: "ko" | "ja";
  defaultDashboardPage: YoroDashboardPage;
  reducedMotion: boolean;
}>;

type ExternalIdentityRow = {
  user_id: string;
  provider: YoroIdentityProvider;
  provider_subject: string;
  display_name: string;
  avatar_reference: string | null;
  connected_at: Date;
  last_authenticated_at: Date;
};

export class YoroAccountRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async createOAuthSession(input: {
    id: string;
    provider: YoroIdentityProvider;
    purpose: YoroOAuthPurpose;
    targetUserId?: string;
    stateHash: Buffer;
    cookieBindingHash: Buffer;
    encryptedPkceVerifier?: Buffer;
    returnPath: string;
    expiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO yoro_oauth_sessions (
         id, provider, purpose, target_user_id, state_hash,
         cookie_binding_hash, pkce_verifier_encrypted, return_path, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        requireUuid(input.id, "oauthSessionId"),
        input.provider,
        input.purpose,
        input.targetUserId ? requireUuid(input.targetUserId, "targetUserId") : null,
        input.stateHash,
        input.cookieBindingHash,
        input.encryptedPkceVerifier ?? null,
        requireBoundedText(input.returnPath, "returnPath", 256),
        input.expiresAt
      ]
    );
  }

  async consumeOAuthSession(input: {
    provider: YoroIdentityProvider;
    stateHash: Buffer;
    cookieBindingHash: Buffer;
  }): Promise<YoroOAuthSessionRow | undefined> {
    const result = await repositoryQuery<YoroOAuthSessionRow>(
      this.queryable,
      `UPDATE yoro_oauth_sessions
       SET status = 'consumed', consumed_at = NOW(), updated_at = NOW()
       WHERE provider = $1
         AND state_hash = $2
         AND cookie_binding_hash = $3
         AND status = 'pending'
         AND expires_at > NOW()
       RETURNING id, provider, purpose, target_user_id,
         pkce_verifier_encrypted, return_path`,
      [input.provider, input.stateHash, input.cookieBindingHash]
    );
    return result.rows[0];
  }

  async failOAuthSession(id: string): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_oauth_sessions
       SET status = 'security_failed',
           pkce_verifier_encrypted = NULL,
           consumed_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [requireUuid(id, "oauthSessionId")]
    );
  }

  async clearOAuthVerifier(id: string): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_oauth_sessions
       SET pkce_verifier_encrypted = NULL, updated_at = NOW()
       WHERE id = $1`,
      [requireUuid(id, "oauthSessionId")]
    );
  }

  async resolveUserForLogin(input: {
    provider: YoroIdentityProvider;
    providerSubject: string;
    displayName: string;
    avatarReference?: string;
  }): Promise<string> {
    await this.lockIdentity(input.provider, input.providerSubject);
    const existing = await repositoryQuery<{ user_id: string }>(
      this.queryable,
      `SELECT user_id
       FROM external_identities
       WHERE provider = $1 AND provider_subject = $2 AND revoked_at IS NULL
       FOR UPDATE`,
      [input.provider, input.providerSubject]
    );
    if (existing.rows[0]) {
      await this.updateIdentity(existing.rows[0].user_id, input);
      return existing.rows[0].user_id;
    }

    const revoked = await repositoryQuery<{ user_id: string }>(
      this.queryable,
      `SELECT user_id
       FROM external_identities
       WHERE provider = $1 AND provider_subject = $2
       FOR UPDATE`,
      [input.provider, input.providerSubject]
    );
    if (revoked.rows[0]) {
      await repositoryQuery(
        this.queryable,
        `UPDATE external_identities
         SET revoked_at = NULL,
             display_name = $3,
             avatar_reference = $4,
             last_authenticated_at = NOW(),
             updated_at = NOW()
         WHERE provider = $1 AND provider_subject = $2`,
        [
          input.provider,
          input.providerSubject,
          requireBoundedText(input.displayName, "displayName", 80),
          input.avatarReference ?? null
        ]
      );
      return revoked.rows[0].user_id;
    }

    const legacyAccount = await repositoryQuery<{ id: string }>(
      this.queryable,
      input.provider === "discord"
        ? "SELECT id FROM users WHERE discord_user_id = $1 FOR UPDATE"
        : "SELECT id FROM users WHERE twitch_user_id = $1 FOR UPDATE",
      [input.providerSubject]
    );
    if (legacyAccount.rows[0]) {
      await repositoryQuery(
        this.queryable,
        `INSERT INTO external_identities (
           id, user_id, provider, provider_subject, display_name, avatar_reference
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          legacyAccount.rows[0].id,
          input.provider,
          input.providerSubject,
          requireBoundedText(input.displayName, "displayName", 80),
          input.avatarReference ?? null
        ]
      );
      return legacyAccount.rows[0].id;
    }

    const userId = crypto.randomUUID();
    await repositoryQuery(
      this.queryable,
      `INSERT INTO users (id, discord_user_id, twitch_user_id)
       VALUES ($1, $2, $3)`,
      [
        userId,
        input.provider === "discord" ? input.providerSubject : null,
        input.provider === "twitch" ? input.providerSubject : null
      ]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO external_identities (
         id, user_id, provider, provider_subject, display_name, avatar_reference
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        userId,
        input.provider,
        input.providerSubject,
        requireBoundedText(input.displayName, "displayName", 80),
        input.avatarReference ?? null
      ]
    );
    return userId;
  }

  async linkIdentity(input: {
    userId: string;
    provider: YoroIdentityProvider;
    providerSubject: string;
    displayName: string;
    avatarReference?: string;
  }): Promise<"linked" | "already_linked" | "conflict"> {
    const userId = requireUuid(input.userId, "userId");
    await this.lockIdentity(input.provider, input.providerSubject);
    const targetProvider = await repositoryQuery<{ provider_subject: string }>(
      this.queryable,
      `SELECT provider_subject
       FROM external_identities
       WHERE user_id = $1 AND provider = $2 AND revoked_at IS NULL
       FOR UPDATE`,
      [userId, input.provider]
    );
    if (
      targetProvider.rows[0]
      && targetProvider.rows[0].provider_subject !== input.providerSubject
    ) return "conflict";
    const existing = await repositoryQuery<{ user_id: string; revoked_at: Date | null }>(
      this.queryable,
      `SELECT user_id, revoked_at
       FROM external_identities
       WHERE provider = $1 AND provider_subject = $2
       FOR UPDATE`,
      [input.provider, input.providerSubject]
    );
    if (existing.rows[0]?.user_id && existing.rows[0].user_id !== userId) return "conflict";
    if (existing.rows[0]) {
      await repositoryQuery(
        this.queryable,
        `UPDATE external_identities
         SET revoked_at = NULL,
             display_name = $3,
             avatar_reference = $4,
             last_authenticated_at = NOW(),
             updated_at = NOW()
         WHERE provider = $1 AND provider_subject = $2 AND user_id = $5`,
        [
          input.provider,
          input.providerSubject,
          requireBoundedText(input.displayName, "displayName", 80),
          input.avatarReference ?? null,
          userId
        ]
      );
      await this.setLegacyProviderId(userId, input.provider, input.providerSubject);
      return existing.rows[0].revoked_at ? "linked" : "already_linked";
    }
    await repositoryQuery(
      this.queryable,
      `INSERT INTO external_identities (
         id, user_id, provider, provider_subject, display_name, avatar_reference
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        userId,
        input.provider,
        input.providerSubject,
        requireBoundedText(input.displayName, "displayName", 80),
        input.avatarReference ?? null
      ]
    );
    await this.setLegacyProviderId(userId, input.provider, input.providerSubject);
    return "linked";
  }

  async createSession(input: {
    id: string;
    userId: string;
    sessionTokenHash: Buffer;
    csrfTokenHash: Buffer;
    authenticationProvider: YoroIdentityProvider;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO yoro_sessions (
         id, user_id, session_token_hash, csrf_token_hash,
         authentication_provider, idle_expires_at, absolute_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        requireUuid(input.id, "sessionId"),
        requireUuid(input.userId, "userId"),
        input.sessionTokenHash,
        input.csrfTokenHash,
        input.authenticationProvider,
        input.idleExpiresAt,
        input.absoluteExpiresAt
      ]
    );
  }

  async findActiveSession(
    sessionTokenHash: Buffer,
    nextIdleExpiry: Date
  ): Promise<YoroSessionRow | undefined> {
    const result = await repositoryQuery<YoroSessionRow>(
      this.queryable,
      `UPDATE yoro_sessions session
       SET last_seen_at = NOW(),
           idle_expires_at = LEAST($2, absolute_expires_at)
       FROM users account
       WHERE session.user_id = account.id
         AND session.session_token_hash = $1
         AND session.status = 'active'
         AND session.idle_expires_at > NOW()
         AND session.absolute_expires_at > NOW()
         AND account.status = 'active'
       RETURNING session.id, session.user_id, session.csrf_token_hash,
         session.authentication_provider, session.authenticated_at`,
      [sessionTokenHash, nextIdleExpiry]
    );
    return result.rows[0];
  }

  async listIdentities(userId: string): Promise<readonly YoroExternalIdentity[]> {
    const result = await repositoryQuery<ExternalIdentityRow>(
      this.queryable,
      `SELECT user_id, provider, provider_subject, display_name,
         avatar_reference, connected_at, last_authenticated_at
       FROM external_identities
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY provider ASC`,
      [requireUuid(userId, "userId")]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      provider: row.provider,
      providerSubject: row.provider_subject,
      displayName: row.display_name,
      ...(row.avatar_reference ? { avatarReference: row.avatar_reference } : {}),
      connectedAt: row.connected_at.toISOString(),
      lastAuthenticatedAt: row.last_authenticated_at.toISOString()
    })));
  }

  async upsertTwitchCredential(input: {
    userId: string;
    encryptedTokenRecord: Buffer;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO yoro_twitch_viewer_credentials (
         user_id, encrypted_token_record, token_expires_at
       ) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET encrypted_token_record = EXCLUDED.encrypted_token_record,
           token_expires_at = EXCLUDED.token_expires_at,
           status = 'active',
           revoked_at = NULL,
           updated_at = NOW()`,
      [
        requireUuid(input.userId, "userId"),
        input.encryptedTokenRecord,
        input.tokenExpiresAt
      ]
    );
  }

  async lockTwitchCredential(
    userId: string
  ): Promise<YoroTwitchCredentialRow | undefined> {
    const result = await repositoryQuery<YoroTwitchCredentialRow>(
      this.queryable,
      `SELECT user_id, encrypted_token_record, token_expires_at
       FROM yoro_twitch_viewer_credentials
       WHERE user_id = $1 AND status = 'active'
       FOR UPDATE`,
      [requireUuid(userId, "userId")]
    );
    return result.rows[0];
  }

  async revokeTwitchCredential(
    userId: string,
    status: "revoked" | "security_failed" = "revoked"
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_twitch_viewer_credentials
       SET encrypted_token_record = NULL,
           status = $2,
           revoked_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [requireUuid(userId, "userId"), status]
    );
  }

  async getUserPreferences(userId: string): Promise<YoroUserPreferences> {
    const result = await repositoryQuery<{
      locale: "ko" | "ja";
      default_dashboard_page: YoroDashboardPage;
      reduced_motion: boolean;
    }>(
      this.queryable,
      `SELECT locale, default_dashboard_page, reduced_motion
       FROM yoro_user_preferences
       WHERE user_id = $1`,
      [requireUuid(userId, "userId")]
    );
    const row = result.rows[0];
    return Object.freeze(row
      ? {
          locale: row.locale,
          defaultDashboardPage: row.default_dashboard_page,
          reducedMotion: row.reduced_motion
        }
      : {
          locale: "ko",
          defaultDashboardPage: "overview",
          reducedMotion: false
        });
  }

  async saveUserPreferences(
    userId: string,
    preferences: YoroUserPreferences
  ): Promise<YoroUserPreferences> {
    const result = await repositoryQuery<{
      locale: "ko" | "ja";
      default_dashboard_page: YoroDashboardPage;
      reduced_motion: boolean;
    }>(
      this.queryable,
      `INSERT INTO yoro_user_preferences (
         user_id, locale, default_dashboard_page, reduced_motion
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET locale = EXCLUDED.locale,
           default_dashboard_page = EXCLUDED.default_dashboard_page,
           reduced_motion = EXCLUDED.reduced_motion,
           updated_at = NOW()
       RETURNING locale, default_dashboard_page, reduced_motion`,
      [
        requireUuid(userId, "userId"),
        preferences.locale,
        preferences.defaultDashboardPage,
        preferences.reducedMotion
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error("yoro_preferences_save_failed");
    return Object.freeze({
      locale: row.locale,
      defaultDashboardPage: row.default_dashboard_page,
      reducedMotion: row.reduced_motion
    });
  }

  async revokeIdentity(userId: string, provider: YoroIdentityProvider): Promise<boolean> {
    const id = requireUuid(userId, "userId");
    const identities = await repositoryQuery<{ provider: YoroIdentityProvider }>(
      this.queryable,
      `SELECT provider
       FROM external_identities
       WHERE user_id = $1 AND revoked_at IS NULL
       FOR UPDATE`,
      [id]
    );
    if (identities.rows.length <= 1) return false;
    const result = await repositoryQuery(
      this.queryable,
      `UPDATE external_identities
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND provider = $2 AND revoked_at IS NULL`,
      [id, provider]
    );
    if ((result.rowCount ?? 0) > 0) {
      await repositoryQuery(
        this.queryable,
        provider === "discord"
          ? "UPDATE users SET discord_user_id = NULL, updated_at = NOW() WHERE id = $1"
          : "UPDATE users SET twitch_user_id = NULL, updated_at = NOW() WHERE id = $1",
        [id]
      );
    }
    return (result.rowCount ?? 0) > 0;
  }

  async revokeSession(sessionTokenHash: Buffer): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_sessions
       SET status = 'revoked', revoked_at = NOW()
       WHERE session_token_hash = $1 AND status = 'active'`,
      [sessionTokenHash]
    );
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_sessions
       SET status = 'revoked', revoked_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [requireUuid(userId, "userId")]
    );
  }

  async expireSessions(): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_oauth_sessions
       SET status = 'expired', pkce_verifier_encrypted = NULL, updated_at = NOW()
       WHERE status = 'pending' AND expires_at <= NOW()`,
      []
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE yoro_sessions
       SET status = 'expired'
       WHERE status = 'active'
         AND (idle_expires_at <= NOW() OR absolute_expires_at <= NOW())`,
      []
    );
  }

  private async updateIdentity(
    userId: string,
    input: {
      provider: YoroIdentityProvider;
      providerSubject: string;
      displayName: string;
      avatarReference?: string;
    }
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE external_identities
       SET display_name = $3,
           avatar_reference = $4,
           last_authenticated_at = NOW(),
           updated_at = NOW()
       WHERE provider = $1 AND provider_subject = $2 AND user_id = $5`,
      [
        input.provider,
        input.providerSubject,
        requireBoundedText(input.displayName, "displayName", 80),
        input.avatarReference ?? null,
        requireUuid(userId, "userId")
      ]
    );
  }

  private async setLegacyProviderId(
    userId: string,
    provider: YoroIdentityProvider,
    providerSubject: string
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      provider === "discord"
        ? `UPDATE users
           SET discord_user_id = COALESCE(discord_user_id, $2), updated_at = NOW()
           WHERE id = $1`
        : `UPDATE users
           SET twitch_user_id = COALESCE(twitch_user_id, $2), updated_at = NOW()
           WHERE id = $1`,
      [requireUuid(userId, "userId"), providerSubject]
    );
  }

  private async lockIdentity(
    provider: YoroIdentityProvider,
    providerSubject: string
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${provider}:${providerSubject}`]
    );
  }
}
