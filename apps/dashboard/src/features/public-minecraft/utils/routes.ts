import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

/* 서버 계약의 q 최대 길이 — App 초기 번들에 포함되는 파일이라 api 모듈을 끌어오지 않고
   여기서 소유하며, api/minecraft.ts 가 재수출합니다. */
export const MINECRAFT_SEARCH_MAX_LENGTH = 80;

/* setMinecraftUrl → notifyPublicRouteChange 가 "publicroutechange" 를 쏘고,
   App 과 useMinecraftRoute 가 같은 이벤트로 다시 그립니다. Palworld 패턴 복제. */
export const MINECRAFT_ROUTE_EVENT = "publicroutechange";

export type MinecraftPage = "home" | "recipes" | "items" | "enchants" | "library" | "patchNotes";

const PAGE_PATHS: Record<MinecraftPage, string> = {
  home: "/minecraft",
  recipes: "/minecraft/recipes",
  items: "/minecraft/items",
  enchants: "/minecraft/enchants",
  library: "/minecraft/library",
  patchNotes: "/minecraft/patch-notes",
};

function normalizePath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname) return "/minecraft";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isMinecraftPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/minecraft" || path.startsWith("/minecraft/");
}

/** 알 수 없는 /minecraft/* 경로는 null — 셸이 404 화면을 그립니다. */
export function minecraftPageFromPath(pathname: string): MinecraftPage | null {
  const path = normalizePath(pathname);
  const entry = (Object.entries(PAGE_PATHS) as Array<[MinecraftPage, string]>)
    .find(([, pagePath]) => pagePath === path);
  return entry?.[0] ?? null;
}

export function minecraftPathForPage(page: MinecraftPage): string {
  return PAGE_PATHS[page];
}

/** URL 의 ?q= 검색어 — 카탈로그 검색의 단일 원본. SSR 및 미지정 시 빈 문자열. */
export function minecraftSearchQueryFromUrl(): string {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search).get("q");
  return query ? query.slice(0, MINECRAFT_SEARCH_MAX_LENGTH) : "";
}

/** 카탈로그 검색 제출 — URL 에 반영해 공유·새로고침·뒤로가기가 검색 상태를 보존하게 합니다. */
export function setMinecraftSearchUrl(page: MinecraftPage, query: string): void {
  const trimmed = query.trim().slice(0, MINECRAFT_SEARCH_MAX_LENGTH);
  const path = minecraftPathForPage(page);
  setMinecraftUrl(trimmed ? `${path}?q=${encodeURIComponent(trimmed)}` : path);
}

export function setMinecraftUrl(url: string, replace = false): void {
  url = localizedPublicUrlForCurrentLocale(url);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  notifyPublicRouteChange();
}
