import assert from "node:assert/strict";
import test from "node:test";
import { appConfig } from "../dist/config.js";
import { createHttpHandler } from "../dist/routes/http-api.js";
import { resetSecurityRateLimiters } from "../dist/security/rate-limit.js";

const AUTH_TOKEN = "admin_global_audit_http_test_token_abcdefghijklmnopqrstuvwxyz";
const REQUEST_ID = "streamer-request-1";
const NOW = "2026-08-08T00:00:00.000Z";

function streamerRequest(overrides = {}) {
  return {
    id: REQUEST_ID,
    twitchUserId: "123456789",
    twitchLogin: "audit_streamer",
    twitchDisplayName: "Audit Streamer",
    riotGameName: "Audit Streamer",
    riotTagLine: "KR1",
    normalizedRiotId: "auditstreamer#kr1",
    status: "pending",
    accountRole: "main",
    dashboardEnabled: false,
    requestedAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function createRequest(path, body) {
  const payload = Buffer.from(JSON.stringify(body));
  return {
    method: "POST",
    url: path,
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      "content-type": "application/json",
      "content-length": String(payload.length),
      "x-streamops-dashboard-surface": "admin"
    },
    socket: { remoteAddress: "127.0.0.1", encrypted: true },
    async *[Symbol.asyncIterator]() {
      yield payload;
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

async function withDatabaseAdminAuth(run) {
  const previous = {
    databaseEnabled: appConfig.database.enabled,
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth
  };
  resetSecurityRateLimiters();
  appConfig.database.enabled = true;
  appConfig.security.dashboardAuthToken = AUTH_TOKEN;
  appConfig.security.localNoAuth = false;
  try {
    await run();
  } finally {
    appConfig.database.enabled = previous.databaseEnabled;
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    resetSecurityRateLimiters();
  }
}

async function send(handler, path, body) {
  const response = createResponse();
  await handler(createRequest(path, body), response);
  return response;
}

test("Riot ID 승인·거절은 Store 변경 전에 전역 감사를 시작하고 성공으로 확정한다", async () => {
  await withDatabaseAdminAuth(async () => {
    const sequence = [];
    const auditInputs = [];
    let current = streamerRequest();
    const handler = createHttpHandler({
      store: {
        listStreamerRiotIdRequests() {
          return [{ ...current }];
        },
        resolveStreamerRiotIdRequest(input) {
          sequence.push("store");
          current = streamerRequest({
            status: input.decision,
            dashboardEnabled: input.decision === "approved",
            reviewedAt: NOW,
            note: input.note
          });
          return { ...current };
        }
      },
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      discordDatabaseReady: () => true,
      adminAuditLogs: {
        async list() {
          return { logs: [], page: { from: NOW, to: NOW, offset: 0, limit: 50, hasMore: false, truncated: false } };
        },
        async beginGlobalMutation(input) {
          sequence.push("begin");
          auditInputs.push(input);
          return { mutationId: "11111111-1111-4111-8111-111111111111" };
        },
        async completeGlobalMutation(input) {
          sequence.push(`complete:${input.outcome}`);
        }
      }
    });

    const response = await send(
      handler,
      "/api/participation/streamer-riot-id-requests/resolve",
      { requestId: REQUEST_ID, decision: "approved", note: "민감한 운영 메모" }
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(sequence, ["begin", "store", "complete:succeeded"]);
    assert.deepEqual(auditInputs, [{
      actorMethod: "token",
      action: "streamer.riot_id_request.resolved",
      targetIdentifier: REQUEST_ID,
      metadata: { decision: "approved", noteProvided: true }
    }]);
    assert.doesNotMatch(JSON.stringify(auditInputs), /민감한 운영 메모|admin_global_audit_http_test_token/u);
  });
});

test("대시보드 접근 변경도 별도 action으로 감사하고 DB 감사 시작 실패 시 Store를 변경하지 않는다", async () => {
  await withDatabaseAdminAuth(async () => {
    let storeCalls = 0;
    const current = streamerRequest({ status: "approved", dashboardEnabled: true });
    const auditInputs = [];
    const successful = createHttpHandler({
      store: {
        listStreamerRiotIdRequests() {
          return [{ ...current }];
        },
        setStreamerRiotIdDashboardEnabled(input) {
          storeCalls += 1;
          return { ...current, dashboardEnabled: input.dashboardEnabled, updatedAt: NOW };
        }
      },
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      discordDatabaseReady: () => true,
      adminAuditLogs: {
        async list() {
          return { logs: [], page: { from: NOW, to: NOW, offset: 0, limit: 50, hasMore: false, truncated: false } };
        },
        async beginGlobalMutation(input) {
          auditInputs.push(input);
          return { mutationId: "22222222-2222-4222-8222-222222222222" };
        },
        async completeGlobalMutation() {}
      }
    });

    const ok = await send(
      successful,
      "/api/participation/streamer-riot-id-requests/dashboard-access",
      { requestId: REQUEST_ID, dashboardEnabled: false }
    );
    assert.equal(ok.statusCode, 200);
    assert.equal(storeCalls, 1);
    assert.deepEqual(auditInputs[0], {
      actorMethod: "token",
      action: "streamer.dashboard_access.updated",
      targetIdentifier: REQUEST_ID,
      metadata: { dashboardEnabled: false, noteProvided: false }
    });

    const unavailable = createHttpHandler({
      store: {
        listStreamerRiotIdRequests() {
          return [{ ...current }];
        },
        setStreamerRiotIdDashboardEnabled() {
          storeCalls += 1;
          return current;
        }
      },
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      discordDatabaseReady: () => true,
      adminAuditLogs: {
        async list() {
          return { logs: [], page: { from: NOW, to: NOW, offset: 0, limit: 50, hasMore: false, truncated: false } };
        },
        async beginGlobalMutation() {
          throw new Error("database unavailable");
        },
        async completeGlobalMutation() {}
      }
    });
    const failed = await send(
      unavailable,
      "/api/participation/streamer-riot-id-requests/dashboard-access",
      { requestId: REQUEST_ID, dashboardEnabled: false }
    );
    assert.equal(failed.statusCode, 503);
    assert.equal(JSON.parse(failed.body).code, "AUDIT_LOGS_UNAVAILABLE");
    assert.equal(storeCalls, 1);
  });
});

test("production은 Database가 비활성이어도 감사 저장소 없이 관리자 권한을 변경하지 않는다", async () => {
  const previous = {
    databaseEnabled: appConfig.database.enabled,
    nodeEnv: appConfig.nodeEnv,
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth
  };
  resetSecurityRateLimiters();
  appConfig.database.enabled = false;
  appConfig.nodeEnv = "production";
  appConfig.security.dashboardAuthToken = AUTH_TOKEN;
  appConfig.security.localNoAuth = false;
  let storeCalls = 0;
  try {
    const current = streamerRequest();
    const handler = createHttpHandler({
      store: {
        listStreamerRiotIdRequests() {
          return [{ ...current }];
        },
        resolveStreamerRiotIdRequest() {
          storeCalls += 1;
          return { ...current, status: "approved" };
        }
      },
      twitchAuth: {},
      actions: { async dispatchOne() {} }
    });

    const response = await send(
      handler,
      "/api/participation/streamer-riot-id-requests/resolve",
      { requestId: REQUEST_ID, decision: "approved" }
    );

    assert.equal(response.statusCode, 503);
    assert.equal(JSON.parse(response.body).code, "AUDIT_LOGS_UNAVAILABLE");
    assert.equal(storeCalls, 0);
  } finally {
    appConfig.database.enabled = previous.databaseEnabled;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    resetSecurityRateLimiters();
  }
});
