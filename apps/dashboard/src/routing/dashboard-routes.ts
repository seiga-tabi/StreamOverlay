export const DASHBOARD_PAGES = [
  "dashboard",
  "twitch",
  "overlayStatus",
  "overlayTest",
  "overlayRewards",
  "overlayAlerts",
  "lolAccount",
  "lolAutomation",
  "lolParticipation",
  "myRiotAccount",
  "soloRank",
  "participation",
  "serverStatus",
  "tournaments",
  "streamerRiotRequests",
  "followers",
  "communityModeration",
  "events",
  "supportInbox",
  "settings",
] as const;

export type Page = (typeof DASHBOARD_PAGES)[number];
export type DashboardRole = "admin" | "streamer";
export type LolOperationsPage = "lolAccount" | "lolAutomation" | "lolParticipation";

export const ADMIN_ALLOWED_PAGES: Page[] = [
  "serverStatus",
  "tournaments",
  "streamerRiotRequests",
  "communityModeration",
  "events",
  "supportInbox",
  "settings",
];

export const STREAMER_ALLOWED_PAGES: Page[] = [
  "dashboard",
  "overlayStatus",
  "overlayAlerts",
  "lolAccount",
  "lolAutomation",
  "lolParticipation",
  "followers",
];

const ADMIN_PAGE_PATHS: Partial<Record<Page, string>> = {
  serverStatus: "/admin",
  tournaments: "/admin/tournaments",
  streamerRiotRequests: "/admin/riot-id-requests",
  communityModeration: "/admin/community",
  events: "/admin/events",
  supportInbox: "/admin/support",
  settings: "/admin/settings",
};

const STREAMER_PAGE_PATHS: Partial<Record<Page, string>> = {
  dashboard: "/dashboard",
  overlayStatus: "/dashboard/overlay",
  overlayAlerts: "/dashboard/alerts",
  lolAccount: "/dashboard/lol/account",
  lolAutomation: "/dashboard/lol/automation",
  lolParticipation: "/dashboard/lol/participation",
  followers: "/dashboard/followers",
};

const LEGACY_STREAMER_PAGE_PATHS: Record<string, Page> = {
  "/dashboard/lol": "lolAccount",
  "/dashboard/riot-account": "lolAccount",
  "/dashboard/solo-rank": "lolAutomation",
  "/dashboard/participation": "lolParticipation",
};

const LEGACY_STREAMER_PAGE_ALIASES: Partial<Record<Page, Page>> = {
  myRiotAccount: "lolAccount",
  soloRank: "lolAutomation",
  participation: "lolParticipation",
};

function normalizedPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function pageAllowedForRole(page: Page, role: DashboardRole): boolean {
  const allowedPages = role === "admin" ? ADMIN_ALLOWED_PAGES : STREAMER_ALLOWED_PAGES;
  return allowedPages.includes(page);
}

export function defaultPageForRole(role: DashboardRole): Page {
  return role === "admin" ? "serverStatus" : "dashboard";
}

export function isLolOperationsPage(page: Page): page is LolOperationsPage {
  return page === "lolAccount" || page === "lolAutomation" || page === "lolParticipation";
}

export function dashboardPathForPage(page: Page, role: DashboardRole): string {
  const paths = role === "admin" ? ADMIN_PAGE_PATHS : STREAMER_PAGE_PATHS;
  const canonicalPage = role === "streamer" ? LEGACY_STREAMER_PAGE_ALIASES[page] ?? page : page;
  return paths[canonicalPage] ?? paths[defaultPageForRole(role)] ?? (role === "admin" ? "/admin" : "/dashboard");
}

export function dashboardPageFromPath(pathname: string, role: DashboardRole): Page {
  const normalized = normalizedPath(pathname);
  if (role === "streamer" && LEGACY_STREAMER_PAGE_PATHS[normalized]) {
    return LEGACY_STREAMER_PAGE_PATHS[normalized];
  }
  const entries = Object.entries(role === "admin" ? ADMIN_PAGE_PATHS : STREAMER_PAGE_PATHS) as Array<[Page, string]>;
  return entries.find(([, path]) => path === normalized)?.[0] ?? defaultPageForRole(role);
}

export function setDashboardPath(page: Page, role: DashboardRole, replace = false): void {
  const nextPath = dashboardPathForPage(page, role);
  if (window.location.pathname === nextPath) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}
