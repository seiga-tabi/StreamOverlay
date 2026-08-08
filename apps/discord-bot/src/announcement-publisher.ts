import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Client,
  type Guild
} from "discord.js";
import {
  DISCORD_GUILD_DIRECTORY_MAX_ENTRIES,
  discordBotMessageLocale,
  type DiscordAnnouncementAckResult,
  type DiscordAnnouncementJob,
  type DiscordBotMessageLocale
} from "@streamops/shared";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";

/* 참여 모집 알림 발행.
 *
 * 봇은 "언제 무엇을 보낼지"를 정하지 않습니다. 서버가 준 job 을 그대로 실행하고
 * 결과만 돌려줍니다. 채널·역할·본문이 전부 서버에서 오므로 봇이 임의 채널로
 * 메시지를 보내는 경로가 없습니다.
 *
 * 서버가 봇을 호출하는 방향을 만들지 않기 위해 폴링을 씁니다.
 */

const MAX_NAME_LENGTH = 100;

const MESSAGES: Record<DiscordBotMessageLocale, {
  recruiting: (name: string) => string;
  closed: (name: string) => string;
  waiting: string;
  selected: string;
  join: string;
  closedBody: string;
}> = {
  ko: {
    recruiting: (name) => `🔴 시청자 참여 모집 중 — ${name}`,
    closed: (name) => `모집이 끝났습니다 — ${name}`,
    waiting: "대기",
    selected: "선정",
    join: "참여 신청하기",
    closedBody: "다음 모집을 기다려 주세요."
  },
  ja: {
    recruiting: (name) => `🔴 視聴者参加 募集中 — ${name}`,
    closed: (name) => `募集が終了しました — ${name}`,
    waiting: "待機",
    selected: "選出",
    join: "参加を申請",
    closedBody: "次の募集をお待ちください。"
  },
  en: {
    recruiting: (name) => `🔴 Viewer participation open — ${name}`,
    closed: (name) => `Participation closed — ${name}`,
    waiting: "Waiting",
    selected: "Selected",
    join: "Join now",
    closedBody: "Please wait for the next session."
  }
};

/** 봇이 실제로 메시지를 보낼 수 있는 텍스트 채널만 고릅니다. */
export function publishableChannels(guild: Guild): Array<{ id: string; name: string }> {
  const me = guild.members.me;
  const entries: Array<{ id: string; name: string }> = [];
  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    if (!channel.name || channel.name.length > MAX_NAME_LENGTH) continue;
    const permissions = me ? channel.permissionsFor(me) : undefined;
    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel)
      || !permissions.has(PermissionFlagsBits.SendMessages)
      || !permissions.has(PermissionFlagsBits.EmbedLinks)
    ) continue;
    entries.push({ id: channel.id, name: channel.name });
  }
  return entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, DISCORD_GUILD_DIRECTORY_MAX_ENTRIES);
}

/** @everyone 은 후보에서 제외합니다. 어떤 설정으로도 멘션하지 않습니다. */
export function mentionableRoles(guild: Guild): Array<{ id: string; name: string }> {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id && role.name.length <= MAX_NAME_LENGTH)
    .map((role) => ({ id: role.id, name: role.name }))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, DISCORD_GUILD_DIRECTORY_MAX_ENTRIES);
}

export function announcementEmbed(job: DiscordAnnouncementJob): EmbedBuilder {
  const locale = job.locale === "auto"
    ? discordBotMessageLocale(undefined)
    : discordBotMessageLocale(job.locale);
  const text = MESSAGES[locale];
  const open = job.state === "recruiting";
  const embed = new EmbedBuilder()
    .setColor(open ? 0x23a55a : 0x4e5058)
    .setTitle(open ? text.recruiting(job.streamerDisplayName) : text.closed(job.streamerDisplayName));

  if (!open) return embed.setDescription(text.closedBody);

  const parts: string[] = [];
  if (job.waiting !== undefined) parts.push(`${text.waiting} ${job.waiting}`);
  if (job.selected !== undefined) parts.push(`${text.selected} ${job.selected}`);
  return embed
    .setDescription(`[${text.join}](${job.participationUrl})`)
    .setFooter(parts.length > 0 ? { text: parts.join(" · ") } : null);
}

function ackFor(error: unknown): DiscordAnnouncementAckResult {
  const code = (error as { code?: unknown })?.code;
  /* discord.js 는 Unknown Channel 10003, Unknown Message 10008,
     Missing Access 50001, Missing Permissions 50013 을 씁니다. */
  if (code === 10003) return "channel_missing";
  if (code === 10008) return "message_deleted";
  if (code === 50001 || code === 50013) return "permission_missing";
  return "failed";
}

export class DiscordAnnouncementPublisher {
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly options: {
      applicationId: string;
      client: Pick<Client, "guilds">;
      internalApi: Pick<
        DiscordInternalApiClient,
        "pendingAnnouncements" | "ackAnnouncement" | "reportGuildDirectory"
      >;
      intervalMs?: number;
    }
  ) {}

  start(): void {
    if (this.timer) return;
    const interval = this.options.intervalMs ?? 15_000;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** 한 Guild 의 채널·역할 후보를 서버에 보고합니다. */
  async reportGuild(guild: Guild): Promise<void> {
    const channels = publishableChannels(guild);
    const roles = mentionableRoles(guild);
    try {
      await this.options.internalApi.reportGuildDirectory({
        applicationId: this.options.applicationId,
        guildId: guild.id,
        channels,
        roles,
        channelsTruncated: channels.length >= DISCORD_GUILD_DIRECTORY_MAX_ENTRIES,
        rolesTruncated: roles.length >= DISCORD_GUILD_DIRECTORY_MAX_ENTRIES
      });
      auditEvent("discord.guild_directory.sent", {
        guild: safeReference(guild.id),
        channels: channels.length,
        roles: roles.length
      });
    } catch {
      /* 보고 실패는 다음 주기에 다시 시도합니다. 명령 처리에는 영향이 없습니다. */
      auditEvent("discord.guild_directory.failed", { guild: safeReference(guild.id) });
    }
  }

  /** 폴링 한 주기. 겹쳐 도는 것을 막습니다. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.options.internalApi
        .pendingAnnouncements(this.options.applicationId);
      for (const job of jobs) await this.runJob(job);
    } catch {
      auditEvent("discord.announcement.poll_failed");
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: DiscordAnnouncementJob): Promise<void> {
    let result: DiscordAnnouncementAckResult = "failed";
    let messageId: string | undefined;
    try {
      const guild = this.options.client.guilds.cache.get(job.guildId);
      const channel = guild?.channels.cache.get(job.channelId);
      if (!channel || !("send" in channel) || typeof channel.send !== "function") {
        result = "channel_missing";
      } else {
        const payload = {
          embeds: [announcementEmbed(job)],
          /* 지정한 역할만 멘션합니다. everyone 은 어떤 경로로도 켜지지 않습니다. */
          allowedMentions: {
            parse: [] as never[],
            ...(job.mentionRoleId ? { roles: [job.mentionRoleId] } : {})
          },
          ...(job.mentionRoleId && !job.messageId
            ? { content: `<@&${job.mentionRoleId}>` }
            : {})
        };
        if (job.messageId) {
          const existing = await channel.messages.fetch(job.messageId);
          const edited = await existing.edit(payload);
          messageId = edited.id;
        } else {
          const created = await channel.send(payload);
          messageId = created.id;
        }
        result = "ok";
      }
    } catch (error) {
      result = ackFor(error);
    }

    try {
      await this.options.internalApi.ackAnnouncement({
        applicationId: this.options.applicationId,
        jobId: job.jobId,
        result,
        ...(result === "ok" && messageId ? { messageId } : {})
      });
    } catch {
      auditEvent("discord.announcement.ack_failed", { result });
    }
    auditEvent("discord.announcement.published", {
      result,
      guild: safeReference(job.guildId)
    });
  }
}
