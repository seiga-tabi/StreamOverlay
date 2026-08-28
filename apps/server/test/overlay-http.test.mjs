import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import zlib, { brotliDecompressSync, gunzipSync } from "node:zlib";

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

function createBinaryResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk === undefined ? Buffer.alloc(0) : Buffer.from(chunk);
    }
  };
}

test("dashboard runtime config는 동적 config endpoint에서 제공된다", async () => {
  const previousConfig = {
    publicBaseUrl: appConfig.publicBaseUrl,
    legalOperatorName: appConfig.legal.operatorName
  };
  appConfig.publicBaseUrl = "http://localhost:3000";
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
    assert.match(dashboardRes.body, /legal/);
    assert.match(dashboardRes.body, /configured/);
    assert.match(dashboardRes.body, /\\u003c\/script>/);
    assert.doesNotMatch(dashboardRes.body, /<\/script><script>/);
    assert.doesNotMatch(dashboardRes.body, /wsBase|overlayBase/);

    const adminReq = createRequest("GET", "/admin/config.js");
    const adminRes = createResponse();
    await handler(adminReq, adminRes);

    assert.equal(adminRes.statusCode, 200);
    assert.match(adminRes.headers["Content-Type"], /text\/javascript/);
    assert.match(adminRes.body, /apiBase/);
    assert.doesNotMatch(adminRes.body, /wsBase|overlayBase/);
  } finally {
    appConfig.publicBaseUrl = previousConfig.publicBaseUrl;
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
          participation: "closed",
          startedAt: "2026-07-11T00:00:00.000Z"
        };
      }
    },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    readiness: () => ({ ok: true, checks: { persistenceHealthy: true }, errors: [] }),
    connectionStatus: () => ({
      http: 3
    })
  });
  const req = createRequest("GET", "/api/dashboard/server-status");
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, "ready");
  assert.equal(body.readiness.checks.persistenceHealthy, true);
  assert.deepEqual(body.connections, { http: 3 });
  assert.equal(body.services.twitch, "connected");
  assert.ok(body.uptimeSeconds >= 0);
  assert.ok(body.memory.rssBytes > 0);
  assert.doesNotMatch(res.body, /DASHBOARD_AUTH_TOKEN/);
});

test("공개 소환사 URL은 dashboard 앱 index를 서빙한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-public-lol-route-"));
  try {
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>"
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
    assert.match(res.body, /<title>LoL 소환사 전적 \| YORO\.gg<\/title>/);
    assert.match(res.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/lol\/summoners\/jp\/%E3%81%9B%E3%81%84%E3%81%8C-sei">/);
    assert.match(res.body, /<meta property="og:image" content="https:\/\/yoro\.gg\/images\/yorogg-og-lol\.png"/);
    assert.match(res.body, /<meta name="twitter:card" content="summary_large_image"/);
    const nonce = /script-src 'nonce-([^']+)'/.exec(res.headers["Content-Security-Policy"])?.[1];
    assert.ok(nonce);
    assert.match(res.headers["Content-Security-Policy"], /'strict-dynamic'/);
    assert.match(res.body, new RegExp(`nonce=\"${nonce}\"`));
    assert.doesNotMatch(res.body, /__STREAMOPS_CSP_NONCE__/);

    const aramRes = createResponse();
    await handler(createRequest("GET", "/lol/aram"), aramRes);
    assert.equal(aramRes.statusCode, 200);
    assert.match(aramRes.body, /<title>증강 칼바람 \| YORO\.gg<\/title>/);
    assert.match(aramRes.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/lol\/aram">/);
    assert.match(aramRes.body, /<meta property="og:url" content="https:\/\/yoro\.gg\/ko\/lol\/aram">/);

    const aramApiRes = createResponse();
    await handler(createRequest("GET", "/api/public/aram/augments"), aramApiRes);
    assert.equal(aramApiRes.statusCode, 200);
    assert.equal(
      aramApiRes.headers["Cache-Control"],
      "public, max-age=300, stale-while-revalidate=3600"
    );
    const aramBody = JSON.parse(aramApiRes.body);
    assert.equal(aramBody.schemaVersion, 1);
    assert.equal(aramBody.mode, "aram_augments");
    assert.equal(aramBody.status, "ready");
    assert.ok(Array.isArray(aramBody.augments) && aramBody.augments.length > 0);
    assert.ok(aramBody.augments.every(
      (augment) => Number.isSafeInteger(augment.cdragonId) && augment.cdragonId > 0
    ));

    const legalRes = createResponse();
    await handler(createRequest("GET", "/privacy"), legalRes);
    assert.equal(legalRes.statusCode, 200);
    assert.equal(legalRes.headers["X-Robots-Tag"], "noindex, nofollow");
    assert.match(legalRes.body, /<title>개인정보 처리방침 \| YORO\.gg<\/title>/);
    assert.match(legalRes.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/privacy">/);

    for (const pathname of ["/login", "/follow", "/participation", "/contact", "/palworld/search", "/valorant/agents"]) {
      const noindexRes = createResponse();
      await handler(createRequest("GET", pathname), noindexRes);
      assert.equal(noindexRes.statusCode, 200, pathname);
      assert.equal(noindexRes.headers["X-Robots-Tag"], "noindex, nofollow", pathname);
      assert.match(noindexRes.body, /<meta name="robots" content="noindex" \/>/, pathname);
    }

    const japanesePalworldRes = createResponse();
    await handler(createRequest("GET", "/ja/palworld/pals"), japanesePalworldRes);
    assert.equal(japanesePalworldRes.statusCode, 200);
    assert.match(japanesePalworldRes.body, /<title>パル図鑑 \| YORO\.gg<\/title>/);
    assert.match(japanesePalworldRes.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ja\/palworld\/pals">/);

    const botCommandsRes = createResponse();
    await handler(createRequest("GET", "/ja/bot/commands"), botCommandsRes);
    assert.equal(botCommandsRes.statusCode, 200);
    assert.match(botCommandsRes.body, /<title>コマンド一覧 \| YORO Bot<\/title>/);
    assert.match(botCommandsRes.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ja\/bot\/commands">/);

    const legacyBotRes = createResponse();
    await handler(
      createRequest("GET", "/ja/bot/features?source=legacy&next=%2Fsafe"),
      legacyBotRes
    );
    assert.equal(legacyBotRes.statusCode, 308);
    assert.equal(
      legacyBotRes.headers.Location,
      "/ja/bot/commands?source=legacy&next=%2Fsafe"
    );

    const unknownPalworldRes = createResponse();
    await handler(createRequest("GET", "/palworld/not-a-real-page"), unknownPalworldRes);
    assert.equal(unknownPalworldRes.statusCode, 404);
    assert.match(unknownPalworldRes.headers["Content-Type"], /text\/html/);
    assert.equal(unknownPalworldRes.headers["Cache-Control"], "no-store");
    assert.equal(unknownPalworldRes.headers["X-Robots-Tag"], "noindex, nofollow");
    assert.match(unknownPalworldRes.body, /<!doctype html>/i);
    assert.match(unknownPalworldRes.body, /<title>페이지를 찾을 수 없습니다 \| YORO\.gg<\/title>/);
    assert.match(unknownPalworldRes.body, /<meta name="robots" content="noindex, nofollow" \/>/);
    const notFoundNonce = /script-src 'nonce-([^']+)'/.exec(
      unknownPalworldRes.headers["Content-Security-Policy"],
    )?.[1];
    assert.ok(notFoundNonce);
    assert.match(unknownPalworldRes.body, new RegExp(`nonce="${notFoundNonce}"`));

    const japaneseNotFoundRes = createResponse();
    await handler(createRequest("GET", "/ja/not-a-real-page"), japaneseNotFoundRes);
    assert.equal(japaneseNotFoundRes.statusCode, 404);
    assert.match(japaneseNotFoundRes.body, /<html lang="ja">/);
    assert.match(japaneseNotFoundRes.body, /<title>ページが見つかりません \| YORO\.gg<\/title>/);

    const headNotFoundRes = createResponse();
    await handler(createRequest("HEAD", "/not-a-real-page"), headNotFoundRes);
    assert.equal(headNotFoundRes.statusCode, 404);
    assert.match(headNotFoundRes.headers["Content-Type"], /text\/html/);
    assert.equal(headNotFoundRes.body, "");

    for (const pathname of ["/api/not-a-real-page", "/internal/not-a-real-page", "/images/not-a-real-file.png"]) {
      const jsonNotFoundRes = createResponse();
      await handler(createRequest("GET", pathname), jsonNotFoundRes);
      assert.equal(jsonNotFoundRes.statusCode, 404, pathname);
      assert.match(jsonNotFoundRes.headers["Content-Type"], /application\/json/, pathname);
      assert.doesNotMatch(jsonNotFoundRes.body, /<!doctype html>/i, pathname);
    }
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cache된 소환사 전적은 동적 SNS 메타데이터와 immutable 공유 이미지를 제공한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-public-lol-social-"));
  // 운영 캐시의 24시간 stale 정책을 검증하는 fixture가 날짜 경과로 실패하지 않도록 현재 시각에 고정한다.
  const fetchedAt = new Date().toISOString();
  let riotCalls = 0;
  const profile = {
    status: "ready",
    riotId: "Faker#KR1",
    gameName: "Faker",
    tagLine: "KR1",
    accountRegion: "asia",
    lolPlatform: "kr",
    rankedStats: {
      queueType: "RANKED_SOLO_5x5",
      tier: "CHALLENGER",
      rank: "I",
      leaguePoints: 1234,
      wins: 20,
      losses: 10,
      winRate: 67,
      fetchedAt,
    },
    topChampions: [],
    recentMatches: [{
      matchId: "KR_1",
      result: "win",
      kills: 10,
      deaths: 2,
      assists: 8,
      items: [],
      summonerSpells: [],
      runes: [],
      teams: [],
    }],
    liveGame: { isLive: false, status: "not_found", participants: [], fetchedAt },
    recentMatchStart: 0,
    hasMoreRecentMatches: false,
    summary: {
      recentGames: 10,
      recentWins: 7,
      recentWinRate: 70,
      averageKda: 4.25,
      totalKills: 10,
      totalDeaths: 2,
      totalAssists: 8,
    },
    championPerformance: [],
    rolePerformance: [],
    fetchedAt,
  };
  try {
    mkdirSync(path.join(dir, "images"), { recursive: true });
    writeFileSync(path.join(dir, "images", "yorogg-og.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>",
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      riot: new Proxy({}, {
        get() {
          riotCalls += 1;
          throw new Error("crawler 요청에서 Riot API를 사용하면 안 됩니다.");
        }
      }),
      publicLolSnapshotStore: {
        async load() { return { puuid: "puuid", fetchedAt, payload: profile }; },
        async save() {},
      },
    });

    const pageRes = createResponse();
    await handler(createRequest("GET", "/ko/lol/summoners/kr/Faker-KR1"), pageRes);
    assert.equal(pageRes.statusCode, 200);
    assert.match(pageRes.body, /<title>Faker#KR1 · Challenger 1,234 LP \| YORO\.gg<\/title>/);
    assert.match(pageRes.body, /<meta property="og:type" content="profile"/);
    assert.match(pageRes.body, /<meta property="og:site_name" content="YORO\.gg"/);
    assert.match(pageRes.body, /<meta property="og:locale" content="ko_KR"/);
    assert.match(pageRes.body, /<meta property="og:locale:alternate" content="ja_JP"/);
    assert.match(pageRes.body, /<meta property="og:image:width" content="1200"/);
    assert.match(pageRes.body, /<meta property="og:image:height" content="630"/);
    assert.match(pageRes.body, /<meta property="og:image:type" content="image\/png"/);
    assert.match(pageRes.body, /<meta property="og:image:alt" content="Faker#KR1의 League of Legends 전적 카드"/);
    assert.match(pageRes.body, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(pageRes.body, /<meta name="twitter:image" content="https:\/\/yoro\.gg\/social\/lol\/ko\/kr\/Faker-KR1\/[a-f0-9]{16}\.png"/);
    const canonicalPath = /<link rel="canonical" href="https:\/\/yoro\.gg(\/ko\/lol\/summoners\/kr\/~[A-Za-z0-9_-]+)"/.exec(pageRes.body)?.[1];
    assert.ok(canonicalPath, "canonical은 암호화된 전적 공유 경로여야 합니다");
    assert.doesNotMatch(canonicalPath, /Faker|KR1/u);
    assert.match(pageRes.body, /최근 10게임 · 7승 3패 · 승률 70%/);
    const imageUrl = /<meta property="og:image" content="https:\/\/yoro\.gg([^\"]+)"/.exec(pageRes.body)?.[1];
    assert.ok(imageUrl);

    const japanesePageRes = createResponse();
    await handler(createRequest("GET", "/ja/lol/summoners/kr/Faker-KR1"), japanesePageRes);
    assert.equal(japanesePageRes.statusCode, 200);
    assert.match(japanesePageRes.body, /<title>Faker#KR1 · Challenger 1,234 LP \| YORO\.gg<\/title>/);
    assert.match(japanesePageRes.body, /<meta property="og:locale" content="ja_JP"/);
    assert.match(japanesePageRes.body, /直近10試合 · 7勝 3敗 · 勝率70%/);

    const encryptedPageRes = createResponse();
    await handler(createRequest("GET", canonicalPath), encryptedPageRes);
    assert.equal(encryptedPageRes.statusCode, 200);
    assert.match(encryptedPageRes.body, /<title>Faker#KR1 · Challenger 1,234 LP \| YORO\.gg<\/title>/);
    assert.match(encryptedPageRes.body, new RegExp(`href="https://yoro\\.gg${canonicalPath}"`));

    const imageRes = createBinaryResponse();
    await handler(createRequest("GET", imageUrl), imageRes);
    assert.equal(imageRes.statusCode, 200);
    assert.equal(imageRes.headers["Content-Type"], "image/png");
    assert.equal(imageRes.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.match(imageRes.headers.ETag, /lol-social-[a-f0-9]{16}/);
    assert.equal(imageRes.body.subarray(1, 4).toString("ascii"), "PNG");

    const headRes = createBinaryResponse();
    await handler(createRequest("HEAD", imageUrl), headRes);
    assert.equal(headRes.statusCode, 200);
    assert.equal(headRes.body.length, 0);
    assert.equal(headRes.headers["Content-Length"], imageRes.headers["Content-Length"]);

    const staleRevisionRes = createBinaryResponse();
    await handler(createRequest("GET", imageUrl.replace(/[a-f0-9]{16}\.png$/u, `${"0".repeat(16)}.png`)), staleRevisionRes);
    assert.equal(staleRevisionRes.statusCode, 200);
    assert.equal(staleRevisionRes.headers["Cache-Control"], "no-store");

    const notModifiedRes = createBinaryResponse();
    await handler(createRequest("GET", imageUrl, undefined, { "if-none-match": imageRes.headers.ETag }), notModifiedRes);
    assert.equal(notModifiedRes.statusCode, 304);
    assert.equal(riotCalls, 0);
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

test("Palworld content-hash WebP는 immutable로 서빙하고 누락·directory 요청은 404를 반환한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-palworld-images-"));
  const hash = "a".repeat(64);
  try {
    const imageDir = path.join(dir, "images", "palworld", "1.0.1", "pals");
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(path.join(imageDir, `${hash}.webp`), Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=", "base64"));
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const imageResponse = createResponse();
    await handler(createRequest("GET", `/images/palworld/1.0.1/pals/${hash}.webp`), imageResponse);
    assert.equal(imageResponse.statusCode, 200);
    assert.equal(imageResponse.headers["Content-Type"], "image/webp");
    assert.equal(imageResponse.headers["Cache-Control"], "public, max-age=31536000, immutable");

    const missingResponse = createResponse();
    await handler(createRequest("GET", `/images/palworld/1.0.1/pals/${"b".repeat(64)}.webp`), missingResponse);
    assert.equal(missingResponse.statusCode, 404);

    const directoryResponse = createResponse();
    await handler(createRequest("GET", "/images/palworld/1.0.1/pals/"), directoryResponse);
    assert.equal(directoryResponse.statusCode, 404);
    assert.doesNotMatch(directoryResponse.body, /<!doctype html>/i);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("favicon, ads.txt와 Riot 제품 검증 파일은 dashboard public asset으로 서빙된다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-dashboard-public-"));
  try {
    mkdirSync(path.join(dir, "valorant"), { recursive: true });
    writeFileSync(path.join(dir, "favicon.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(path.join(dir, "ads.txt"), "google.com, pub-7880271953912430, DIRECT, f08c47fec0942fa0\n");
    writeFileSync(path.join(dir, "riot.txt"), "11111111-2222-3333-4444-555555555555\n");
    writeFileSync(path.join(dir, "valorant", "riot.txt"), "a9be3168-55f0-44a0-9797-88fc9522c5a2\n");
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

    const adsResponse = createResponse();
    await handler(createRequest("GET", "/ads.txt"), adsResponse);
    assert.equal(adsResponse.statusCode, 200);
    assert.equal(adsResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(adsResponse.headers["Cache-Control"], "public, max-age=3600");
    assert.equal(adsResponse.body, "google.com, pub-7880271953912430, DIRECT, f08c47fec0942fa0\n");

    const lolRiotVerificationResponse = createResponse();
    await handler(createRequest("GET", "/riot.txt"), lolRiotVerificationResponse);
    assert.equal(lolRiotVerificationResponse.statusCode, 200);
    assert.equal(lolRiotVerificationResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(lolRiotVerificationResponse.headers["Cache-Control"], "no-store");
    assert.equal(lolRiotVerificationResponse.body, "11111111-2222-3333-4444-555555555555");

    const lolRiotVerificationHeadResponse = createResponse();
    await handler(createRequest("HEAD", "/riot.txt"), lolRiotVerificationHeadResponse);
    assert.equal(lolRiotVerificationHeadResponse.statusCode, 200);
    assert.equal(lolRiotVerificationHeadResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(lolRiotVerificationHeadResponse.body, "");

    const riotVerificationResponse = createResponse();
    await handler(createRequest("GET", "/valorant/riot.txt"), riotVerificationResponse);
    assert.equal(riotVerificationResponse.statusCode, 200);
    assert.equal(riotVerificationResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(riotVerificationResponse.headers["Cache-Control"], "no-store");
    assert.equal(riotVerificationResponse.body, "a9be3168-55f0-44a0-9797-88fc9522c5a2");

    const riotVerificationHeadResponse = createResponse();
    await handler(createRequest("HEAD", "/valorant/riot.txt"), riotVerificationHeadResponse);
    assert.equal(riotVerificationHeadResponse.statusCode, 200);
    assert.equal(riotVerificationHeadResponse.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(riotVerificationHeadResponse.body, "");
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("정적 텍스트 자산은 br 우선으로 압축하고 바이너리·identity·HEAD·304 동작을 보존한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-static-compression-"));
  try {
    const assetsDir = path.join(dir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    const cssBody = Buffer.from(".stream-overlay{color:#123456;background:#abcdef}\n".repeat(4_000));
    const pngBody = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    writeFileSync(path.join(assetsDir, "index-test.css"), cssBody);
    writeFileSync(path.join(assetsDir, "favicon.png"), pngBody);
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><script nonce=\"__STREAMOPS_CSP_NONCE__\"></script>"
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const brotliResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/index-test.css", undefined, { "accept-encoding": "gzip, br" }),
      brotliResponse
    );
    assert.equal(brotliResponse.statusCode, 200);
    assert.equal(brotliResponse.headers["Content-Encoding"], "br");
    assert.equal(brotliResponse.headers["Content-Length"], String(brotliResponse.body.length));
    assert.equal(brotliResponse.headers.Vary, "Accept-Encoding");
    assert.deepEqual(brotliDecompressSync(brotliResponse.body), cssBody);
    assert.ok(brotliResponse.body.length < cssBody.length);

    const gzipResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/index-test.css", undefined, { "accept-encoding": "gzip" }),
      gzipResponse
    );
    assert.equal(gzipResponse.headers["Content-Encoding"], "gzip");
    assert.equal(gzipResponse.headers["Content-Length"], String(gzipResponse.body.length));
    assert.deepEqual(gunzipSync(gzipResponse.body), cssBody);

    const disabledBrotliResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/index-test.css", undefined, { "accept-encoding": "br;q=0, gzip;q=1" }),
      disabledBrotliResponse
    );
    assert.equal(disabledBrotliResponse.headers["Content-Encoding"], "gzip");

    const identityResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/index-test.css", undefined, { "accept-encoding": "identity" }),
      identityResponse
    );
    assert.equal(identityResponse.headers["Content-Encoding"], undefined);
    assert.equal(identityResponse.headers["Content-Length"], String(cssBody.length));
    assert.deepEqual(identityResponse.body, cssBody);

    const headResponse = createBinaryResponse();
    await handler(
      createRequest("HEAD", "/dashboard/assets/index-test.css", undefined, { "accept-encoding": "gzip, br" }),
      headResponse
    );
    assert.equal(headResponse.headers["Content-Encoding"], "br");
    assert.equal(headResponse.headers["Content-Length"], String(brotliResponse.body.length));
    assert.equal(headResponse.body.length, 0);

    const imageResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/favicon.png", undefined, { "accept-encoding": "gzip, br" }),
      imageResponse
    );
    assert.equal(imageResponse.headers["Content-Encoding"], undefined);
    assert.equal(imageResponse.headers["Content-Length"], String(pngBody.length));
    assert.deepEqual(imageResponse.body, pngBody);

    const notModifiedResponse = createBinaryResponse();
    await handler(
      createRequest("GET", "/dashboard/assets/index-test.css", undefined, {
        "accept-encoding": "gzip, br",
        "if-none-match": identityResponse.headers.ETag
      }),
      notModifiedResponse
    );
    assert.equal(notModifiedResponse.statusCode, 304);
    assert.equal(notModifiedResponse.headers["Content-Encoding"], undefined);
    assert.equal(notModifiedResponse.body.length, 0);

    const compressionFailureBody = Buffer.from("압축 실패 시 원본 응답을 유지합니다.\n".repeat(100));
    writeFileSync(path.join(assetsDir, "compression-failure.css"), compressionFailureBody);
    const originalBrotliCompress = zlib.brotliCompress;
    try {
      zlib.brotliCompress = (_buffer, _options, callback) => callback(new Error("의도한 압축 실패"));
      const compressionFailureResponse = createBinaryResponse();
      await handler(
        createRequest("GET", "/dashboard/assets/compression-failure.css", undefined, { "accept-encoding": "br" }),
        compressionFailureResponse
      );
      assert.equal(compressionFailureResponse.statusCode, 200);
      assert.equal(compressionFailureResponse.headers["Content-Encoding"], undefined);
      assert.equal(compressionFailureResponse.headers["Content-Length"], String(compressionFailureBody.length));
      assert.deepEqual(compressionFailureResponse.body, compressionFailureBody);
    } finally {
      zlib.brotliCompress = originalBrotliCompress;
    }

    const firstHtmlResponse = createBinaryResponse();
    const secondHtmlResponse = createBinaryResponse();
    await handler(createRequest("GET", "/dashboard/", undefined, { "accept-encoding": "br" }), firstHtmlResponse);
    await handler(createRequest("GET", "/dashboard/", undefined, { "accept-encoding": "br" }), secondHtmlResponse);
    const firstHtml = brotliDecompressSync(firstHtmlResponse.body).toString("utf8");
    const secondHtml = brotliDecompressSync(secondHtmlResponse.body).toString("utf8");
    assert.equal(firstHtmlResponse.headers["Content-Encoding"], "br");
    assert.equal(secondHtmlResponse.headers["Content-Encoding"], "br");
    assert.doesNotMatch(firstHtml, /__STREAMOPS_CSP_NONCE__/u);
    assert.doesNotMatch(secondHtml, /__STREAMOPS_CSP_NONCE__/u);
    assert.notEqual(firstHtml, secondHtml);
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

test("스트리머 tenant 중첩 URL을 직접 열어도 dashboard 앱 index를 서빙한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-streamer-tenant-route-"));
  try {
    writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Streamer Dashboard</title><div id=\"root\"></div>");
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const req = createRequest("GET", "/dashboard/seiga/sdk_test/lol/participation");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /text\/html/);
    assert.match(res.body, /Streamer Dashboard/);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dashboard test action은 /api/actions/test에서 검증 후 dispatch된다", async () => {
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
    type: "noop",
    note: "Dashboard action 검증"
  };

  const req = createRequest("POST", "/api/actions/test", { action });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].action.type, "noop");
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

test("participation manual control API는 앞 4명을 게임 중으로 전환하고 상태를 저장한다", async () => {
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
  assert.equal(dispatched.length, 0);
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
  assert.equal(dispatched.length, 0);
});

test("게임 중 공개 참가 신청은 세션 상태를 모집 중으로 덮어쓰지 않는다", async () => {
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
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-session`,
    origin: "http://localhost:3000"
  });
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(store.getParticipationSession(streamerId)?.status, "in_game");
  assert.equal(dispatched.length, 0);
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
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-rejoin-session`,
    origin: "http://localhost:3000"
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

test("공개 session URL은 참가·체크인·취소를 같은 참여 대기열에 반영한다", async () => {
  const store = new Store();
  const streamerId = "public-session-streamer";
  const session = store.startParticipationSession(streamerId, {
    riotGameName: "Streamer",
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  }, { maxQueueSize: 5, allowRejoin: true, checkInSeconds: 60 });
  const publicTwitchAuth = {
    async getStatus() {
      return {
        connected: true,
        configured: true,
        requiredScopes: ["user:read:follows"],
        missingScopes: [],
        user: { id: "public-viewer", login: "public-viewer", displayName: "PublicViewer" }
      };
    }
  };
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth,
    actions: { async dispatchOne() {} }
  });
  const headers = {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=public-session-cookie`,
    origin: "http://localhost:3000"
  };

  const detailReq = createRequest("GET", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}`, undefined, headers);
  const detailRes = createResponse();
  await handler(detailReq, detailRes);
  assert.equal(detailRes.statusCode, 200);
  assert.equal(JSON.parse(detailRes.body).publicSessionId, session.publicSessionId);

  const invalidJoinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`, {
    riotId: "PublicViewer#JP1",
    role: "support",
    streamerId: "spoofed-streamer"
  }, headers);
  const invalidJoinRes = createResponse();
  await handler(invalidJoinReq, invalidJoinRes);
  assert.equal(invalidJoinRes.statusCode, 400);
  assert.equal(store.getParticipationQueue(streamerId).length, 0);

  const joinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`, {
    riotId: "PublicViewer#JP1",
    role: "support"
  }, headers);
  const joinRes = createResponse();
  await handler(joinReq, joinRes);
  assert.equal(joinRes.statusCode, 200);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.joinedFrom, "public_web");
  assert.equal(store.getParticipationQueue(streamerId)[0]?.attemptNumber, 1);

  store.selectNextParticipant(60, streamerId);
  const selectedReq = createRequest("GET", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}`, undefined, headers);
  const selectedRes = createResponse();
  await handler(selectedReq, selectedRes);
  assert.equal(selectedRes.statusCode, 200);
  assert.match(JSON.parse(selectedRes.body).viewerEntry?.checkInExpiresAt ?? "", /^\d{4}-\d{2}-\d{2}T/u);

  const invalidCheckInReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/check-in`, {
    unexpected: true
  }, headers);
  const invalidCheckInRes = createResponse();
  await handler(invalidCheckInReq, invalidCheckInRes);
  assert.equal(invalidCheckInRes.statusCode, 400);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.status, "selected");

  const skipReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/skip`, {}, headers);
  const skipRes = createResponse();
  await handler(skipReq, skipRes);
  assert.equal(skipRes.statusCode, 200);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.status, "skipped");

  const rejoinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/rejoin`, {
    riotId: "PublicViewer#JP1",
    role: "support"
  }, headers);
  const rejoinRes = createResponse();
  await handler(rejoinReq, rejoinRes);
  assert.equal(rejoinRes.statusCode, 200);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.status, "waitlisted");
  store.selectNextParticipant(60, streamerId);

  const checkInReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/check-in`, {}, headers);
  const checkInRes = createResponse();
  await handler(checkInReq, checkInRes);
  assert.equal(checkInRes.statusCode, 200);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.status, "checked_in");

  const cancelReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/cancel`, {}, headers);
  const cancelRes = createResponse();
  await handler(cancelReq, cancelRes);
  assert.equal(cancelRes.statusCode, 200);
  assert.equal(store.getParticipationQueue(streamerId)[0]?.status, "cancelled");
});

test("팔로우 참여 탐색은 Twitch user ID를 exact join하고 모집 상태를 구분한다", async () => {
  const store = new Store();
  for (const twitchUserId of ["followed-live", "followed-closed", "followed-offline", "not-followed"]) {
    const request = store.upsertStreamerRiotIdRequest({
      twitchUserId,
      twitchLogin: twitchUserId,
      twitchDisplayName: twitchUserId,
      riotGameName: `Riot${twitchUserId}`,
      riotTagLine: "JP1"
    });
    store.resolveStreamerRiotIdRequest({ requestId: request.id, decision: "approved", reviewer: "test" });
  }
  const liveSession = store.startParticipationSession("followed-live");
  const offlineSession = store.startParticipationSession("followed-offline");
  store.startParticipationSession("not-followed");
  const publicTwitchAuth = {
    async getStatus() {
      return {
        connected: true,
        configured: true,
        requiredScopes: ["user:read:follows"],
        missingScopes: [],
        user: { id: "viewer", login: "viewer", displayName: "Viewer" }
      };
    },
    async getAccessContext() {
      return {
        clientId: "client-id",
        accessToken: "access-token",
        userId: "viewer",
        scopes: ["user:read:follows"],
        user: { id: "viewer", login: "viewer", displayName: "Viewer" }
      };
    }
  };
  const followedAt = "2026-07-20T00:00:00.000Z";
  const followedChannels = ["followed-live", "followed-closed", "followed-offline"].map((id) => ({
    broadcasterId: id,
    broadcasterLogin: id,
    broadcasterName: id,
    followedAt
  }));
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth,
    twitch: {
      async getFollowedChannels() {
        return { total: followedChannels.length, truncated: false, channels: followedChannels };
      },
      async getStreamsByUserIds() {
        return new Map([
          ["followed-live", { userId: "followed-live", userLogin: "followed-live", userName: "followed-live", title: "LIVE", gameName: "League of Legends", viewerCount: 1, startedAt: followedAt }],
          ["followed-closed", { userId: "followed-closed", userLogin: "followed-closed", userName: "followed-closed", title: "LIVE", gameName: "League of Legends", viewerCount: 1, startedAt: followedAt }]
        ]);
      }
    },
    actions: { async dispatchOne() {} }
  });
  const req = createRequest("GET", "/api/public/participation/discovery?scope=followed", undefined, {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-session`
  });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepEqual(body.followedRecruiting.map((streamer) => streamer.id), ["followed-live"]);
  assert.deepEqual(body.followedLiveButClosed.map((streamer) => streamer.id), ["followed-closed"]);
  assert.deepEqual(body.followedOfflineRecruiting.map((streamer) => streamer.id), ["followed-offline"]);
  assert.equal(body.followedRecruiting[0].publicSessionId, liveSession.publicSessionId);
  assert.equal(body.followedOfflineRecruiting[0].publicSessionId, offlineSession.publicSessionId);
  assert.equal(JSON.stringify(body).includes("not-followed"), false);
});

test("공개 참여 세션은 동시 신청에서도 최대 정원을 초과하지 않는다", async () => {
  const store = new Store();
  const streamerId = "capacity-streamer";
  const session = store.startParticipationSession(streamerId, undefined, { maxQueueSize: 1 });
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth: {
      async getStatus(sessionId) {
        const viewerId = sessionId === "capacity-a" ? "capacity-viewer-a" : "capacity-viewer-b";
        return {
          connected: true,
          configured: true,
          requiredScopes: ["user:read:follows"],
          missingScopes: [],
          user: { id: viewerId, login: viewerId, displayName: viewerId }
        };
      }
    },
    actions: { async dispatchOne() {} }
  });
  const request = (viewer, riotId) => createRequest(
    "POST",
    `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`,
    { riotId, role: "fill" },
    {
      cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=${viewer}`,
      origin: "http://localhost:3000"
    }
  );
  const responseA = createResponse();
  const responseB = createResponse();

  await Promise.all([
    handler(request("capacity-a", "CapacityA#JP1"), responseA),
    handler(request("capacity-b", "CapacityB#JP1"), responseB)
  ]);

  assert.deepEqual([responseA.statusCode, responseB.statusCode].sort((a, b) => a - b), [200, 409]);
  const rejected = responseA.statusCode === 409 ? JSON.parse(responseA.body) : JSON.parse(responseB.body);
  assert.equal(rejected.code, "QUEUE_FULL");
  assert.equal(store.getActiveParticipationCount(streamerId), 1);
});

test("공개 참여 상태는 공개 범위에 따라 목록을 노출하고 명시 선택 전 대기열을 숨긴다", async () => {
  const store = new Store();
  const liveStreamerId = "2001";
  const offlineStreamerId = "2002";
  const followersStreamerId = "2003";
  for (const streamerId of [liveStreamerId, offlineStreamerId]) {
    store.startParticipationSession(streamerId, {
      riotGameName: `Streamer${streamerId}`,
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    });
  }
  const followersSession = store.startParticipationSession(followersStreamerId, {
    riotGameName: `Streamer${followersStreamerId}`,
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  }, { listingVisibility: "followers" });
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
  store.setTwitchStreamLiveStatus({
    twitchUserId: followersStreamerId,
    isLive: true,
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
  assert.deepEqual(unselectedState.streamers.map((streamer) => streamer.id), [liveStreamerId, offlineStreamerId]);
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
  assert.deepEqual(offlineState.streamers.map((streamer) => streamer.id), [liveStreamerId, offlineStreamerId]);
  assert.equal(offlineState.selectedStreamerId, offlineStreamerId);
  assert.equal(offlineState.isOpen, true);
  assert.deepEqual(offlineState.queue, []);

  const hiddenFollowersReq = createRequest("GET", `/api/public/participation/state?streamerId=${followersStreamerId}`);
  const hiddenFollowersRes = createResponse();
  await handler(hiddenFollowersReq, hiddenFollowersRes);
  assert.equal(hiddenFollowersRes.statusCode, 200);
  assert.equal(JSON.parse(hiddenFollowersRes.body).selectedStreamerId, undefined);

  const directFollowersReq = createRequest("GET", `/api/public/participation/state?session=${followersSession.publicSessionId}`);
  const directFollowersRes = createResponse();
  await handler(directFollowersReq, directFollowersRes);
  assert.equal(directFollowersRes.statusCode, 200);
  const directFollowersState = JSON.parse(directFollowersRes.body);
  assert.equal(directFollowersState.selectedStreamerId, followersStreamerId);
  assert.equal(directFollowersState.isOpen, true);
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

    const healthWithoutProxyHeader = createResponse();
    await handler(createRequest("GET", "/health/ready"), healthWithoutProxyHeader);
    assert.equal(healthWithoutProxyHeader.statusCode, 200);
    assert.equal(
      healthWithoutProxyHeader.headers["Strict-Transport-Security"],
      "max-age=15552000; includeSubDomains"
    );
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
  assert.equal("hasOverlayAction" in body[0], false);
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

test("제거된 /alerts 정적 경로는 404를 반환한다", async () => {
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

    assert.equal(res.statusCode, 404);
    return;
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

test("제거된 알림 asset 업로드 API는 404를 반환한다", async () => {
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

    assert.equal(uploadRes.statusCode, 404);
    return;
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

test("제거된 알림 runtime 설정 API는 404를 반환한다", async () => {
  const previousConfigDir = appConfig.paths.config;
  const previousStateDir = appConfig.paths.state;
  const configDir = mkdtempSync(path.join(tmpdir(), "streamops-alert-legacy-config-"));
  const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-alert-legacy-state-"));
  const runtimePath = path.join(stateDir, "alert-overlays.runtime.json");
  const runtime = {
    follow: {
      enabled: true,
      title: "팔로우",
      soundUrl: "/alerts/follow.wav",
      speechEnabled: true,
      speechText: "legacy voice"
    }
  };
  try {
    appConfig.paths.config = configDir;
    appConfig.paths.state = stateDir;
    writeFileSync(path.join(configDir, "alert-overlays.json"), "{}\n");
    writeFileSync(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`);
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {}
    });

    const req = createRequest("GET", "/api/alerts/config");
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 404);
    return;
    const response = JSON.parse(res.body);
    assert.equal(response.config.follow.title, "팔로우");
    assert.equal(response.config.follow.soundUrl, "/alerts/follow.wav");
    assert.equal("speechEnabled" in response.config.follow, false);
    assert.equal("speechText" in response.config.follow, false);
    assert.deepEqual(JSON.parse(readFileSync(runtimePath, "utf8")), runtime);
  } finally {
    appConfig.paths.config = previousConfigDir;
    appConfig.paths.state = previousStateDir;
    rmSync(configDir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("제거된 알림 asset 업로드 API는 파일 형식과 무관하게 404를 반환한다", async () => {
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

    assert.equal(res.statusCode, 404);
    return;
    assert.match(JSON.parse(res.body).error, /GIF/);
  } finally {
    appConfig.paths.state = previousStateDir;
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test("제거된 알림 정적 asset은 cache 대상이 아닌 404를 반환한다", async () => {
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

    assert.equal(firstRes.statusCode, 404);
    return;
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

test("/tts 경로는 제거되어 안전한 404로 응답한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {}
  });

  const req = createRequest("GET", "/tts/voice.wav");
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.match(res.headers["Content-Type"], /text\/html/);
  assert.equal(res.headers["X-Robots-Tag"], "noindex, nofollow");
  assert.match(res.body, /<html/i);
  assert.doesNotMatch(res.body, /stack|\.streamops/i);
});

test("정적 파일 경로의 잘못된 URL 인코딩은 400으로 응답한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {}
  });

  for (const target of ["/dashboard/%E0%A4%A"]) {
    const req = createRequest("GET", target);
    const res = createResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 400, target);
    assert.equal(JSON.parse(res.body).error, "잘못된 정적 파일 경로입니다.");
  }
});

test("공개 sitemap route는 index와 정적 sitemap을 생성한다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {
      async dispatchOne() {}
    }
  });

  const indexResponse = createResponse();
  await handler(createRequest("GET", "/sitemap.xml"), indexResponse);
  assert.equal(indexResponse.statusCode, 200);
  assert.equal(indexResponse.headers["Content-Type"], "application/xml; charset=utf-8");
  assert.match(indexResponse.body, /<sitemapindex/u);
  assert.match(indexResponse.body, /<loc>https:\/\/yoro\.gg\/sitemap-static\.xml<\/loc>/u);
  // palworldDataService가 없으면 빈 엔티티 sitemap을 index에 넣지 않는다.
  assert.doesNotMatch(indexResponse.body, /sitemap-palworld-pals/u);

  const staticResponse = createResponse();
  await handler(createRequest("GET", "/sitemap-static.xml"), staticResponse);
  assert.equal(staticResponse.statusCode, 200);
  assert.match(staticResponse.body, /<loc>https:\/\/yoro\.gg\/ko\/palworld\/pals<\/loc>/u);
  assert.match(staticResponse.body, /<xhtml:link rel="alternate" hreflang="ja"/u);

  const missingEntitySitemap = createResponse();
  await handler(createRequest("GET", "/sitemap-palworld-pals.xml"), missingEntitySitemap);
  assert.equal(missingEntitySitemap.statusCode, 404);
});

test("패치 상세 sitemap은 서비스가 있을 때만 index에 등록되고 ko·ja URL을 제공한다", async () => {
  const patchNotes = {
    async getFeed() {
      return {
        schemaVersion: 1,
        locale: "ko",
        fetchedAt: "2026-08-28T00:00:00.000Z",
        stale: false,
        notes: [{
          slug: "patch-26-17-notes",
          title: "26.17 패치 노트",
          publishedAt: "2026-08-26T00:00:00.000Z",
          patchVersion: "26.17",
          url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-26-17-notes/",
        }],
      };
    },
  };
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    patchNotes,
  });

  const indexResponse = createResponse();
  await handler(createRequest("GET", "/sitemap.xml"), indexResponse);
  assert.equal(indexResponse.statusCode, 200);
  assert.match(indexResponse.body, /sitemap-lol-patch-notes\.xml/u);

  const detailResponse = createResponse();
  await handler(createRequest("GET", "/sitemap-lol-patch-notes.xml"), detailResponse);
  assert.equal(detailResponse.statusCode, 200);
  assert.match(detailResponse.body, /https:\/\/yoro\.gg\/ko\/patch-notes\/26-17/u);
  assert.match(detailResponse.body, /https:\/\/yoro\.gg\/ja\/patch-notes\/26-17/u);
  assert.doesNotMatch(detailResponse.body, /\/en\/patch-notes\/26-17/u);
  assert.match(detailResponse.body, /2026-08-26T00:00:00\.000Z/u);
});

test("LoL 패치 상세 route는 정상·부분 실패·404·503을 fail-closed로 구분한다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-patch-detail-"));
  const appShell = "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>";
  const note = {
    slug: "patch-26-17-notes",
    title: "리그 오브 레전드 26.17 패치 노트",
    summary: "Riot 목록 요약",
    publishedAt: "2026-08-26T00:00:00.000Z",
    patchVersion: "26.17",
    dataDragonVersion: "16.17.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/patch-26-17-notes/",
  };
  const patchNotes = {
    async getFeed(locale) {
      return {
        schemaVersion: 1,
        locale,
        fetchedAt: "2026-08-28T00:00:00.000Z",
        stale: false,
        notes: [note],
      };
    },
  };
  const actions = { async dispatchOne() {} };
  try {
    writeFileSync(path.join(dir, "index.html"), appShell);
    appConfig.paths.dashboardStatic = dir;

    const completeHandler = createHttpHandler({
      store: {}, twitchAuth: {}, actions, patchNotes,
      patchChangeSummary: {
        async summaryFor() {
          return {
            patchVersion: "26.17",
            comparedVersions: ["16.16.1", "16.17.1"],
            systemChanges: [{ stat: "armor", from: 20, to: 21, championCount: 5 }],
            championChanges: [{
              championId: 1,
              name: "애니",
              direction: "buff",
              changes: [{ stat: "hp", from: 500, to: 520 }],
            }],
            itemChanges: [{ itemId: 1001, name: "롱소드", kind: "price", from: 350, to: 400 }],
            skillChangesIncluded: false,
          };
        },
      },
    });
    const complete = createResponse();
    await completeHandler(createRequest("GET", "/ko/patch-notes/26-17"), complete);
    assert.equal(complete.statusCode, 200);
    assert.match(complete.body, /<title>LoL 패치 26\.17 변경사항 \| YORO\.gg<\/title>/u);
    assert.match(complete.body, /애니 · 버프/u);
    assert.match(complete.body, /롱소드 · 가격 변경/u);

    /* 변경 요약 서비스가 없어도 유효한 피드 노트는 기본 정보로 안전하게 남습니다. */
    const partialHandler = createHttpHandler({ store: {}, twitchAuth: {}, actions, patchNotes });
    const partial = createResponse();
    await partialHandler(createRequest("GET", "/ja/patch-notes/26-17"), partial);
    assert.equal(partial.statusCode, 200);
    assert.match(partial.body, /2026-08-26/u);
    assert.match(partial.body, /Riot公式パッチノートを見る/u);
    assert.doesNotMatch(partial.body, /name="robots"/u);

    const missing = createResponse();
    await completeHandler(createRequest("GET", "/ko/patch-notes/26-18"), missing);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.headers["X-Robots-Tag"], "noindex, nofollow");

    const unavailableHandler = createHttpHandler({ store: {}, twitchAuth: {}, actions });
    const unavailable = createResponse();
    await unavailableHandler(createRequest("GET", "/ko/patch-notes/26-17"), unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.headers["Retry-After"], "600");
    assert.equal(unavailable.headers["X-Robots-Tag"], "noindex, nofollow");

    const emptyFeedHandler = createHttpHandler({
      store: {}, twitchAuth: {}, actions,
      patchNotes: { async getFeed() { return undefined; } },
    });
    const emptyFeed = createResponse();
    await emptyFeedHandler(createRequest("GET", "/ko/patch-notes/26-17"), emptyFeed);
    assert.equal(emptyFeed.statusCode, 503);
    assert.equal(emptyFeed.headers["Retry-After"], "600");
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Palworld 상세 query URL은 고유 경로로 영구 이전되고 없는 엔티티는 404다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-palworld-entity-"));
  try {
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>"
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const redirectResponse = createResponse();
    await handler(createRequest("GET", "/ko/palworld/pals?pal=lamball"), redirectResponse);
    assert.equal(redirectResponse.statusCode, 308);
    assert.equal(redirectResponse.headers.Location, "/ko/palworld/pals/lamball");

    // 데이터가 없는 엔티티 URL에 app shell을 200으로 주면 soft 404가 된다.
    const notFoundResponse = createResponse();
    await handler(createRequest("GET", "/ko/palworld/pals/lamball"), notFoundResponse);
    assert.equal(notFoundResponse.statusCode, 404);
    assert.equal(notFoundResponse.headers["X-Robots-Tag"], "noindex, nofollow");

    // 목록 URL은 그대로 app shell을 서빙한다.
    const listResponse = createResponse();
    await handler(createRequest("GET", "/ko/palworld/pals"), listResponse);
    assert.equal(listResponse.statusCode, 200);
    assert.match(listResponse.body, /<link rel="canonical" href="https:\/\/yoro\.gg\/ko\/palworld\/pals">/u);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("공개 app shell은 crawler가 읽는 h1과 hreflang, JSON-LD를 함께 담는다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-seo-shell-"));
  try {
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>"
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      }
    });

    const response = createResponse();
    /* 루트(/ja/)는 이제 /ja/lol 로 넘어가므로 shell 을 그리지 않습니다. */
    await handler(createRequest("GET", "/ja/lol"), response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="ja"/u);
    /* /lol 은 영어 카피가 생겨 en 을 서빙합니다 — x-default 는 "언어가 맞지 않는
       방문자에게 보일 판"이라 영어판이 있으면 그쪽입니다(팰월드와 같은 규칙). */
    assert.match(response.body, /<link rel="alternate" hreflang="en" href="https:\/\/yoro\.gg\/en\/lol" \/>/u);
    assert.match(response.body, /<link rel="alternate" hreflang="x-default" href="https:\/\/yoro\.gg\/en\/lol" \/>/u);
    assert.match(response.body, /<div id="root"><div class="seo-fallback"/u);
    assert.match(response.body, /<h1>YORO\.gg — LoL戦績、検索ひとつで<\/h1>/u);
    assert.doesNotMatch(response.body, /<div id="root"><\/div>/u);

    // JSON-LD script도 정적 script와 같은 nonce로 치환되어야 CSP에서 실행 차단되지 않는다.
    const nonce = /script-src 'nonce-([^']+)'/.exec(response.headers["Content-Security-Policy"])?.[1];
    assert.ok(nonce);
    assert.match(response.body, new RegExp(`<script type="application/ld\\+json" nonce="${nonce}">`, "u"));
    assert.doesNotMatch(response.body, /__STREAMOPS_CSP_NONCE__/u);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Palworld 허브 app shell은 데이터 서비스의 실제 목록을 fallback 본문에 담는다", async () => {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-palworld-hub-seo-"));
  const queryLog = [];
  const response = (items, total) => ({ items, pagination: { total } });
  const palworldDataService = {
    listPals(query) {
      queryLog.push(["pals", query]);
      return response([{ id: "lamball", nameKo: "도로롱", nameJa: "モコロン", nameEn: "Lamball" }], 574);
    },
    listItems(query) {
      queryLog.push(["items", query]);
      return response([{ id: "pal-sphere", nameKo: "팰 스피어", nameJa: "パルスフィア", nameEn: "Pal Sphere" }], 1_847);
    },
    listSkills(query) {
      queryLog.push(["skills", query]);
      return response([{ id: "air-cannon", nameKo: "공기 대포", nameJa: "エアーキャノン", nameEn: "Air Cannon" }], 566);
    },
    listTechnologyUnlocks(query) {
      queryLog.push(["technology", query]);
      return response([{
        id: "primitive-workbench",
        kind: "building",
        nameKo: "원시적인 작업대",
        nameJa: "原始的な作業台",
        technologyLevel: 1
      }], 312);
    }
  };
  try {
    writeFileSync(
      path.join(dir, "index.html"),
      "<!doctype html><html lang=\"ko\"><head><meta name=\"description\" content=\"home\"><link rel=\"canonical\" href=\"https://yoro.gg/\"><meta property=\"og:title\" content=\"home\"><meta property=\"og:description\" content=\"home\"><meta property=\"og:url\" content=\"https://yoro.gg/\"><meta name=\"twitter:title\" content=\"home\"><meta name=\"twitter:description\" content=\"home\"><script nonce=\"__STREAMOPS_CSP_NONCE__\" src=\"/dashboard/config.js\"></script><title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>"
    );
    appConfig.paths.dashboardStatic = dir;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      palworldDataService
    });
    const cases = [
      ["/ko/palworld/pals", "등록된 팰</dt><dd>574종", "도로롱"],
      ["/ja/palworld/items", "登録アイテム</dt><dd>1847件", "パルスフィア"],
      ["/en/palworld/skills", "Registered skills</dt><dd>566", "Air Cannon"],
      ["/ko/palworld/technology", "기술 해금 항목</dt><dd>312개", "원시적인 작업대"]
    ];
    for (const [pathname, fact, name] of cases) {
      const res = createResponse();
      await handler(createRequest("GET", pathname), res);
      assert.equal(res.statusCode, 200, pathname);
      assert.match(res.body, new RegExp(fact, "u"), pathname);
      assert.match(res.body, new RegExp(name, "u"), pathname);
    }
    assert.deepEqual(queryLog.map(([kind, query]) => [kind, query.sort, query.order, query.page, query.limit]), [
      ["pals", "number", "asc", 1, 30],
      ["items", "name", "asc", 1, 30],
      ["skills", "name", "asc", 1, 30],
      ["technology", undefined, "asc", 1, 30]
    ]);

    /* 특정 스냅샷 조회가 실패해도 일반 제목·요약 fallback은 사라지지 않습니다. */
    palworldDataService.listItems = () => { throw new Error("스냅샷 없음"); };
    const fallbackResponse = createResponse();
    await handler(createRequest("GET", "/ko/palworld/items"), fallbackResponse);
    assert.equal(fallbackResponse.statusCode, 200);
    assert.match(fallbackResponse.body, /<h1>아이템<\/h1>/u);
    assert.doesNotMatch(fallbackResponse.body, /등록된 아이템/u);
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(dir, { recursive: true, force: true });
  }
});
