import { EmbedBuilder } from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  type DiscordBotMessageLocale,
  type DiscordBotStatusFields,
  type DiscordGameServerStatusResponse,
  type DiscordGameServerStatusState
} from "@streamops/shared";

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

function statusIcon(status: DiscordGameServerStatusState): string {
  switch (status) {
    case "online":
      return "🟢";
    case "checking":
      return "🔵";
    case "degraded":
    case "stale":
      return "🟡";
    case "offline":
      return "🔴";
    case "auth_failed":
    case "blocked_by_policy":
      return "🟠";
    default:
      return "⚪";
  }
}

export function discordProgressGauge(
  value: number,
  maximum: number,
  segments = 12
): string {
  const safeSegments = Math.max(1, Math.min(20, Math.trunc(segments)));
  const ratio = maximum > 0
    ? Math.max(0, Math.min(1, value / maximum))
    : 0;
  const filled = Math.round(ratio * safeSegments);
  return `${"▰".repeat(filled)}${"▱".repeat(safeSegments - filled)}`;
}

function latencyPresentation(
  locale: DiscordBotMessageLocale,
  latencyMs: number
): Readonly<{ gauge: string; quality: string; icon: string }> {
  const charts = DISCORD_BOT_MESSAGES[locale].prefix.charts;
  if (latencyMs <= 80) {
    return { gauge: discordProgressGauge(4, 4), quality: charts.excellent, icon: "🟢" };
  }
  if (latencyMs <= 160) {
    return { gauge: discordProgressGauge(3, 4), quality: charts.good, icon: "🔵" };
  }
  if (latencyMs <= 300) {
    return { gauge: discordProgressGauge(2, 4), quality: charts.delayed, icon: "🟡" };
  }
  return { gauge: discordProgressGauge(1, 4), quality: charts.slow, icon: "🔴" };
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
}): EmbedBuilder {
  const messages = DISCORD_BOT_MESSAGES[input.locale].prefix;
  const server = input.server;
  const observedAt = server.observedAt
    ? discordTimestamp(server.observedAt)
    : undefined;
  const icon = statusIcon(server.status);
  const embed = new EmbedBuilder()
    .setColor(statusColor(server.status))
    .setTitle(`${icon} ${messages.statusTitle}`)
    .setDescription([
      `**${safeDiscordText(server.displayName)}**`,
      `${icon} ${messages.states[server.status]}`
    ].join("\n"))
    .setFooter({ text: messages.charts.footer });
  if (server.reason) {
    embed.addFields({
      name: `ℹ️ ${messages.fields.notice}`,
      value: messages.reasons[server.reason],
      inline: false
    });
  }
  if (input.statusFields.players && server.players) {
    const percentage = server.players.max > 0
      ? Math.round(Math.max(
          0,
          Math.min(1, server.players.current / server.players.max)
        ) * 100)
      : 0;
    embed.addFields({
      name: `👥 ${messages.charts.occupancy}`,
      value: [
        `\`${discordProgressGauge(server.players.current, server.players.max)}\``,
        `**${server.players.current} / ${server.players.max}** · ${percentage}%`
      ].join("\n"),
      inline: false
    });
  }
  if (input.statusFields.version && server.version) {
    embed.addFields({
      name: `🎮 ${messages.fields.version}`,
      value: safeDiscordText(server.version),
      inline: true
    });
  }
  if (input.statusFields.latency && server.latencyMs !== undefined) {
    const latency = latencyPresentation(input.locale, server.latencyMs);
    const formatted = Math.round(server.latencyMs).toLocaleString(
      input.locale === "ja"
        ? "ja-JP"
        : input.locale === "en"
          ? "en-US"
          : "ko-KR"
    );
    embed.addFields({
      name: `📶 ${messages.charts.responseQuality}`,
      value: [
        `\`${latency.gauge}\``,
        `${latency.icon} **${latency.quality}** · ${formatted}ms`
      ].join("\n"),
      inline: false
    });
  }
  if (input.statusFields.observedAt && observedAt) {
    embed.addFields({
      name: `🕒 ${messages.fields.observedAt}`,
      value: observedAt,
      inline: true
    });
  }
  return embed;
}

export function presentGameServerNotice(input: {
  locale: DiscordBotMessageLocale;
  description: string;
}): EmbedBuilder {
  const messages = DISCORD_BOT_MESSAGES[input.locale].prefix;
  return new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle(`🟠 ${messages.statusTitle}`)
    .setDescription(input.description)
    .setFooter({ text: messages.charts.footer });
}
