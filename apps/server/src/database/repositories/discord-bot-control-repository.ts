import crypto from "node:crypto";
import {
  DEFAULT_DISCORD_BOT_CONTROL_SETTINGS,
  DISCORD_BOT_CONTROL_MODULE_ID,
  DISCORD_BOT_CONTROL_MODULE_VERSION,
  DISCORD_BOT_CONTROL_SCHEMA_VERSION,
  type DiscordBotCommandPolicyRequest,
  type DiscordBotCommandPolicyResponse,
  type DiscordBotControlLocale,
  type DiscordBotControlOverview,
  type DiscordBotControlSettings,
  type DiscordBotResponseLocaleUpdateRequest,
  type DiscordBotResponseLocaleUpdateResponse,
  type UpdateDiscordBotControlInput
} from "@streamops/shared";
import type { TenantContext } from "../tenant-context.js";
import { SafeDatabaseError } from "../errors.js";
import type { BotManagementRole } from "@streamops/shared";
import {
  repositoryQuery,
  type RepositoryQueryable
} from "./types.js";

type InstallationRow = {
  discord_guild_id: string;
  guild_display_name: string;
  application_id: string;
};

type ActorInstallationRow = InstallationRow & {
  organization_id: string;
  actor_user_id: string;
};

type ControlRow = {
  public_commands_enabled: boolean;
  palworld_status_enabled: boolean;
  status_command_enabled: boolean;
  player_command_enabled: boolean;
  guide_command_enabled: boolean;
  delete_invocation_after_reply: boolean;
  preferred_locale: DiscordBotControlLocale;
  show_players: boolean;
  show_version: boolean;
  show_latency: boolean;
  show_observed_at: boolean;
  participation_announce_enabled: boolean;
  revision: string;
};

type PolicyRow = ControlRow & {
  present: boolean;
};

function settings(row?: ControlRow): DiscordBotControlSettings {
  if (!row) return DEFAULT_DISCORD_BOT_CONTROL_SETTINGS;
  return Object.freeze({
    publicCommandsEnabled: row.public_commands_enabled,
    palworldStatusEnabled: row.palworld_status_enabled,
    statusCommandEnabled: row.status_command_enabled,
    playerCommandEnabled: row.player_command_enabled,
    guideCommandEnabled: row.guide_command_enabled,
    deleteInvocationAfterReply: row.delete_invocation_after_reply,
    preferredLocale: row.preferred_locale,
    statusFields: Object.freeze({
      players: row.show_players,
      version: row.show_version,
      latency: row.show_latency,
      observedAt: row.show_observed_at
    }),
    participationAnnounceEnabled: row.participation_announce_enabled,
    revision: Number(row.revision)
  });
}

function requireReadRole(role: BotManagementRole): void {
  if (!["owner", "manager", "viewer"].includes(role)) {
    throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
  }
}

function requireWriteRole(role: BotManagementRole): void {
  if (!["owner", "manager"].includes(role)) {
    throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
  }
}

export class DiscordBotControlRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async overview(input: {
    context: TenantContext;
    role: BotManagementRole;
    applicationId: string;
    globalPrefixCommandsEnabled: boolean;
  }): Promise<DiscordBotControlOverview> {
    requireReadRole(input.role);
    const installation = await this.activeInstallation(
      input.context.organizationId,
      input.applicationId
    );
    const control = installation
      ? await this.control(
          input.context.organizationId,
          installation.discord_guild_id,
          installation.application_id
        )
      : undefined;
    const current = settings(control);
    return Object.freeze({
      organizationId: input.context.organizationId,
      role: input.role,
      globalPrefixCommandsEnabled: input.globalPrefixCommandsEnabled,
      ...(installation
        ? {
            installation: Object.freeze({
              guildId: installation.discord_guild_id,
              guildDisplayName: installation.guild_display_name,
              applicationId: installation.application_id,
              status: "active" as const
            })
          }
        : {}),
      modules: Object.freeze([
        Object.freeze({
          id: DISCORD_BOT_CONTROL_MODULE_ID,
          version: DISCORD_BOT_CONTROL_MODULE_VERSION,
          enabled: current.palworldStatusEnabled
        })
      ]),
      settings: current
    });
  }

  async update(input: {
    context: TenantContext;
    role: BotManagementRole;
    applicationId: string;
    globalPrefixCommandsEnabled: boolean;
    value: UpdateDiscordBotControlInput;
  }): Promise<DiscordBotControlOverview> {
    requireWriteRole(input.role);
    const installationResult = await repositoryQuery<InstallationRow>(
      this.queryable,
      `SELECT installation.discord_guild_id,
         guild.display_name AS guild_display_name,
         installation.application_id
       FROM discord_installations installation
       JOIN discord_guilds guild
         ON guild.organization_id = installation.organization_id
        AND guild.discord_guild_id = installation.discord_guild_id
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       WHERE installation.organization_id = $1
         AND installation.application_id = $2
         AND installation.status = 'active'
         AND observation.status = 'observed'
         AND guild.status = 'active'
       ORDER BY installation.installed_at DESC, installation.id DESC
       LIMIT 1
       FOR UPDATE OF installation`,
      [input.context.organizationId, input.applicationId]
    );
    const installation = installationResult.rows[0];
    if (!installation) {
      throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    }
    const existingResult = await repositoryQuery<ControlRow>(
      this.queryable,
      `SELECT public_commands_enabled, palworld_status_enabled,
         status_command_enabled, player_command_enabled,
         guide_command_enabled, delete_invocation_after_reply,
         preferred_locale,
         show_players, show_version, show_latency, show_observed_at,
         participation_announce_enabled,
         revision::TEXT AS revision
       FROM discord_bot_control_configs
       WHERE organization_id = $1
         AND discord_guild_id = $2
         AND application_id = $3
       FOR UPDATE`,
      [
        input.context.organizationId,
        installation.discord_guild_id,
        installation.application_id
      ]
    );
    const existing = existingResult.rows[0];
    const currentRevision = existing ? Number(existing.revision) : 0;
    if (currentRevision !== input.value.expectedRevision) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
    const nextRevision = currentRevision + 1;
    const values = [
      input.value.publicCommandsEnabled,
      input.value.palworldStatusEnabled,
      input.value.statusCommandEnabled,
      input.value.playerCommandEnabled,
      input.value.guideCommandEnabled,
      input.value.deleteInvocationAfterReply,
      input.value.preferredLocale,
      input.value.statusFields.players,
      input.value.statusFields.version,
      input.value.statusFields.latency,
      input.value.statusFields.observedAt,
      input.value.participationAnnounceEnabled
    ] as const;
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_bot_control_configs (
         organization_id, discord_guild_id, application_id,
         public_commands_enabled, palworld_status_enabled,
         status_command_enabled, player_command_enabled,
         guide_command_enabled, delete_invocation_after_reply,
         preferred_locale,
         show_players, show_version, show_latency, show_observed_at,
         participation_announce_enabled,
         revision, updated_by_user_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
       )
       ON CONFLICT (organization_id, discord_guild_id, application_id)
       DO UPDATE SET
         public_commands_enabled = EXCLUDED.public_commands_enabled,
         palworld_status_enabled = EXCLUDED.palworld_status_enabled,
         status_command_enabled = EXCLUDED.status_command_enabled,
         player_command_enabled = EXCLUDED.player_command_enabled,
         guide_command_enabled = EXCLUDED.guide_command_enabled,
         delete_invocation_after_reply = EXCLUDED.delete_invocation_after_reply,
         preferred_locale = EXCLUDED.preferred_locale,
         show_players = EXCLUDED.show_players,
         show_version = EXCLUDED.show_version,
         show_latency = EXCLUDED.show_latency,
         show_observed_at = EXCLUDED.show_observed_at,
         participation_announce_enabled = EXCLUDED.participation_announce_enabled,
         revision = EXCLUDED.revision,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()`,
      [
        input.context.organizationId,
        installation.discord_guild_id,
        installation.application_id,
        ...values,
        nextRevision,
        input.context.actorUserId
      ]
    );
    const snapshot = {
      schemaVersion: DISCORD_BOT_CONTROL_SCHEMA_VERSION,
      moduleId: DISCORD_BOT_CONTROL_MODULE_ID,
      publicCommandsEnabled: input.value.publicCommandsEnabled,
      palworldStatusEnabled: input.value.palworldStatusEnabled,
      statusCommandEnabled: input.value.statusCommandEnabled,
      playerCommandEnabled: input.value.playerCommandEnabled,
      guideCommandEnabled: input.value.guideCommandEnabled,
      deleteInvocationAfterReply: input.value.deleteInvocationAfterReply,
      preferredLocale: input.value.preferredLocale,
      statusFields: input.value.statusFields
    };
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_bot_control_revisions (
         id, organization_id, discord_guild_id, application_id,
         revision, schema_version, safe_snapshot, actor_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8)`,
      [
        crypto.randomUUID(),
        input.context.organizationId,
        installation.discord_guild_id,
        installation.application_id,
        nextRevision,
        DISCORD_BOT_CONTROL_SCHEMA_VERSION,
        JSON.stringify(snapshot),
        input.context.actorUserId
      ]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO audit_logs (
         id, organization_id, actor_user_id, action, target_type,
         target_reference_hash, safe_metadata
       ) VALUES ($1, $2, $3, 'discord.bot.settings.updated',
         'discord_bot_control', $4, $5::JSONB)`,
      [
        crypto.randomUUID(),
        input.context.organizationId,
        input.context.actorUserId,
        crypto.createHash("sha256")
          .update(`${installation.application_id}:${installation.discord_guild_id}`)
          .digest(),
        JSON.stringify({ revision: nextRevision })
      ]
    );
    return this.overview({
      context: input.context,
      role: input.role,
      applicationId: input.applicationId,
      globalPrefixCommandsEnabled: input.globalPrefixCommandsEnabled
    });
  }

  async commandPolicy(
    input: DiscordBotCommandPolicyRequest
  ): Promise<DiscordBotCommandPolicyResponse> {
    const result = await repositoryQuery<PolicyRow>(
      this.queryable,
      `SELECT TRUE AS present,
         COALESCE(config.public_commands_enabled, TRUE)
           AS public_commands_enabled,
         COALESCE(config.palworld_status_enabled, TRUE)
           AS palworld_status_enabled,
         COALESCE(config.status_command_enabled, TRUE)
           AS status_command_enabled,
         COALESCE(config.player_command_enabled, TRUE)
           AS player_command_enabled,
         COALESCE(config.guide_command_enabled, TRUE)
           AS guide_command_enabled,
         COALESCE(config.delete_invocation_after_reply, FALSE)
           AS delete_invocation_after_reply,
         COALESCE(config.preferred_locale, 'auto')
           AS preferred_locale,
         COALESCE(config.show_players, TRUE) AS show_players,
         COALESCE(config.show_version, TRUE) AS show_version,
         COALESCE(config.show_latency, TRUE) AS show_latency,
         COALESCE(config.show_observed_at, TRUE) AS show_observed_at,
         COALESCE(config.participation_announce_enabled, TRUE)
           AS participation_announce_enabled,
         COALESCE(config.revision, 0)::TEXT AS revision
       FROM discord_installations installation
       JOIN discord_guilds guild
         ON guild.organization_id = installation.organization_id
        AND guild.discord_guild_id = installation.discord_guild_id
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       LEFT JOIN discord_bot_control_configs config
         ON config.organization_id = installation.organization_id
        AND config.discord_guild_id = installation.discord_guild_id
        AND config.application_id = installation.application_id
       WHERE installation.application_id = $1
         AND installation.discord_guild_id = $2
         AND installation.status = 'active'
         AND observation.status = 'observed'
         AND guild.status = 'active'
      LIMIT 1`,
      [input.applicationId, input.guildId]
    );
    if (!result.rows[0]?.present) {
      return Object.freeze({
        allowed: false,
        commands: Object.freeze({
          help: false,
          status: false,
          player: false,
          guide: false
        }),
        deleteInvocationAfterReply: false,
        preferredLocale: "auto",
        statusFields: DEFAULT_DISCORD_BOT_CONTROL_SETTINGS.statusFields,
        revision: 0,
        reason: "installation_inactive"
      });
    }
    const current = settings(result.rows[0]);
    const commands = Object.freeze({
      help: current.publicCommandsEnabled,
      status: current.publicCommandsEnabled
        && current.palworldStatusEnabled
        && current.statusCommandEnabled,
      player: current.publicCommandsEnabled
        && current.palworldStatusEnabled
        && current.playerCommandEnabled,
      guide: current.publicCommandsEnabled
        && current.palworldStatusEnabled
        && current.guideCommandEnabled
    });
    const moduleRequired = input.command !== "help";
    const reason = !current.publicCommandsEnabled
      ? "command_disabled" as const
      : moduleRequired && !current.palworldStatusEnabled
        ? "module_disabled" as const
        : !commands[input.command]
          ? "command_disabled" as const
        : undefined;
    return Object.freeze({
      allowed: reason === undefined,
      commands,
      deleteInvocationAfterReply: current.deleteInvocationAfterReply,
      preferredLocale: current.preferredLocale,
      statusFields: current.statusFields,
      revision: current.revision,
      ...(reason ? { reason } : {})
    });
  }

  async updateResponseLocale(
    input: DiscordBotResponseLocaleUpdateRequest
  ): Promise<DiscordBotResponseLocaleUpdateResponse> {
    const installationResult = await repositoryQuery<ActorInstallationRow>(
      this.queryable,
      `SELECT installation.organization_id,
         installation.discord_guild_id,
         guild.display_name AS guild_display_name,
         installation.application_id,
         member.user_id AS actor_user_id
       FROM discord_installations installation
       JOIN discord_guilds guild
         ON guild.organization_id = installation.organization_id
        AND guild.discord_guild_id = installation.discord_guild_id
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       JOIN external_identities identity
         ON identity.provider = 'discord'
        AND identity.provider_subject = $3
        AND identity.revoked_at IS NULL
       JOIN users account
         ON account.id = identity.user_id
        AND account.status = 'active'
       JOIN organization_members member
         ON member.organization_id = installation.organization_id
        AND member.user_id = account.id
        AND member.role IN ('owner', 'manager')
       WHERE installation.application_id = $1
         AND installation.discord_guild_id = $2
         AND installation.status = 'active'
         AND observation.status = 'observed'
         AND guild.status = 'active'
       LIMIT 1
       FOR UPDATE OF installation, member`,
      [input.applicationId, input.guildId, input.userId]
    );
    const installation = installationResult.rows[0];
    if (!installation) {
      throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    }
    const existingResult = await repositoryQuery<ControlRow>(
      this.queryable,
      `SELECT public_commands_enabled, palworld_status_enabled,
         status_command_enabled, player_command_enabled,
         guide_command_enabled, delete_invocation_after_reply,
         preferred_locale,
         show_players, show_version, show_latency, show_observed_at,
         participation_announce_enabled,
         revision::TEXT AS revision
       FROM discord_bot_control_configs
       WHERE organization_id = $1
         AND discord_guild_id = $2
         AND application_id = $3
       FOR UPDATE`,
      [
        installation.organization_id,
        installation.discord_guild_id,
        installation.application_id
      ]
    );
    const current = settings(existingResult.rows[0]);
    const nextRevision = current.revision + 1;
    const next = Object.freeze({
      ...current,
      preferredLocale: input.preferredLocale,
      revision: nextRevision
    });
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_bot_control_configs (
         organization_id, discord_guild_id, application_id,
         public_commands_enabled, palworld_status_enabled,
         status_command_enabled, player_command_enabled,
         guide_command_enabled, delete_invocation_after_reply,
         preferred_locale,
         show_players, show_version, show_latency, show_observed_at,
         participation_announce_enabled,
         revision, updated_by_user_id
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
       )
       ON CONFLICT (organization_id, discord_guild_id, application_id)
       DO UPDATE SET
         preferred_locale = EXCLUDED.preferred_locale,
         revision = EXCLUDED.revision,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()`,
      [
        installation.organization_id,
        installation.discord_guild_id,
        installation.application_id,
        next.publicCommandsEnabled,
        next.palworldStatusEnabled,
        next.statusCommandEnabled,
        next.playerCommandEnabled,
        next.guideCommandEnabled,
        next.deleteInvocationAfterReply,
        next.preferredLocale,
        next.statusFields.players,
        next.statusFields.version,
        next.statusFields.latency,
        next.statusFields.observedAt,
        next.participationAnnounceEnabled,
        nextRevision,
        installation.actor_user_id
      ]
    );
    const snapshot = {
      schemaVersion: DISCORD_BOT_CONTROL_SCHEMA_VERSION,
      moduleId: DISCORD_BOT_CONTROL_MODULE_ID,
      publicCommandsEnabled: next.publicCommandsEnabled,
      palworldStatusEnabled: next.palworldStatusEnabled,
      statusCommandEnabled: next.statusCommandEnabled,
      playerCommandEnabled: next.playerCommandEnabled,
      guideCommandEnabled: next.guideCommandEnabled,
      deleteInvocationAfterReply: next.deleteInvocationAfterReply,
      preferredLocale: next.preferredLocale,
      statusFields: next.statusFields
    };
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_bot_control_revisions (
         id, organization_id, discord_guild_id, application_id,
         revision, schema_version, safe_snapshot, actor_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8)`,
      [
        crypto.randomUUID(),
        installation.organization_id,
        installation.discord_guild_id,
        installation.application_id,
        nextRevision,
        DISCORD_BOT_CONTROL_SCHEMA_VERSION,
        JSON.stringify(snapshot),
        installation.actor_user_id
      ]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO audit_logs (
         id, organization_id, actor_user_id, action, target_type,
         target_reference_hash, safe_metadata
       ) VALUES ($1, $2, $3, 'discord.bot.response_locale.updated',
         'discord_bot_control', $4, $5::JSONB)`,
      [
        crypto.randomUUID(),
        installation.organization_id,
        installation.actor_user_id,
        crypto.createHash("sha256")
          .update(`${installation.application_id}:${installation.discord_guild_id}`)
          .digest(),
        JSON.stringify({
          revision: nextRevision,
          preferredLocale: next.preferredLocale,
          source: "discord_command"
        })
      ]
    );
    return Object.freeze({
      preferredLocale: next.preferredLocale,
      revision: nextRevision
    });
  }

  private async activeInstallation(
    organizationId: string,
    applicationId: string
  ): Promise<InstallationRow | undefined> {
    const result = await repositoryQuery<InstallationRow>(
      this.queryable,
      `SELECT installation.discord_guild_id,
         guild.display_name AS guild_display_name,
         installation.application_id
       FROM discord_installations installation
       JOIN discord_guilds guild
         ON guild.organization_id = installation.organization_id
        AND guild.discord_guild_id = installation.discord_guild_id
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       WHERE installation.organization_id = $1
         AND installation.application_id = $2
         AND installation.status = 'active'
         AND observation.status = 'observed'
         AND guild.status = 'active'
       ORDER BY installation.installed_at DESC, installation.id DESC
       LIMIT 1`,
      [organizationId, applicationId]
    );
    return result.rows[0];
  }

  private async control(
    organizationId: string,
    guildId: string,
    applicationId: string
  ): Promise<ControlRow | undefined> {
    const result = await repositoryQuery<ControlRow>(
      this.queryable,
      `SELECT public_commands_enabled, palworld_status_enabled,
         status_command_enabled, player_command_enabled,
         guide_command_enabled, delete_invocation_after_reply,
         preferred_locale,
         show_players, show_version, show_latency, show_observed_at,
         participation_announce_enabled,
         revision::TEXT AS revision
       FROM discord_bot_control_configs
       WHERE organization_id = $1
         AND discord_guild_id = $2
         AND application_id = $3`,
      [organizationId, guildId, applicationId]
    );
    return result.rows[0];
  }
}
