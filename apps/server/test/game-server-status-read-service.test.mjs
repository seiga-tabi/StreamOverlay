import test from "node:test";
import assert from "node:assert/strict";
import { GameServerStatusReadService } from "../dist/services/game-server-status-read-service.js";

const context = Object.freeze({
  organizationId: "10000000-0000-4000-8000-000000000001"
});

function repository(server, connected = true) {
  return {
    async resolveGuild() {
      return connected ? context : undefined;
    },
    async findPalworldServer() {
      return server;
    }
  };
}

test("상태 조회는 연결되지 않은 Guild와 서버 미등록을 구분한다", async () => {
  const disconnected = new GameServerStatusReadService(
    repository(undefined, false)
  );
  assert.deepEqual(await disconnected.read({
    applicationId: "100000000000000001",
    guildId: "100000000000000002"
  }), { connected: false });

  const empty = new GameServerStatusReadService(repository(undefined));
  assert.deepEqual(await empty.read({
    applicationId: "100000000000000001",
    guildId: "100000000000000002"
  }), { connected: true });
});

test("Agent 상태는 current를 사용하고 오래된 관측을 stale로 변환한다", async () => {
  const base = {
    id: "20000000-0000-4000-8000-000000000001",
    displayName: "Seiga Palworld",
    connectionType: "agent",
    connectionStatus: "ready",
    current: {
      online: true,
      players: 4,
      maxPlayers: 32,
      version: "v1.0",
      latencyMs: 22,
      observedAt: "2026-07-30T00:00:00.000Z"
    }
  };
  const recent = new GameServerStatusReadService(
    repository(base),
    undefined,
    () => Date.parse("2026-07-30T00:05:00.000Z")
  );
  assert.deepEqual((await recent.read({
    applicationId: "100000000000000001",
    guildId: "100000000000000002"
  })).server, {
    displayName: "Seiga Palworld",
    status: "online",
    source: "agent",
    players: { current: 4, max: 32 },
    version: "v1.0",
    latencyMs: 22,
    observedAt: "2026-07-30T00:00:00.000Z"
  });

  const stale = new GameServerStatusReadService(
    repository(base),
    undefined,
    () => Date.parse("2026-07-30T00:20:00.000Z")
  );
  assert.equal((await stale.read({
    applicationId: "100000000000000001",
    guildId: "100000000000000002"
  })).server.status, "stale");
});

test("REST 상태는 설정된 source만 읽고 내부 진단을 DTO에 포함하지 않는다", async () => {
  const server = {
    id: "20000000-0000-4000-8000-000000000002",
    displayName: "REST Palworld",
    connectionType: "rest",
    connectionStatus: "ready"
  };
  let ownerId;
  const service = new GameServerStatusReadService(repository(server), {
    getDashboardResponse(value) {
      ownerId = value;
      return {
        enabled: true,
        pollIntervalSeconds: 30,
        registrationPolicy: {
          publicHttpsSelfService: false,
          publicHttpsPort: 443,
          privateNetworkRequiresOperatorApproval: true
        },
        connection: {
          configured: true,
          passwordConfigured: true
        },
        status: {
          state: "degraded",
          checkedAt: "2026-07-30T00:00:00.000Z",
          latencyMs: 300,
          consecutiveFailures: 1,
          info: { serverName: "private", version: "v1.0" },
          metrics: {
            serverFps: 60,
            currentPlayers: 2,
            maxPlayers: 32,
            frameTimeMs: 16,
            uptimeSeconds: 100,
            baseCampCount: 1,
            gameDays: 1
          },
          diagnostics: [{
            key: "basic_auth",
            state: "failed",
            errorCode: "auth_failed"
          }]
        }
      };
    }
  });
  const result = await service.read({
    applicationId: "100000000000000001",
    guildId: "100000000000000002"
  });
  assert.equal(
    ownerId,
    `organization:${context.organizationId}:server:${server.id}`
  );
  assert.deepEqual(result.server, {
    displayName: "REST Palworld",
    status: "degraded",
    source: "rest",
    players: { current: 2, max: 32 },
    version: "v1.0",
    latencyMs: 300,
    observedAt: "2026-07-30T00:00:00.000Z"
  });
  assert.equal(JSON.stringify(result).includes("basic_auth"), false);
  assert.equal(JSON.stringify(result).includes("private"), false);
});
