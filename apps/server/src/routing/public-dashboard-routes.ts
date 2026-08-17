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
     hreflang(alternateUrls)도 함께 빠집니다. live 인 게임만 올립니다. */
  "/games",
  "/games/",
  "/games/reaction",
  "/games/reaction/"
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
  "/palworld/skills/"
];

export type PublicUrlLocale = "ko" | "ja";

export function publicUrlLocaleFromPathname(pathname: string): PublicUrlLocale | undefined {
  const locale = pathname.match(/^\/(ko|ja)(?:\/|$)/u)?.[1];
  return locale === "ko" || locale === "ja" ? locale : undefined;
}

export function stripPublicUrlLocalePrefix(pathname: string): string {
  const locale = publicUrlLocaleFromPathname(pathname);
  if (!locale) return pathname;
  const stripped = pathname.slice(locale.length + 1);
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
  if (!publicUrlLocaleFromPathname(pathname)) return false;
  return isLocalizablePublicDashboardRoute(stripPublicUrlLocalePrefix(pathname));
}
