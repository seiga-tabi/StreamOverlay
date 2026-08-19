import type { PublicLocale } from "../i18n/public-lol-i18n";

/* en(2026-08-18) — 팰월드 우선 단계. /en 프리픽스는 전 로케일화 경로에서 유효하며,
 * en 콘텐츠가 없는 섹션은 ko 폴백으로 렌더됩니다(publicContentLocale). */
const PUBLIC_LOCALE_SEGMENTS = new Set<PublicLocale>(["ko", "ja", "en"]);

const LOCALIZABLE_PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/lol",
  "/follow",
  "/participation",
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
  "/valorant",
  "/valorant/agents",
  "/valorant/weapons",
  "/valorant/maps",
  "/valorant/ranked",
  "/minecraft",
  "/minecraft/recipes",
  "/minecraft/items",
  "/minecraft/enchants",
  "/minecraft/library",
  "/minecraft/patch-notes",
  "/lol/aram",
  "/patch-notes",
  /* 미니게임 — 여기에 없으면 localizedPublicUrl 이 경로를 그대로 돌려주어
     canonical 이 /games 가 됩니다. 서버는 /ko/games 를 주므로 같은 페이지에
     canonical 이 둘 생깁니다. 서버 목록(apps/server/src/routing/
     public-dashboard-routes.ts)과 짝을 맞춥니다. */
  "/games",
  "/games/reaction",
  "/streamers",
  "/streamers/new",
  "/games/ranking",
]);

const LOCALIZABLE_PUBLIC_PATH_PREFIXES = [
  "/lol/summoners/",
  /* 반응속도 공유 링크(/games/reaction/r/<shareId>) — 여기 없으면 ja 상태에서
     복사한 링크에 로케일 프리픽스가 빠져 SNS 크롤러가 기본(한국어) OG 를 받습니다
     (2026-08-17 실사례). shareId 가 가변이라 정확 목록 대신 prefix 로 커버합니다. */
  "/games/reaction/r/",
  /* 스트리머 추천 글(/streamers/<id>) — 글 id 가 가변이라 정확 목록으로는 못 덮습니다.
     여기 없으면 ja 화면에서 글을 열어도 /streamers/<id> 로 가서 로케일이 통째로
     떨어집니다(목록·글쓰기는 정확 목록에 있어 멀쩡한 탓에 눈에 잘 안 띕니다).
     서버 목록(public-dashboard-routes.ts 의 PUBLIC_DASHBOARD_PATH_PREFIXES)과 짝. */
  "/streamers/",
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
