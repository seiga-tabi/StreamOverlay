import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TwitchAuthService, TwitchOAuthStateStore } from "../dist/services/twitch-auth.js";
import {
  LocalJsonTwitchTokenStore,
  MemoryTwitchTokenStore,
  TWITCH_TOKEN_AAD
} from "../dist/services/twitch-token-store.js";
import { STREAMER_FOLLOWER_TOKEN_AAD } from "../dist/services/streamer-follower-token-store.js";
import { decryptTwitchTokenDocument } from "../dist/services/twitch-token-encryption.js";
import { migrateTwitchTokenStores } from "../dist/services/twitch-token-migration.js";
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

test("OAuth URL은 요청별 redirect URI와 return URL을 state에 저장한다", () => {
  const store = new MemoryTwitchTokenStore();
  const stateStore = new TwitchOAuthStateStore();
  const service = new TwitchAuthService(store, stateStore, baseConfig, async () => {
    throw new Error("fetch should not be called");
  });
  const redirectUri = "http://localhost:3000/api/twitch/auth/callback";
  const returnUrl = "http://localhost:5173/?twitch=connected";

  const url = new URL(service.createAuthorizationUrl(false, { redirectUri, returnUrl }));
  const state = service.consumeState(url.searchParams.get("state"));

  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(state?.redirectUri, redirectUri);
  assert.equal(state?.returnUrl, returnUrl);
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

test("공개 Twitch 로그인은 dashboard 복귀 URL을 state에 보존할 수 있다", () => {
  const service = new PublicTwitchAuthService(
    new PublicTwitchViewerSessionStore(),
    new TwitchOAuthStateStore(),
    {
      clientId: "client_id_test",
      clientSecret: "client_secret_test",
      redirectUri: "http://localhost:3000/api/public/twitch/auth/callback",
      dashboardBaseUrl: "http://localhost:5173"
    }
  );
  const returnUrl = "http://localhost:3000/dashboard?viewer_twitch=connected";

  const url = new URL(service.createAuthorizationUrl(false, undefined, returnUrl));
  const state = service.consumeState(url.searchParams.get("state"));

  assert.equal(state?.returnUrl, returnUrl);
});

test("OAuth code 교환은 state에 저장한 요청별 redirect URI를 사용한다", async () => {
  const store = new MemoryTwitchTokenStore();
  const redirectUri = "http://localhost:3000/api/twitch/auth/callback";
  let capturedBody = "";
  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async (requestUrl, init) => {
    const url = String(requestUrl);
    if (url.includes("/oauth2/token")) {
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({
        access_token: "access_token",
        refresh_token: "refresh_token",
        expires_in: 3600,
        scope: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
        token_type: "bearer"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      data: [{ id: "1234", login: "tester", display_name: "Tester" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  await service.connectWithCode("oauth-code", redirectUri);

  const params = new URLSearchParams(capturedBody);
  assert.equal(params.get("redirect_uri"), redirectUri);
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

test("연결 상태 조회는 만료된 OAuth token을 자동 갱신한다", async () => {
  const store = new MemoryTwitchTokenStore();
  await store.set({
    accessToken: "old_access",
    refreshToken: "old_refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
    expiresAt: "2000-01-01T00:00:00.000Z",
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: "2000-01-01T00:00:00.000Z"
  });

  let refreshCalls = 0;
  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async () => {
    refreshCalls += 1;
    return new Response(JSON.stringify({
      access_token: "new_access",
      refresh_token: "new_refresh",
      expires_in: 3600,
      scope: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
      token_type: "bearer"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  const status = await service.getStatus();
  const stored = await store.get();

  assert.equal(status.state, "connected");
  assert.equal(status.connected, true);
  assert.equal(status.refreshed, true);
  assert.equal(stored?.accessToken, "new_access");
  assert.equal(refreshCalls, 1);
});

test("동시에 들어온 연결 상태 조회는 token refresh를 한 번만 호출한다", async () => {
  const store = new MemoryTwitchTokenStore();
  await store.set({
    accessToken: "old_access",
    refreshToken: "old_refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
    expiresAt: "2000-01-01T00:00:00.000Z",
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: "2000-01-01T00:00:00.000Z"
  });

  let refreshCalls = 0;
  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async () => {
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(JSON.stringify({
      access_token: "new_access",
      refresh_token: "new_refresh",
      expires_in: 3600,
      scope: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
      token_type: "bearer"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  const [first, second] = await Promise.all([service.getStatus(), service.getStatus()]);

  assert.equal(first.state, "connected");
  assert.equal(second.state, "connected");
  assert.equal(first.refreshed, true);
  assert.equal(second.refreshed, true);
  assert.equal(refreshCalls, 1);
});

test("만료된 OAuth refresh token이 거부되면 재연결 안내 상태를 반환한다", async () => {
  const store = new MemoryTwitchTokenStore();
  await store.set({
    accessToken: "old_access",
    refreshToken: "old_refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat", "user:write:chat", "channel:read:redemptions"],
    expiresAt: "2000-01-01T00:00:00.000Z",
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: "2000-01-01T00:00:00.000Z"
  });

  const service = new TwitchAuthService(store, new TwitchOAuthStateStore(), baseConfig, async () => (
    new Response(JSON.stringify({ message: "invalid refresh token" }), { status: 400, headers: { "Content-Type": "application/json" } })
  ));

  const status = await service.getStatus();

  assert.equal(status.state, "token_expired");
  assert.equal(status.connected, false);
  assert.match(status.error ?? "", /Twitch refresh token/);
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
  const encryptionKey = Buffer.alloc(32, 17).toString("base64");
  const store = new LocalJsonTwitchTokenStore(filePath, encryptionKey);
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
  const firstCiphertext = await fs.readFile(filePath, "utf8");
  await store.set(token);
  const secondCiphertext = await fs.readFile(filePath, "utf8");
  const directoryMode = (await fs.stat(path.dirname(filePath))).mode & 0o777;
  const fileMode = (await fs.stat(filePath)).mode & 0o777;
  assert.equal(directoryMode, 0o700);
  assert.equal(fileMode, 0o600);
  assert.doesNotMatch(await fs.readFile(filePath, "utf8"), /access|refresh/);
  assert.notEqual(firstCiphertext, secondCiphertext);

  await fs.chmod(path.dirname(filePath), 0o755);
  await fs.chmod(filePath, 0o644);
  const loaded = await store.get();

  assert.equal(loaded?.accessToken, "access");
  assert.equal((await fs.stat(path.dirname(filePath))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
});

test("변조된 Twitch token 암호문은 다른 AAD와 mutation에서 fail-closed 된다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-token-tamper-"));
  const filePath = path.join(directory, "twitch-token.json");
  const encryptionKey = Buffer.alloc(32, 23).toString("base64");
  const token = {
    accessToken: "sentinel-access-token",
    refreshToken: "sentinel-refresh-token",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: new Date().toISOString()
  };
  try {
    const store = new LocalJsonTwitchTokenStore(filePath, encryptionKey);
    await store.set(token);
    const raw = await fs.readFile(filePath, "utf8");
    assert.doesNotMatch(raw, /sentinel-access-token|sentinel-refresh-token/u);
    assert.throws(
      () => decryptTwitchTokenDocument(
        raw,
        Buffer.from(encryptionKey, "base64"),
        STREAMER_FOLLOWER_TOKEN_AAD
      )
    );
    assert.equal(
      decryptTwitchTokenDocument(raw, Buffer.from(encryptionKey, "base64"), TWITCH_TOKEN_AAD).legacyPlaintext,
      false
    );

    const envelope = JSON.parse(raw);
    envelope.ciphertext = `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`;
    await fs.writeFile(filePath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
    const damaged = await fs.readFile(filePath, "utf8");
    const reopened = new LocalJsonTwitchTokenStore(filePath, encryptionKey);
    await assert.rejects(() => reopened.get(), /STATE_UNAVAILABLE/u);
    assert.equal(reopened.getLoadState(), "encryption_failed");
    await assert.rejects(() => reopened.set(token), /STATE_UNAVAILABLE/u);
    await assert.rejects(() => reopened.clear(), /STATE_UNAVAILABLE/u);
    assert.equal(await fs.readFile(filePath, "utf8"), damaged);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("평문 Twitch token 저장소는 명시적 승인·외부 backup 전에는 변경되지 않는다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-token-migration-"));
  const stateDirectory = path.join(directory, "state");
  const backupDirectory = path.join(directory, "backup");
  const filePath = path.join(stateDirectory, "twitch-token.json");
  const followerFilePath = path.join(stateDirectory, "streamer-follower-tokens.json");
  const token = {
    accessToken: "legacy-access",
    refreshToken: "legacy-refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: new Date().toISOString()
  };
  const followerDocument = {
    version: 1,
    tokensByBroadcasterId: {
      "1234": token
    }
  };
  const encryptionKey = Buffer.alloc(32, 18).toString("base64");
  try {
    await fs.mkdir(stateDirectory, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(token), { mode: 0o600 });
    await fs.writeFile(followerFilePath, JSON.stringify(followerDocument), { mode: 0o600 });
    const original = await fs.readFile(filePath, "utf8");

    const store = new LocalJsonTwitchTokenStore(filePath, encryptionKey);
    await assert.rejects(() => store.get(), /승인된 마이그레이션/u);
    assert.equal(await fs.readFile(filePath, "utf8"), original);
    await assert.rejects(() => migrateTwitchTokenStores({
      tokenStorePath: filePath,
      followerTokenStorePath: followerFilePath,
      stateDirectory,
      backupDirectory,
      encryptionKey,
      operatorApproved: false,
      backupStorageEncryptedConfirmed: true
    }));
    assert.equal(await fs.readFile(filePath, "utf8"), original);

    const result = await migrateTwitchTokenStores({
      tokenStorePath: filePath,
      followerTokenStorePath: followerFilePath,
      stateDirectory,
      backupDirectory,
      encryptionKey,
      operatorApproved: true,
      backupStorageEncryptedConfirmed: true
    });
    assert.equal(result.migrated.length, 2);
    assert.ok(result.backupSnapshotDirectory);
    assert.equal((await fs.stat(result.backupSnapshotDirectory)).mode & 0o777, 0o700);
    assert.equal(
      (await fs.stat(path.join(result.backupSnapshotDirectory, path.basename(filePath)))).mode & 0o777,
      0o600
    );
    assert.equal(
      await fs.readFile(path.join(result.backupSnapshotDirectory, path.basename(filePath)), "utf8"),
      original
    );
    assert.doesNotMatch(await fs.readFile(filePath, "utf8"), /legacy-access|legacy-refresh/);
    assert.doesNotMatch(await fs.readFile(followerFilePath, "utf8"), /legacy-access|legacy-refresh/);
    assert.equal((await new LocalJsonTwitchTokenStore(filePath, encryptionKey).get())?.accessToken, "legacy-access");

    const secondRun = await migrateTwitchTokenStores({
      tokenStorePath: filePath,
      followerTokenStorePath: followerFilePath,
      stateDirectory,
      backupDirectory,
      encryptionKey,
      operatorApproved: true,
      backupStorageEncryptedConfirmed: true
    });
    assert.equal(secondRun.migrated.length, 0);
    assert.equal(secondRun.alreadyEncrypted.length, 2);
    assert.equal(secondRun.backupSnapshotDirectory, undefined);

    const wrongKeyStore = new LocalJsonTwitchTokenStore(filePath, Buffer.alloc(32, 19).toString("base64"));
    await assert.rejects(() => wrongKeyStore.get());

    await fs.copyFile(path.join(result.backupSnapshotDirectory, path.basename(filePath)), filePath);
    await fs.copyFile(
      path.join(result.backupSnapshotDirectory, path.basename(followerFilePath)),
      followerFilePath
    );
    assert.equal((await new LocalJsonTwitchTokenStore(filePath).get())?.accessToken, "legacy-access");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("unknown field가 있는 legacy Twitch token은 마이그레이션하지 않는다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-token-invalid-migration-"));
  const stateDirectory = path.join(directory, "state");
  const backupDirectory = path.join(directory, "backup");
  const filePath = path.join(stateDirectory, "twitch-token.json");
  const followerFilePath = path.join(stateDirectory, "streamer-follower-tokens.json");
  const token = {
    accessToken: "legacy-access",
    refreshToken: "legacy-refresh",
    tokenType: "bearer",
    scopes: ["user:read:chat"],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    broadcaster: { id: "1234", login: "tester", displayName: "Tester" },
    updatedAt: new Date().toISOString(),
    unexpected: true
  };
  const followerDocument = { version: 1, tokensByBroadcasterId: {} };
  const encryptionKey = Buffer.alloc(32, 24).toString("base64");
  try {
    await fs.mkdir(stateDirectory, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(token), { mode: 0o600 });
    await fs.writeFile(followerFilePath, JSON.stringify(followerDocument), { mode: 0o600 });
    const originalToken = await fs.readFile(filePath, "utf8");
    const originalFollower = await fs.readFile(followerFilePath, "utf8");

    await assert.rejects(() => migrateTwitchTokenStores({
      tokenStorePath: filePath,
      followerTokenStorePath: followerFilePath,
      stateDirectory,
      backupDirectory,
      encryptionKey,
      operatorApproved: true,
      backupStorageEncryptedConfirmed: true
    }));
    assert.equal(await fs.readFile(filePath, "utf8"), originalToken);
    assert.equal(await fs.readFile(followerFilePath, "utf8"), originalFollower);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
