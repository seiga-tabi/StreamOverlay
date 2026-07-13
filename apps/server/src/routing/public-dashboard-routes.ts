const PUBLIC_DASHBOARD_EXACT_PATHS = new Set([
  "/lol",
  "/lol/",
  "/follow",
  "/follow/",
  "/participation",
  "/participation/",
  "/community",
  "/community/",
  "/privacy",
  "/terms",
  "/contact",
  "/lol/tournaments"
]);

const PUBLIC_DASHBOARD_PATH_PREFIXES = [
  "/lol/summoners/",
  "/lol/tournaments/",
  "/community/server",
  "/community/party",
  "/community/posts/"
];

export function isPublicDashboardAppRoute(pathname: string): boolean {
  if (PUBLIC_DASHBOARD_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_DASHBOARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
