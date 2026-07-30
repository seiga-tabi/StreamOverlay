import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from "discord.js";
import type { DiscordInternalApiClient } from "./internal-api-client.js";
import { DiscordInternalApiError } from "./internal-api-client.js";
import { auditEvent, safeReference } from "./logger.js";

const INTERACTION_TTL_MS = 15 * 60 * 1_000;
const MAX_INTERACTIONS = 10_000;

const messages = {
  ko: {
    dmDenied: "이 명령은 Discord 서버 안에서만 사용할 수 있습니다.",
    permissionDenied: "서버 소유자 또는 서버 관리 권한이 있는 사용자만 실행할 수 있습니다.",
    setupTitle: "YORO Bot 설정은 웹 Dashboard에서 진행할 수 있습니다.",
    setupBody: "아래 링크에서 Discord 서버 연결을 완료해 주세요. 링크는 10분 후 만료되며 한 번만 사용할 수 있습니다.",
    setupButton: "웹에서 서버 연결하기",
    dashboardTitle: "YORO Bot 관리 화면",
    dashboardButton: "Dashboard 열기",
    setupUnavailable: "설정 링크를 발급할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    setupActive: "이미 진행 중인 설정 링크가 있습니다. 기존 링크가 만료된 뒤 다시 시도해 주세요.",
    help: [
      "**/yoro setup**",
      "웹 Dashboard에서 Discord 서버와 YORO.gg 연결을 시작하거나 복구합니다.",
      "",
      "**/yoro help**",
      "현재 사용할 수 있는 명령을 확인합니다.",
      "",
      "**/yoro dashboard**",
      "YORO Bot 관리 화면을 엽니다."
    ].join("\n"),
    unknown: "지원하지 않는 YORO Bot 명령입니다."
  },
  ja: {
    dmDenied: "このコマンドはDiscordサーバー内でのみ使用できます。",
    permissionDenied: "サーバー所有者またはサーバー管理権限を持つユーザーのみ実行できます。",
    setupTitle: "YORO Botの設定はWeb Dashboardから行えます。",
    setupBody: "以下のリンクからDiscordサーバー連携を完了してください。リンクは10分後に期限切れとなり、一度だけ使用できます。",
    setupButton: "Webでサーバーを連携",
    dashboardTitle: "YORO Bot管理画面",
    dashboardButton: "Dashboardを開く",
    setupUnavailable: "設定リンクを発行できません。しばらくしてからもう一度お試しください。",
    setupActive: "進行中の設定リンクがあります。既存リンクの期限切れ後にもう一度お試しください。",
    help: [
      "**/yoro setup**",
      "Web DashboardでDiscordサーバーとYORO.ggの連携を開始または復旧します。",
      "",
      "**/yoro help**",
      "現在利用できるコマンドを確認します。",
      "",
      "**/yoro dashboard**",
      "YORO Bot管理画面を開きます。"
    ].join("\n"),
    unknown: "未対応のYORO Botコマンドです。"
  }
} as const;

function localeFor(value: string): keyof typeof messages {
  return value.toLowerCase().startsWith("ja") ? "ja" : "ko";
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
    private readonly internalApi: Pick<DiscordInternalApiClient, "issueSetupSession">,
    private readonly now: () => number = Date.now,
    private readonly dashboardUrl = "http://localhost:3000/dashboard/organizations"
  ) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName !== "yoro") return;
    if (this.seen(interaction.id)) return;
    this.remember(interaction.id);
    const locale = localeFor(interaction.locale);
    const text = messages[locale];
    const subcommand = interaction.options.getSubcommand(false);
    auditEvent("discord.command.received", {
      command: subcommand ?? "unknown",
      interaction: safeReference(interaction.id),
      guild: interaction.guildId ? safeReference(interaction.guildId) : undefined,
      user: safeReference(interaction.user.id)
    });

    if (subcommand === "help") {
      await interaction.reply({
        content: text.help,
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
