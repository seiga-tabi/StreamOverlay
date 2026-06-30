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
          <path d="M12.2 15.2c.8-2.8 3-4.4 6-4.7a92 92 0 0 1 11.6 0c3 .3 5.2 1.9 6 4.7a34.8 34.8 0 0 1 0 17.6c-.8 2.8-3 4.4-6 4.7a92 92 0 0 1-11.6 0c-3-.3-5.2-1.9-6-4.7a34.8 34.8 0 0 1 0-17.6Z" fill="currentColor" />
          <path d="M21.2 17.8v12.4L31.8 24 21.2 17.8Z" fill="var(--profile-link-youtube-play, #ef0000)" />
        </svg>
      );
    case "twitch":
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M10 7h30v21.4L31.4 37H24l-6.7 5.6h-4.5V37H6V13l4-6Zm4.2 5.2V31h6v4.1l4.8-4.1h5.3l5.5-5.5V12.2H14.2Zm8.7 5.4h4.1v9.3h-4.1v-9.3Zm8.1 0h4.1v9.3H31v-9.3Z" fill="currentColor" />
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
          <path d="M10.2 9h9.1l6.7 8.9L32.8 9h5.1L28.4 21.5 39 35.6h-9.1l-7.4-9.8-7.5 9.8H9.9l10.2-13.4L10.2 9Zm7 3.7 14.6 19.2h1.9L19.1 12.7h-1.9Z" fill="currentColor" />
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
