import test from "node:test";
import assert from "node:assert/strict";
import {
  discordInternalCanonicalRequest,
  parseDiscordGameServerStatusRequest,
  parseDiscordGameServerStatusResponse,
  parseDiscordInstallationObservationRequest,
  parseDiscordSetupSessionRequest
} from "../dist/discord-internal.js";

const setup = {
  applicationId: "100000000000000001",
  guildId: "100000000000000002",
  interactionId: "100000000000000003",
  userId: "100000000000000004"
};

test("Discord 내부 setup 요청은 exact schema와 snowflake만 허용한다", () => {
  assert.deepEqual(parseDiscordSetupSessionRequest(setup), setup);
  assert.equal(parseDiscordSetupSessionRequest({ ...setup, owner: true }), undefined);
  assert.equal(parseDiscordSetupSessionRequest({ ...setup, guildId: "not-id" }), undefined);
  assert.deepEqual(parseDiscordInstallationObservationRequest({
    applicationId: setup.applicationId,
    guildId: setup.guildId
  }), {
    applicationId: setup.applicationId,
    guildId: setup.guildId
  });
});

test("Discord 게임 서버 상태 계약은 허용된 안전 필드만 통과시킨다", () => {
  assert.deepEqual(parseDiscordGameServerStatusRequest({
    applicationId: setup.applicationId,
    guildId: setup.guildId
  }), {
    applicationId: setup.applicationId,
    guildId: setup.guildId
  });
  const response = {
    connected: true,
    server: {
      displayName: "Palworld 서버",
      status: "online",
      reason: "partial_data",
      source: "agent",
      players: { current: 3, max: 32 },
      version: "v1.0",
      latencyMs: 24,
      observedAt: "2026-07-30T00:00:00.000Z"
    }
  };
  assert.deepEqual(parseDiscordGameServerStatusResponse(response), response);
  assert.equal(
    parseDiscordGameServerStatusResponse({
      ...response,
      server: { ...response.server, restUrl: "https://private.example" }
    }),
    undefined
  );
  assert.equal(
    parseDiscordGameServerStatusResponse({
      ...response,
      server: { ...response.server, reason: "database_password_missing" }
    }),
    undefined
  );
  assert.equal(
    parseDiscordGameServerStatusResponse({
      ...response,
      server: { ...response.server, players: { current: 33, max: 32 } }
    }),
    undefined
  );
  assert.deepEqual(parseDiscordGameServerStatusResponse({ connected: false }), {
    connected: false
  });
});

test("Discord 내부 canonical request는 method와 path를 정확히 귀속한다", () => {
  assert.equal(discordInternalCanonicalRequest({
    bodySha256: "a".repeat(64),
    method: "post",
    nonce: "b".repeat(32),
    path: "/internal/discord/setup-sessions",
    timestamp: "1800000000"
  }), [
    "v1",
    "1800000000",
    "b".repeat(32),
    "POST",
    "/internal/discord/setup-sessions",
    "a".repeat(64)
  ].join("\n"));
  assert.throws(() => discordInternalCanonicalRequest({
    bodySha256: "a".repeat(64),
    method: "POST",
    nonce: "b".repeat(32),
    path: "/api/discord/setup",
    timestamp: "1800000000"
  }));
});
