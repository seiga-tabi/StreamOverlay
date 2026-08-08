import assert from "node:assert/strict";
import test from "node:test";
import { createHttpHandler } from "../dist/routes/http-api.js";
import { appConfig } from "../dist/config.js";
import {
  DashboardSessionStore,
  dashboardSessionCookie,
  requiredHttpPrincipal
} from "../dist/security/auth.js";
import { resetSecurityRateLimiters } from "../dist/security/rate-limit.js";

const AUTH_TOKEN = "admin_audit_http_test_token_abcdefghijklmnopqrstuvwxyz";

function createRequest(url, headers = {}) {
  return {
    method: "GET",
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {}
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

function validResponse() {
  return {
    logs: [],
    page: {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-08T00:00:00.000Z",
      offset: 0,
      limit: 50,
      hasMore: false,
      truncated: false
    }
  };
}

async function withAdminAuth(run) {
  const previous = {
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth
  };
  resetSecurityRateLimiters();
  appConfig.security.dashboardAuthToken = AUTH_TOKEN;
  appConfig.security.localNoAuth = false;
  try {
    await run();
  } finally {
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    resetSecurityRateLimiters();
  }
}

function handler(adminAuditLogs, sessions) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    discordDatabaseReady: () => true,
    adminAuditLogs,
    sessions
  });
}

async function send(httpHandler, url, authenticated = true) {
  const response = createResponse();
  await httpHandler(createRequest(url, authenticated
    ? { authorization: `Bearer ${AUTH_TOKEN}`, "x-streamops-dashboard-surface": "admin" }
    : {}), response);
  return response;
}

test("감사 로그 endpoint는 DASHBOARD_ADMIN을 명시하고 인증·필터·가용성을 fail-closed로 처리한다", async () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/admin/audit-logs"), "DASHBOARD_ADMIN");
  await withAdminAuth(async () => {
    const queries = [];
    const httpHandler = handler({
      async list(query) {
        queries.push(query);
        return validResponse();
      }
    });

    const unauthenticated = await send(httpHandler, "/api/admin/audit-logs", false);
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(JSON.parse(unauthenticated.body).code, "AUTH_REQUIRED");

    const sessions = new DashboardSessionStore();
    const streamerSession = sessions.create({ role: "streamer", twitchUserId: "12345" });
    const streamerResponse = createResponse();
    await handler({ async list() { return validResponse(); } }, sessions)(createRequest(
      "/api/admin/audit-logs",
      {
        cookie: dashboardSessionCookie(streamerSession)[0].split(";")[0],
        "x-streamops-dashboard-surface": "streamer"
      }
    ), streamerResponse);
    assert.equal(streamerResponse.statusCode, 403);
    assert.equal(JSON.parse(streamerResponse.body).code, "FORBIDDEN");

    const ok = await send(
      httpHandler,
      "/api/admin/audit-logs?from=2026-08-01T00%3A00%3A00.000Z&to=2026-08-08T00%3A00%3A00.000Z&action=discord.bot.settings.updated&offset=25&limit=25"
    );
    assert.equal(ok.statusCode, 200);
    assert.equal(queries[0].action, "discord.bot.settings.updated");
    assert.equal(queries[0].from, "2026-08-01T00:00:00.000Z");
    assert.equal(queries[0].to, "2026-08-08T00:00:00.000Z");
    assert.equal(queries[0].offset, 25);
    assert.equal(queries[0].limit, 25);
    assert.match(String(ok.headers["Cache-Control"]), /no-store/u);

    const invalid = await send(httpHandler, "/api/admin/audit-logs?limit=101");
    assert.equal(invalid.statusCode, 400);
    assert.equal(JSON.parse(invalid.body).code, "INVALID_AUDIT_FILTER");

    const unavailable = await send(handler(undefined), "/api/admin/audit-logs");
    assert.equal(unavailable.statusCode, 503);
    assert.equal(JSON.parse(unavailable.body).code, "AUDIT_LOGS_UNAVAILABLE");
  });
});

test("감사 로그 endpoint는 전용 60회/분 rate limit과 Retry-After를 사용한다", async () => {
  await withAdminAuth(async () => {
    const httpHandler = handler({ async list() { return validResponse(); } });
    for (let index = 0; index < 60; index += 1) {
      const response = await send(httpHandler, "/api/admin/audit-logs");
      assert.equal(response.statusCode, 200);
    }
    const limited = await send(httpHandler, "/api/admin/audit-logs");
    assert.equal(limited.statusCode, 429);
    assert.equal(typeof limited.headers["Retry-After"], "string");
    assert.equal(limited.headers["X-RateLimit-Limit"], "60");
  });
});
