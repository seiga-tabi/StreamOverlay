import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  escapeMarkdown
} from "discord.js";
import {
  DISCORD_BOT_MESSAGES,
  type DiscordBotMessageLocale,
  type DiscordPalworldPlayerLookupResponse
} from "@streamops/shared";

function safePlayerName(value: string): string {
  return escapeMarkdown(value.replaceAll("@", "＠")).slice(0, 80);
}

function safeShareValue(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replaceAll("@", "＠")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);
}

export function presentPalworldPlayerActions(input: {
  locale: DiscordBotMessageLocale;
  response: DiscordPalworldPlayerLookupResponse;
  publicBaseUrl: string;
}): ActionRowBuilder<ButtonBuilder> | undefined {
  if (input.response.result?.kind !== "profile") return undefined;
  const messages = DISCORD_BOT_MESSAGES[input.locale].prefix;
  const player = input.response.result.player;
  const palworldUrl = new URL(
    input.locale === "en" ? "/palworld" : `/${input.locale}/palworld`,
    input.publicBaseUrl
  ).toString();
  const shareText = messages.playerShareText
    .replace("{nickname}", safeShareValue(player.nickname))
    .replace("{level}", String(player.level));
  const shareUrl = new URL("https://x.com/intent/post");
  shareUrl.searchParams.set("text", shareText);
  shareUrl.searchParams.set("url", palworldUrl);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji("↗️")
      .setLabel(messages.playerShareButton)
      .setURL(shareUrl.toString()),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji("🌐")
      .setLabel(messages.playerPalworldButton)
      .setURL(palworldUrl)
  );
}

export function presentPalworldPlayers(input: {
  locale: DiscordBotMessageLocale;
  response: DiscordPalworldPlayerLookupResponse;
  searchHint: string;
}): EmbedBuilder {
  const messages = DISCORD_BOT_MESSAGES[input.locale].prefix;
  const footer = messages.charts.playerFooter;
  if (!input.response.connected) {
    return new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle(`🟠 ${messages.playerListTitle}`)
      .setDescription(messages.guildNotConnected)
      .setFooter({ text: footer });
  }
  if (input.response.reason) {
    return new EmbedBuilder()
      .setColor(0xf0b232)
      .setTitle(`⚠️ ${messages.playerListTitle}`)
      .setDescription(messages.playerUnavailable[input.response.reason])
      .setFooter({ text: footer });
  }
  if (!input.response.result) {
    return new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle(`⚪ ${messages.playerListTitle}`)
      .setDescription(messages.unavailable)
      .setFooter({ text: footer });
  }
  if (input.response.result.kind === "list") {
    const result = input.response.result;
    const displayedNames = result.nicknames.slice(0, 25);
    const names = displayedNames
      .map((name, index) => `\`${String(index + 1).padStart(2, "0")}\` ${safePlayerName(name)}`)
      .join("\n");
    const listFooter = result.total > displayedNames.length
      ? messages.playerListTruncated
        .replace("{total}", String(result.total))
        .replace("{shown}", String(displayedNames.length))
      : input.searchHint;
    return new EmbedBuilder()
      .setColor(result.total > 0 ? 0x5865f2 : 0x6b7280)
      .setTitle(`👥 ${messages.playerListTitle} · ${result.total}`)
      .setDescription(names || messages.playerEmpty)
      .setFooter({ text: `${footer} · ${listFooter}` });
  }
  if (input.response.result.kind === "not_found") {
    const suggestions = input.response.result.suggestions.length
      ? [
          "",
          `**${messages.playerSuggestions}**`,
          ...input.response.result.suggestions.map(
            (name) => `• ${safePlayerName(name)}`
          )
        ].join("\n")
      : "";
    return new EmbedBuilder()
      .setColor(0xf0b232)
      .setTitle(`🔎 ${messages.playerProfileTitle}`)
      .setDescription(`${messages.playerNotFound}${suggestions}`)
      .setFooter({ text: footer });
  }
  const player = input.response.result.player;
  const serverName = input.response.displayName?.trim();
  return new EmbedBuilder()
    .setColor(0x7c5cff)
    .setTitle(`🧭 ${messages.playerCardTitle}`)
    .setDescription([
      `## 👤 ${safePlayerName(player.nickname)}`,
      messages.playerCardSubtitle
    ].join("\n"))
    .addFields([
      {
        name: `⭐ ${messages.playerFields.level}`,
        value: `**Lv. ${player.level}**`,
        inline: true
      },
      {
        name: `🟢 ${messages.playerFields.status}`,
        value: `**${messages.playerOnline}**`,
        inline: true
      },
      ...(player.buildingCount === undefined
        ? []
          : [{
            name: `🏠 ${messages.playerFields.buildingCount}`,
            value: String(player.buildingCount),
            inline: true
          }]),
      ...(serverName
        ? [{
            name: `🌐 ${messages.playerFields.server}`,
            value: safePlayerName(serverName),
            inline: false
          }]
        : [])
    ])
    .setFooter({ text: footer });
}
