import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  discordBotHelpBody,
  discordBotMessageLocale
} from "@streamops/shared";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { DiscordInternalApiError } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";

const INTERACTION_TTL_MS = 15 * 60 * 1_000;
const MAX_INTERACTIONS = 10_000;

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
      "issueSetupSession" | "commandPolicy"
    >,
    private readonly now: () => number = Date.now,
    private readonly dashboardUrl = "http://localhost:3000/dashboard/organizations",
    private readonly prefixCommandsEnabled = false
  ) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName !== "yoro") return;
    if (this.seen(interaction.id)) return;
    this.remember(interaction.id);
    const locale = discordBotMessageLocale(interaction.locale);
    const text = DISCORD_BOT_MESSAGES[locale].slash;
    const subcommand = interaction.options.getSubcommand(false);
    auditEvent("discord.command.received", {
      command: subcommand ?? "unknown",
      interaction: safeReference(interaction.id),
      guild: interaction.guildId ? safeReference(interaction.guildId) : undefined,
      user: safeReference(interaction.user.id)
    });

    if (subcommand === "help") {
      let prefixHelp = "";
      if (this.prefixCommandsEnabled && interaction.guildId) {
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
            prefixHelp = [
              "",
              policyText.prefixHelpTitle,
              discordBotHelpBody(policyLocale, policy.commands)
            ].join("\n");
          }
        } catch {
          // 내부 정책 조회 실패 시 안전하게 slash 명령 도움말만 표시합니다.
        }
      }
      await interaction.reply({
        content: `${text.help}${prefixHelp}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      });
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
