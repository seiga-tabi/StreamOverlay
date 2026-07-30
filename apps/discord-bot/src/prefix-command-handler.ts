import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message
} from "discord.js";
import type {
  DiscordGameServerStatusResponse,
  DiscordGameServerStatusState
} from "@streamops/shared";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";

const MAX_MESSAGE_LENGTH = 100;
const USER_COOLDOWN_MS = 10_000;
const GUILD_WINDOW_MS = 5_000;
const GUILD_WINDOW_MAX = 5;
const MAX_RATE_LIMIT_KEYS = 10_000;

export type YoroPrefixCommand = "help" | "status" | "guide";

const aliases = new Map<string, YoroPrefixCommand>([
  ["도움말", "help"],
  ["help", "help"],
  ["ヘルプ", "help"],
  ["상태", "status"],
  ["status", "status"],
  ["ステータス", "status"],
  ["가이드", "guide"],
  ["guide", "guide"],
  ["ガイド", "guide"]
]);

const text = {
  ko: {
    helpTitle: "YORO Bot 일반 사용자 명령",
    helpBody: [
      "`!yoro 상태` Palworld 서버 상태 확인",
      "`!yoro 가이드` Palworld 전용 서버 설정 안내",
      "`!yoro 도움말` 현재 사용할 수 있는 명령 확인"
    ].join("\n"),
    guideTitle: "Palworld 전용 서버 설정",
    guideBody: "YORO와 연결할 Palworld 전용 서버 설정 방법을 확인할 수 있습니다.",
    guideButton: "설정 가이드 열기",
    dashboardButton: "Dashboard 열기",
    statusTitle: "YORO Palworld 서버",
    guildNotConnected: "이 Discord 서버가 YORO Organization과 연결되지 않았습니다.",
    serverNotConfigured: "아직 Palworld 게임 서버가 등록되지 않았습니다.",
    unavailable: "현재 서버 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
    fields: {
      status: "상태",
      players: "접속 인원",
      version: "게임 버전",
      latency: "응답 시간",
      observedAt: "마지막 확인"
    },
    states: {
      not_configured: "아직 게임 서버가 연결되지 않음",
      checking: "서버 상태 확인 중",
      online: "온라인",
      degraded: "응답 지연",
      offline: "오프라인",
      stale: "최신 상태 확인 중",
      auth_failed: "관리자가 연결 설정을 확인 중",
      blocked_by_policy: "상태 기능을 사용할 수 없음",
      unavailable: "현재 상태를 불러올 수 없음"
    }
  },
  ja: {
    helpTitle: "YORO Bot一般ユーザーコマンド",
    helpBody: [
      "`!yoro ステータス` Palworldサーバー状態を確認",
      "`!yoro ガイド` Palworld専用サーバー設定ガイド",
      "`!yoro ヘルプ` 利用可能なコマンドを確認"
    ].join("\n"),
    guideTitle: "Palworld専用サーバー設定",
    guideBody: "YOROと連携するPalworld専用サーバーの設定方法を確認できます。",
    guideButton: "設定ガイドを開く",
    dashboardButton: "Dashboardを開く",
    statusTitle: "YORO Palworldサーバー",
    guildNotConnected: "このDiscordサーバーはYORO Organizationと連携されていません。",
    serverNotConfigured: "Palworldゲームサーバーはまだ登録されていません。",
    unavailable: "現在サーバー状態を取得できません。しばらくしてからお試しください。",
    fields: {
      status: "状態",
      players: "接続人数",
      version: "ゲームバージョン",
      latency: "応答時間",
      observedAt: "最終確認"
    },
    states: {
      not_configured: "ゲームサーバー未連携",
      checking: "サーバー状態を確認中",
      online: "オンライン",
      degraded: "応答遅延",
      offline: "オフライン",
      stale: "最新状態を確認中",
      auth_failed: "管理者が接続設定を確認中",
      blocked_by_policy: "状態機能を利用できません",
      unavailable: "現在状態を取得できません"
    }
  }
} as const;

function localeFor(value: string | undefined): keyof typeof text {
  return value?.toLowerCase().startsWith("ja") ? "ja" : "ko";
}

function safeDiscordText(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/([`*_~|>])/gu, "\\$1")
    .replace(/@/gu, "＠")
    .slice(0, 120);
}

function statusColor(status: DiscordGameServerStatusState): number {
  switch (status) {
    case "online":
      return 0x22c55e;
    case "degraded":
      return 0xeab308;
    case "offline":
      return 0xef4444;
    case "auth_failed":
      return 0xf97316;
    default:
      return 0x6b7280;
  }
}

function discordTimestamp(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? `<t:${Math.trunc(timestamp / 1_000)}:R>`
    : undefined;
}

export function parseYoroPrefixCommand(content: string): YoroPrefixCommand | undefined {
  if (content.length > MAX_MESSAGE_LENGTH) return undefined;
  const match = /^!yoro(?:\s+(\S+))?\s*$/iu.exec(content);
  if (!match) return undefined;
  const token = match[1];
  return token ? aliases.get(token.toLowerCase()) : "help";
}

class PrefixRateLimiter {
  private readonly users = new Map<string, number>();
  private readonly guilds = new Map<string, number[]>();

  allow(guildId: string, userId: string, now: number): boolean {
    this.prune(now);
    const userKey = `${guildId}:${userId}`;
    if ((this.users.get(userKey) ?? 0) > now) return false;
    const guildWindow = (this.guilds.get(guildId) ?? [])
      .filter((timestamp) => timestamp > now - GUILD_WINDOW_MS);
    if (guildWindow.length >= GUILD_WINDOW_MAX) {
      this.guilds.set(guildId, guildWindow);
      return false;
    }
    this.users.set(userKey, now + USER_COOLDOWN_MS);
    guildWindow.push(now);
    this.guilds.set(guildId, guildWindow);
    return true;
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.users) {
      if (expiresAt <= now) this.users.delete(key);
    }
    for (const [key, timestamps] of this.guilds) {
      const active = timestamps.filter((timestamp) => timestamp > now - GUILD_WINDOW_MS);
      if (active.length) this.guilds.set(key, active);
      else this.guilds.delete(key);
    }
    while (this.users.size > MAX_RATE_LIMIT_KEYS) {
      const oldest = this.users.keys().next().value as string | undefined;
      if (!oldest) break;
      this.users.delete(oldest);
    }
  }
}

export class YoroPrefixCommandHandler {
  private readonly limiter = new PrefixRateLimiter();

  constructor(
    private readonly applicationId: string,
    private readonly internalApi: Pick<DiscordInternalApiClient, "gameServerStatus">,
    private readonly publicBaseUrl: string,
    private readonly now: () => number = Date.now
  ) {}

  async handle(message: Message): Promise<void> {
    if (
      !message.guildId
      || !message.guild
      || message.author.bot
      || message.webhookId
      || message.system
    ) return;
    const command = parseYoroPrefixCommand(message.content);
    if (!command) return;
    if (!this.limiter.allow(message.guildId, message.author.id, this.now())) {
      auditEvent("discord.prefix_command.rate_limited", {
        guild: safeReference(message.guildId),
        user: safeReference(message.author.id)
      });
      return;
    }
    const locale = localeFor(message.guild.preferredLocale);
    const messages = text[locale];
    auditEvent("discord.prefix_command.received", {
      command,
      guild: safeReference(message.guildId),
      user: safeReference(message.author.id)
    });
    if (command === "help") {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(messages.helpTitle)
            .setDescription(messages.helpBody)
        ],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    if (command === "guide") {
      const guideUrl = new URL("/bot/dedicated-server", this.publicBaseUrl).toString();
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(messages.guideTitle)
            .setDescription(messages.guideBody)
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel(messages.guideButton)
              .setURL(guideUrl)
          )
        ],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    await this.replyStatus(message, messages);
  }

  private async replyStatus(
    message: Message,
    messages: (typeof text)[keyof typeof text]
  ): Promise<void> {
    let result: DiscordGameServerStatusResponse;
    try {
      result = await this.internalApi.gameServerStatus({
        applicationId: this.applicationId,
        guildId: message.guildId!
      });
    } catch {
      await message.reply({
        content: messages.unavailable,
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    const dashboardUrl = new URL("/dashboard/organizations", this.publicBaseUrl).toString();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(messages.dashboardButton)
        .setURL(dashboardUrl)
    );
    if (!result.connected || !result.server) {
      await message.reply({
        content: result.connected
          ? messages.serverNotConfigured
          : messages.guildNotConnected,
        components: [row],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    const server = result.server;
    const observedAt = server.observedAt
      ? discordTimestamp(server.observedAt)
      : undefined;
    const embed = new EmbedBuilder()
      .setColor(statusColor(server.status))
      .setTitle(messages.statusTitle)
      .setDescription(safeDiscordText(server.displayName))
      .addFields({
        name: messages.fields.status,
        value: messages.states[server.status],
        inline: true
      });
    if (server.players) {
      embed.addFields({
        name: messages.fields.players,
        value: `${server.players.current} / ${server.players.max}`,
        inline: true
      });
    }
    if (server.version) {
      embed.addFields({
        name: messages.fields.version,
        value: safeDiscordText(server.version),
        inline: true
      });
    }
    if (server.latencyMs !== undefined) {
      embed.addFields({
        name: messages.fields.latency,
        value: `${server.latencyMs}ms`,
        inline: true
      });
    }
    if (observedAt) {
      embed.addFields({
        name: messages.fields.observedAt,
        value: observedAt,
        inline: true
      });
    }
    await message.reply({
      embeds: [embed],
      components: [row],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: true
    });
  }
}
