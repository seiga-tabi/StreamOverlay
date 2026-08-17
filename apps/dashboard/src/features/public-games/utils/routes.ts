import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

/* setGamesUrl → notifyPublicRouteChange 가 "publicroutechange" 를 쏘고,
   App 과 useGamesRoute 가 같은 이벤트로 다시 그립니다. Valorant/Palworld 패턴 복제. */
export const GAMES_ROUTE_EVENT = "publicroutechange";

export type GamesPage = "hub" | "reaction" | "ranking" | "share";

const PAGE_PATHS: Record<Exclude<GamesPage, "share">, string> = {
  hub: "/games",
  reaction: "/games/reaction",
  ranking: "/games/ranking",
};

/* 공유 링크 /games/reaction/r/<shareId> — shareId 는 서버가 발급한 불투명 토큰. */
const SHARE_PATH_PATTERN = /^\/games\/reaction\/r\/([A-Za-z0-9_-]{1,64})$/;

export function gamesShareIdFromPath(pathname: string): string | null {
  const match = SHARE_PATH_PATTERN.exec(normalizePath(pathname));
  return match?.[1] ?? null;
}

function normalizePath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname) return "/games";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isGamesPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/games" || path.startsWith("/games/");
}

/** 알 수 없는 /games/* 경로는 null — 셸이 404 화면을 그립니다. */
export function gamesPageFromPath(pathname: string): GamesPage | null {
  const path = normalizePath(pathname);
  if (gamesShareIdFromPath(path)) return "share";
  const entry = (Object.entries(PAGE_PATHS) as Array<[Exclude<GamesPage, "share">, string]>)
    .find(([, pagePath]) => pagePath === path);
  return entry?.[0] ?? null;
}

export function gamesPathForPage(page: GamesPage): string {
  if (page === "share") return PAGE_PATHS.reaction;
  return PAGE_PATHS[page];
}

export function gamesSharePath(shareId: string): string {
  return `/games/reaction/r/${shareId}`;
}

export function setGamesUrl(path: string): void {
  const url = localizedPublicUrlForCurrentLocale(path);
  if (window.location.pathname !== url) {
    window.history.pushState({}, "", url);
  }
  notifyPublicRouteChange();
}
