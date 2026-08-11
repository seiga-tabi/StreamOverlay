import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

/* setValorantUrl → notifyPublicRouteChange 가 "publicroutechange" 를 쏘고,
   App 과 useValorantRoute 가 같은 이벤트로 다시 그립니다. Palworld 패턴 복제. */
export const VALORANT_ROUTE_EVENT = "publicroutechange";

export type ValorantPage = "home" | "agents" | "weapons" | "maps" | "ranked";

const PAGE_PATHS: Record<ValorantPage, string> = {
  home: "/valorant",
  agents: "/valorant/agents",
  weapons: "/valorant/weapons",
  maps: "/valorant/maps",
  ranked: "/valorant/ranked",
};

function normalizePath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname) return "/valorant";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isValorantPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/valorant" || path.startsWith("/valorant/");
}

/** 알 수 없는 /valorant/* 경로는 null — 셸이 404 화면을 그립니다. */
export function valorantPageFromPath(pathname: string): ValorantPage | null {
  const path = normalizePath(pathname);
  const entry = (Object.entries(PAGE_PATHS) as Array<[ValorantPage, string]>)
    .find(([, pagePath]) => pagePath === path);
  return entry?.[0] ?? null;
}

export function valorantPathForPage(page: ValorantPage): string {
  return PAGE_PATHS[page];
}

export function setValorantUrl(url: string, replace = false): void {
  url = localizedPublicUrlForCurrentLocale(url);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  notifyPublicRouteChange();
}
