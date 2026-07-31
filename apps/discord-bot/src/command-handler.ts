import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  DISCORD_BOT_CONTROL_LOCALES,
  discordBotHelpBody,
  discordBotPrivateHelpBody,
  discordBotMessageLocale
} from "@streamops/shared";
import type {
  DiscordBotControlCommand,
  DiscordBotControlLocale,
  DiscordBotMessageLocale,
  DiscordBotCommandPolicyResponse,
  DiscordGameServerStatusResponse,
  DiscordPalworldPlayerLookupResponse
} from "@streamops/shared";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { DiscordInternalApiError } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";
import { discordResourceLinks } from "./message-actions.js";
import {
  presentPalworldPlayerActions,
  presentPalworldPlayers
} from "./player-message-presenter.js";
import {
  presentGameServerNotice,
  presentGameServerStatus
} from "./status-message-presenter.js";

const INTERACTION_TTL_MS = 15 * 60 * 1_000;
const MAX_INTERACTIONS = 10_000;

function privateCommandFailureMessage(
  locale: DiscordBotMessageLocale,
  error: unknown
): string {
  const code = error instanceof DiscordInternalApiError
    ? error.code
    : "unexpected";
  return DISCORD_BOT_MESSAGES[locale].prefix.internalFailure[code];
}

export function hasSetupPermission(interaction: Pick<
  ChatInputCommandInteraction,
  "guild" | "memberPermissions" | "user"
>): boolean {
  if (interaction.guild?.ownerId === interaction.user.id) return true;
  const permissions = interaction.memberPermissions?.bitfield;
  if (permissions === undefined) return false;
  return (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
    || (permissions & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
}

export class YoroCommandHandler {
  private readonly interactions = new Map<string, number>();

  constructor(
    private readonly applicationId: string,
    private readonly internalApi: Pick<
      DiscordInternalApiClient,
      | "issueSetupSession"
      | "commandPolicy"
      | "gameServerStatus"
      | "palworldPlayers"
      | "updateResponseLocale"
    >,
    private readonly now: () => number = Date.now,
    private readonly dashboardUrl = "http://localhost:3000/dashboard/organizations",
    private readonly prefixCommandsEnabled = false
  ) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName !== "yoro") return;
    if (this.seen(interaction.id)) return;
    this.remember(interaction.id);
    const locale = discordBotMessageLocale(
      interaction.guildLocale ?? interaction.locale
    );
    const text = DISCORD_BOT_MESSAGES[locale].slash;
    const subcommand = interaction.options.getSubcommand(false);
    auditEvent("discord.command.received", {
      command: subcommand ?? "unknown",
      interaction: safeReference(interaction.id),
      guild: interaction.guildId ? safeReference(interaction.guildId) : undefined,
      user: safeReference(interaction.user.id)
    });

    if (subcommand === "help") {
      let privateHelp = "";
      let prefixHelp = "";
      if (interaction.guildId) {
        try {
          const policy = await this.internalApi.commandPolicy({
            applicationId: this.applicationId,
            guildId: interaction.guildId,
            command: "help"
          });
          if (policy.allowed) {
            const policyLocale = policy.preferredLocale === "auto"
              ? locale
              : policy.preferredLocale;
            const policyText = DISCORD_BOT_MESSAGES[policyLocale].slash;
            const privateBody = discordBotPrivateHelpBody(
              policyLocale,
              policy.commands
            );
            privateHelp = privateBody
              ? [
                  "",
                  policyText.privateHelpTitle,
                  privateBody
                ].join("\n")
              : "";
            prefixHelp = this.prefixCommandsEnabled
              ? [
              "",
              policyText.prefixHelpTitle,
              discordBotHelpBody(policyLocale, policy.commands)
                ].join("\n")
              : "";
          }
        } catch {
          // 내부 정책 조회 실패 시 안전하게 slash 명령 도움말만 표시합니다.
        }
      }
      const prefixMessages = DISCORD_BOT_MESSAGES[locale].prefix;
      const resources = discordResourceLinks({
        primaryUrl: this.dashboardUrl,
        primaryLabel: text.dashboardButton,
        guideUrl: new URL(
          "/bot/game-files",
          this.dashboardUrl
        ).toString(),
        guideLabel: prefixMessages.guideButton
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`🤖 ${prefixMessages.helpTitle}`)
            .setDescription(`${text.help}${privateHelp}${prefixHelp}`)
            .setFooter({ text: prefixMessages.charts.footer })
        ],
        components: [resources],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (
      subcommand === "status"
      || subcommand === "player"
      || subcommand === "guide"
    ) {
      await this.handlePrivateCommand(interaction, subcommand, locale);
      return;
    }
    if (subcommand === "language") {
      await this.handleLanguageCommand(interaction, locale);
      return;
    }
    if (subcommand === "dashboard") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(text.dashboardButton)
          .setStyle(ButtonStyle.Link)
          .setURL(this.dashboardUrl)
      );
      await interaction.reply({
        content: text.dashboardTitle,
        components: [row],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (subcommand !== "setup") {
      await interaction.reply({
        content: text.unknown,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (!interaction.inGuild() || !interaction.guildId) {
      auditEvent("discord.command.denied", { result: "guild_required" });
      await interaction.reply({
        content: text.dmDenied,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (!hasSetupPermission(interaction)) {
      auditEvent("discord.command.denied", { result: "permission_required" });
      await interaction.reply({
        content: text.permissionDenied,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const setup = await this.internalApi.issueSetupSession({
        applicationId: this.applicationId,
        guildId: interaction.guildId,
        interactionId: interaction.id,
        userId: interaction.user.id
      });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(text.setupButton)
          .setStyle(ButtonStyle.Link)
          .setURL(setup.url)
      );
      await interaction.editReply({
        content: `${text.setupTitle}\n${text.setupBody}`,
        components: [row],
        allowedMentions: { parse: [] }
      });
      auditEvent("discord.setup.issued", {
        interaction: safeReference(interaction.id),
        result: "issued"
      });
    } catch (error) {
      const active = error instanceof DiscordInternalApiError && error.code === "rejected";
      await interaction.editReply({
        content: active ? text.setupActive : text.setupUnavailable,
        components: [],
        allowedMentions: { parse: [] }
      });
      auditEvent("discord.command.denied", {
        command: "setup",
        result: active ? "setup_active" : "service_unavailable"
      });
    }
  }

  private async handleLanguageCommand(
    interaction: ChatInputCommandInteraction,
    fallbackLocale: DiscordBotMessageLocale
  ): Promise<void> {
    const fallbackText = DISCORD_BOT_MESSAGES[fallbackLocale].slash;
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: fallbackText.dmDenied,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (!hasSetupPermission(interaction)) {
      auditEvent("discord.command.denied", {
        command: "language",
        result: "permission_required",
        guild: safeReference(interaction.guildId),
        user: safeReference(interaction.user.id)
      });
      await interaction.reply({
        content: fallbackText.permissionDenied,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    const requested = interaction.options.getString("locale", true);
    if (!DISCORD_BOT_CONTROL_LOCALES.includes(
      requested as DiscordBotControlLocale
    )) {
      await interaction.reply({
        content: fallbackText.unknown,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    const preferredLocale = requested as DiscordBotControlLocale;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await this.internalApi.updateResponseLocale({
        applicationId: this.applicationId,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        preferredLocale
      });
      const responseLocale = preferredLocale === "auto"
        ? discordBotMessageLocale(interaction.guildLocale ?? interaction.locale)
        : preferredLocale;
      const responseText = DISCORD_BOT_MESSAGES[responseLocale].slash;
      await interaction.editReply({
        content: preferredLocale === "auto"
          ? responseText.languageAutoUpdated
          : responseText.languageUpdated,
        allowedMentions: { parse: [] }
      });
      auditEvent("discord.command.language_updated", {
        command: "language",
        guild: safeReference(interaction.guildId),
        user: safeReference(interaction.user.id),
        locale: preferredLocale
      });
    } catch (error) {
      await interaction.editReply({
        content: fallbackText.languageUnavailable,
        allowedMentions: { parse: [] }
      });
      auditEvent("discord.command.language_failed", {
        command: "language",
        guild: safeReference(interaction.guildId),
        user: safeReference(interaction.user.id),
        errorCode: error instanceof DiscordInternalApiError
          ? error.code
          : "unexpected"
      });
    }
  }

  private async handlePrivateCommand(
    interaction: ChatInputCommandInteraction,
    command: Extract<DiscordBotControlCommand, "status" | "player" | "guide">,
    fallbackLocale: DiscordBotMessageLocale
  ): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: DISCORD_BOT_MESSAGES[fallbackLocale].slash.dmDenied,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let policy: DiscordBotCommandPolicyResponse;
    try {
      policy = await this.internalApi.commandPolicy({
        applicationId: this.applicationId,
        guildId: interaction.guildId,
        command
      });
    } catch (error) {
      auditEvent("discord.command.private_failed", {
        command,
        stage: "policy",
        guild: safeReference(interaction.guildId)
      });
      await interaction.editReply({
        content: privateCommandFailureMessage(fallbackLocale, error),
        allowedMentions: { parse: [] }
      });
      return;
    }
    const locale = policy.preferredLocale === "auto"
      ? fallbackLocale
      : policy.preferredLocale;
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    if (!policy.allowed) {
      await interaction.editReply({
        content: messages.policyDenied[
          policy.reason ?? "command_disabled"
        ],
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (command === "guide") {
      const row = discordResourceLinks({
        primaryUrl: this.dashboardUrl,
        primaryLabel: DISCORD_BOT_MESSAGES[locale].slash.dashboardButton,
        guideUrl: new URL(
          "/bot/game-files",
          this.dashboardUrl
        ).toString(),
        guideLabel: messages.guideButton
      });
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📘 ${messages.guideTitle}`)
            .setDescription(messages.guideBody)
            .setFooter({ text: messages.charts.footer })
        ],
        components: [row],
        allowedMentions: { parse: [] }
      });
      return;
    }
    if (command === "player") {
      await this.replyPrivatePlayers(interaction, locale);
      return;
    }
    await this.replyPrivateStatus(interaction, locale, policy);
  }

  private async replyPrivatePlayers(
    interaction: ChatInputCommandInteraction,
    locale: DiscordBotMessageLocale
  ): Promise<void> {
    const nickname = interaction.options.getString("nickname")?.trim();
    if (
      nickname !== undefined
      && (
        nickname.length < 1
        || nickname.length > 80
        || /[\u0000-\u001f\u007f]/u.test(nickname)
      )
    ) {
      await interaction.editReply({
        content: DISCORD_BOT_MESSAGES[locale].slash.unknown,
        allowedMentions: { parse: [] }
      });
      return;
    }
    let response: DiscordPalworldPlayerLookupResponse;
    try {
      response = await this.internalApi.palworldPlayers({
        applicationId: this.applicationId,
        guildId: interaction.guildId!,
        ...(nickname ? { nickname } : {})
      });
    } catch (error) {
      auditEvent("discord.command.private_failed", {
        command: "player",
        stage: "status",
        guild: safeReference(interaction.guildId!)
      });
      await interaction.editReply({
        content: privateCommandFailureMessage(locale, error),
        allowedMentions: { parse: [] }
      });
      return;
    }
    const actions = presentPalworldPlayerActions({
      locale,
      response,
      publicBaseUrl: this.dashboardUrl
    });
    await interaction.editReply({
      embeds: [
        presentPalworldPlayers({
          locale,
          response,
          searchHint: DISCORD_BOT_MESSAGES[locale].slash.playerSearchHint
        })
      ],
      ...(actions ? { components: [actions] } : {}),
      allowedMentions: { parse: [] }
    });
  }

  private async replyPrivateStatus(
    interaction: ChatInputCommandInteraction,
    locale: DiscordBotMessageLocale,
    policy: DiscordBotCommandPolicyResponse
  ): Promise<void> {
    const messages = DISCORD_BOT_MESSAGES[locale].prefix;
    let result: DiscordGameServerStatusResponse;
    try {
      result = await this.internalApi.gameServerStatus({
        applicationId: this.applicationId,
        guildId: interaction.guildId!
      });
    } catch (error) {
      auditEvent("discord.command.private_failed", {
        command: "status",
        stage: "status",
        guild: safeReference(interaction.guildId!)
      });
      await interaction.editReply({
        content: privateCommandFailureMessage(locale, error),
        allowedMentions: { parse: [] }
      });
      return;
    }
    const row = discordResourceLinks({
      primaryUrl: this.dashboardUrl,
      primaryLabel: DISCORD_BOT_MESSAGES[locale].slash.dashboardButton,
      guideUrl: new URL(
        "/bot/game-files",
        this.dashboardUrl
      ).toString(),
      guideLabel: messages.guideButton
    });
    if (!result.connected || !result.server) {
      await interaction.editReply({
        embeds: [
          presentGameServerNotice({
            locale,
            description: result.connected
              ? messages.serverNotConfigured
              : messages.guildNotConnected
          })
        ],
        components: [row],
        allowedMentions: { parse: [] }
      });
      return;
    }
    const presentation = presentGameServerStatus({
      locale,
      server: result.server,
      statusFields: policy.statusFields
    });
    await interaction.editReply({
      embeds: [presentation],
      components: [row],
      allowedMentions: { parse: [] }
    });
  }

  private seen(id: string): boolean {
    this.prune();
    return this.interactions.has(id);
  }

  private remember(id: string): void {
    this.interactions.set(id, this.now() + INTERACTION_TTL_MS);
    while (this.interactions.size > MAX_INTERACTIONS) {
      const oldest = this.interactions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.interactions.delete(oldest);
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [id, expiresAt] of this.interactions) {
      if (expiresAt <= now) this.interactions.delete(id);
    }
  }
}
