import {
  EmbedBuilder,
  type Message
} from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  discordBotHelpBody,
  discordBotMessageLocale,
  type DiscordBotMessageLocale,
  DiscordBotCommandPolicyResponse,
  DiscordBotStatusFields,
  DiscordGameServerStatusResponse,
  DiscordPalworldPlayerLookupResponse
} from "@streamops/shared";
import {
  DiscordInternalApiError,
  type DiscordInternalApiClient
} from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";
import { discordResourceLinks } from "./message-actions.js";
import { presentPalworldPlayers } from "./player-message-presenter.js";
import {
  presentGameServerNotice,
  presentGameServerStatus
} from "./status-message-presenter.js";

const MAX_MESSAGE_LENGTH = 100;
const USER_COOLDOWN_MS = 10_000;
const GUILD_WINDOW_MS = 5_000;
const GUILD_WINDOW_MAX = 5;
const MAX_RATE_LIMIT_KEYS = 10_000;

type InternalFailureCode =
  | DiscordInternalApiError["code"]
  | "unexpected";

function internalFailureCode(error: unknown): InternalFailureCode {
  return error instanceof DiscordInternalApiError ? error.code : "unexpected";
}

function internalFailureMessage(
  locale: DiscordBotMessageLocale,
  error: unknown
): string {
  return DISCORD_BOT_MESSAGES[locale].prefix.internalFailure[
    internalFailureCode(error)
  ];
}

export type YoroPrefixCommand = "help" | "status" | "player" | "guide";

export type ParsedYoroPrefixCommand = Readonly<{
  command: YoroPrefixCommand;
  localeHint?: DiscordBotMessageLocale;
  nickname?: string;
}>;

type YoroPrefixAlias = Readonly<{
  command: YoroPrefixCommand;
  localeHint?: DiscordBotMessageLocale;
}>;

const aliases = new Map<string, YoroPrefixAlias>([
  ["명령어", { command: "help", localeHint: "ko" }],
  ["도움말", { command: "help", localeHint: "ko" }],
  ["도움", { command: "help", localeHint: "ko" }],
  ["help", { command: "help" }],
  ["コマンド", { command: "help", localeHint: "ja" }],
  ["ヘルプ", { command: "help", localeHint: "ja" }],
  ["상태", { command: "status", localeHint: "ko" }],
  ["서버상태", { command: "status", localeHint: "ko" }],
  ["status", { command: "status" }],
  ["ステータス", { command: "status", localeHint: "ja" }],
  ["状態", { command: "status", localeHint: "ja" }],
  ["サーバー状態", { command: "status", localeHint: "ja" }],
  ["플레이어", { command: "player", localeHint: "ko" }],
  ["접속자", { command: "player", localeHint: "ko" }],
  ["player", { command: "player" }],
  ["players", { command: "player" }],
  ["プレイヤー", { command: "player", localeHint: "ja" }],
  ["プレーヤー", { command: "player", localeHint: "ja" }],
  ["가이드", { command: "guide", localeHint: "ko" }],
  ["안내", { command: "guide", localeHint: "ko" }],
  ["guide", { command: "guide" }],
  ["ガイド", { command: "guide", localeHint: "ja" }],
  ["案内", { command: "guide", localeHint: "ja" }]
]);

export function parseYoroPrefixCommand(
  content: string
): ParsedYoroPrefixCommand | undefined {
  if (content.length > MAX_MESSAGE_LENGTH) return undefined;
  const match = /^!yoro(?:\s+(\S+)(?:\s+(.+?))?)?\s*$/iu.exec(content);
  if (!match) return undefined;
  const token = match[1];
  const alias = token
    ? aliases.get(token.toLowerCase())
    : { command: "help" as const };
  if (!alias) return undefined;
  const nickname = match[2]?.trim();
  if (
    nickname !== undefined
    && (
      alias.command !== "player"
      || nickname.length < 1
      || nickname.length > 80
      || /[\u0000-\u001f\u007f]/u.test(nickname)
    )
  ) return undefined;
  return Object.freeze({
    command: alias.command,
    ...(alias.localeHint === undefined ? {} : { localeHint: alias.localeHint }),
    ...(nickname === undefined ? {} : { nickname })
  });
}

function commandResponseLocale(
  parsed: ParsedYoroPrefixCommand,
  preferredLocale: "auto" | DiscordBotMessageLocale,
  fallbackLocale: DiscordBotMessageLocale
): DiscordBotMessageLocale {
  if (parsed.localeHint) return parsed.localeHint;
  return preferredLocale === "auto" ? fallbackLocale : preferredLocale;
}

export function localizedPublicResourceUrl(
  publicBaseUrl: string,
  locale: DiscordBotMessageLocale,
  pathname: "/palworld" | "/bot/dedicated-server"
): string {
  return new URL(`/${locale}${pathname}`, publicBaseUrl).toString();
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
    private readonly internalApi: Pick<
      DiscordInternalApiClient,
      "commandPolicy" | "gameServerStatus" | "palworldPlayers"
    >,
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
    const parsed = parseYoroPrefixCommand(message.content);
    if (!parsed) return;
    const { command } = parsed;
    if (!this.limiter.allow(message.guildId, message.author.id, this.now())) {
      auditEvent("discord.prefix_command.rate_limited", {
        guild: safeReference(message.guildId),
        user: safeReference(message.author.id)
      });
      return;
    }
    const fallbackLocale = discordBotMessageLocale(message.guild.preferredLocale);
    let policy: DiscordBotCommandPolicyResponse;
    try {
      policy = await this.internalApi.commandPolicy({
        applicationId: this.applicationId,
        guildId: message.guildId,
        command
      });
    } catch (error) {
      auditEvent("discord.prefix_command.internal_api_failed", {
        command,
        stage: "policy",
        errorCode: internalFailureCode(error),
        guild: safeReference(message.guildId)
      });
      await message.reply({
        content: internalFailureMessage(
          parsed.localeHint ?? fallbackLocale,
          error
        ),
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    if (!policy.allowed) {
      const deniedLocale = commandResponseLocale(
        parsed,
        policy.preferredLocale,
        fallbackLocale
      );
      auditEvent("discord.prefix_command.denied", {
        command,
        guild: safeReference(message.guildId),
        reason: policy.reason
      });
      await message.reply({
        content: DISCORD_BOT_MESSAGES[deniedLocale].prefix.policyDenied[
          policy.reason ?? "command_disabled"
        ],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      await this.deleteInvocationAfterReply(
        message,
        policy.deleteInvocationAfterReply
      );
      return;
    }
    const locale = commandResponseLocale(
      parsed,
      policy.preferredLocale,
      fallbackLocale
    );
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    const palworldHomeUrl = localizedPublicResourceUrl(
      this.publicBaseUrl,
      locale,
      "/palworld"
    );
    const guideUrl = localizedPublicResourceUrl(
      this.publicBaseUrl,
      locale,
      "/bot/dedicated-server"
    );
    const resources = discordResourceLinks({
      primaryUrl: palworldHomeUrl,
      primaryLabel: messages.palworldHomeButton,
      primaryEmoji: "🏠",
      guideUrl,
      guideLabel: messages.guideButton
    });
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
            .setTitle(`🤖 ${messages.helpTitle}`)
            .setDescription(discordBotHelpBody(locale, policy.commands))
            .setFooter({ text: messages.charts.footer })
        ],
        components: [resources],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      await this.deleteInvocationAfterReply(
        message,
        policy.deleteInvocationAfterReply
      );
      return;
    }
    if (command === "guide") {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📘 ${messages.guideTitle}`)
            .setDescription(messages.guideBody)
            .setFooter({ text: messages.charts.footer })
        ],
        components: [resources],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      await this.deleteInvocationAfterReply(
        message,
        policy.deleteInvocationAfterReply
      );
      return;
    }
    if (command === "player") {
      await this.replyPlayers(message, locale, parsed.nickname);
      await this.deleteInvocationAfterReply(
        message,
        policy.deleteInvocationAfterReply
      );
      return;
    }
    await this.replyStatus(message, locale, policy.statusFields);
    await this.deleteInvocationAfterReply(
      message,
      policy.deleteInvocationAfterReply
    );
  }

  private async deleteInvocationAfterReply(
    message: Message,
    enabled: boolean
  ): Promise<void> {
    if (!enabled) return;
    if (!message.deletable) {
      auditEvent("discord.prefix_command.delete_skipped", {
        guild: safeReference(message.guildId!),
        reason: "permission_required"
      });
      return;
    }
    try {
      await message.delete();
      auditEvent("discord.prefix_command.deleted", {
        guild: safeReference(message.guildId!)
      });
    } catch {
      auditEvent("discord.prefix_command.delete_failed", {
        guild: safeReference(message.guildId!)
      });
    }
  }

  private async replyPlayers(
    message: Message,
    locale: DiscordBotMessageLocale,
    nickname?: string
  ): Promise<void> {
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    let response: DiscordPalworldPlayerLookupResponse;
    try {
      response = await this.internalApi.palworldPlayers({
        applicationId: this.applicationId,
        guildId: message.guildId!,
        ...(nickname ? { nickname } : {})
      });
    } catch (error) {
      auditEvent("discord.prefix_command.internal_api_failed", {
        command: "player",
        stage: "status",
        errorCode: internalFailureCode(error),
        guild: safeReference(message.guildId!)
      });
      await message.reply({
        content: internalFailureMessage(locale, error),
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    await message.reply({
      embeds: [
        presentPalworldPlayers({
          locale,
          response,
          searchHint: messages.playerSearchHint
        })
      ],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: true
    });
  }

  private async replyStatus(
    message: Message,
    locale: DiscordBotMessageLocale,
    statusFields: DiscordBotStatusFields
  ): Promise<void> {
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    let result: DiscordGameServerStatusResponse;
    try {
      result = await this.internalApi.gameServerStatus({
        applicationId: this.applicationId,
        guildId: message.guildId!
      });
    } catch (error) {
      auditEvent("discord.prefix_command.internal_api_failed", {
        command: "status",
        stage: "status",
        errorCode: internalFailureCode(error),
        guild: safeReference(message.guildId!)
      });
      await message.reply({
        content: internalFailureMessage(locale, error),
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    const row = discordResourceLinks({
      primaryUrl: localizedPublicResourceUrl(
        this.publicBaseUrl,
        locale,
        "/palworld"
      ),
      primaryLabel: messages.palworldHomeButton,
      primaryEmoji: "🏠",
      guideUrl: localizedPublicResourceUrl(
        this.publicBaseUrl,
        locale,
        "/bot/dedicated-server"
      ),
      guideLabel: messages.guideButton
    });
    if (!result.connected || !result.server) {
      await message.reply({
        embeds: [
          presentGameServerNotice({
            locale,
            description: result.connected
              ? messages.serverNotConfigured
              : messages.guildNotConnected
          })
        ],
        components: [row],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    const server = result.server;
    const presentation = presentGameServerStatus({ locale, server, statusFields });
    await message.reply({
      embeds: [presentation],
      components: [row],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: true
    });
  }
}
