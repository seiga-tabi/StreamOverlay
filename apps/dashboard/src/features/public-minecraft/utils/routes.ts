import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

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

export function setMinecraftUrl(url: string, replace = false): void {
  url = localizedPublicUrlForCurrentLocale(url);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  notifyPublicRouteChange();
}
