import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

function createRequest(method, url, body, headers = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    }
  };
}

function createRawRequest(method, url, rawBody, headers = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (rawBody !== undefined) yield Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    }
  };
}

function createMultipartBody(boundary, parts) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = [
      `form-data; name="${part.name}"`,
      part.filename ? `filename="${part.filename}"` : undefined
    ].filter(Boolean).join("; ");
    chunks.push(Buffer.from(`Content-Disposition: ${disposition}\r\n`));
    if (part.contentType) chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
    chunks.push(Buffer.from("\r\n"));
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(String(part.data)));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

test("dashboard overlay test action은 /api/actions/test에서 검증 후 dispatch된다", async () => {
  const dispatched = [];
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });
  const action = {
    type: "overlay.banner",
    title: "Dashboard Test",
    message: "Dashboard 테스트 배너입니다.",
    variant: "info",
    durationMs: 3000,
    source: "dashboard.test"
  };

  const req = createRequest("POST", "/api/actions/test", { action });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].action.type, "overlay.banner");
  assert.equal(dispatched[0].reason, "dashboard.test");
});

test("POST API는 올바르지 않은 JSON body를 400으로 반환한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {
      async dispatchOne() {}
    }
  });

  const req = createRawRequest("POST", "/api/actions/test", "{ broken json");
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /JSON/);
});

test("POST API는 너무 큰 JSON body를 413으로 반환한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {
      async dispatchOne() {}
    }
  });

  const req = createRawRequest("POST", "/api/actions/test", "x".repeat(1_000_001));
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 413);
});

test("API 응답은 기본 보안 헤더를 포함한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {}
  });

  const req = createRequest("GET", "/health");
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["Referrer-Policy"], "no-referrer");
  assert.equal(res.headers["X-Permitted-Cross-Domain-Policies"], "none");
});

test("reward mapping API는 token 없이 read-only summary를 반환한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {}
  });

  const req = createRequest("GET", "/api/rewards/mappings");
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
  assert.equal(typeof body[0].hasOverlayAction, "boolean");
  assert.equal("accessToken" in body[0], false);
});

test("EventSub reconnect API는 client reconnect를 호출하고 status를 반환한다", async () => {
  let reconnectReason;
  const handler = createHttpHandler({
    store: {
      getTwitchEventSubStatus() {
        return { websocket: "reconnecting", activeSubscriptions: 0, failedSubscriptions: [], missingScopes: [], subscriptions: [] };
      },
      getTwitchChatStatus() {
        return { mode: "broadcaster", queueSize: 0, throttleMs: 1500, cooldownMs: 10000, maxMessageLength: 500, recentFailures: [] };
      }
    },
    twitchAuth: {
      async getStatus() {
        return { state: "connected", connected: true, source: "oauth", grantedScopes: [], requiredScopes: [], optionalScopes: [], enabledOptionalScopes: [], missingScopes: [] };
      }
    },
    actions: {},
    eventSub: {
      reconnect(reason) {
        reconnectReason = reason;
      }
    }
  });

  const req = createRequest("POST", "/api/twitch/eventsub/reconnect", {});
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(reconnectReason, "dashboard.admin");
  assert.equal(JSON.parse(res.body).eventSub.websocket, "reconnecting");
});

test("follower refresh API는 Twitch follower snapshot을 Store에 반영한다", async () => {
  const calls = [];
  let followerState;
  const handler = createHttpHandler({
    store: {
      reconcileFollowerSnapshot(input) {
        calls.push(input);
        followerState = {
          summary: { knownFollowers: input.followers.length, activeFollowers: input.followers.length, unfollowed: 0, newFollowers7d: 1, observedGenreFollowers: 0 },
          followers: input.followers,
          recentFollowers: input.followers,
          recentUnfollowers: [],
          topObservedGenres: [],
          lastSnapshotTotal: input.total,
          lastSnapshotTruncated: input.truncated,
          dataNotes: []
        };
        return followerState;
      }
    },
    twitch: {
      async getChannelFollowers(limit) {
        assert.equal(limit, 50);
        return {
          followers: [{ userId: "100", userLogin: "viewer100", userName: "Viewer100", followedAt: "2026-06-01T00:00:00.000Z" }],
          total: 1,
          truncated: false
        };
      }
    },
    twitchAuth: {},
    actions: {}
  });

  const req = createRequest("POST", "/api/followers/refresh?limit=50", {});
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].followers[0].userName, "Viewer100");
  assert.equal(JSON.parse(res.body).summary.activeFollowers, 1);
});

test("follower refresh API는 scope 부족 오류를 400으로 반환한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitch: {
      async getChannelFollowers() {
        throw new Error("moderator:read:followers scope가 필요합니다.");
      }
    },
    twitchAuth: {},
    actions: {}
  });

  const req = createRequest("POST", "/api/followers/refresh", {});
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /moderator:read:followers/);
});

test("Riot API key 설정 API는 key 원문을 응답하지 않는다", async () => {
  const rawKey = "RGAPI-dashboard-secret-key";
  let runtimeKey = "";
  const handler = createHttpHandler({
    store: {},
    riot: {
      credentialStatus() {
        return {
          configured: Boolean(runtimeKey),
          source: runtimeKey ? "runtime" : "none",
          maskedKey: runtimeKey ? "RGAPI-...-key" : undefined,
          updatedAt: runtimeKey ? "2026-06-22T00:00:00.000Z" : undefined,
          accountRegion: "asia",
          lolPlatform: "kr"
        };
      },
      setRuntimeApiKey(apiKey) {
        runtimeKey = apiKey;
        return this.credentialStatus();
      },
      clearRuntimeApiKey() {
        runtimeKey = "";
        return this.credentialStatus();
      }
    },
    twitchAuth: {},
    actions: {}
  });

  const getReq = createRequest("GET", "/api/riot/settings");
  const getRes = createResponse();
  await handler(getReq, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.equal(JSON.parse(getRes.body).source, "none");

  const postReq = createRequest("POST", "/api/riot/api-key", { apiKey: rawKey });
  const postRes = createResponse();
  await handler(postReq, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(runtimeKey, rawKey);
  assert.equal(JSON.parse(postRes.body).source, "runtime");
  assert.doesNotMatch(postRes.body, new RegExp(rawKey));

  const deleteReq = createRequest("POST", "/api/riot/api-key/delete", {});
  const deleteRes = createResponse();
  await handler(deleteReq, deleteRes);

  assert.equal(deleteRes.statusCode, 200);
  assert.equal(runtimeKey, "");
  assert.equal(JSON.parse(deleteRes.body).source, "none");
});

test("participation game monitor API는 방송자 Riot ID를 저장하고 반환한다", async () => {
  const previousConfigDir = appConfig.paths.config;
  const previousStateDir = appConfig.paths.state;
  const configDir = mkdtempSync(path.join(tmpdir(), "streamops-game-monitor-config-"));
  const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-game-monitor-state-"));
  try {
    writeFileSync(path.join(configDir, "lol-participation.json"), JSON.stringify({
      enabled: true,
      showRiotIdPublicly: false,
      gameMonitor: {
        enabled: true,
        streamerRiotId: "",
        pollIntervalMs: 45000,
        gameEndDebounceMs: 90000,
        autoSelectNextAfterGame: true,
        announceInChat: true
      }
    }, null, 2));
    appConfig.paths.config = configDir;
    appConfig.paths.state = stateDir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const getReq = createRequest("GET", "/api/participation/game-monitor");
    const getRes = createResponse();
    await handler(getReq, getRes);

    assert.equal(getRes.statusCode, 200);
    assert.equal(JSON.parse(getRes.body).streamerRiotId, "");

    const postReq = createRequest("POST", "/api/participation/game-monitor", {
      streamerRiotId: "Streamer#KR1",
      enabled: true,
      autoSelectNextAfterGame: true,
      announceInChat: false
    });
    const postRes = createResponse();
    await handler(postReq, postRes);

    assert.equal(postRes.statusCode, 200);
    const body = JSON.parse(postRes.body);
    assert.equal(body.streamerRiotId, "Streamer#KR1");
    assert.equal(body.announceInChat, false);

    const baseConfig = JSON.parse(readFileSync(path.join(configDir, "lol-participation.json"), "utf8"));
    assert.equal(baseConfig.gameMonitor.streamerRiotId, "");
    assert.equal(baseConfig.gameMonitor.announceInChat, true);

    const saved = JSON.parse(readFileSync(path.join(stateDir, "lol-game-monitor.json"), "utf8"));
    assert.equal(saved.streamerRiotId, "Streamer#KR1");
    assert.equal(saved.announceInChat, false);
  } finally {
    appConfig.paths.config = previousConfigDir;
    appConfig.paths.state = previousStateDir;
    rmSync(configDir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("participation game monitor API는 잘못된 Riot ID를 거부한다", async () => {
  const previousConfigDir = appConfig.paths.config;
  const previousStateDir = appConfig.paths.state;
  const configDir = mkdtempSync(path.join(tmpdir(), "streamops-game-monitor-invalid-config-"));
  const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-game-monitor-invalid-state-"));
  try {
    writeFileSync(path.join(configDir, "lol-participation.json"), JSON.stringify({ gameMonitor: { enabled: true, streamerRiotId: "" } }));
    appConfig.paths.config = configDir;
    appConfig.paths.state = stateDir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const req = createRequest("POST", "/api/participation/game-monitor", {
      streamerRiotId: "StreamerWithoutTag"
    });
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /#/);
  } finally {
    appConfig.paths.config = previousConfigDir;
    appConfig.paths.state = previousStateDir;
    rmSync(configDir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("/alerts 경로는 overlay public asset을 서빙한다", async () => {
  const previousOverlayStatic = appConfig.paths.overlayStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-alerts-"));
  try {
    mkdirSync(path.join(dir, "alerts"));
    writeFileSync(path.join(dir, "alerts", "test.gif"), Buffer.from("GIF89a"));
    writeFileSync(path.join(dir, "alerts", "test.wav"), Buffer.from("RIFF"));
    appConfig.paths.overlayStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const req = createRequest("GET", "/alerts/test.gif");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "image/gif");
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");

    const wavReq = createRequest("GET", "/alerts/test.wav");
    const wavRes = createResponse();
    await handler(wavReq, wavRes);

    assert.equal(wavRes.statusCode, 200);
    assert.equal(wavRes.headers["Content-Type"], "audio/wav");
  } finally {
    appConfig.paths.overlayStatic = previousOverlayStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("알림 GIF 업로드 API는 파일을 state에 저장하고 overlay URL로 서빙한다", async () => {
  const previousConfigDir = appConfig.paths.config;
  const previousStateDir = appConfig.paths.state;
  const configDir = mkdtempSync(path.join(tmpdir(), "streamops-alert-config-"));
  const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-alert-state-"));
  try {
    appConfig.paths.config = configDir;
    appConfig.paths.state = stateDir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });
    const boundary = "streamops-test-boundary";
    const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.from([1, 0, 1, 0, 0, 0, 0])]);
    const uploadBody = createMultipartBody(boundary, [
      { name: "eventType", data: "follow" },
      { name: "file", filename: "follow.gif", contentType: "image/gif", data: gif }
    ]);

    const uploadReq = createRawRequest("POST", "/api/alerts/assets", uploadBody, {
      "content-type": `multipart/form-data; boundary=${boundary}`
    });
    const uploadRes = createResponse();
    await handler(uploadReq, uploadRes);

    assert.equal(uploadRes.statusCode, 200);
    const uploaded = JSON.parse(uploadRes.body);
    assert.match(uploaded.url, /^\/alerts\/uploads\/follow-\d+-[a-f0-9]+\.gif$/);
    assert.equal(uploaded.size, gif.byteLength);

    const saveReq = createRequest("POST", "/api/alerts/config", {
      eventType: "follow",
      mediaUrl: uploaded.url,
      mediaAlt: "follow alert"
    });
    const saveRes = createResponse();
    await handler(saveReq, saveRes);

    assert.equal(saveRes.statusCode, 200);
    const saved = JSON.parse(saveRes.body);
    assert.equal(saved.config.follow.mediaUrl, uploaded.url);
    assert.equal(saved.assets.length, 1);

    const runtimeConfig = JSON.parse(readFileSync(path.join(stateDir, "alert-overlays.runtime.json"), "utf8"));
    assert.equal(runtimeConfig.follow.mediaUrl, uploaded.url);

    const assetReq = createRequest("GET", uploaded.url);
    const assetRes = createResponse();
    await handler(assetReq, assetRes);

    assert.equal(assetRes.statusCode, 200);
    assert.equal(assetRes.headers["Content-Type"], "image/gif");
    assert.equal(assetRes.headers["X-Content-Type-Options"], "nosniff");
  } finally {
    appConfig.paths.config = previousConfigDir;
    appConfig.paths.state = previousStateDir;
    rmSync(configDir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("알림 asset 업로드 API는 GIF가 아닌 파일을 거부한다", async () => {
  const previousStateDir = appConfig.paths.state;
  const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-alert-invalid-state-"));
  try {
    appConfig.paths.state = stateDir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });
    const boundary = "streamops-test-boundary-invalid";
    const uploadBody = createMultipartBody(boundary, [
      { name: "eventType", data: "cheer" },
      { name: "file", filename: "cheer.png", contentType: "image/png", data: Buffer.from("not-a-gif") }
    ]);

    const req = createRawRequest("POST", "/api/alerts/assets", uploadBody, {
      "content-type": `multipart/form-data; boundary=${boundary}`
    });
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /GIF/);
  } finally {
    appConfig.paths.state = previousStateDir;
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("정적 asset은 ETag 재검증 시 body 없이 304로 응답한다", async () => {
  const previousOverlayStatic = appConfig.paths.overlayStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-static-cache-"));
  try {
    mkdirSync(path.join(dir, "alerts"));
    writeFileSync(path.join(dir, "alerts", "test.gif"), Buffer.from("GIF89a"));
    appConfig.paths.overlayStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const firstReq = createRequest("GET", "/alerts/test.gif");
    const firstRes = createResponse();
    await handler(firstReq, firstRes);

    assert.equal(firstRes.statusCode, 200);
    assert.equal(typeof firstRes.headers.ETag, "string");

    const secondReq = createRequest("GET", "/alerts/test.gif", undefined, { "if-none-match": firstRes.headers.ETag });
    const secondRes = createResponse();
    await handler(secondReq, secondRes);

    assert.equal(secondRes.statusCode, 304);
    assert.equal(secondRes.body, "");
  } finally {
    appConfig.paths.overlayStatic = previousOverlayStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("/tts 경로는 로컬 TTS 캐시 WAV를 서빙한다", async () => {
  const previousCacheDir = appConfig.localTts.cacheDir;
  const previousPublicPath = appConfig.localTts.publicPath;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-tts-"));
  try {
    writeFileSync(path.join(dir, "voice.wav"), Buffer.from("RIFF"));
    appConfig.localTts.cacheDir = dir;
    appConfig.localTts.publicPath = "/tts";
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const req = createRequest("GET", "/tts/voice.wav");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "audio/wav");
  } finally {
    appConfig.localTts.cacheDir = previousCacheDir;
    appConfig.localTts.publicPath = previousPublicPath;
    rmSync(dir, { recursive: true, force: true });
  }
});
