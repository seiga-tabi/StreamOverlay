import test from "node:test";
import assert from "node:assert/strict";

const {
  PARTICIPATION_COMMANDS,
  PARTICIPATION_MESSAGES,
  participationCommandKind,
  resolveChatLocale
} = await import("../dist/modules/participation.module.js");
const { Store } = await import("../dist/services/store.js");
const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const {
  DashboardSessionStore,
  STREAMER_DASHBOARD_SESSION_COOKIE
} = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";

function createRequest(method, url, body, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    }
  };
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

function approveStreamer(store, twitchUserId, riotGameName) {
  const request = store.upsertStreamerRiotIdRequest({
    twitchUserId,
    twitchLogin: twitchUserId,
    twitchDisplayName: twitchUserId,
    riotGameName,
    riotTagLine: "JP1"
  });
  store.resolveStreamerRiotIdRequest({ requestId: request.id, decision: "approved", reviewer: "test" });
  store.setStreamerRiotIdDashboardEnabled({ requestId: request.id, dashboardEnabled: true, reviewer: "test" });
}

test("자동화 설정 API로 봇 응답 언어(chatLocale)를 저장하고, 잘못된 값은 거부한다", async () => {
  const previous = {
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv,
    sessionTtl: appConfig.security.dashboardSessionTtlMs
  };
  resetSecurityRateLimiters();
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
  try {
    const store = new Store();
    approveStreamer(store, "locale-streamer", "LocaleStreamer");
    const sessions = new DashboardSessionStore();
    const session = sessions.create({ role: "streamer", twitchUserId: "locale-streamer" });
    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions
    });
    const headers = {
      cookie: `${STREAMER_DASHBOARD_SESSION_COOKIE}=${session.id}`,
      origin: DASHBOARD_ORIGIN,
      "x-streamops-dashboard-surface": "streamer",
      "x-streamops-csrf": session.csrfToken
    };

    const invalidReq = createRequest("POST", "/api/lol-operations/automation", { chatLocale: "fr" }, headers);
    const invalidRes = createResponse();
    await handler(invalidReq, invalidRes);
    assert.equal(invalidRes.statusCode, 400);
    assert.equal(JSON.parse(invalidRes.body).code, "INVALID_CHAT_LOCALE");
    assert.equal(store.getLolAutomationSettings("locale-streamer").chatLocale, "ko");

    const validReq = createRequest("POST", "/api/lol-operations/automation", { chatLocale: "ja" }, headers);
    const validRes = createResponse();
    await handler(validReq, validRes);
    assert.equal(validRes.statusCode, 200, validRes.body);
    assert.equal(JSON.parse(validRes.body).settings.chatLocale, "ja");
    assert.equal(store.getLolAutomationSettings("locale-streamer").chatLocale, "ja");
  } finally {
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    resetSecurityRateLimiters();
  }
});

test("명령어 인식은 영어 트리거만 허용한다 — 예전 한국어/일본어 트리거는 더 이상 인식하지 않는다", () => {
  assert.equal(participationCommandKind("!join"), "apply");
  assert.equal(participationCommandKind("!JOIN"), "apply");
  assert.equal(participationCommandKind("!participate"), "apply");
  assert.equal(participationCommandKind("!loljoin"), "apply");
  assert.equal(participationCommandKind("!joinstart"), "open");
  assert.equal(participationCommandKind("!queueopen"), "open");
  assert.equal(participationCommandKind("!joinend"), "close");
  assert.equal(participationCommandKind("!checkin"), "checkIn");
  assert.equal(participationCommandKind("!cancel"), "cancel");
  assert.equal(participationCommandKind("!leave"), "cancel");

  // 예전에 지원하던 한국어·일본어 트리거는 이제 인식하지 않습니다.
  for (const legacy of ["!참가", "!시참", "!참가시작", "!참가확인", "!참가취소", "!参加", "!さんか", "!参加開始"]) {
    assert.equal(participationCommandKind(legacy), undefined, `${legacy} 는 더 이상 명령어로 인식되면 안 됩니다.`);
  }
});

test("PARTICIPATION_COMMANDS 테이블에 영어 이외의 트리거가 섞여 있지 않다", () => {
  const asciiCommandPattern = /^![a-z0-9-]+$/u;
  for (const [kind, commands] of Object.entries(PARTICIPATION_COMMANDS)) {
    for (const command of commands) {
      assert.match(command, asciiCommandPattern, `${kind}의 "${command}"는 영어 트리거 형식이 아닙니다.`);
    }
  }
});

test("resolveChatLocale은 스트리머가 고른 chatLocale을 따르고, 미설정이면 ko로 기본값을 채운다", () => {
  const store = new Store();
  const ctx = { store };

  // 아무 설정이 없으면 기본값 ko.
  assert.equal(resolveChatLocale(ctx, "streamer-1"), "ko");

  store.setLolAutomationSettings("streamer-1", { chatLocale: "ja" });
  assert.equal(resolveChatLocale(ctx, "streamer-1"), "ja");

  store.setLolAutomationSettings("streamer-1", { chatLocale: "en" });
  assert.equal(resolveChatLocale(ctx, "streamer-1"), "en");

  // 다른 스트리머 설정에는 영향을 주지 않습니다.
  assert.equal(resolveChatLocale(ctx, "streamer-2"), "ko");
});

test("PARTICIPATION_MESSAGES는 ko/ja/en 세 언어 모두 같은 메시지 키 집합을 채운다 — 한 메시지에 여러 언어를 섞지 않는다", () => {
  const locales = Object.keys(PARTICIPATION_MESSAGES);
  assert.deepEqual(locales.sort(), ["en", "ja", "ko"]);

  const koKeys = Object.keys(PARTICIPATION_MESSAGES.ko).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(PARTICIPATION_MESSAGES[locale]).sort(), koKeys, `${locale} 메시지 키 집합이 ko와 다릅니다.`);
  }

  // 언어별 메시지는 그 언어 문자만 쓰고, 다른 언어 문자가 섞여 있지 않아야 합니다
  // (예전의 "일본어 / 한국어" 동시 표기 방식으로 되돌아가지 않았는지 확인).
  const hangulPattern = /[가-힣]/u;
  const kanaPattern = /[぀-ヿ]/u;
  for (const key of koKeys) {
    // 이름 자리는 채팅 사용자가 실제로 쓰는 twitchUserName이 그대로 들어가는
    // 자리라 로케일 중립적인 값으로 채웁니다(이름 자체는 어느 언어든 될 수 있어
    // 이 검사 대상이 아닙니다).
    const ja = typeof PARTICIPATION_MESSAGES.ja[key] === "function"
      ? PARTICIPATION_MESSAGES.ja[key]("Viewer1")
      : PARTICIPATION_MESSAGES.ja[key];
    const en = typeof PARTICIPATION_MESSAGES.en[key] === "function"
      ? PARTICIPATION_MESSAGES.en[key]("Viewer1")
      : PARTICIPATION_MESSAGES.en[key];
    assert.doesNotMatch(ja, hangulPattern, `ja.${key}에 한글이 섞여 있습니다: ${ja}`);
    assert.doesNotMatch(en, hangulPattern, `en.${key}에 한글이 섞여 있습니다: ${en}`);
    assert.doesNotMatch(en, kanaPattern, `en.${key}에 일본어가 섞여 있습니다: ${en}`);
  }
});

test("emptyInputGuide 예시는 영어 명령어(!join) 형식을 안내한다", () => {
  for (const locale of ["ko", "ja", "en"]) {
    assert.match(PARTICIPATION_MESSAGES[locale].emptyInputGuide, /!join/u);
  }
});
