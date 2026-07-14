import assert from "node:assert/strict";
import test from "node:test";
import type { TwitchConnectionStatus } from "@streamops/shared";
import { resolveTwitchDashboardOAuthAction } from "../src/features/dashboard/twitch-oauth";

function connectionStatus(
  state: TwitchConnectionStatus["state"],
  overrides: Partial<TwitchConnectionStatus> = {}
): TwitchConnectionStatus {
  return {
    state,
    connected: state === "connected" || state === "missing_scopes",
    source: state === "disconnected" ? "none" : "oauth",
    grantedScopes: [],
    requiredScopes: [],
    optionalScopes: [],
    enabledOptionalScopes: [],
    missingScopes: state === "missing_scopes" ? ["channel:read:redemptions"] : [],
    ...overrides
  };
}

test("방송 운영 대시보드는 Twitch 미연결 상태에서 연결 액션을 제공한다", () => {
  assert.equal(resolveTwitchDashboardOAuthAction(connectionStatus("disconnected")), "connect");
});

test("방송 운영 대시보드는 토큰 만료와 권한 부족 상태에서 OAuth 갱신 액션을 제공한다", () => {
  assert.equal(resolveTwitchDashboardOAuthAction(connectionStatus("token_expired")), "renew");
  assert.equal(resolveTwitchDashboardOAuthAction(connectionStatus("missing_scopes")), "renew");
  assert.equal(resolveTwitchDashboardOAuthAction(connectionStatus("connected", { error: "refresh failed" })), "renew");
});

test("방송 운영 대시보드는 정상 연결 상태에서 불필요한 OAuth 액션을 숨긴다", () => {
  assert.equal(resolveTwitchDashboardOAuthAction(connectionStatus("connected")), null);
  assert.equal(resolveTwitchDashboardOAuthAction(null), null);
});
