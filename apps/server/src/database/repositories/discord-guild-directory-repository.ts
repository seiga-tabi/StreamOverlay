import type {
  DiscordGuildDirectoryEntry,
  DiscordGuildDirectoryReportRequest
} from "@streamops/shared";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

/* Bot 이 보고한 길드 채널·역할 후보 캐시.
 *
 * 서버는 Discord 를 직접 보지 않습니다. 봇이 자기가 실제로 쓸 수 있는 것만 골라
 * 보고하고, 여기에 통째로 교체 저장합니다(migration 0018).
 * Dashboard 의 알림 채널 선택지와 저장 시 채널 허용 판정이 이 캐시를 씁니다.
 */

export type DiscordGuildDirectory = Readonly<{
  organizationId: string;
  discordGuildId: string;
  channels: readonly DiscordGuildDirectoryEntry[];
  roles: readonly DiscordGuildDirectoryEntry[];
  channelsTruncated: boolean;
  rolesTruncated: boolean;
  reportedAt: string;
}>;

type DirectoryRow = {
  organization_id: string;
  discord_guild_id: string;
  channels: DiscordGuildDirectoryEntry[];
  roles: DiscordGuildDirectoryEntry[];
  channels_truncated: boolean;
  roles_truncated: boolean;
  reported_at: Date;
};

function directory(row: DirectoryRow): DiscordGuildDirectory {
  return Object.freeze({
    organizationId: row.organization_id,
    discordGuildId: row.discord_guild_id,
    channels: Object.freeze(row.channels ?? []),
    roles: Object.freeze(row.roles ?? []),
    channelsTruncated: row.channels_truncated,
    rolesTruncated: row.roles_truncated,
    reportedAt: row.reported_at.toISOString()
  });
}

export class DiscordGuildDirectoryRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  /**
   * 봇 보고를 저장합니다. 설치되지 않은 Guild 는 조용히 무시하고 `false` 를
   * 돌려줍니다 — 봇이 아직 서버에 연결되지 않은 Guild 를 보고할 수 있습니다.
   */
  async replaceReport(input: DiscordGuildDirectoryReportRequest): Promise<boolean> {
    const result = await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_guild_directory (
         organization_id, discord_guild_id, application_id,
         channels, roles, channels_truncated, roles_truncated, reported_at
       )
       SELECT installation.organization_id, installation.discord_guild_id,
              installation.application_id,
              $3::JSONB, $4::JSONB, $5, $6, NOW()
         FROM discord_installations installation
        WHERE installation.discord_guild_id = $1
          AND installation.application_id = $2
          AND installation.status = 'active'
       ON CONFLICT (organization_id, discord_guild_id, application_id)
       DO UPDATE SET
         channels = EXCLUDED.channels,
         roles = EXCLUDED.roles,
         channels_truncated = EXCLUDED.channels_truncated,
         roles_truncated = EXCLUDED.roles_truncated,
         reported_at = EXCLUDED.reported_at`,
      [
        input.guildId,
        input.applicationId,
        JSON.stringify(input.channels),
        JSON.stringify(input.roles),
        input.channelsTruncated,
        input.rolesTruncated
      ]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** 한 사용자가 속한 organization 들의 캐시를 한 번에 읽습니다. */
  async listForOrganizations(
    organizationIds: readonly string[]
  ): Promise<readonly DiscordGuildDirectory[]> {
    if (organizationIds.length === 0) return Object.freeze([]);
    const result = await repositoryQuery<DirectoryRow>(
      this.queryable,
      `SELECT organization_id, discord_guild_id, channels, roles,
              channels_truncated, roles_truncated, reported_at
         FROM discord_guild_directory
        WHERE organization_id = ANY($1::UUID[])
        ORDER BY organization_id ASC, discord_guild_id ASC`,
      [organizationIds]
    );
    return Object.freeze(result.rows.map(directory));
  }

  /**
   * 저장 요청의 채널이 봇이 실제로 쓸 수 있는 후보인지 확인합니다.
   * 후보 목록 밖의 채널을 저장하면 발송이 조용히 실패하므로 여기서 막습니다.
   */
  async allowsChannel(input: {
    organizationId: string;
    discordGuildId: string;
    channelId: string;
    mentionRoleId?: string;
  }): Promise<boolean> {
    const result = await repositoryQuery<{ allowed: boolean }>(
      this.queryable,
      `SELECT
         EXISTS (
           SELECT 1 FROM jsonb_array_elements(directory.channels) entry
            WHERE entry->>'id' = $3
         )
         AND (
           $4::TEXT IS NULL
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(directory.roles) entry
              WHERE entry->>'id' = $4
           )
         ) AS allowed
         FROM discord_guild_directory directory
        WHERE directory.organization_id = $1
          AND directory.discord_guild_id = $2`,
      [
        input.organizationId,
        input.discordGuildId,
        input.channelId,
        input.mentionRoleId ?? null
      ]
    );
    return result.rows[0]?.allowed === true;
  }
}
