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
  "palworldServer",
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
export type StreamerDashboardTenant = {
  streamerSlug: string;
  dashboardKey: string;
};

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
  "lolAccount",
  "lolAutomation",
  "lolParticipation",
  "palworldServer",
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
  palworldServer: "/dashboard/palworld/server",
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

function validStreamerSlug(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

function validDashboardKey(value: string): boolean {
  return /^sdk_[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function decodedPathSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && !decoded.includes("/") && !decoded.includes("\\") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function parsedStreamerPath(pathname: string): {
  routePath: string;
  tenant?: StreamerDashboardTenant;
} {
  const normalized = normalizedPath(pathname);
  const segments = normalized.split("/");
  if (segments[1] !== "dashboard" || segments.length < 4) return { routePath: normalized };

  const streamerSlug = decodedPathSegment(segments[2] ?? "");
  const dashboardKey = decodedPathSegment(segments[3] ?? "");
  if (!streamerSlug || !dashboardKey || !validStreamerSlug(streamerSlug) || !validDashboardKey(dashboardKey)) {
    return { routePath: normalized };
  }

  const suffix = segments.slice(4).join("/");
  return {
    routePath: suffix ? `/dashboard/${suffix}` : "/dashboard",
    tenant: { streamerSlug, dashboardKey }
  };
}

export function streamerDashboardTenantFromPath(pathname: string): StreamerDashboardTenant | undefined {
  return parsedStreamerPath(pathname).tenant;
}

export function streamerDashboardTenantMatches(
  left: StreamerDashboardTenant | undefined,
  right: StreamerDashboardTenant | undefined
): boolean {
  if (!left || !right) return false;
  return left.streamerSlug === right.streamerSlug && left.dashboardKey === right.dashboardKey;
}

export function streamerDashboardBasePath(tenant: StreamerDashboardTenant): string {
  return `/dashboard/${encodeURIComponent(tenant.streamerSlug)}/${encodeURIComponent(tenant.dashboardKey)}`;
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

export function dashboardPathForPage(page: Page, role: DashboardRole, tenant?: StreamerDashboardTenant): string {
  const paths = role === "admin" ? ADMIN_PAGE_PATHS : STREAMER_PAGE_PATHS;
  const canonicalPage = role === "streamer" ? LEGACY_STREAMER_PAGE_ALIASES[page] ?? page : page;
  const path = paths[canonicalPage] ?? paths[defaultPageForRole(role)] ?? (role === "admin" ? "/admin" : "/dashboard");
  if (role !== "streamer" || !tenant) return path;
  return path.replace("/dashboard", streamerDashboardBasePath(tenant));
}

export function dashboardPageFromPath(pathname: string, role: DashboardRole): Page {
  const normalized = role === "streamer" ? parsedStreamerPath(pathname).routePath : normalizedPath(pathname);
  if (role === "streamer" && LEGACY_STREAMER_PAGE_PATHS[normalized]) {
    return LEGACY_STREAMER_PAGE_PATHS[normalized];
  }
  const entries = Object.entries(role === "admin" ? ADMIN_PAGE_PATHS : STREAMER_PAGE_PATHS) as Array<[Page, string]>;
  return entries.find(([, path]) => path === normalized)?.[0] ?? defaultPageForRole(role);
}

export function setDashboardPath(
  page: Page,
  role: DashboardRole,
  replace = false,
  tenant?: StreamerDashboardTenant
): void {
  const nextPath = dashboardPathForPage(page, role, tenant);
  if (window.location.pathname === nextPath) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}
