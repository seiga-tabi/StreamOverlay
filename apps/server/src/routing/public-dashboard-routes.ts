const PUBLIC_DASHBOARD_EXACT_PATHS = new Set([
  "/lol",
  "/lol/",
  "/follow",
  "/follow/",
  "/participation",
  "/participation/",
  "/privacy",
  "/terms",
  "/contact",
  "/login",
  "/login/",
  "/account",
  "/account/",
  "/account/connections",
  "/account/connections/",
  "/bot",
  "/bot/",
  "/bot/getting-started",
  "/bot/getting-started/",
  "/bot/commands",
  "/bot/commands/",
  "/bot/game-files",
  "/bot/game-files/",
  // 기존 공개 링크는 HTTP 계층에서 canonical 경로로 redirect합니다.
  "/bot/features",
  "/bot/features/",
  "/bot/connect",
  "/bot/connect/",
  "/bot/dedicated-server",
  "/bot/dedicated-server/",
  "/palworld",
  "/palworld/",
  "/palworld/pals",
  "/palworld/pals/",
  "/palworld/breeding",
  "/palworld/breeding/",
  "/palworld/items",
  "/palworld/items/",
  "/palworld/technology",
  "/palworld/technology/",
  "/palworld/skills",
  "/palworld/skills/",
  "/palworld/map",
  "/palworld/map/",
  "/palworld/search",
  "/palworld/search/",
  "/valorant",
  "/valorant/",
  "/valorant/agents",
  "/valorant/agents/",
  "/valorant/weapons",
  "/valorant/weapons/",
  "/valorant/maps",
  "/valorant/maps/",
  "/valorant/ranked",
  "/valorant/ranked/",
  "/minecraft",
  "/minecraft/",
  "/minecraft/recipes",
  "/minecraft/recipes/",
  "/minecraft/items",
  "/minecraft/items/",
  "/minecraft/enchants",
  "/minecraft/enchants/",
  "/minecraft/library",
  "/minecraft/library/",
  "/minecraft/patch-notes",
  "/minecraft/patch-notes/",
  "/lol/aram",
  "/lol/aram/",
  "/patch-notes",
  "/patch-notes/",
  /* 미니게임 — 여기에 없으면 /ko/games 가 공개 라우트로 인식되지 않아
     hreflang(alternateUrls)도 함께 빠집니다. live 인 게임만 올립니다.
     프런트 목록(apps/dashboard/src/features/public-lol/utils/public-locale-path.ts)과
     짝을 맞출 것 — /games/ranking 누락으로 새로고침 404 실사례(2026-08-17). */
  "/games",
  "/games/",
  "/games/reaction",
  "/games/reaction/",
  "/games/ranking",
  "/games/ranking/"
]);

const NON_LOCALIZED_PUBLIC_PATHS = new Set([
  "/login",
  "/login/",
  "/account",
  "/account/",
  "/account/connections",
  "/account/connections/",
]);

const PUBLIC_DASHBOARD_PATH_PREFIXES = [
  "/lol/summoners/",
  // Palworld 상세는 query가 아니라 고유 URL을 가져야 검색에 색인되고 공유·북마크가 동작합니다.
  "/palworld/pals/",
  "/palworld/items/",
  "/palworld/skills/",
  /* 반응속도 공유 링크 — 기록 id 마다 고유 URL 이라 prefix 로 받습니다.
     서버 렌더 메타(OG)가 여기에 기록을 새겨야 SNS 미리보기가 살아납니다. */
  "/games/reaction/r/"
];

/* en(2026-08-18): 팰월드 섹션부터 영어 콘텐츠를 서빙합니다.
 *
 * 유니온에 en 을 넣었다고 모든 경로가 en 을 갖는 것은 아닙니다 — en 번역이 없는
 * 섹션(LoL 등)에 en hreflang 을 붙이면 크롤러에게 없는 페이지를 약속하게 되므로,
 * 경로별로 어떤 로케일을 내보낼지는 public-seo.ts 의 alternateUrlsForPath 가
 * 정합니다(팰월드만 3종, 나머지는 ko·ja). */
export type PublicUrlLocale = "ko" | "ja" | "en";

const SERVED_LOCALE_SEGMENT_PATTERN = /^\/(ko|ja|en)(?:\/|$)/u;

/**
 * 영어판이 없는 기능에서 en 요청을 ko 로 접습니다.
 *
 * LoL 전적·패치 노트는 ko·ja 만 있으므로, /en 으로 들어와도 한국어 판을 그대로
 * 보여 줍니다(공백 문구 금지). 팰월드처럼 영어 콘텐츠가 있는 쪽은 이 함수를
 * 쓰지 않습니다.
 */
export function koJaPublicUrlLocale(locale: PublicUrlLocale): "ko" | "ja" {
  return locale === "ja" ? "ja" : "ko";
}

export function publicUrlLocaleFromPathname(pathname: string): PublicUrlLocale | undefined {
  const locale = pathname.match(SERVED_LOCALE_SEGMENT_PATTERN)?.[1];
  return locale === "ko" || locale === "ja" || locale === "en" ? locale : undefined;
}

export function stripPublicUrlLocalePrefix(pathname: string): string {
  const segment = pathname.match(SERVED_LOCALE_SEGMENT_PATTERN)?.[1];
  if (!segment) return pathname;
  const stripped = pathname.slice(segment.length + 1);
  return stripped ? (stripped.startsWith("/") ? stripped : `/${stripped}`) : "/";
}

export function isLocalizablePublicDashboardRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (NON_LOCALIZED_PUBLIC_PATHS.has(pathname)) return false;
  if (PUBLIC_DASHBOARD_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_DASHBOARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isPublicDashboardAppRoute(pathname: string): boolean {
  if (PUBLIC_DASHBOARD_EXACT_PATHS.has(pathname)) return true;
  if (PUBLIC_DASHBOARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (!pathname.match(SERVED_LOCALE_SEGMENT_PATTERN)) return false;
  return isLocalizablePublicDashboardRoute(stripPublicUrlLocalePrefix(pathname));
}
