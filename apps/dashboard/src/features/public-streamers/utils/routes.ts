import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

/* 스트리머 추천 게시판 경로.
 *
 * 미니게임과 같은 "카테고리 섹션"입니다 — 개별 게임이 아니라 게임 선택기의 한
 * 항목으로 들어가고, 게임 범위는 이 섹션 안의 secondary nav 가 담당합니다.
 * 근거: docs/mockups/streamer-board (게임 선택기 아트보드).
 */
export const STREAMERS_ROUTE_EVENT = "publicroutechange";

export type StreamersPage = "list" | "detail" | "compose";

/** 게임 범위 — nav 이자 목록 필터입니다. */
export const STREAMER_SCOPES = ["all", "lol", "valorant", "palworld", "minecraft"] as const;

export type StreamerScope = (typeof STREAMER_SCOPES)[number];

export const STREAMERS_BASE_PATH = "/streamers";
const COMPOSE_PATH = "/streamers/new";

/* 글 id 는 서버가 발급하는 불투명 토큰입니다. 조작된 경로를 그대로 조회에
   넘기지 않도록 형식을 여기서 고정합니다(팰월드 엔티티 id 선례). */
const DETAIL_PATH_PATTERN = /^\/streamers\/([a-z0-9][a-z0-9_-]{0,63})$/u;

function normalizePath(pathname: string): string {
  const stripped = stripPublicLocalePrefix(pathname);
  if (!stripped) return STREAMERS_BASE_PATH;
  return stripped.length > 1 && stripped.endsWith("/") ? stripped.slice(0, -1) : stripped;
}

export function isStreamersPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === STREAMERS_BASE_PATH || path.startsWith(`${STREAMERS_BASE_PATH}/`);
}

export function streamerPostIdFromPath(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (path === COMPOSE_PATH) return null;
  return DETAIL_PATH_PATTERN.exec(path)?.[1] ?? null;
}

/** 알 수 없는 /streamers/* 는 null — 셸이 404 화면을 그립니다. */
export function streamersPageFromPath(pathname: string): StreamersPage | null {
  const path = normalizePath(pathname);
  if (path === STREAMERS_BASE_PATH) return "list";
  if (path === COMPOSE_PATH) return "compose";
  return streamerPostIdFromPath(path) ? "detail" : null;
}

export function streamersPathForPage(page: StreamersPage): string {
  return page === "compose" ? COMPOSE_PATH : STREAMERS_BASE_PATH;
}

export function streamerPostPath(postId: string): string {
  return `${STREAMERS_BASE_PATH}/${postId}`;
}

/** 범위는 query 로 둡니다 — 경로를 늘리면 글 상세 id 와 형태가 겹칩니다. */
export function streamerScopeFromSearch(search: string = window.location.search): StreamerScope {
  const value = new URLSearchParams(search).get("game");
  return STREAMER_SCOPES.find((scope) => scope === value) ?? "all";
}

export function streamersScopePath(scope: StreamerScope): string {
  return scope === "all" ? STREAMERS_BASE_PATH : `${STREAMERS_BASE_PATH}?game=${scope}`;
}

export function setStreamersUrl(path: string): void {
  const [pathname = "", search = ""] = path.split("?", 2);
  const url = localizedPublicUrlForCurrentLocale(pathname);
  const next = search ? `${url}?${search}` : url;
  if (`${window.location.pathname}${window.location.search}` !== next) {
    window.history.pushState({}, "", next);
  }
  notifyPublicRouteChange();
}
