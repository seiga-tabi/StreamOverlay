const TWITCH_PREVIEW_HOST = "static-cdn.jtvnw.net";

/** Twitch Helix가 반환하는 썸네일 템플릿을 고정된 16:9 미리보기 URL로 변환합니다. */
export function safeTwitchStreamPreviewUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const expanded = value
    .replace(/\{width\}|%7Bwidth%7D/giu, "640")
    .replace(/\{height\}|%7Bheight%7D/giu, "360");
  try {
    const parsed = new URL(expanded);
    if (
      parsed.protocol !== "https:"
      || parsed.hostname !== TWITCH_PREVIEW_HOST
      || parsed.username
      || parsed.password
      || !parsed.pathname.startsWith("/previews-ttv/")
    ) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}
