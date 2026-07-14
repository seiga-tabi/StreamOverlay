import type { TwitchConnectionStatus } from "@streamops/shared";

export type TwitchDashboardOAuthAction = "connect" | "renew" | null;

export function resolveTwitchDashboardOAuthAction(status: TwitchConnectionStatus | null): TwitchDashboardOAuthAction {
  if (!status) return null;
  if (status.state === "disconnected") return "connect";
  if (status.state === "token_expired" || status.state === "missing_scopes" || status.error || !status.connected) {
    return "renew";
  }
  return null;
}
