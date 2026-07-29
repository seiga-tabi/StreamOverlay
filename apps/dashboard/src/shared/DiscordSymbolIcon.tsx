export const DISCORD_SYMBOL_ICON_SRC =
  "/images/brand/discord-symbol-blurple.f6c1a66250d3.png";

type DiscordSymbolIconProps = Readonly<{
  className?: string;
}>;

export function DiscordSymbolIcon({ className }: DiscordSymbolIconProps) {
  const classes = ["discord-symbol-icon", className].filter(Boolean).join(" ");

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      draggable="false"
      src={DISCORD_SYMBOL_ICON_SRC}
    />
  );
}
