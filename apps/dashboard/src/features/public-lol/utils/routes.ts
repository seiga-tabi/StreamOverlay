import type { PublicMainPage } from "../types/public-lol";
import {
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  stripPublicLocalePrefix,
} from "./public-locale-path";

export const PUBLIC_ARAM_PATH = "/lol/aram";
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

function normalizedPublicPath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function publicPageRouteFromPath(pathname: string = window.location.pathname): PublicPageRoute | undefined {
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
