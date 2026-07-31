import { EmbedBuilder } from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  type DiscordBotMessageLocale,
  type DiscordBotStatusFields,
  type DiscordGameServerStatusReason,
  type DiscordGameServerStatusResponse,
  type DiscordGameServerStatusState
} from "@streamops/shared";

const DASHBOARD_ACTION_REASONS = new Set<DiscordGameServerStatusReason>([
  "status_not_configured",
  "status_feature_disabled",
  "credentials_unavailable",
  "auth_failed",
  "network_policy_blocked",
  "upstream_unavailable"
]);

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
    case "stale":
      return 0xeab308;
    case "offline":
      return 0xef4444;
    case "auth_failed":
    case "blocked_by_policy":
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

export function presentGameServerStatus(input: {
  locale: DiscordBotMessageLocale;
  server: NonNullable<DiscordGameServerStatusResponse["server"]>;
  statusFields: DiscordBotStatusFields;
}): Readonly<{ embed: EmbedBuilder; needsDashboardAction: boolean }> {
  const messages = DISCORD_BOT_MESSAGES[input.locale].prefix;
  const server = input.server;
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
  if (server.reason) {
    embed.addFields({
      name: messages.fields.notice,
      value: messages.reasons[server.reason],
      inline: false
    });
  }
  if (input.statusFields.players && server.players) {
    embed.addFields({
      name: messages.fields.players,
      value: `${server.players.current} / ${server.players.max}`,
      inline: true
    });
  }
  if (input.statusFields.version && server.version) {
    embed.addFields({
      name: messages.fields.version,
      value: safeDiscordText(server.version),
      inline: true
    });
  }
  if (input.statusFields.latency && server.latencyMs !== undefined) {
    const formatted = Math.round(server.latencyMs).toLocaleString(
      input.locale === "ja" ? "ja-JP" : "ko-KR"
    );
    embed.addFields({
      name: messages.fields.latency,
      value: `${formatted}ms`,
      inline: true
    });
  }
  if (input.statusFields.observedAt && observedAt) {
    embed.addFields({
      name: messages.fields.observedAt,
      value: observedAt,
      inline: true
    });
  }
  return Object.freeze({
    embed,
    needsDashboardAction: Boolean(
      server.reason && DASHBOARD_ACTION_REASONS.has(server.reason)
    )
  });
}
