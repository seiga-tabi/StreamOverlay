import type { PublicLocale } from "../i18n/public-lol-i18n";

const PUBLIC_LOCALE_SEGMENTS = new Set<PublicLocale>(["ko", "ja"]);

const LOCALIZABLE_PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/lol",
  "/follow",
  "/participation",
  "/community",
  "/privacy",
  "/terms",
  "/contact",
  "/bot",
  "/bot/getting-started",
  "/bot/commands",
  "/bot/game-files",
  "/bot/features",
  "/bot/connect",
  "/bot/dedicated-server",
  "/palworld",
  "/palworld/pals",
  "/palworld/breeding",
  "/palworld/items",
  "/palworld/technology",
  "/palworld/skills",
  "/palworld/map",
  "/palworld/search",
  "/lol/aram",
]);

const LOCALIZABLE_PUBLIC_PATH_PREFIXES = [
  "/lol/summoners/",
  "/community/server",
  "/community/party",
  "/community/posts/",
];

function pathOnly(value: string): string {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  return indexes.length > 0 ? value.slice(0, Math.min(...indexes)) : value;
}

function suffixOnly(value: string): string {
  return value.slice(pathOnly(value).length);
}

function normalizePublicPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/u, "") || "/";
}

export function publicLocaleFromPathname(pathname: string): PublicLocale | undefined {
  const segment = pathname.match(/^\/([^/]+)(?:\/|$)/u)?.[1];
  return segment && PUBLIC_LOCALE_SEGMENTS.has(segment as PublicLocale)
    ? segment as PublicLocale
    : undefined;
}

export function stripPublicLocalePrefix(pathname: string): string {
  const locale = publicLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.slice(locale.length + 1);
  return stripped ? (stripped.startsWith("/") ? stripped : `/${stripped}`) : "/";
}

export function isLocalizablePublicPath(pathname: string): boolean {
  const normalized = normalizePublicPath(stripPublicLocalePrefix(pathOnly(pathname)));
  return LOCALIZABLE_PUBLIC_EXACT_PATHS.has(normalized)
    || LOCALIZABLE_PUBLIC_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function localizedPublicUrl(value: string, locale: PublicLocale): string {
  const pathname = pathOnly(value);
  if (!pathname.startsWith("/") || pathname.startsWith("//") || !isLocalizablePublicPath(pathname)) {
    return value;
  }
  const unprefixed = stripPublicLocalePrefix(pathname);
  const localizedPath = unprefixed === "/" ? `/${locale}/` : `/${locale}${unprefixed}`;
  return `${localizedPath}${suffixOnly(value)}`;
}

export function currentPublicLocale(): PublicLocale {
  if (typeof window !== "undefined") {
    const pathLocale = publicLocaleFromPathname(window.location.pathname);
    if (pathLocale) return pathLocale;
  }
  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("ja")) {
    return "ja";
  }
  return "ko";
}

export function localizedPublicUrlForCurrentLocale(value: string): string {
  return localizedPublicUrl(value, currentPublicLocale());
}

export function notifyPublicRouteChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("publicroutechange"));
  window.dispatchEvent(new CustomEvent("palworldroutechange"));
}
