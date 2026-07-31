import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export function discordResourceLinks(input: {
  dashboardUrl: string;
  dashboardLabel: string;
  guideUrl: string;
  guideLabel: string;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji("⚙️")
      .setLabel(input.dashboardLabel)
      .setURL(input.dashboardUrl),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji("📘")
      .setLabel(input.guideLabel)
      .setURL(input.guideUrl)
  );
}
