import crypto from "node:crypto";
import type { DiscordGuildDirectoryEntry } from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

/* 참여 모집 Discord 알림 대상 (migration 0017).
 *
 * 소유 방향은 "스트리머가 자기 Dashboard 에서 켠다" 입니다. 그래서 조회·저장
 * 모두 스트리머 본인의 Twitch userId 를 기준으로 하고, organization 은 본인이
 * 멤버인 곳으로만 제한합니다. 멤버가 아닌 organization 은 403 이 아니라
 * "없는 것"으로 취급해 존재 여부가 새지 않게 합니다.
 */

export type AnnouncementDeliverable =
  | "ok"
  | "missing_channel"
  | "missing_permission"
  | "bot_removed"
  | "blocked_by_guild";

export type AnnouncementTarget = Readonly<{
  organizationId: string;
  organizationName: string;
  discordGuildId: string;
  guildDisplayName: string;
  channelId: string;
  channelName?: string;
  mentionRoleId?: string;
  mentionRoleName?: string;
  deliverable: AnnouncementDeliverable;
  lastDeliveredAt?: string;
}>;

export type AnnouncementCandidate = Readonly<{
  organizationId: string;
  organizationName: string;
  discordGuildId: string;
  guildDisplayName: string;
  channels: readonly DiscordGuildDirectoryEntry[];
  channelsTruncated: boolean;
  roles: readonly DiscordGuildDirectoryEntry[];
  announcementAllowed: boolean;
}>;

export type AnnouncementSettings = Readonly<{
  enabled: boolean;
  targets: readonly AnnouncementTarget[];
  available: readonly AnnouncementCandidate[];
}>;

export type AnnouncementTargetInput = Readonly<{
  organizationId: string;
  discordGuildId: string;
  channelId: string;
  mentionRoleId?: string;
}>;

export const ANNOUNCEMENT_MAX_TARGETS = 3;

type CandidateRow = {
  organization_id: string;
  organization_name: string;
  discord_guild_id: string;
  guild_display_name: string;
  application_id: string;
  channels: DiscordGuildDirectoryEntry[] | null;
  roles: DiscordGuildDirectoryEntry[] | null;
  channels_truncated: boolean;
  announcement_allowed: boolean;
};

type TargetRow = {
  organization_id: string;
  discord_guild_id: string;
  channel_id: string;
  mention_role_id: string | null;
  is_enabled: boolean;
  deliverable: Exclude<AnnouncementDeliverable, "blocked_by_guild">;
  last_delivered_at: Date | null;
};

const CANDIDATE_SQL = `
  SELECT
    org.id AS organization_id,
    org.display_name AS organization_name,
    guild.discord_guild_id,
    guild.display_name AS guild_display_name,
    installation.application_id,
    directory.channels,
    directory.roles,
    COALESCE(directory.channels_truncated, FALSE) AS channels_truncated,
    COALESCE(config.participation_announce_enabled, TRUE) AS announcement_allowed
  FROM organization_members member
  JOIN organizations org
    ON org.id = member.organization_id
   AND org.status = 'active'
  JOIN discord_installations installation
    ON installation.organization_id = member.organization_id
   AND installation.status = 'active'
  JOIN discord_guilds guild
    ON guild.organization_id = installation.organization_id
   AND guild.discord_guild_id = installation.discord_guild_id
   AND guild.status = 'active'
  LEFT JOIN discord_guild_directory directory
    ON directory.organization_id = installation.organization_id
   AND directory.discord_guild_id = installation.discord_guild_id
   AND directory.application_id = installation.application_id
  LEFT JOIN discord_bot_control_configs config
    ON config.organization_id = installation.organization_id
   AND config.discord_guild_id = installation.discord_guild_id
   AND config.application_id = installation.application_id
  WHERE member.user_id = $1
  ORDER BY org.display_name ASC, guild.display_name ASC`;

function candidate(row: CandidateRow): AnnouncementCandidate {
  return Object.freeze({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    discordGuildId: row.discord_guild_id,
    guildDisplayName: row.guild_display_name,
    channels: Object.freeze(row.channels ?? []),
    channelsTruncated: row.channels_truncated,
    roles: Object.freeze(row.roles ?? []),
    announcementAllowed: row.announcement_allowed
  });
}

function entryName(
  entries: readonly DiscordGuildDirectoryEntry[],
  id: string | null
): string | undefined {
  if (!id) return undefined;
  return entries.find((entry) => entry.id === id)?.name;
}

export class DiscordParticipationAnnouncementRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async read(input: {
    userId: string;
    streamerTwitchUserId: string;
  }): Promise<AnnouncementSettings> {
    const [candidateResult, targetResult] = await Promise.all([
      repositoryQuery<CandidateRow>(this.queryable, CANDIDATE_SQL, [input.userId]),
      repositoryQuery<TargetRow>(
        this.queryable,
        `SELECT target.organization_id, target.discord_guild_id, target.channel_id,
                target.mention_role_id, target.is_enabled, target.deliverable,
                target.last_delivered_at
           FROM discord_participation_announcement_targets target
           JOIN organization_members member
             ON member.organization_id = target.organization_id
            AND member.user_id = $1
          WHERE target.streamer_twitch_user_id = $2
          ORDER BY target.created_at ASC`,
        [input.userId, input.streamerTwitchUserId]
      )
    ]);

    const available = candidateResult.rows.map(candidate);
    const byGuild = new Map(
      available.map((entry) => [`${entry.organizationId}:${entry.discordGuildId}`, entry])
    );

    const targets = targetResult.rows.map((row) => {
      const guild = byGuild.get(`${row.organization_id}:${row.discord_guild_id}`);
      const channelName = entryName(guild?.channels ?? [], row.channel_id);
      const roleName = entryName(guild?.roles ?? [], row.mention_role_id);
      /* 길드가 막았으면 저장된 값보다 그 사실을 먼저 알립니다.
         조용히 발송되지 않는 것보다 이유가 보이는 편이 낫습니다. */
      const deliverable: AnnouncementDeliverable = guild?.announcementAllowed === false
        ? "blocked_by_guild"
        : row.deliverable;
      return Object.freeze({
        organizationId: row.organization_id,
        organizationName: guild?.organizationName ?? "",
        discordGuildId: row.discord_guild_id,
        guildDisplayName: guild?.guildDisplayName ?? "",
        channelId: row.channel_id,
        ...(channelName ? { channelName } : {}),
        ...(row.mention_role_id ? { mentionRoleId: row.mention_role_id } : {}),
        ...(roleName ? { mentionRoleName: roleName } : {}),
        deliverable,
        ...(row.last_delivered_at
          ? { lastDeliveredAt: row.last_delivered_at.toISOString() }
          : {})
      });
    });

    return Object.freeze({
      enabled: targetResult.rows.some((row) => row.is_enabled),
      targets: Object.freeze(targets),
      available: Object.freeze(available)
    });
  }

  /**
   * 대상 목록을 통째로 교체합니다. 호출자가 transaction 안에서 실행해야 합니다.
   *
   * 실패 사유는 SafeDatabaseError 코드로 구분합니다. 멤버가 아닌 organization 은
   * `DATABASE_REFERENCE_INVALID`(호출부에서 404)로, 길드 거부권과 후보 밖 채널은
   * `DATABASE_INVALID_INPUT`으로 올립니다.
   */
  async replace(input: {
    userId: string;
    streamerTwitchUserId: string;
    enabled: boolean;
    targets: readonly AnnouncementTargetInput[];
  }): Promise<void> {
    if (input.targets.length > ANNOUNCEMENT_MAX_TARGETS) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    const candidateResult = await repositoryQuery<CandidateRow>(
      this.queryable,
      CANDIDATE_SQL,
      [input.userId]
    );
    const byGuild = new Map(
      candidateResult.rows.map((row) => [`${row.organization_id}:${row.discord_guild_id}`, row])
    );

    const seen = new Set<string>();
    for (const target of input.targets) {
      const key = `${target.organizationId}:${target.discordGuildId}`;
      const guild = byGuild.get(key);
      /* 본인이 멤버가 아니거나 Bot 이 없는 길드는 "없는 것"으로 다룹니다. */
      if (!guild) throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
      if (seen.has(key)) throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
      seen.add(key);
      if (!guild.announcement_allowed) {
        throw new SafeDatabaseError("DATABASE_CONFLICT", false);
      }
      const channels = guild.channels ?? [];
      const roles = guild.roles ?? [];
      /* 봇이 쓸 수 없는 채널을 저장하면 발송이 조용히 실패합니다. 여기서 막습니다. */
      if (!channels.some((entry) => entry.id === target.channelId)) {
        throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
      }
      if (
        target.mentionRoleId !== undefined
        && !roles.some((entry) => entry.id === target.mentionRoleId)
      ) {
        throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
      }
    }

    await repositoryQuery(
      this.queryable,
      `DELETE FROM discord_participation_announcement_targets
        WHERE streamer_twitch_user_id = $1
          AND organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = $2
          )`,
      [input.streamerTwitchUserId, input.userId]
    );

    for (const target of input.targets) {
      const guild = byGuild.get(`${target.organizationId}:${target.discordGuildId}`)!;
      await repositoryQuery(
        this.queryable,
        `INSERT INTO discord_participation_announcement_targets (
           id, organization_id, discord_guild_id, application_id,
           streamer_twitch_user_id, channel_id, mention_role_id,
           is_enabled, created_by_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          crypto.randomUUID(),
          target.organizationId,
          target.discordGuildId,
          guild.application_id,
          input.streamerTwitchUserId,
          target.channelId,
          target.mentionRoleId ?? null,
          input.enabled,
          input.userId
        ]
      );
    }
  }
}
