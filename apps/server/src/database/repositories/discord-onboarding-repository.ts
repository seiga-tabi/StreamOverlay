import type { RepositoryQueryable } from "./types.js";
import { repositoryQuery, requireBoundedText } from "./types.js";
import { SafeDatabaseError } from "../errors.js";
import { requireUuid } from "../tenant-context.js";

export type DiscordSetupStatus =
  | "issued"
  | "authenticated"
  | "guild_selected"
  | "completed"
  | "expired"
  | "revoked";

export type DiscordOAuthStatus =
  | "pending"
  | "authenticated"
  | "consumed"
  | "expired"
  | "revoked"
  | "encryption_failed";

export type DiscordSetupIssuedVia =
  | "bot_command"
  | "operator_test"
  | "web_management";

export type DiscordOAuthSessionRecord = Readonly<{
  id: string;
  setupSessionId: string;
  discordIdentityId?: string;
  encryptedPkceVerifier: Buffer;
  encryptedTokenRecord?: Buffer;
  status: DiscordOAuthStatus;
  expiresAt: Date;
  tokenExpiresAt?: Date;
  requestedDiscordGuildId?: string;
  requestedByDiscordUserId?: string;
  requestedApplicationId?: string;
  issuedVia: DiscordSetupIssuedVia;
}>;

export type DiscordAuthenticatedSession = Readonly<{
  oauthSessionId: string;
  setupSessionId: string;
  discordIdentityId: string;
  discordUserId: string;
  internalUserId: string;
  encryptedTokenRecord: Buffer;
  expiresAt: Date;
  csrfTokenHash: Buffer;
  requestedDiscordGuildId?: string;
  requestedByDiscordUserId?: string;
  requestedApplicationId?: string;
  issuedVia: DiscordSetupIssuedVia;
}>;

export type DiscordGuildCandidateRecord = Readonly<{
  id: string;
  name: string;
  iconUrl?: string;
}>;

type OAuthRow = {
  id: string;
  setup_session_id: string;
  discord_identity_id: string | null;
  pkce_verifier_encrypted: Buffer;
  encrypted_token_record: Buffer | null;
  status: DiscordOAuthStatus;
  expires_at: Date;
  token_expires_at: Date | null;
  requested_discord_guild_id: string | null;
  requested_by_discord_user_id: string | null;
  requested_application_id: string | null;
  issued_via: DiscordSetupIssuedVia;
};

type AuthenticatedRow = {
  oauth_session_id: string;
  setup_session_id: string;
  discord_identity_id: string;
  discord_user_id: string;
  internal_user_id: string;
  encrypted_token_record: Buffer;
  expires_at: Date;
  csrf_token_hash: Buffer;
  requested_discord_guild_id: string | null;
  requested_by_discord_user_id: string | null;
  requested_application_id: string | null;
  issued_via: DiscordSetupIssuedVia;
};

function oauthRecord(row: OAuthRow): DiscordOAuthSessionRecord {
  return Object.freeze({
    id: row.id,
    setupSessionId: row.setup_session_id,
    ...(row.discord_identity_id ? { discordIdentityId: row.discord_identity_id } : {}),
    encryptedPkceVerifier: row.pkce_verifier_encrypted,
    ...(row.encrypted_token_record ? { encryptedTokenRecord: row.encrypted_token_record } : {}),
    status: row.status,
    expiresAt: row.expires_at,
    ...(row.token_expires_at ? { tokenExpiresAt: row.token_expires_at } : {}),
    ...(row.requested_discord_guild_id
      ? { requestedDiscordGuildId: row.requested_discord_guild_id }
      : {}),
    ...(row.requested_by_discord_user_id
      ? { requestedByDiscordUserId: row.requested_by_discord_user_id }
      : {}),
    ...(row.requested_application_id
      ? { requestedApplicationId: row.requested_application_id }
      : {}),
    issuedVia: row.issued_via
  });
}

export class DiscordOnboardingRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async issueSetupSession(input: {
    id: string;
    tokenHash: Buffer;
    expiresAt: Date;
    requestedDiscordGuildId?: string;
    requestedByDiscordUserId?: string;
    requestedApplicationId?: string;
    issuedVia: DiscordSetupIssuedVia;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_setup_sessions (
         id, token_hash, expires_at, requested_discord_guild_id,
         requested_by_discord_user_id, requested_application_id, issued_via
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        requireUuid(input.id, "setupSessionId"),
        input.tokenHash,
        input.expiresAt,
        input.requestedDiscordGuildId ?? null,
        input.requestedByDiscordUserId ?? null,
        input.requestedApplicationId ?? null,
        input.issuedVia
      ]
    );
  }

  async beginOAuthSession(input: {
    setupTokenHash: Buffer;
    oauthSessionId: string;
    stateHash: Buffer;
    cookieBindingHash: Buffer;
    csrfTokenHash: Buffer;
    encryptedPkceVerifier: Buffer;
    expiresAt: Date;
  }): Promise<{ setupSessionId: string } | undefined> {
    const setup = await repositoryQuery<{ id: string }>(
      this.queryable,
      `SELECT id
       FROM discord_setup_sessions
       WHERE token_hash = $1 AND status = 'issued' AND expires_at > NOW()
       FOR UPDATE`,
      [input.setupTokenHash]
    );
    const setupSessionId = setup.rows[0]?.id;
    if (!setupSessionId) return undefined;
    const inserted = await repositoryQuery<{ setup_session_id: string }>(
      this.queryable,
      `INSERT INTO discord_oauth_sessions (
         id, setup_session_id, state_hash, cookie_binding_hash, csrf_token_hash,
         pkce_verifier_encrypted, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (setup_session_id) DO NOTHING
       RETURNING setup_session_id`,
      [
        requireUuid(input.oauthSessionId, "oauthSessionId"),
        setupSessionId,
        input.stateHash,
        input.cookieBindingHash,
        input.csrfTokenHash,
        input.encryptedPkceVerifier,
        input.expiresAt
      ]
    );
    return inserted.rows[0] ? { setupSessionId } : undefined;
  }

  async consumeOAuthState(input: {
    stateHash: Buffer;
    cookieBindingHash: Buffer;
  }): Promise<DiscordOAuthSessionRecord | undefined> {
    const result = await repositoryQuery<OAuthRow>(
      this.queryable,
      `UPDATE discord_oauth_sessions AS oauth
       SET state_consumed_at = NOW(), updated_at = NOW()
       FROM discord_setup_sessions AS setup
       WHERE oauth.setup_session_id = setup.id
         AND oauth.state_hash = $1
         AND oauth.cookie_binding_hash = $2
         AND oauth.status = 'pending'
         AND oauth.state_consumed_at IS NULL
         AND oauth.expires_at > NOW()
       RETURNING oauth.id, oauth.setup_session_id, oauth.discord_identity_id,
         oauth.pkce_verifier_encrypted, oauth.encrypted_token_record, oauth.status,
         oauth.expires_at, oauth.token_expires_at, setup.requested_discord_guild_id,
         setup.requested_by_discord_user_id, setup.requested_application_id,
         setup.issued_via`,
      [input.stateHash, input.cookieBindingHash]
    );
    return result.rows[0] ? oauthRecord(result.rows[0]) : undefined;
  }

  async issuedViaByCookieBinding(
    cookieBindingHash: Buffer
  ): Promise<DiscordSetupIssuedVia | undefined> {
    const result = await repositoryQuery<{ issued_via: DiscordSetupIssuedVia }>(
      this.queryable,
      `SELECT setup.issued_via
       FROM discord_oauth_sessions oauth
       JOIN discord_setup_sessions setup ON setup.id = oauth.setup_session_id
       WHERE oauth.cookie_binding_hash = $1
         AND oauth.status IN ('pending', 'authenticated')
         AND oauth.expires_at > NOW()
         AND setup.expires_at > NOW()`,
      [cookieBindingHash]
    );
    return result.rows[0]?.issued_via;
  }

  async upsertDiscordIdentity(input: {
    identityId: string;
    userId: string;
    requiredUserId?: string;
    discordUserId: string;
    displayName: string;
    avatarReference?: string;
  }): Promise<{ identityId: string; userId: string }> {
    const discordUserId = input.discordUserId.trim();
    const displayName = requireBoundedText(input.displayName, "displayName", 80);
    const requiredUserId = input.requiredUserId
      ? requireUuid(input.requiredUserId, "requiredUserId")
      : undefined;
    await repositoryQuery(
      this.queryable,
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`discord:${discordUserId}`]
    );
    const existing = await repositoryQuery<{ id: string; user_id: string }>(
      this.queryable,
      `SELECT id, user_id FROM discord_identities WHERE discord_user_id = $1 FOR UPDATE`,
      [discordUserId]
    );
    const external = await repositoryQuery<{ user_id: string }>(
      this.queryable,
      `SELECT user_id
       FROM external_identities
       WHERE provider = 'discord' AND provider_subject = $1
       FOR UPDATE`,
      [discordUserId]
    );
    if (
      existing.rows[0]
      && external.rows[0]
      && existing.rows[0].user_id !== external.rows[0].user_id
    ) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }

    let userId = existing.rows[0]?.user_id ?? external.rows[0]?.user_id;
    if (!userId) {
      const account = await repositoryQuery<{ id: string }>(
        this.queryable,
        "SELECT id FROM users WHERE discord_user_id = $1 FOR UPDATE",
        [discordUserId]
      );
      userId = account.rows[0]?.id;
    }
    if (requiredUserId && userId && userId !== requiredUserId) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
    userId = requiredUserId ?? userId;
    if (!userId) {
      userId = requireUuid(input.userId, "userId");
      await repositoryQuery(
        this.queryable,
        `INSERT INTO users (id, discord_user_id) VALUES ($1, $2)`,
        [userId, discordUserId]
      );
    } else {
      const account = await repositoryQuery<{ id: string }>(
        this.queryable,
        `UPDATE users
         SET discord_user_id = COALESCE(discord_user_id, $2), updated_at = NOW()
         WHERE id = $1
           AND (discord_user_id IS NULL OR discord_user_id = $2)
         RETURNING id`,
        [requireUuid(userId, "userId"), discordUserId]
      );
      if (!account.rows[0]) throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }

    let identityId = existing.rows[0]?.id;
    if (identityId) {
      await repositoryQuery(
        this.queryable,
        `UPDATE discord_identities
         SET display_name = $2, avatar_reference = $3, updated_at = NOW()
         WHERE id = $1`,
        [identityId, displayName, input.avatarReference ?? null]
      );
    } else {
      identityId = requireUuid(input.identityId, "identityId");
      await repositoryQuery(
        this.queryable,
        `INSERT INTO discord_identities (
           id, user_id, discord_user_id, display_name, avatar_reference
         ) VALUES ($1, $2, $3, $4, $5)`,
        [identityId, userId, discordUserId, displayName, input.avatarReference ?? null]
      );
    }
    const synchronized = await repositoryQuery<{ user_id: string }>(
      this.queryable,
      `INSERT INTO external_identities (
         id, user_id, provider, provider_subject, display_name, avatar_reference
       ) VALUES (gen_random_uuid(), $1, 'discord', $2, $3, $4)
       ON CONFLICT (provider, provider_subject) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           avatar_reference = EXCLUDED.avatar_reference,
           revoked_at = NULL,
           last_authenticated_at = NOW(),
           updated_at = NOW()
       WHERE external_identities.user_id = EXCLUDED.user_id
       RETURNING user_id`,
      [userId, discordUserId, displayName, input.avatarReference ?? null]
    );
    if (synchronized.rowCount !== 1) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
    return { identityId, userId };
  }

  async authenticateOAuthSession(input: {
    oauthSessionId: string;
    setupSessionId: string;
    identityId: string;
    encryptedTokenRecord: Buffer;
    tokenExpiresAt: Date;
  }): Promise<void> {
    const oauth = await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET discord_identity_id = $2,
           encrypted_token_record = $3,
           token_expires_at = $4,
           status = 'authenticated',
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending' AND state_consumed_at IS NOT NULL`,
      [
        requireUuid(input.oauthSessionId, "oauthSessionId"),
        requireUuid(input.identityId, "identityId"),
        input.encryptedTokenRecord,
        input.tokenExpiresAt
      ]
    );
    if (oauth.rowCount !== 1) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
    const setup = await repositoryQuery(
      this.queryable,
      `UPDATE discord_setup_sessions
       SET discord_identity_id = $2, status = 'authenticated'
       WHERE id = $1 AND status = 'issued' AND expires_at > NOW()`,
      [
        requireUuid(input.setupSessionId, "setupSessionId"),
        requireUuid(input.identityId, "identityId")
      ]
    );
    if (setup.rowCount !== 1) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
  }

  async markEncryptionFailed(oauthSessionId: string): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'encryption_failed', encrypted_token_record = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'authenticated')`,
      [requireUuid(oauthSessionId, "oauthSessionId")]
    );
  }

  async replaceGuildCandidates(
    oauthSessionId: string,
    candidates: readonly DiscordGuildCandidateRecord[]
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      "DELETE FROM discord_guild_candidates WHERE oauth_session_id = $1",
      [requireUuid(oauthSessionId, "oauthSessionId")]
    );
    for (const candidate of candidates) {
      await repositoryQuery(
        this.queryable,
        `INSERT INTO discord_guild_candidates (
           oauth_session_id, discord_guild_id, display_name, icon_url, manageable
         ) VALUES ($1, $2, $3, $4, TRUE)`,
        [
          oauthSessionId,
          candidate.id,
          requireBoundedText(candidate.name, "guildName", 120),
          candidate.iconUrl ?? null
        ]
      );
    }
  }

  async findAuthenticatedByCookie(
    cookieBindingHash: Buffer
  ): Promise<DiscordAuthenticatedSession | undefined> {
    const result = await repositoryQuery<AuthenticatedRow>(
      this.queryable,
      `SELECT
         oauth.id AS oauth_session_id,
         oauth.setup_session_id,
         identity.id AS discord_identity_id,
         identity.discord_user_id,
         identity.user_id AS internal_user_id,
         oauth.encrypted_token_record,
         oauth.expires_at,
         oauth.csrf_token_hash,
         setup.requested_discord_guild_id,
         setup.requested_by_discord_user_id,
         setup.requested_application_id,
         setup.issued_via
       FROM discord_oauth_sessions oauth
       JOIN discord_identities identity ON identity.id = oauth.discord_identity_id
       JOIN discord_setup_sessions setup ON setup.id = oauth.setup_session_id
       WHERE oauth.cookie_binding_hash = $1
         AND oauth.status = 'authenticated'
         AND oauth.expires_at > NOW()
         AND setup.status IN ('authenticated', 'guild_selected')
         AND setup.expires_at > NOW()`,
      [cookieBindingHash]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          oauthSessionId: row.oauth_session_id,
          setupSessionId: row.setup_session_id,
          discordIdentityId: row.discord_identity_id,
          discordUserId: row.discord_user_id,
          internalUserId: row.internal_user_id,
          encryptedTokenRecord: row.encrypted_token_record,
          expiresAt: row.expires_at,
          csrfTokenHash: row.csrf_token_hash,
          ...(row.requested_discord_guild_id
            ? { requestedDiscordGuildId: row.requested_discord_guild_id }
            : {}),
          ...(row.requested_by_discord_user_id
            ? { requestedByDiscordUserId: row.requested_by_discord_user_id }
            : {}),
          ...(row.requested_application_id
            ? { requestedApplicationId: row.requested_application_id }
            : {}),
          issuedVia: row.issued_via
        })
      : undefined;
  }

  async revokeBoundSession(input: {
    oauthSessionId: string;
    setupSessionId: string;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'revoked',
           encrypted_token_record = NULL,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           updated_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'authenticated')`,
      [requireUuid(input.oauthSessionId, "oauthSessionId")]
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_setup_sessions
       SET status = 'revoked'
       WHERE id = $1 AND status IN ('issued', 'authenticated', 'guild_selected')`,
      [requireUuid(input.setupSessionId, "setupSessionId")]
    );
  }

  async observeBotInstallation(input: {
    applicationId: string;
    guildId: string;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `WITH observed AS (
         INSERT INTO discord_bot_installation_observations (
           discord_guild_id, application_id
         ) VALUES ($1, $2)
         ON CONFLICT (discord_guild_id, application_id) DO UPDATE
         SET status = 'observed',
             last_observed_at = NOW(),
             revoked_at = NULL
         RETURNING discord_guild_id
       )
       UPDATE discord_installations
       SET status = 'active', revoked_at = NULL
       WHERE discord_guild_id = $1
         AND application_id = $2
         AND status = 'revoked'
         AND EXISTS (SELECT 1 FROM observed)`,
      [input.guildId, input.applicationId]
    );
  }

  async revokeBotInstallation(input: {
    applicationId: string;
    guildId: string;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `WITH revoked AS (
         INSERT INTO discord_bot_installation_observations (
           discord_guild_id, application_id, status, revoked_at
         ) VALUES ($1, $2, 'revoked', NOW())
         ON CONFLICT (discord_guild_id, application_id) DO UPDATE
         SET status = 'revoked',
             revoked_at = NOW(),
             last_observed_at = NOW()
         RETURNING discord_guild_id
       )
       UPDATE discord_installations
       SET status = 'revoked', revoked_at = NOW()
       WHERE discord_guild_id = $1
         AND application_id = $2
         AND status = 'active'
         AND EXISTS (SELECT 1 FROM revoked)`,
      [input.guildId, input.applicationId]
    );
  }

  async activeBotInstallationExists(input: {
    applicationId: string;
    guildId: string;
  }): Promise<boolean> {
    const result = await repositoryQuery<{ present: boolean }>(
      this.queryable,
      `SELECT TRUE AS present
       FROM discord_bot_installation_observations
       WHERE discord_guild_id = $1
         AND application_id = $2
         AND status = 'observed'`,
      [input.guildId, input.applicationId]
    );
    return Boolean(result.rows[0]?.present);
  }

  async listGuildCandidates(oauthSessionId: string): Promise<DiscordGuildCandidateRecord[]> {
    const result = await repositoryQuery<{
      discord_guild_id: string;
      display_name: string;
      icon_url: string | null;
    }>(
      this.queryable,
      `SELECT discord_guild_id, display_name, icon_url
       FROM discord_guild_candidates
       WHERE oauth_session_id = $1 AND manageable = TRUE
       ORDER BY lower(display_name), discord_guild_id`,
      [requireUuid(oauthSessionId, "oauthSessionId")]
    );
    return result.rows.map((row) => Object.freeze({
      id: row.discord_guild_id,
      name: row.display_name,
      ...(row.icon_url ? { iconUrl: row.icon_url } : {})
    }));
  }

  async listGuildCandidatesByInstallation(
    oauthSessionId: string,
    applicationId: string
  ): Promise<{
    installed: DiscordGuildCandidateRecord[];
    missing: DiscordGuildCandidateRecord[];
  }> {
    const result = await repositoryQuery<{
      discord_guild_id: string;
      display_name: string;
      icon_url: string | null;
      installed: boolean;
    }>(
      this.queryable,
      `SELECT candidate.discord_guild_id, candidate.display_name, candidate.icon_url,
         (observation.status = 'observed') AS installed
       FROM discord_guild_candidates candidate
       LEFT JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = candidate.discord_guild_id
        AND observation.application_id = $2
       WHERE candidate.oauth_session_id = $1
         AND candidate.manageable = TRUE
       ORDER BY lower(candidate.display_name), candidate.discord_guild_id`,
      [requireUuid(oauthSessionId, "oauthSessionId"), applicationId]
    );
    const records = result.rows.map((row) => Object.freeze({
      id: row.discord_guild_id,
      name: row.display_name,
      ...(row.icon_url ? { iconUrl: row.icon_url } : {})
    }));
    return {
      installed: records.filter((_record, index) => result.rows[index]?.installed === true),
      missing: records.filter((_record, index) => result.rows[index]?.installed !== true)
    };
  }

  async listOwnedOrganizations(userId: string): Promise<Array<{ id: string; displayName: string }>> {
    const result = await repositoryQuery<{ id: string; display_name: string }>(
      this.queryable,
      `SELECT organization.id, organization.display_name
       FROM organization_members member
       JOIN organizations organization ON organization.id = member.organization_id
       WHERE member.user_id = $1
         AND member.role = 'owner'
         AND organization.status = 'active'
         AND organization.deleted_at IS NULL
       ORDER BY lower(organization.display_name), organization.id
       LIMIT 100`,
      [requireUuid(userId, "userId")]
    );
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name }));
  }

  async ownedOrganizationExists(userId: string, organizationId: string): Promise<boolean> {
    const result = await repositoryQuery<{ allowed: boolean }>(
      this.queryable,
      `SELECT TRUE AS allowed
       FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND role = 'owner'`,
      [requireUuid(organizationId, "organizationId"), requireUuid(userId, "userId")]
    );
    return Boolean(result.rows[0]?.allowed);
  }

  async organizationMembership(
    userId: string,
    organizationId: string
  ): Promise<{ displayName: string; role: "owner" | "manager" | "viewer" } | undefined> {
    const result = await repositoryQuery<{
      display_name: string;
      role: "owner" | "manager" | "viewer";
    }>(
      this.queryable,
      `SELECT organization.display_name, member.role
       FROM organization_members member
       JOIN organizations organization ON organization.id = member.organization_id
       WHERE member.organization_id = $1
         AND member.user_id = $2
         AND organization.status = 'active'
         AND organization.deleted_at IS NULL`,
      [requireUuid(organizationId, "organizationId"), requireUuid(userId, "userId")]
    );
    const row = result.rows[0];
    return row ? { displayName: row.display_name, role: row.role } : undefined;
  }

  async lockSetupForConnection(
    setupSessionId: string,
    identityId: string
  ): Promise<{
    status: DiscordSetupStatus;
    issuedVia: DiscordSetupIssuedVia;
    requestedApplicationId?: string;
  } | undefined> {
    const result = await repositoryQuery<{
      status: DiscordSetupStatus;
      issued_via: DiscordSetupIssuedVia;
      requested_application_id: string | null;
    }>(
      this.queryable,
      `SELECT status, issued_via, requested_application_id
       FROM discord_setup_sessions
       WHERE id = $1
         AND discord_identity_id = $2
         AND expires_at > NOW()
       FOR UPDATE`,
      [
        requireUuid(setupSessionId, "setupSessionId"),
        requireUuid(identityId, "identityId")
      ]
    );
    const row = result.rows[0];
    return row ? {
      status: row.status,
      issuedVia: row.issued_via,
      ...(row.requested_application_id
        ? { requestedApplicationId: row.requested_application_id }
        : {})
    } : undefined;
  }

  async requireObservedBotInstallation(input: {
    guildId: string;
    applicationId: string;
  }): Promise<void> {
    const result = await repositoryQuery<{ present: boolean }>(
      this.queryable,
      `SELECT TRUE AS present
       FROM discord_bot_installation_observations
       WHERE discord_guild_id = $1
         AND application_id = $2
         AND status = 'observed'
       FOR UPDATE`,
      [input.guildId, input.applicationId]
    );
    if (!result.rows[0]?.present) {
      throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    }
  }

  async requireDiscordGuildCapacity(organizationId: string): Promise<void> {
    const entitlement = await repositoryQuery<{ max_discord_guilds: number }>(
      this.queryable,
      `SELECT max_discord_guilds
       FROM entitlements
       WHERE organization_id = $1
       FOR UPDATE`,
      [requireUuid(organizationId, "organizationId")]
    );
    const maximum = entitlement.rows[0]?.max_discord_guilds;
    if (maximum === undefined) {
      throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    }
    const count = await repositoryQuery<{ count: string }>(
      this.queryable,
      `SELECT COUNT(*)::TEXT AS count
       FROM discord_guilds
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    );
    if (Number(count.rows[0]?.count ?? maximum) >= maximum) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
  }

  async connectedGuildOrganization(discordGuildId: string): Promise<string | undefined> {
    const result = await repositoryQuery<{ organization_id: string }>(
      this.queryable,
      "SELECT organization_id FROM discord_guilds WHERE discord_guild_id = $1 FOR UPDATE",
      [discordGuildId]
    );
    return result.rows[0]?.organization_id;
  }

  async createOrganizationForGuild(input: {
    organizationId: string;
    userId: string;
    displayName: string;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      "INSERT INTO organizations (id, display_name) VALUES ($1, $2)",
      [
        requireUuid(input.organizationId, "organizationId"),
        requireBoundedText(input.displayName, "organizationName", 120)
      ]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [
        requireUuid(input.organizationId, "organizationId"),
        requireUuid(input.userId, "userId")
      ]
    );
    await repositoryQuery(
      this.queryable,
      "INSERT INTO entitlements (organization_id) VALUES ($1)",
      [input.organizationId]
    );
  }

  async connectGuild(input: {
    guildRecordId: string;
    organizationId: string;
    discordGuildId: string;
    displayName: string;
    setupSessionId: string;
    oauthSessionId: string;
    actorUserId: string;
    auditId: string;
    targetHash: Buffer;
    installationId?: string;
    applicationId?: string;
    managementSession?: {
      id: string;
      sessionTokenHash: Buffer;
      csrfTokenHash: Buffer;
      idleExpiresAt: Date;
      absoluteExpiresAt: Date;
    };
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_guilds (
         id, organization_id, discord_guild_id, display_name
       ) VALUES ($1, $2, $3, $4)`,
      [
        requireUuid(input.guildRecordId, "guildRecordId"),
        requireUuid(input.organizationId, "organizationId"),
        input.discordGuildId,
        requireBoundedText(input.displayName, "guildName", 120)
      ]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO audit_logs (
         id, organization_id, actor_user_id, action, target_type,
         target_reference_hash, safe_metadata
       ) VALUES ($1, $2, $3, 'discord.guild.connected', 'discord_guild', $4, '{}'::JSONB)`,
      [
        requireUuid(input.auditId, "auditId"),
        input.organizationId,
        requireUuid(input.actorUserId, "actorUserId"),
        input.targetHash
      ]
    );
    if (input.installationId && input.applicationId) {
      await repositoryQuery(
        this.queryable,
        `INSERT INTO discord_installations (
           id, organization_id, discord_guild_id, application_id,
           installed_by_user_id, status
         ) VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (organization_id, discord_guild_id, application_id) DO UPDATE
         SET status = 'active', revoked_at = NULL`,
        [
          requireUuid(input.installationId, "installationId"),
          input.organizationId,
          input.discordGuildId,
          input.applicationId,
          input.actorUserId
        ]
      );
    }
    if (input.managementSession) {
      await this.createManagementSession({
        ...input.managementSession,
        userId: input.actorUserId
      });
    }
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_setup_sessions
       SET organization_id = $2, status = 'completed', consumed_at = NOW()
       WHERE id = $1 AND status IN ('authenticated', 'guild_selected')`,
      [requireUuid(input.setupSessionId, "setupSessionId"), input.organizationId]
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'consumed',
           encrypted_token_record = NULL,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'authenticated'`,
      [requireUuid(input.oauthSessionId, "oauthSessionId")]
    );
  }

  async completeExistingGuild(input: {
    setupSessionId: string;
    oauthSessionId: string;
    organizationId: string;
    userId?: string;
    discordGuildId?: string;
    installationId?: string;
    applicationId?: string;
    managementSession?: {
      id: string;
      sessionTokenHash: Buffer;
      csrfTokenHash: Buffer;
      idleExpiresAt: Date;
      absoluteExpiresAt: Date;
    };
  }): Promise<void> {
    if (
      input.installationId
      && input.applicationId
      && input.userId
      && input.discordGuildId
    ) {
      await repositoryQuery(
        this.queryable,
        `INSERT INTO discord_installations (
           id, organization_id, discord_guild_id, application_id,
           installed_by_user_id, status
         ) VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (organization_id, discord_guild_id, application_id) DO UPDATE
         SET status = 'active', revoked_at = NULL`,
        [
          requireUuid(input.installationId, "installationId"),
          requireUuid(input.organizationId, "organizationId"),
          input.discordGuildId,
          input.applicationId,
          requireUuid(input.userId, "userId")
        ]
      );
    }
    if (input.managementSession && input.userId) {
      await this.createManagementSession({
        ...input.managementSession,
        userId: input.userId
      });
    }
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_setup_sessions
       SET organization_id = $2, status = 'completed', consumed_at = NOW()
       WHERE id = $1 AND status IN ('authenticated', 'guild_selected')`,
      [requireUuid(input.setupSessionId, "setupSessionId"), input.organizationId]
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'consumed',
           encrypted_token_record = NULL,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'authenticated'`,
      [requireUuid(input.oauthSessionId, "oauthSessionId")]
    );
  }

  private async createManagementSession(input: {
    id: string;
    userId: string;
    sessionTokenHash: Buffer;
    csrfTokenHash: Buffer;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_management_sessions (
         id, user_id, session_token_hash, csrf_token_hash,
         idle_expires_at, absolute_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        requireUuid(input.id, "managementSessionId"),
        requireUuid(input.userId, "userId"),
        input.sessionTokenHash,
        input.csrfTokenHash,
        input.idleExpiresAt,
        input.absoluteExpiresAt
      ]
    );
  }

  async revokeByCookie(cookieBindingHash: Buffer): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'revoked',
           encrypted_token_record = NULL,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           updated_at = NOW()
       WHERE cookie_binding_hash = $1
         AND status IN ('pending', 'authenticated', 'encryption_failed')`,
      [cookieBindingHash]
    );
  }

  async expireSessions(): Promise<number> {
    const oauth = await repositoryQuery(
      this.queryable,
      `UPDATE discord_oauth_sessions
       SET status = 'expired',
           encrypted_token_record = NULL,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           updated_at = NOW()
       WHERE expires_at <= NOW() AND status IN ('pending', 'authenticated', 'encryption_failed')`,
      []
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_setup_sessions
       SET status = 'expired'
       WHERE expires_at <= NOW() AND status IN ('issued', 'authenticated', 'guild_selected')`,
      []
    );
    return oauth.rowCount ?? 0;
  }
}
