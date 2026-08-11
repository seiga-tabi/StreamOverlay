import assert from "node:assert/strict";
import test from "node:test";
import { createHttpHandler } from "../dist/routes/http-api.js";
import { appConfig } from "../dist/config.js";
import { requiredHttpPrincipal } from "../dist/security/auth.js";
import { resetSecurityRateLimiters } from "../dist/security/rate-limit.js";
import { ValorantPublicCatalogService } from "../dist/services/valorant-public-catalog.js";

function request(method, url, body, headers = {}) {
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

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") { this.body = String(chunk); }
  };
}

function handler(overrides = {}) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...overrides
  });
}

async function send(httpHandler, method, url, body, headers) {
  const res = response();
  await httpHandler(request(method, url, body, headers), res);
  return res;
}

test("발로란트 공개 API는 feature off에서 404이고 승인 전 외부 상태를 숨긴다", async (t) => {
  const previous = appConfig.riot.valorantPublicEnabled;
  t.after(() => {
    appConfig.riot.valorantPublicEnabled = previous;
    resetSecurityRateLimiters();
  });
  resetSecurityRateLimiters();
  assert.equal(requiredHttpPrincipal("GET", "/api/valorant/agents"), "PUBLIC");
  appConfig.riot.valorantPublicEnabled = false;
  const disabled = await send(handler(), "GET", "/api/valorant/agents");
  assert.equal(disabled.statusCode, 404);

  appConfig.riot.valorantPublicEnabled = true;
  const catalog = ValorantPublicCatalogService.load();
  const enabledHandler = handler({
    valorantCatalog: catalog,
    valorantPublic: {
      async leaderboard() { return { state: "approval_pending" }; },
      async streamers() { return { state: "approval_pending" }; },
      async streamerMatches() { return { state: "approval_pending" }; }
    }
  });
  const agents = await send(enabledHandler, "GET", "/api/valorant/agents?limit=5");
  assert.equal(agents.statusCode, 200);
  assert.equal(JSON.parse(agents.body).items.length, 5);
  assert.match(String(agents.headers["Cache-Control"]), /s-maxage=3600/u);

  const leaderboard = await send(enabledHandler, "GET", "/api/valorant/leaderboard");
  assert.deepEqual(JSON.parse(leaderboard.body), { state: "approval_pending" });
  assert.match(String(leaderboard.headers["Cache-Control"]), /no-store/u);

  const invalid = await send(enabledHandler, "GET", "/api/valorant/agents?unknown=1");
  assert.equal(invalid.statusCode, 400);
  assert.equal(JSON.parse(invalid.body).code, "invalid_query");
});

test("발로란트 동의 API는 account 공개 auth 경계와 strict body를 사용한다", async (t) => {
  const previousDatabase = appConfig.database.enabled;
  appConfig.database.enabled = true;
  t.after(() => { appConfig.database.enabled = previousDatabase; });
  assert.equal(
    requiredHttpPrincipal("POST", "/api/account/riot/valorant-record-consent"),
    "PUBLIC"
  );
  const calls = [];
  const httpHandler = handler({
    discordDatabaseReady: () => true,
    yoroAccounts: {
      async updateValorantRecordConsent(input) {
        calls.push(input);
        return { enabled: input.enabled, consentedAt: "2026-08-11T00:00:00.000Z" };
      }
    }
  });
  const headers = {
    origin: "http://localhost:3000",
    "content-type": "application/json",
    "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
    cookie: "yoro_session=session-value"
  };
  const ok = await send(
    httpHandler,
    "POST",
    "/api/account/riot/valorant-record-consent",
    { enabled: true },
    headers
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(JSON.parse(ok.body).valorantRecordConsent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sessionCookie, "session-value");

  const invalid = await send(
    httpHandler,
    "POST",
    "/api/account/riot/valorant-record-consent",
    { enabled: true, extra: true },
    headers
  );
  assert.equal(invalid.statusCode, 400);
  assert.equal(calls.length, 1);
});
