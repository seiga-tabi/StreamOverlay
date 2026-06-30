import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TwitchAuthService, TwitchOAuthStateStore } from "../dist/services/twitch-auth.js";
import { LocalJsonTwitchTokenStore, MemoryTwitchTokenStore } from "../dist/services/twitch-token-store.js";
import { PublicTwitchAuthService, PublicTwitchViewerSessionStore } from "../dist/services/public-twitch-auth.js";

const baseConfig = {
  clientId: "client_id_test",
  clientSecret: "client_secret_test",
  redirectUri: "http://localhost:3000/api/twitch/auth/callback",
  dashboardBaseUrl: "http://localhost:5173",
  extraScopes: []
};

test("OAuth URL은 Authorization Code Flow와 최소 scope, state를 포함한다", () => {
  const store = new MemoryTwitchTokenStore();
  const stateStore = new TwitchOAuthStateStore();
  const service = new TwitchAuthService(store, stateStore, baseConfig, async () => {
    throw new Error("fetch should not be called");
  });

  const url = new URL(service.createAuthorizationUrl());
  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), baseConfig.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), baseConfig.redirectUri);
  assert.equal(url.searchParams.get("scope"), "user:read:chat user:write:chat channel:read:redemptions");
  assert.ok(url.searchParams.get("state"));
});

test("공개 Twitch 로그인 URL은 팔로우와 구독 조회 scope를 요청한다", () => {
  const service = new PublicTwitchAuthService(
    new PublicTwitchViewerSessionStore(),
    new TwitchOAuthStateStore(),
    {
      clientId: "client_id_test",
      clientSecret: "client_secret_test",
      redirectUri: "http://localhost:3000/api/public/twitch/auth/callback",
      dashboardBaseUrl: "http://localhost:5173"
    },
    async () => {
      throw new Error("fetch should not be called");
    }
  );

  const url = new URL(service.createAuthorizationUrl());
  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), baseConfig.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/public/twitch/auth/callback");
  assert.equal(url.searchParams.get("scope"), "user:read:follows user:read:subscriptions");
  assert.match(url.searchParams.get("state") ?? "", /^public:/);
  assert.equal(service.isPublicState(url.searchParams.get("state")), true);
});

test("OAuth state는 일회성으로 검증되고 만료된 state는 거부된다", () => {
  let now = 1_000;
  const stateStore = new TwitchOAuthStateStore(100, () => now);
  const valid = stateStore.create();
  assert.equal(stateStore.consume(valid), true);
  assert.equal(stateStore.consume(valid), false);

  const expired = stateStore.create();
  now += 101;
  assert.equal(stateStore.consume(expired), false);
});

test("token refresh는 refresh_token grant를 호출하고 새 token을 저장한다", async () => {
  const store = new MemoryTwitchTokenStore();
  await store.set({
    accessToken: "old_access",
    refreshToken: "old_refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: "2000-01-01T00:00:00.000Z",
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: "2000-01-01T00:00:00.000Z"
  });

  let capturedBody = "";
  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async (_url, init) => {
    capturedBody = String(init?.body);
    return new Response(JSON.stringify({
      access_token: "new_access",
      refresh_token: "new_refresh",
      expires_in: 3600,
      scope: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
      token_type: "bearer"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  const refreshed = await service.refreshStoredToken();
  assert.equal(refreshed?.accessToken, "new_access");
  assert.equal(refreshed?.refreshToken, "new_refresh");
  assert.match(capturedBody, /grant_type=refresh_token/);
  assert.match(capturedBody, /refresh_token=old_refresh/);
});

test("연결 상태는 누락된 scope를 missing_scopes로 표시한다", async () => {
  const store = new MemoryTwitchTokenStore();
  await store.set({
    accessToken: "access",
    refreshToken: "refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: new Date().toISOString()
  });

  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async () => {
    throw new Error("fetch should not be called");
  });
  const status = await service.getStatus();
  assert.equal(status.state, "missing_scopes");
  assert.deepEqual(status.missingScopes, ["user:write:chat", "channel:read:redemptions"]);
});

test("로컬 Twitch token 저장소는 디렉터리와 파일 권한을 제한한다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-token-store-"));
  const filePath = path.join(directory, "nested", "twitch-token.json");
  const store = new LocalJsonTwitchTokenStore(filePath);
  const token = {
    accessToken: "access",
    refreshToken: "refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: new Date().toISOString()
  };

  await store.set(token);
  const directoryMode = (await fs.stat(path.dirname(filePath))).mode & 0o777;
  const fileMode = (await fs.stat(filePath)).mode & 0o777;
  assert.equal(directoryMode, 0o700);
  assert.equal(fileMode, 0o600);

  await fs.chmod(path.dirname(filePath), 0o755);
  await fs.chmod(filePath, 0o644);
  const loaded = await store.get();

  assert.equal(loaded?.accessToken, "access");
  assert.equal((await fs.stat(path.dirname(filePath))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
});
