import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { PUBLIC_TWITCH_VIEWER_SESSION_COOKIE } = await import("../dist/services/public-twitch-auth.js");
const { Store } = await import("../dist/services/store.js");

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

test("dashboard와 overlay runtime config는 동적 config endpoint에서 제공된다", async () => {
  const previousConfig = {
    publicBaseUrl: appConfig.publicBaseUrl,
    overlayBaseUrl: appConfig.overlayBaseUrl,
    legalOperatorName: appConfig.legal.operatorName
  };
  appConfig.publicBaseUrl = "http://localhost:3000";
  appConfig.overlayBaseUrl = "http://localhost:3000/overlay";
  appConfig.legal.operatorName = "</script><script>alert(1)</script>";

  try {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const dashboardReq = createRequest("GET", "/dashboard/config.js");
    const dashboardRes = createResponse();
    await handler(dashboardReq, dashboardRes);

    assert.equal(dashboardRes.statusCode, 200);
    assert.match(dashboardRes.headers["Content-Type"], /text\/javascript/);
    assert.equal(dashboardRes.headers["Cache-Control"], "no-store, max-age=0");
    assert.equal(dashboardRes.headers["Cloudflare-CDN-Cache-Control"], "no-store");
    assert.match(dashboardRes.body, /apiBase/);
    assert.match(dashboardRes.body, /wsBase/);
    assert.match(dashboardRes.body, /overlayBase/);
    assert.match(dashboardRes.body, /legal/);
    assert.match(dashboardRes.body, /configured/);
    assert.match(dashboardRes.body, /\\u003c\/script>/);
    assert.doesNotMatch(dashboardRes.body, /<\/script><script>/);
    assert.match(dashboardRes.body, /window\.location\.origin \+ "\/overlay"/);
    assert.doesNotMatch(dashboardRes.body, /localhost:5174/);

    const adminReq = createRequest("GET", "/admin/config.js");
    const adminRes = createResponse();
    await handler(adminReq, adminRes);

    assert.equal(adminRes.statusCode, 200);
    assert.match(adminRes.headers["Content-Type"], /text\/javascript/);
    assert.match(adminRes.body, /apiBase/);
    assert.match(adminRes.body, /overlayBase/);

    const overlayReq = createRequest("GET", "/overlay/config.js");
    const overlayRes = createResponse();
    await handler(overlayReq, overlayRes);

    assert.equal(overlayRes.statusCode, 200);
    assert.match(overlayRes.headers["Content-Type"], /text\/javascript/);
    assert.equal(overlayRes.headers["Cache-Control"], "no-store, max-age=0");
    assert.match(overlayRes.body, /wsBase/);
    assert.doesNotMatch(overlayRes.body, /overlayBase/);
  } finally {
    appConfig.publicBaseUrl = previousConfig.publicBaseUrl;
    appConfig.overlayBaseUrl = previousConfig.overlayBaseUrl;
    appConfig.legal.operatorName = previousConfig.legalOperatorName;
  }
});

test("readiness는 의존성 실패와 종료 중 상태를 503으로 반환한다", async () => {
  const dependencyHandler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    readiness: () => ({ ok: false, checks: { persistenceHealthy: false }, errors: ["runtime:save"] })
  });
  const dependencyReq = createRequest("GET", "/health/ready");
  const dependencyRes = createResponse();
  await dependencyHandler(dependencyReq, dependencyRes);
  assert.equal(dependencyRes.statusCode, 503);
  assert.equal(JSON.parse(dependencyRes.body).checks.persistenceHealthy, false);

  const shutdownHandler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    readiness: () => ({ ok: true, checks: { persistenceHealthy: true } }),
    isShuttingDown: () => true
  });
  const shutdownReq = createRequest("GET", "/health/ready");
  const shutdownRes = createResponse();
  await shutdownHandler(shutdownReq, shutdownRes);
  assert.equal(shutdownRes.statusCode, 503);
  assert.equal(JSON.parse(shutdownRes.body).checks.acceptingRequests, false);
});

test("liveness는 재시작 감지에 필요한 instance 메타데이터를 반환한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} }
  });
  const req = createRequest("GET", "/health/live");
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.status, "live");
  assert.ok(Number.isFinite(Date.parse(body.startedAt)));
  assert.ok(body.uptimeSeconds >= 0);
});

test("관리자 서버 현황은 민감정보 없이 현재 런타임 상태를 반환한다", async () => {
  const handler = createHttpHandler({
    store: {
      getStatus() {
        return {
          server: "online",
          twitch: "connected",
          stream: "offline",
          bridge: "connected",
          obs: "connected",
          participation: "closed",
          startedAt: "2026-07-11T00:00:00.000Z"
        };
      }
    },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    readiness: () => ({ ok: true, checks: { persistenceHealthy: true }, errors: [] }),
    connectionStatus: () => ({
      http: 3,
      dashboardWebSocket: 2,
      overlayWebSocket: 4,
      bridge: true
    })
  });
  const req = createRequest("GET", "/api/dashboard/server-status");
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ready");
  assert.equal(body.readiness.checks.persistenceHealthy, true);
  assert.equal(body.connections.dashboardWebSocket, 2);
  assert.equal(body.connections.overlayWebSocket, 4);
  assert.equal(body.services.twitch, "connected");
  assert.ok(body.uptimeSeconds >= 0);
  assert.ok(body.memory.rssBytes > 0);
  assert.doesNotMatch(res.body, /DASHBOARD_AUTH_TOKEN|BRIDGE_SHARED_SECRET|OVERLAY_ACCESS_TOKEN/);
});

test("공개 소환사 URL은 dashboard 앱 index를 서빙한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-public-lol-route-"));
  try {
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title><div id=\"root\"></div>"
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const req = createRequest("GET", "/lol/summoners/jp/%E3%81%9B%E3%81%84%E3%81%8C-sei");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /text\/html/);
    assert.match(res.body, /YORO\.gg/);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.headers.ETag, undefined);
    const nonce = /script-src 'nonce-([^']+)'/.exec(res.headers["Content-Security-Policy"])?.[1];
    assert.ok(nonce);
    assert.match(res.headers["Content-Security-Policy"], /'strict-dynamic'/);
    assert.match(res.body, new RegExp(`nonce=\"${nonce}\"`));
    assert.doesNotMatch(res.body, /__STREAMOPS_CSP_NONCE__/);

    const legalRes = createResponse();
    await handler(createRequest("GET", "/privacy"), legalRes);
    assert.equal(legalRes.statusCode, 200);
    assert.equal(legalRes.headers["X-Robots-Tag"], "noindex, nofollow");
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("공개 dashboard 이미지 asset은 /images 경로로 서빙된다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-dashboard-images-"));
  try {
    mkdirSync(path.join(dir, "images"));
    writeFileSync(path.join(dir, "images", "yorogg-logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const req = createRequest("GET", "/images/yorogg-logo.png");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /image\/png/);
    assert.equal(Buffer.from(res.body, "binary").length > 0, true);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("favicon과 sitemap은 dashboard public asset으로 서빙된다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-dashboard-public-"));
  try {
    writeFileSync(path.join(dir, "favicon.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(path.join(dir, "sitemap.xml"), "<?xml version=\"1.0\"?><urlset></urlset>");
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const faviconResponse = createResponse();
    await handler(createRequest("GET", "/favicon.png"), faviconResponse);
    assert.equal(faviconResponse.statusCode, 200);
    assert.equal(faviconResponse.headers["Content-Type"], "image/png");

    const sitemapResponse = createResponse();
    await handler(createRequest("GET", "/sitemap.xml"), sitemapResponse);
    assert.equal(sitemapResponse.statusCode, 200);
    assert.equal(sitemapResponse.headers["Content-Type"], "application/xml; charset=utf-8");
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("관리자 URL은 dashboard 앱 index를 서빙한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-admin-route-"));
  try {
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>StreamOps Admin</title><div id=\"root\"></div>");
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const req = createRequest("GET", "/admin");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /text\/html/);
    assert.match(res.body, /StreamOps Admin/);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

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

test("participation invite message API는 대기열 참가자에게 Twitch 채팅 메시지를 전송한다", async () => {
  const dispatched = [];
  const handler = createHttpHandler({
    store: {
      getParticipationEntryById(id) {
        return id === "entry-1" ? { id: "entry-1", twitchUserName: "ViewerOne" } : undefined;
      }
    },
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });

  const req = createRequest("POST", "/api/participation/invite-message", {
    entryId: "entry-1",
    message: "https://example.com/invite 참가 안내입니다."
  });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, entryId: "entry-1", twitchUserName: "ViewerOne" });
  assert.equal(dispatched.length, 1);
  assert.deepEqual(dispatched[0].action, {
    type: "twitch.chat",
    message: "@ViewerOne https://example.com/invite 참가 안내입니다."
  });
  assert.equal(dispatched[0].reason, "dashboard.participation_invite");
});

test("participation invite message API는 http/https가 아닌 링크 프로토콜을 거부한다", async () => {
  const dispatched = [];
  const handler = createHttpHandler({
    store: {
      getParticipationEntryById(id) {
        return id === "entry-1" ? { id: "entry-1", twitchUserName: "ViewerOne" } : undefined;
      }
    },
    twitchAuth: {},
    actions: {
      async dispatchOne(action) {
        dispatched.push(action);
      }
    }
  });

  const req = createRequest("POST", "/api/participation/invite-message", {
    entryId: "entry-1",
    message: "lol://invite-code"
  });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /http/);
  assert.equal(dispatched.length, 0);
});

test("participation invite bulk message API는 전송 가능한 참가자를 한 채팅 메시지로 묶는다", async () => {
  const entries = new Map([
    ["entry-1", { id: "entry-1", twitchUserName: "ViewerOne", status: "waitlisted" }],
    ["entry-2", { id: "entry-2", twitchUserName: "ViewerTwo", status: "checked_in" }],
    ["entry-3", { id: "entry-3", twitchUserName: "ViewerThree", status: "in_game" }]
  ]);
  const dispatched = [];
  const handler = createHttpHandler({
    store: {
      getParticipationEntryById(id) {
        return entries.get(id);
      }
    },
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });

  const req = createRequest("POST", "/api/participation/invite-message/bulk", {
    entryIds: ["entry-1", "entry-2", "entry-3"],
    message: "https://example.com/invite 참가 안내입니다."
  });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, targetCount: 2, sentMessages: 1 });
  assert.equal(dispatched.length, 1);
  assert.deepEqual(dispatched[0].action, {
    type: "twitch.chat",
    message: "@ViewerOne @ViewerTwo https://example.com/invite 참가 안내입니다."
  });
  assert.equal(dispatched[0].reason, "dashboard.participation_invite_bulk");
});

test("participation manual control API는 앞 4명을 게임 중으로 전환하고 오버레이를 갱신한다", async () => {
  const store = new Store();
  store.setParticipationOpen(true);
  store.setParticipationStreamerProfile({
    displayName: "Streamer",
    topChampions: Array.from({ length: 4 }, (_, index) => ({
      championId: index + 1,
      nameKo: `챔피언${index + 1}`
    }))
  });
  for (let index = 1; index <= 5; index += 1) {
    store.addParticipation(store.makeParticipationEntry({
      twitchUserId: `viewer-${index}`,
      twitchUserName: `Viewer${index}`,
      riotGameName: `Viewer${index}`,
      riotTagLine: "KR1",
      preferredRole: "mid",
      status: "waitlisted",
      source: "chat_command"
    }));
  }
  const dispatched = [];
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });

  const req = createRequest("POST", "/api/participation/manual-control", { action: "mark_in_game" });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.phase, "in_game");
  assert.deepEqual(store.getParticipationQueue().slice(0, 4).map((entry) => entry.status), ["in_game", "in_game", "in_game", "in_game"]);
  assert.equal(store.getParticipationQueue()[4].status, "waitlisted");
  const statusUpdate = dispatched.find((item) => item.action.type === "overlay.participationStatus" && item.action.phase === "in_game");
  assert.ok(statusUpdate);
  assert.deepEqual(statusUpdate.action.streamerProfile.topChampions.map((champion) => champion.championId), [1, 2, 3]);
  assert.ok(dispatched.some((item) => item.action.type === "overlay.participationQueue" && item.action.queue.length === 1 && item.action.queue[0].twitchUserName === "Viewer5"));
});

test("participation entry-status API는 참가자 상태를 수동 변경한다", async () => {
  const store = new Store();
  store.setParticipationOpen(true);
  const entry = store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-1",
    twitchUserName: "ViewerOne",
    riotGameName: "ViewerOne",
    riotTagLine: "KR1",
    preferredRole: "mid",
    status: "waitlisted",
    source: "chat_command"
  }));
  const dispatched = [];
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });

  const req = createRequest("POST", "/api/participation/entry-status", { entryId: entry.id, status: "invited" });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(store.getParticipationQueue()[0].status, "invited");
  assert.ok(dispatched.some((item) => item.reason === "dashboard.participation_entry_status"));
});

test("게임 중 공개 참가 신청은 오버레이 상태를 모집 중으로 덮어쓰지 않는다", async () => {
  const store = new Store();
  const streamerId = "1001";
  store.startParticipationSession(streamerId, {
    riotGameName: "Streamer",
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  });
  store.updateParticipationSessionStatus(streamerId, "in_game");
  store.setTwitchStreamLiveStatus({
    twitchUserId: streamerId,
    isLive: true,
    source: "eventsub"
  });

  const dispatched = [];
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth: {
      async getStatus(sessionId) {
        assert.equal(sessionId, "viewer-session");
        return {
          connected: true,
          configured: true,
          requiredScopes: ["user:read:follows", "user:read:subscriptions"],
          missingScopes: [],
          user: {
            id: "viewer-1",
            login: "viewer-one",
            displayName: "ViewerOne"
          }
        };
      }
    },
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    }
  });

  const req = createRequest("POST", "/api/public/participation/join", {
    streamerId,
    riotId: "ViewerOne#JP1",
    role: "mid"
  }, {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-session`
  });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(store.getParticipationSession(streamerId)?.status, "in_game");
  assert.ok(dispatched.some((item) => (
    item.action.type === "overlay.participationSnapshot"
    && item.reason === "public.participation_join"
    && item.action.streamerId === streamerId
    && item.action.status.phase === "in_game"
    && item.action.queue.length === 1
  )));
  assert.equal(dispatched.some((item) => (
    item.action.type === "overlay.participationStatus"
    && item.action.phase === "recruiting"
  )), false);
});

test("완료된 공개 참가자는 상태 조회 후 기존 항목으로 재참여할 수 있다", async () => {
  const store = new Store();
  const streamerId = "1002";
  store.startParticipationSession(streamerId, {
    riotGameName: "Streamer",
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  });
  store.setTwitchStreamLiveStatus({
    twitchUserId: streamerId,
    isLive: true,
    source: "eventsub"
  });
  const completed = store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-rejoin",
    twitchUserName: "ViewerRejoin",
    riotGameName: "ViewerRejoin",
    riotTagLine: "JP1",
    preferredRole: "mid",
    status: "played",
    source: "dashboard"
  }), streamerId);
  const publicTwitchAuth = {
    async getStatus(sessionId) {
      assert.equal(sessionId, "viewer-rejoin-session");
      return {
        connected: true,
        configured: true,
        requiredScopes: ["user:read:follows", "user:read:subscriptions"],
        missingScopes: [],
        user: {
          id: "viewer-rejoin",
          login: "viewer-rejoin",
          displayName: "ViewerRejoin"
        }
      };
    }
  };
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth,
    actions: {
      async dispatchOne() {}
    }
  });
  const headers = {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-rejoin-session`
  };

  const stateReq = createRequest("GET", `/api/public/participation/state?streamerId=${streamerId}`, undefined, headers);
  const stateRes = createResponse();
  await handler(stateReq, stateRes);

  assert.equal(stateRes.statusCode, 200);
  const state = JSON.parse(stateRes.body);
  assert.equal(state.viewerEntry?.status, "played");
  assert.equal(state.viewerEntry?.riotId, "ViewerRejoin#JP1");
  assert.equal(state.queue.length, 0);

  const joinReq = createRequest("POST", "/api/public/participation/join", {
    streamerId,
    riotId: "ViewerRejoin#JP1",
    role: "top"
  }, headers);
  const joinRes = createResponse();
  await handler(joinReq, joinRes);

  assert.equal(joinRes.statusCode, 200);
  const joined = JSON.parse(joinRes.body);
  assert.equal(joined.alreadyJoined, false);
  assert.equal(joined.reused, true);
  assert.equal(joined.entry?.status, "waitlisted");
  assert.equal(store.getParticipationQueue(streamerId).length, 1);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.id, completed.id);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.requestedRole, "top");
});

test("공개 참여 상태는 라이브 방송인만 노출하고 명시 선택 전 대기열을 숨긴다", async () => {
  const store = new Store();
  const liveStreamerId = "2001";
  const offlineStreamerId = "2002";
  for (const streamerId of [liveStreamerId, offlineStreamerId]) {
    store.startParticipationSession(streamerId, {
      riotGameName: `Streamer${streamerId}`,
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    });
  }
  store.setTwitchStreamLiveStatus({
    twitchUserId: liveStreamerId,
    isLive: true,
    source: "eventsub"
  });
  store.setTwitchStreamLiveStatus({
    twitchUserId: offlineStreamerId,
    isLive: false,
    source: "eventsub"
  });
  store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-live",
    twitchUserName: "ViewerLive",
    riotGameName: "ViewerLive",
    riotTagLine: "JP1",
    preferredRole: "mid",
    status: "waitlisted",
    source: "dashboard"
  }), liveStreamerId);

  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: {
      async dispatchOne() {}
    }
  });

  const unselectedReq = createRequest("GET", "/api/public/participation/state");
  const unselectedRes = createResponse();
  await handler(unselectedReq, unselectedRes);

  assert.equal(unselectedRes.statusCode, 200);
  const unselectedState = JSON.parse(unselectedRes.body);
  assert.deepEqual(unselectedState.streamers.map((streamer) => streamer.id), [liveStreamerId]);
  assert.equal(unselectedState.selectedStreamerId, undefined);
  assert.equal(unselectedState.isOpen, false);
  assert.equal(unselectedState.summary.active, 0);
  assert.deepEqual(unselectedState.queue, []);

  const selectedReq = createRequest("GET", `/api/public/participation/state?streamerId=${liveStreamerId}`);
  const selectedRes = createResponse();
  await handler(selectedReq, selectedRes);

  assert.equal(selectedRes.statusCode, 200);
  const selectedState = JSON.parse(selectedRes.body);
  assert.equal(selectedState.selectedStreamerId, liveStreamerId);
  assert.equal(selectedState.isOpen, true);
  assert.equal(selectedState.queue.length, 1);

  const offlineReq = createRequest("GET", `/api/public/participation/state?streamerId=${offlineStreamerId}`);
  const offlineRes = createResponse();
  await handler(offlineReq, offlineRes);

  assert.equal(offlineRes.statusCode, 200);
  const offlineState = JSON.parse(offlineRes.body);
  assert.deepEqual(offlineState.streamers.map((streamer) => streamer.id), [liveStreamerId]);
  assert.equal(offlineState.selectedStreamerId, undefined);
  assert.equal(offlineState.isOpen, false);
  assert.deepEqual(offlineState.queue, []);
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

test("production HTTP는 HTTPS로 redirect하고 HTTPS 응답은 HSTS를 포함한다", async () => {
  const previous = {
    nodeEnv: appConfig.nodeEnv,
    publicBaseUrl: appConfig.publicBaseUrl,
    trustProxy: appConfig.security.trustProxy
  };
  appConfig.nodeEnv = "production";
  appConfig.publicBaseUrl = "https://gg.seigatabi.com";
  appConfig.security.trustProxy = true;
  try {
    const handler = createHttpHandler({ store: {}, twitchAuth: {}, actions: {} });
    const redirectRes = createResponse();
    await handler(createRequest("GET", "/", undefined, { "x-forwarded-proto": "http" }), redirectRes);
    assert.equal(redirectRes.statusCode, 308);
    assert.equal(redirectRes.headers.Location, "https://gg.seigatabi.com/");

    const secureRes = createResponse();
    await handler(createRequest("GET", "/health/live", undefined, { "x-forwarded-proto": "https" }), secureRes);
    assert.equal(secureRes.statusCode, 200);
    assert.equal(secureRes.headers["Strict-Transport-Security"], "max-age=15552000; includeSubDomains");
  } finally {
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.publicBaseUrl = previous.publicBaseUrl;
    appConfig.security.trustProxy = previous.trustProxy;
  }
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
  let twitchCalls = 0;
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
        twitchCalls += 1;
        assert.equal(limit, 50);
        return {
          followers: [{
            userId: "100",
            userLogin: "viewer100",
            userName: "Viewer100",
            profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer100.png",
            followedAt: "2026-06-01T00:00:00.000Z"
          }],
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
  assert.equal(twitchCalls, 1);
  assert.equal(calls[0].followers[0].userName, "Viewer100");
  assert.equal(calls[0].followers[0].profileImageUrl, "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer100.png");
  assert.equal(JSON.parse(res.body).summary.activeFollowers, 1);

  const cooldownReq = createRequest("POST", "/api/followers/refresh?limit=50", {});
  const cooldownRes = createResponse();
  await handler(cooldownReq, cooldownRes);

  assert.equal(cooldownRes.statusCode, 200);
  assert.equal(twitchCalls, 1);
  assert.equal(cooldownRes.headers["X-StreamOps-Cache"], "cooldown");
  assert.equal(JSON.parse(cooldownRes.body).summary.activeFollowers, 1);
});

test("participation profile refresh API는 같은 entry의 연속 강제 갱신을 쿨다운한다", async () => {
  let refreshCalls = 0;
  const handler = createHttpHandler({
    store: {
      getParticipationEntryById(entryId) {
        assert.equal(entryId, "entry-1");
        return { id: entryId };
      },
      getParticipationState() {
        return { isOpen: true, queue: [], activeQueue: [], summary: { total: 0, active: 0, waiting: 0, selected: 0, checkedIn: 0, noShow: 0, played: 0 } };
      }
    },
    twitchAuth: {},
    actions: {},
    async refreshLolProfile(entryId) {
      assert.equal(entryId, "entry-1");
      refreshCalls += 1;
      return true;
    }
  });

  const firstReq = createRequest("POST", "/api/participation/profile/refresh", { entryId: "entry-1" });
  const firstRes = createResponse();
  await handler(firstReq, firstRes);

  const secondReq = createRequest("POST", "/api/participation/profile/refresh", { entryId: "entry-1" });
  const secondRes = createResponse();
  await handler(secondReq, secondRes);

  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 200);
  assert.equal(refreshCalls, 1);
  assert.equal(secondRes.headers["X-StreamOps-Cache"], "cooldown");
  assert.ok(Number(secondRes.headers["Retry-After"]) > 0);
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

test("정적 파일 경로의 잘못된 URL 인코딩은 400으로 응답한다", async () => {
  const previousPublicPath = appConfig.localTts.publicPath;
  try {
    appConfig.localTts.publicPath = "/tts";
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    for (const target of ["/dashboard/%E0%A4%A", "/alerts/%E0%A4%A", "/tts/%E0%A4%A"]) {
      const req = createRequest("GET", target);
      const res = createResponse();
      await handler(req, res);

      assert.equal(res.statusCode, 400, target);
      assert.equal(JSON.parse(res.body).error, "잘못된 정적 파일 경로입니다.");
    }
  } finally {
    appConfig.localTts.publicPath = previousPublicPath;
  }
});
