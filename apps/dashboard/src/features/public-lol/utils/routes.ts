import type { PublicMainPage } from "../types/public-lol";
import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  publicLocaleFromPathname,
  stripPublicLocalePrefix,
} from "./public-locale-path";

export const PUBLIC_ARAM_PATH = "/lol/aram";
export const PUBLIC_CHAMPIONS_PATH = "/lol/champions";
export const PUBLIC_PATCH_NOTES_PATH = "/patch-notes";
const PUBLIC_PRIVACY_PATH = "/privacy";
const PUBLIC_TERMS_PATH = "/terms";
const PUBLIC_CONTACT_PATH = "/contact";
const PUBLIC_PAGE_PATHS: Partial<Record<PublicMainPage, string>> = {
  search: "/",
  palworld: "/palworld",
  valorant: "/valorant",
  minecraft: "/minecraft",
  bot: "/bot",
  games: "/games",
  streamers: "/streamers",
  subscriptions: "/follow",
  followJoin: "/participation",
  aram: PUBLIC_ARAM_PATH,
  champions: PUBLIC_CHAMPIONS_PATH,
  patchNotes: PUBLIC_PATCH_NOTES_PATH,
  privacy: PUBLIC_PRIVACY_PATH,
  terms: PUBLIC_TERMS_PATH,
  contact: PUBLIC_CONTACT_PATH,
};

export type PublicLegalPageKey = Extract<PublicMainPage, "privacy" | "terms" | "contact">;

export type PublicPageRoute = {
  page: PublicMainPage;
  postId?: string;
};

/* 챔피언 글로벌 빌드 통계 상세 — `/lol/champions/<championId>`.
   championId 는 Data Dragon 의 숫자 key 라 자릿수만 검사합니다(존재 여부는 화면이
   목록과 대조해 판단합니다 — 여기서 챔피언 목록을 알 필요가 없습니다). */
const PUBLIC_CHAMPION_DETAIL_PATTERN = /^\/lol\/champions\/(\d{1,6})$/u;

export function publicChampionIdFromPath(pathname: string = window.location.pathname): number | undefined {
  const match = PUBLIC_CHAMPION_DETAIL_PATTERN.exec(normalizedPublicPath(pathname));
  const championId = match?.[1] ? Number(match[1]) : undefined;
  return championId !== undefined && Number.isSafeInteger(championId) && championId > 0 ? championId : undefined;
}

export function publicChampionDetailPath(championId: number): string {
  return `${PUBLIC_CHAMPIONS_PATH}/${championId}`;
}

/** 서버의 `/patch-notes/26-17` 상세 경로를 기존 목록이 쓰는 `26.17`로 복원합니다. */
export function patchNotesDetailFromPath(pathname: string): string | null {
  const locale = publicLocaleFromPathname(pathname);
  if (locale !== "ko" && locale !== "ja") return null;
  const match = /^\/patch-notes\/(\d{1,3}-\d{1,3})$/u.exec(normalizedPublicPath(pathname));
  return match?.[1] ? match[1].replace("-", ".") : null;
}

function normalizedPublicPath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function publicPageRouteFromPath(pathname: string = window.location.pathname): PublicPageRoute | undefined {
  if (patchNotesDetailFromPath(pathname)) return { page: "patchNotes" };
  /* 챔피언 상세도 "champions" 페이지입니다 — 목록/상세 구분은 화면이 경로에서
     다시 읽습니다(패치 노트 상세와 같은 방식). */
  if (publicChampionIdFromPath(pathname) !== undefined) return { page: "champions" };
  const normalized = normalizedPublicPath(pathname);
  const legalRoute = legalPageFromPublicPath(normalized);
  if (legalRoute) return { page: legalRoute };
  const page = (Object.entries(PUBLIC_PAGE_PATHS) as Array<[PublicMainPage, string]>).find(([, path]) => path === normalized)?.[0];
  return page ? { page } : undefined;
}

export function publicPathForPage(page: PublicMainPage): string | undefined {
  return PUBLIC_PAGE_PATHS[page];
}

export function legalPageFromPublicPath(pathname: string = window.location.pathname): PublicLegalPageKey | undefined {
  pathname = stripPublicLocalePrefix(pathname);
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (normalized === PUBLIC_PRIVACY_PATH) return "privacy";
  if (normalized === PUBLIC_TERMS_PATH) return "terms";
  if (normalized === PUBLIC_CONTACT_PATH) return "contact";
  return undefined;
}

export function publicLegalPath(page: PublicMainPage): string | undefined {
  if (page === "privacy") return PUBLIC_PRIVACY_PATH;
  if (page === "terms") return PUBLIC_TERMS_PATH;
  if (page === "contact") return PUBLIC_CONTACT_PATH;
  return undefined;
}

/* LoL 홈의 주소는 /lol 입니다. 루트로 들어와도 서버가 여기로 넘기므로,
   화면 안에서 이동할 때도 루트를 만들지 않습니다 — 같은 화면이 두 주소로
   보이면 공유 링크와 색인이 갈립니다. */
export const PUBLIC_LOL_HOME_PATH = "/lol";

export function setPublicPath(pathname: string, replace = false): void {
  const nextPath = localizedPublicUrlForCurrentLocale(pathname || "/");
  const currentPath = `${window.location.pathname}${window.location.search ?? ""}${window.location.hash ?? ""}`;
  if (currentPath === nextPath) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    notifyPublicRouteChange();
    return;
  }
  window.history.pushState({}, "", nextPath);
  notifyPublicRouteChange();
}
