export const DASHBOARD_PAGES = [
  "streamerRiotRequests",
  "communityModeration",
  "events",
  "supportInbox",
  "settings",
] as const;

export type Page = (typeof DASHBOARD_PAGES)[number];

export const ADMIN_ALLOWED_PAGES: Page[] = [
  "streamerRiotRequests",
  "communityModeration",
  "events",
  "supportInbox",
  "settings",
];

const ADMIN_PAGE_PATHS: Partial<Record<Page, string>> = {
  streamerRiotRequests: "/admin/riot-id-requests",
  communityModeration: "/admin/community",
  events: "/admin/events",
  supportInbox: "/admin/support",
  settings: "/admin/settings",
};

function normalizedPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function pageAllowed(page: Page): boolean {
  return ADMIN_ALLOWED_PAGES.includes(page);
}

export function defaultDashboardPage(): Page {
  return "streamerRiotRequests";
}

export function dashboardPathForPage(page: Page): string {
  return ADMIN_PAGE_PATHS[page]
    ?? ADMIN_PAGE_PATHS[defaultDashboardPage()]
    ?? "/admin/riot-id-requests";
}

export function dashboardPageFromPath(pathname: string): Page {
  const normalized = normalizedPath(pathname);
  const entries = Object.entries(ADMIN_PAGE_PATHS) as Array<[Page, string]>;
  return entries.find(([, path]) => path === normalized)?.[0] ?? defaultDashboardPage();
}

export function setDashboardPath(
  page: Page,
  replace = false
): void {
  const nextPath = dashboardPathForPage(page);
  if (window.location.pathname === nextPath && !window.location.search && !window.location.hash) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}
