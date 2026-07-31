import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  DiscordGameServerStatusResponse
} from "@streamops/shared";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";
import { presentGameServerStatus } from "./status-message-presenter.js";

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
    private readonly internalApi: Pick<
      DiscordInternalApiClient,
      "commandPolicy" | "gameServerStatus"
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
    const command = parseYoroPrefixCommand(message.content);
    if (!command) return;
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
    } catch {
      await message.reply({
        content: DISCORD_BOT_MESSAGES[fallbackLocale].prefix.unavailable,
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    if (!policy.allowed) {
      const deniedLocale = policy.preferredLocale === "auto"
        ? fallbackLocale
        : policy.preferredLocale;
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
      return;
    }
    const locale = policy.preferredLocale === "auto"
      ? fallbackLocale
      : policy.preferredLocale;
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
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
            .setDescription(discordBotHelpBody(locale, policy.commands))
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
    await this.replyStatus(message, locale, policy.statusFields);
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
    const presentation = presentGameServerStatus({ locale, server, statusFields });
    await message.reply({
      embeds: [presentation.embed],
      components: presentation.needsDashboardAction ? [row] : [],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: true
    });
  }
}
