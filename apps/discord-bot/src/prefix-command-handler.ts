import {
  EmbedBuilder,
  type Message
} from "discord.js";
import {
  DISCORD_BOT_PREFIX_COMMAND_MANIFEST,
  DISCORD_BOT_MESSAGES,
  discordBotPrefixCommandDefinition,
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
  nickname?: string;
}>;

const aliases = new Map<string, YoroPrefixCommand>();
for (const definition of DISCORD_BOT_PREFIX_COMMAND_MANIFEST) {
  for (const alias of definition.aliases) {
    if (!alias) continue;
    aliases.set(alias, definition.command);
  }
}

export function parseYoroPrefixCommand(
  content: string
): ParsedYoroPrefixCommand | undefined {
  if (content.length > MAX_MESSAGE_LENGTH) return undefined;
  const match = /^!yoro(?:\s+(\S+)(?:\s+(.+?))?)?\s*$/iu.exec(content);
  if (!match) return undefined;
  const token = match[1];
  const command = token
    ? aliases.get(token.toLowerCase())
    : "help";
  if (!command) return undefined;
  const nickname = match[2]?.trim();
  if (
    nickname !== undefined
    && (
      command !== "player"
      || nickname.length < 1
      || nickname.length > 80
      || /[\u0000-\u001f\u007f]/u.test(nickname)
    )
  ) return undefined;
  return Object.freeze({
    command,
    ...(nickname === undefined ? {} : { nickname })
  });
}

function commandResponseLocale(
  preferredLocale: "auto" | DiscordBotMessageLocale,
  fallbackLocale: DiscordBotMessageLocale
): DiscordBotMessageLocale {
  return preferredLocale === "auto" ? fallbackLocale : preferredLocale;
}

export function localizedPublicResourceUrl(
  publicBaseUrl: string,
  locale: DiscordBotMessageLocale,
  pathname: "/palworld" | "/bot/game-files"
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
  private readonly inFlight = new Set<string>();

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
    const inFlightKey = `${message.guildId}:${message.author.id}:${parsed.command}`;
    if (this.inFlight.has(inFlightKey)) {
      auditEvent("discord.prefix_command.duplicate_in_flight", {
        command: parsed.command,
        guild: safeReference(message.guildId),
        user: safeReference(message.author.id)
      });
      return;
    }
    this.inFlight.add(inFlightKey);
    const startedAt = Date.now();
    this.auditTiming(message, parsed.command, "gateway_received", startedAt);
    try {
      const task = () => this.handleParsed(message, parsed);
      if (discordBotPrefixCommandDefinition(parsed.command).showTyping) {
        await this.withTyping(message, task);
      } else {
        await task();
      }
    } finally {
      this.auditTiming(message, parsed.command, "handler_complete", startedAt);
      this.inFlight.delete(inFlightKey);
    }
  }

  private async handleParsed(
    message: Message,
    parsed: ParsedYoroPrefixCommand
  ): Promise<void> {
    const { command } = parsed;
    const guildId = message.guildId!;
    const guild = message.guild!;
    if (!this.limiter.allow(guildId, message.author.id, this.now())) {
      auditEvent("discord.prefix_command.rate_limited", {
        guild: safeReference(guildId),
        user: safeReference(message.author.id)
      });
      return;
    }
    const fallbackLocale = discordBotMessageLocale(guild.preferredLocale);
    let policy: DiscordBotCommandPolicyResponse;
    const policyStartedAt = Date.now();
    try {
      policy = await this.internalApi.commandPolicy({
        applicationId: this.applicationId,
        guildId,
        command
      });
      this.auditTiming(message, command, "command_policy", policyStartedAt);
    } catch (error) {
      this.auditTiming(
        message,
        command,
        "command_policy",
        policyStartedAt,
        internalFailureCode(error)
      );
      auditEvent("discord.prefix_command.internal_api_failed", {
        command,
        stage: "policy",
        errorCode: internalFailureCode(error),
        guild: safeReference(guildId)
      });
      await message.reply({
        content: internalFailureMessage(
          fallbackLocale,
          error
        ),
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: true
      });
      return;
    }
    if (!policy.allowed) {
      const deniedLocale = commandResponseLocale(
        policy.preferredLocale,
        fallbackLocale
      );
      auditEvent("discord.prefix_command.denied", {
        command,
        guild: safeReference(guildId),
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
      "/bot/game-files"
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
      guild: safeReference(guildId),
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

  private auditTiming(
    message: Message,
    command: YoroPrefixCommand,
    stage: string,
    startedAt: number,
    errorCode?: InternalFailureCode
  ): void {
    auditEvent("discord.command.timing", {
      command,
      guild: safeReference(message.guildId!),
      user: safeReference(message.author.id),
      stage,
      durationMs: Math.max(0, Date.now() - startedAt),
      ...(errorCode ? { errorCode } : {})
    });
  }

  private async withTyping<T>(
    message: Message,
    task: () => Promise<T>
  ): Promise<T> {
    const channel = message.channel;
    if (!channel) return task();
    const sendTyping = "sendTyping" in channel && typeof channel.sendTyping === "function"
      ? () => channel.sendTyping()
      : undefined;
    if (!sendTyping) return task();
    const send = async () => {
      try {
        await sendTyping();
      } catch {
        auditEvent("discord.prefix_command.typing_failed", {
          guild: safeReference(message.guildId!)
        });
      }
    };
    await send();
    const timer = setInterval(() => {
      void send();
    }, 8_000);
    timer.unref?.();
    try {
      return await task();
    } finally {
      clearInterval(timer);
    }
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
    const requestStartedAt = Date.now();
    try {
      response = await this.internalApi.palworldPlayers({
        applicationId: this.applicationId,
        guildId: message.guildId!,
        ...(nickname ? { nickname } : {})
      });
      this.auditTiming(message, "player", "palworld_rest", requestStartedAt);
    } catch (error) {
      this.auditTiming(
        message,
        "player",
        "palworld_rest",
        requestStartedAt,
        internalFailureCode(error)
      );
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
    const embedStartedAt = Date.now();
    const embed = presentPalworldPlayers({
      locale,
      response,
      searchHint: messages.playerSearchHint
    });
    this.auditTiming(message, "player", "embed_build", embedStartedAt);
    const replyStartedAt = Date.now();
    await message.reply({
      embeds: [
        embed
      ],
      allowedMentions: { parse: [], repliedUser: false },
      failIfNotExists: true
    });
    this.auditTiming(message, "player", "discord_reply", replyStartedAt);
  }

  private async replyStatus(
    message: Message,
    locale: DiscordBotMessageLocale,
    statusFields: DiscordBotStatusFields
  ): Promise<void> {
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    let result: DiscordGameServerStatusResponse;
    const requestStartedAt = Date.now();
    try {
      result = await this.internalApi.gameServerStatus({
        applicationId: this.applicationId,
        guildId: message.guildId!
      });
      this.auditTiming(message, "status", "palworld_rest", requestStartedAt);
    } catch (error) {
      this.auditTiming(
        message,
        "status",
        "palworld_rest",
        requestStartedAt,
        internalFailureCode(error)
      );
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
        "/bot/game-files"
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
