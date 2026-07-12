import type { PublicMainPage } from "../types/public-lol";

const PUBLIC_TOURNAMENT_ROUTE_PREFIX = "/lol/tournaments/";
export const PUBLIC_TOURNAMENT_LIST_PATH = "/lol/tournaments";
export const PUBLIC_TOURNAMENT_CALENDAR_PATH = "/lol/tournaments/calendar";
const PUBLIC_PRIVACY_PATH = "/privacy";
const PUBLIC_TERMS_PATH = "/terms";
const PUBLIC_CONTACT_PATH = "/contact";

export type PublicTournamentRoute = {
  page: Extract<PublicMainPage, "tournamentCalendar" | "tournamentList" | "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule">;
  slug?: string;
};

export type PublicLegalPageKey = Extract<PublicMainPage, "privacy" | "terms" | "contact">;

export function tournamentRouteFromPublicPath(pathname: string = window.location.pathname): PublicTournamentRoute | undefined {
  if (pathname === PUBLIC_TOURNAMENT_LIST_PATH || pathname === `${PUBLIC_TOURNAMENT_LIST_PATH}/`) return { page: "tournamentList" };
  if (pathname === PUBLIC_TOURNAMENT_CALENDAR_PATH || pathname === `${PUBLIC_TOURNAMENT_CALENDAR_PATH}/`) return { page: "tournamentCalendar" };
  if (!pathname.startsWith(PUBLIC_TOURNAMENT_ROUTE_PREFIX)) return undefined;
  const [slug, tab] = pathname.slice(PUBLIC_TOURNAMENT_ROUTE_PREFIX.length).split("/");
  if (!slug) return { page: "tournamentList" };
  const page =
    tab === "news" ? "tournamentNews" :
    tab === "teams" ? "tournamentTeams" :
    tab === "schedule" ? "tournamentSchedule" :
    "tournamentBracket";
  return { page, slug: decodeURIComponent(slug) };
}

export function legalPageFromPublicPath(pathname: string = window.location.pathname): PublicLegalPageKey | undefined {
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

export function publicTournamentDetailPath(slug: string, page: PublicMainPage = "tournamentBracket"): string {
  const suffix =
    page === "tournamentNews" ? "/news" :
    page === "tournamentTeams" ? "/teams" :
    page === "tournamentSchedule" ? "/schedule" :
    "";
  return `${PUBLIC_TOURNAMENT_ROUTE_PREFIX}${encodeURIComponent(slug)}${suffix}`;
}

export function setPublicPath(pathname: string, replace = false): void {
  const nextPath = pathname || "/";
  if (window.location.pathname === nextPath) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}
