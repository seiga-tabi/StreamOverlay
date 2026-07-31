import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DISCORD_BOT_CONTROL_SETTINGS,
  parseDiscordBotCommandPolicyRequest,
  parseDiscordBotCommandPolicyResponse,
  parseUpdateDiscordBotControlInput
} from "../dist/index.js";

const validUpdate = {
  publicCommandsEnabled: true,
  palworldStatusEnabled: true,
  statusCommandEnabled: true,
  guideCommandEnabled: false,
  preferredLocale: "ko",
  statusFields: {
    players: true,
    version: true,
    latency: false,
    observedAt: true
  },
  expectedRevision: 3
};

test("Discord Bot 제어 입력은 exact schema와 revision을 검증한다", () => {
  assert.deepEqual(parseUpdateDiscordBotControlInput(validUpdate), validUpdate);
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    organizationId: "위조된 tenant"
  }), undefined);
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    expectedRevision: -1
  }), undefined);
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    statusFields: { ...validUpdate.statusFields, players: "yes" }
  }), undefined);
});

test("Discord Bot 내부 명령 정책 요청은 Guild와 Application binding을 강제한다", () => {
  const value = {
    applicationId: "123456789012345678",
    guildId: "223456789012345678",
    command: "status"
  };
  assert.deepEqual(parseDiscordBotCommandPolicyRequest(value), value);
  assert.equal(parseDiscordBotCommandPolicyRequest({
    ...value,
    organizationId: "tenant-a"
  }), undefined);
  assert.equal(parseDiscordBotCommandPolicyRequest({
    ...value,
    command: "ban"
  }), undefined);
});

test("Discord Bot 명령 정책 응답은 허용 여부와 사유의 모순을 거부한다", () => {
  const allowed = {
    allowed: true,
    commands: {
      help: true,
      status: true,
      guide: false
    },
    preferredLocale: "auto",
    statusFields: DEFAULT_DISCORD_BOT_CONTROL_SETTINGS.statusFields,
    revision: 0
  };
  assert.ok(parseDiscordBotCommandPolicyResponse(allowed));
  assert.equal(parseDiscordBotCommandPolicyResponse({
    ...allowed,
    reason: "command_disabled"
  }), undefined);
  assert.ok(parseDiscordBotCommandPolicyResponse({
    ...allowed,
    allowed: false,
    reason: "module_disabled"
  }));
  assert.equal(parseDiscordBotCommandPolicyResponse({
    ...allowed,
    allowed: false
  }), undefined);
  assert.equal(parseDiscordBotCommandPolicyResponse({
    ...allowed,
    commands: { help: true, status: true }
  }), undefined);
});
