export const TWITCH_GLITCH_ICON_URL =
  "/images/brand/twitch-glitch-purple.0a7bc78f69becd1d.png";

export function TwitchGlitchIcon({ className }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={["twitch-glitch-icon", className].filter(Boolean).join(" ")}
      decoding="async"
      draggable={false}
      height={1600}
      src={TWITCH_GLITCH_ICON_URL}
      width={1371}
    />
  );
}
