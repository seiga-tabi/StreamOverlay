import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

export function discordResourceLinks(input: {
  primaryUrl: string;
  primaryLabel: string;
  primaryEmoji?: string;
  guideUrl: string;
  guideLabel: string;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(input.primaryEmoji ?? "⚙️")
      .setLabel(input.primaryLabel)
      .setURL(input.primaryUrl),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji("📘")
      .setLabel(input.guideLabel)
      .setURL(input.guideUrl)
  );
}
