type ProfileLinkIconProps = {
  platform?: string;
  url?: string;
  label?: string;
  href?: string;
  className?: string;
};

export function profileLinkPlatformFromUrl(url: string | undefined): string {
  if (!url) return "website";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("twitch.tv")) return "twitch";
    if (host === "discord.gg" || host.endsWith("discord.com")) return "discord";
    if (host === "x.com" || host.endsWith("twitter.com")) return "x";
    if (host.endsWith("instagram.com")) return "instagram";
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("afreecatv.com") || host.endsWith("sooplive.co.kr")) return "soop";
  } catch {
    return "website";
  }
  return "website";
}

export function profileLinkPlatformClass(platform: string | undefined, url?: string): string {
  return (platform || profileLinkPlatformFromUrl(url)).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "website";
}

function ProfileLinkIconGlyph({ platform }: { platform: string }) {
  switch (platform) {
    case "youtube":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M37.8 16.1c-.3-1.3-1.4-2.4-2.8-2.8C32.6 12.7 24 12.7 24 12.7s-8.6 0-11 .6c-1.4.4-2.5 1.5-2.8 2.8-.6 2.5-.6 7.9-.6 7.9s0 5.4.6 7.9c.3 1.3 1.4 2.4 2.8 2.8 2.4.6 11 .6 11 .6s8.6 0 11-.6c1.4-.4 2.5-1.5 2.8-2.8.6-2.5.6-7.9.6-7.9s0-5.4-.6-7.9Z" fill="currentColor" />
          <path d="M21.1 29.4V18.6L30.5 24l-9.4 5.4Z" fill="var(--profile-link-youtube-play, #ff0000)" />
        </svg>
      );
    case "twitch":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M12 7h29v20.6L32.7 36h-7.2L19 42h-5.1v-6H7V13l5-6Zm4.1 4.6v20h6.4v4.2l4.5-4.2h5.5l4.4-4.5V11.6H16.1Z" fill="currentColor" />
          <path d="M25.1 17.1h3.6v9.8h-3.6v-9.8Zm8.2 0h3.6v9.8h-3.6v-9.8Z" fill="var(--profile-link-twitch-cutout, #9146ff)" />
        </svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.2 7.2c1.1-.5 2.1-.8 3-.9l.4.8c1-.1 1.9-.1 2.8 0l.4-.8c1 .1 2 .4 3 .9 1.5 2.2 2.2 4.6 2 7-.9.7-1.9 1.2-3 1.5l-.7-1.1c.4-.1.8-.3 1.2-.6-.4.2-1.7.8-5.3.8s-4.9-.6-5.3-.8c.4.3.8.5 1.2.6l-.7 1.1c-1.1-.3-2.1-.8-3-1.5-.2-2.4.5-4.8 2-7Zm1.8 5.4c.7 0 1.2-.6 1.2-1.3S10.7 10 10 10s-1.2.6-1.2 1.3.5 1.3 1.2 1.3Zm4 0c.7 0 1.2-.6 1.2-1.3S14.7 10 14 10s-1.2.6-1.2 1.3.5 1.3 1.2 1.3Z" fill="currentColor" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M28.7 21.1 40.2 8h-4.1l-9.2 10.5L19.5 8H8.3l12 17.1L8.5 40h4.1l9.5-12 8.3 12h11.3L28.7 21.1Zm-5 3.3-1.8-2.5-8.2-10.4h3.8l7.3 9.3 1.8 2.5 8.8 11.2h-3.8l-7.9-10.1Z" fill="currentColor" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.2 4h7.6A4.2 4.2 0 0 1 20 8.2v7.6a4.2 4.2 0 0 1-4.2 4.2H8.2A4.2 4.2 0 0 1 4 15.8V8.2A4.2 4.2 0 0 1 8.2 4Zm0 2A2.2 2.2 0 0 0 6 8.2v7.6A2.2 2.2 0 0 0 8.2 18h7.6a2.2 2.2 0 0 0 2.2-2.2V8.2A2.2 2.2 0 0 0 15.8 6H8.2Zm3.8 2.9A3.1 3.1 0 1 1 8.9 12 3.1 3.1 0 0 1 12 8.9Zm0 1.9a1.2 1.2 0 1 0 1.2 1.2 1.2 1.2 0 0 0-1.2-1.2Zm3.4-2.6a.8.8 0 1 1-.8.8.8.8 0 0 1 .8-.8Z" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.2 4c.3 2.2 1.5 3.6 3.8 3.8v3c-1.3 0-2.5-.4-3.7-1.1v5.2c0 2.7-1.8 5.1-5 5.1-2.8 0-4.8-1.8-4.8-4.4 0-2.9 2.2-4.7 5.4-4.5v3.1c-1.4-.2-2.2.4-2.2 1.4 0 .8.6 1.4 1.6 1.4 1.1 0 1.8-.6 1.8-2V4h3.1Z" fill="currentColor" />
        </svg>
      );
    case "soop":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.2C5 7.7 8.5 5 12.2 5H19v4.1h-6.4c-2 0-3.1 1.1-3.1 3.1 0 1.9 1.3 3 3.2 3H19V19h-6.9C8.2 19 5 16.6 5 12.2Z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.4 7.2 12 5.6a4.4 4.4 0 1 1 6.2 6.2l-2.4 2.4a4.4 4.4 0 0 1-5.9.3l1.6-1.6a2.2 2.2 0 0 0 2.7-.3l2.4-2.4a2.2 2.2 0 0 0-3.1-3.1l-1.6 1.6-1.5-1.5Zm3.2 9.6L12 18.4a4.4 4.4 0 1 1-6.2-6.2l2.4-2.4a4.4 4.4 0 0 1 5.9-.3l-1.6 1.6a2.2 2.2 0 0 0-2.7.3l-2.4 2.4a2.2 2.2 0 0 0 3.1 3.1l1.6-1.6 1.5 1.5Z" fill="currentColor" />
        </svg>
      );
  }
}

export function ProfileLinkIcon({ platform, url, label, href, className }: ProfileLinkIconProps) {
  const normalizedPlatform = profileLinkPlatformClass(platform, url);
  const accessibleLabel = label?.trim() || normalizedPlatform;
  const classes = ["public-profile-link-icon", normalizedPlatform, className].filter(Boolean).join(" ");
  const icon = <ProfileLinkIconGlyph platform={normalizedPlatform} />;

  if (href) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer" title={accessibleLabel} aria-label={accessibleLabel}>
        {icon}
      </a>
    );
  }

  return (
    <span className={classes} title={accessibleLabel} aria-label={accessibleLabel}>
      {icon}
    </span>
  );
}
