import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { TwitchOAuthStateStore } from "../dist/services/twitch-auth.js";
import {
  StreamerFollowerAuthError,
  StreamerFollowerAuthService
} from "../dist/services/streamer-follower-auth.js";
import {
  LocalJsonStreamerFollowerTokenStore,
  MemoryStreamerFollowerTokenStore
} from "../dist/services/streamer-follower-token-store.js";

const authConfig = {
  clientId: "follower-client-id",
  clientSecret: "follower-client-secret"
};
const redirectUri = "http://localhost:3000/api/twitch/auth/callback";
const returnUrl = "http://localhost:3000/dashboard/streamer/sdk_dashboard_key/followers";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function storedToken(ownerId, overrides = {}) {
  return {
    accessToken: `access-${ownerId}`,
    refreshToken: `refresh-${ownerId}`,
    tokenType: "bearer",
    scopes: ["moderator:read:followers"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: ownerId, login: `streamer${ownerId}`, displayName: `Streamer ${ownerId}` },
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

test("스트리머 follower OAuth URL은 전용 scope와 owner가 결합된 일회성 state만 사용한다", () => {
  const service = new StreamerFollowerAuthService(
    new MemoryStreamerFollowerTokenStore(),
    new TwitchOAuthStateStore(),
    authConfig,
    async () => {
      throw new Error("fetch should not be called");
    }
  );

  const url = new URL(service.createAuthorizationUrl("101", { redirectUri, returnUrl, forceVerify: true }));

  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("scope"), "moderator:read:followers");
  assert.equal(url.searchParams.get("force_verify"), "true");
  assert.match(url.searchParams.get("state") ?? "", /^streamer-followers:/);
  const state = service.consumeState(url.searchParams.get("state"));
  assert.deepEqual(state, { ownerId: "101", redirectUri, returnUrl });
  assert.equal(service.consumeState(url.searchParams.get("state")), undefined);
});

test("OAuth callback 계정이 인증 owner와 다르면 token을 저장하지 않는다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig, async (requestUrl) => {
    if (String(requestUrl).includes("/oauth2/token")) {
      return jsonResponse({
        access_token: "wrong-owner-access",
        refresh_token: "wrong-owner-refresh",
        expires_in: 3600,
        scope: ["moderator:read:followers"],
        token_type: "bearer"
      });
    }
    return jsonResponse({ data: [{ id: "202", login: "other", display_name: "Other" }] });
  });

  await assert.rejects(
    () => service.connectWithCode("oauth-code", { ownerId: "101", redirectUri }),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "OWNER_MISMATCH"
  );
  assert.equal(await store.get("101"), undefined);
  assert.equal(await store.get("202"), undefined);
});

test("연결 상태에는 token 원문을 노출하지 않고 내부 access context만 owner별로 반환한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig, async (requestUrl) => {
    if (String(requestUrl).includes("/oauth2/token")) {
      return jsonResponse({
        access_token: "private-access-token",
        refresh_token: "private-refresh-token",
        expires_in: 3600,
        scope: ["moderator:read:followers"],
        token_type: "bearer"
      });
    }
    return jsonResponse({ data: [{ id: "101", login: "owner", display_name: "Owner" }] });
  });

  const status = await service.connectWithCode("oauth-code", { ownerId: "101", redirectUri });
  const serializedStatus = JSON.stringify(status);
  assert.equal(status.state, "connected");
  assert.equal(serializedStatus.includes("private-access-token"), false);
  assert.equal(serializedStatus.includes("private-refresh-token"), false);

  const context = await service.getAccessContext("101");
  assert.deepEqual(context, {
    clientId: authConfig.clientId,
    accessToken: "private-access-token",
    scopes: ["moderator:read:followers"],
    broadcasterId: "101"
  });
  assert.equal((await service.getStatus("202")).state, "disconnected");
});

test("scope 부족과 미연결 상태를 typed 오류로 구분한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", { scopes: ["user:read:follows"] }));
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig);

  assert.deepEqual(await service.getStatus("101"), {
    state: "missing_scopes",
    missingScopes: ["moderator:read:followers"],
    tokenExpiresAt: (await store.get("101")).expiresAt
  });
  await assert.rejects(
    () => service.getAccessContext("101"),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "MISSING_SCOPES"
  );
  await assert.rejects(
    () => service.getAccessContext("202"),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "NOT_CONNECTED"
  );
});

test("token refresh in-flight는 같은 owner끼리만 합치고 다른 owner는 독립 실행한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", { expiresAt: "2000-01-01T00:00:00.000Z" }));
  await store.set("202", storedToken("202", { expiresAt: "2000-01-01T00:00:00.000Z" }));
  const refreshCalls = new Map();
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig, async (_requestUrl, init) => {
    const params = new URLSearchParams(String(init?.body));
    const refreshToken = params.get("refresh_token");
    refreshCalls.set(refreshToken, (refreshCalls.get(refreshToken) ?? 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jsonResponse({
      access_token: `new-${refreshToken}`,
      refresh_token: `rotated-${refreshToken}`,
      expires_in: 3600,
      scope: ["moderator:read:followers"],
      token_type: "bearer"
    });
  });

  const [first, second, other] = await Promise.all([
    service.getAccessContext("101"),
    service.getAccessContext("101"),
    service.getAccessContext("202")
  ]);

  assert.equal(first.accessToken, "new-refresh-101");
  assert.equal(second.accessToken, "new-refresh-101");
  assert.equal(other.accessToken, "new-refresh-202");
  assert.equal(refreshCalls.get("refresh-101"), 1);
  assert.equal(refreshCalls.get("refresh-202"), 1);
});

test("진행 중인 옛 token refresh는 새 OAuth 연결 token을 덮어쓰지 않는다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", { expiresAt: "2000-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }));
  let releaseRefresh;
  const refreshStarted = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  let respond;
  const response = new Promise((resolve) => {
    respond = resolve;
  });
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig, async () => {
    releaseRefresh();
    return response;
  });

  const refreshing = service.getAccessContext("101");
  await refreshStarted;
  await store.set("101", storedToken("101", {
    accessToken: "new-oauth-access",
    refreshToken: "new-oauth-refresh",
    updatedAt: "2026-07-21T00:00:00.000Z"
  }));
  respond(jsonResponse({
    access_token: "stale-refreshed-access",
    refresh_token: "stale-refreshed-refresh",
    expires_in: 3600,
    scope: ["moderator:read:followers"]
  }));

  assert.equal((await refreshing).accessToken, "new-oauth-access");
  assert.equal((await store.get("101"))?.accessToken, "new-oauth-access");
});

test("연결 해제 중 완료된 옛 token refresh는 삭제한 token을 되살리지 않는다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", { expiresAt: "2000-01-01T00:00:00.000Z" }));
  let releaseRefresh;
  const refreshStarted = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  let respond;
  const response = new Promise((resolve) => {
    respond = resolve;
  });
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig, async () => {
    releaseRefresh();
    return response;
  });

  const refreshing = service.getAccessContext("101");
  await refreshStarted;
  await service.disconnect("101");
  respond(jsonResponse({
    access_token: "stale-refreshed-access",
    refresh_token: "stale-refreshed-refresh",
    expires_in: 3600,
    scope: ["moderator:read:followers"]
  }));

  await assert.rejects(
    () => refreshing,
    (error) => error instanceof StreamerFollowerAuthError && error.code === "NOT_CONNECTED"
  );
  assert.equal(await store.get("101"), undefined);
});

test("만료된 refresh token은 token_expired 상태와 typed 오류로 구분한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", { expiresAt: "2000-01-01T00:00:00.000Z" }));
  const service = new StreamerFollowerAuthService(
    store,
    new TwitchOAuthStateStore(),
    authConfig,
    async () => jsonResponse({ message: "invalid refresh token" }, 401)
  );

  const status = await service.getStatus("101");
  assert.equal(status.state, "token_expired");
  assert.match(status.error ?? "", /다시 연결/);
  await assert.rejects(
    () => service.getAccessContext("101"),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "TOKEN_EXPIRED"
  );
});

test("Twitch 401 뒤 강제 갱신이 거부되면 이후 상태도 token_expired로 유지한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101"));
  let refreshCalls = 0;
  const service = new StreamerFollowerAuthService(
    store,
    new TwitchOAuthStateStore(),
    authConfig,
    async () => {
      refreshCalls += 1;
      return jsonResponse({ message: "revoked" }, 401);
    }
  );

  await assert.rejects(
    () => service.getAccessContext("101", { forceRefresh: true }),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "TOKEN_EXPIRED"
  );
  const status = await service.getStatus("101");

  assert.equal(status.state, "token_expired");
  assert.equal(refreshCalls, 1);
});

test("갱신 후 access token도 거부되면 owner token 상태를 재승인 필요로 표시한다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101"));
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig);

  await service.markAccessTokenRejected("101", "access-101");

  assert.equal((await service.getStatus("101")).state, "token_expired");
  await assert.rejects(
    () => service.getAccessContext("101"),
    (error) => error instanceof StreamerFollowerAuthError && error.code === "TOKEN_EXPIRED"
  );
});

test("옛 access token의 지연된 401은 새 OAuth 연결 token을 만료 처리하지 않는다", async () => {
  const store = new MemoryStreamerFollowerTokenStore();
  await store.set("101", storedToken("101", {
    accessToken: "old-access",
    refreshToken: "old-refresh",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }));
  const service = new StreamerFollowerAuthService(store, new TwitchOAuthStateStore(), authConfig);
  await store.set("101", storedToken("101", {
    accessToken: "new-oauth-access",
    refreshToken: "new-oauth-refresh",
    updatedAt: "2026-07-21T00:00:00.000Z"
  }));

  await service.markAccessTokenRejected("101", "old-access");

  assert.equal((await store.get("101"))?.accessToken, "new-oauth-access");
  assert.equal((await service.getStatus("101")).state, "connected");
});

test("로컬 scoped token 저장소는 한 고정 파일에 owner별로 원자 저장하고 권한을 제한한다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-follower-token-store-"));
  const filePath = path.join(directory, "fixed", "streamer-follower-tokens.json");
  try {
    const store = new LocalJsonStreamerFollowerTokenStore(filePath);
    await Promise.all([
      store.set("101", storedToken("101")),
      store.set("202", storedToken("202"))
    ]);

    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    assert.equal(parsed.version, 1);
    assert.deepEqual(Object.keys(parsed.tokensByBroadcasterId).sort(), ["101", "202"]);
    assert.equal((await fs.stat(path.dirname(filePath))).mode & 0o777, 0o700);
    assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
    assert.equal(await fs.stat(`${filePath}.tmp`).catch(() => undefined), undefined);

    const reloaded = new LocalJsonStreamerFollowerTokenStore(filePath);
    assert.equal((await reloaded.get("101"))?.accessToken, "access-101");
    assert.equal((await reloaded.get("202"))?.accessToken, "access-202");
    await reloaded.clear("101");
    assert.equal(await reloaded.get("101"), undefined);
    assert.equal((await reloaded.get("202"))?.accessToken, "access-202");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
