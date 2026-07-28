import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAgentRegistrationInput,
  parsePalworldAgentStatusPayload
} from "../dist/index.js";

const now = Date.parse("2026-07-29T00:00:00.000Z");
const validStatus = {
  payloadVersion: 1,
  observedAt: "2026-07-28T23:59:30.000Z",
  online: true,
  players: 6,
  maxPlayers: 16,
  gameVersion: "0.6.5",
  uptimeSeconds: 3600,
  cpuPercent: 12.5,
  memoryPercent: 40,
  diskPercent: 60,
  latencyMs: 28
};

test("Agent 등록 요청은 정확한 allowlist field만 허용한다", () => {
  const value = {
    bootstrapToken: "a".repeat(48),
    agentVersion: "1.0.0",
    platform: "linux",
    architecture: "x64"
  };
  assert.deepEqual(parseAgentRegistrationInput(value), value);
  assert.equal(parseAgentRegistrationInput({ ...value, organizationId: "forged" }), undefined);
  assert.equal(parseAgentRegistrationInput({ ...value, platform: "darwin" }), undefined);
  assert.equal(parseAgentRegistrationInput({ ...value, architecture: "x86" }), undefined);
});

test("Palworld Agent status 정상 payload를 정규화한다", () => {
  assert.deepEqual(
    parsePalworldAgentStatusPayload(validStatus, { now }),
    validStatus
  );
});

test("Palworld Agent status는 unknown·민감 field와 잘못된 version을 거부한다", () => {
  for (const value of [
    { ...validStatus, payloadVersion: 2 },
    { ...validStatus, playerNames: ["player"] },
    { ...validStatus, address: "127.0.0.1" },
    { ...validStatus, adminPassword: "secret" },
    { ...validStatus, nested: {} }
  ]) {
    assert.equal(parsePalworldAgentStatusPayload(value, { now }), undefined);
  }
});

test("Palworld Agent status는 count·percentage·유한수 범위를 검증한다", () => {
  for (const value of [
    { ...validStatus, players: -1 },
    { ...validStatus, maxPlayers: -1 },
    { ...validStatus, players: 17 },
    { ...validStatus, cpuPercent: 101 },
    { ...validStatus, memoryPercent: Number.NaN },
    { ...validStatus, diskPercent: Number.POSITIVE_INFINITY },
    { ...validStatus, uptimeSeconds: -1 },
    { ...validStatus, latencyMs: -1 }
  ]) {
    assert.equal(parsePalworldAgentStatusPayload(value, { now }), undefined);
  }
});

test("Palworld Agent status는 strict ISO와 과거·미래 허용 범위를 검증한다", () => {
  assert.equal(
    parsePalworldAgentStatusPayload({ ...validStatus, observedAt: "2026/07/29" }, { now }),
    undefined
  );
  assert.equal(
    parsePalworldAgentStatusPayload(
      { ...validStatus, observedAt: "2026-07-27T23:59:59.000Z" },
      { now }
    ),
    undefined
  );
  assert.equal(
    parsePalworldAgentStatusPayload(
      { ...validStatus, observedAt: "2026-07-29T00:05:01.000Z" },
      { now }
    ),
    undefined
  );
});

test("Palworld Agent status는 gameVersion 길이와 control character를 제한한다", () => {
  assert.equal(
    parsePalworldAgentStatusPayload({ ...validStatus, gameVersion: "x".repeat(81) }, { now }),
    undefined
  );
  assert.equal(
    parsePalworldAgentStatusPayload({ ...validStatus, gameVersion: "0.6\nsecret" }, { now }),
    undefined
  );
});
