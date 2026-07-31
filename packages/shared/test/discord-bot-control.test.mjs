import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DISCORD_BOT_CONTROL_SETTINGS,
  parseDiscordBotControlOverview,
  parseDiscordBotCommandPolicyRequest,
  parseDiscordBotCommandPolicyResponse,
  parseUpdateDiscordBotControlInput
} from "../dist/index.js";

const validOverview = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  role: "owner",
  globalPrefixCommandsEnabled: true,
  installation: {
    guildId: "123456789012345678",
    guildDisplayName: "검증 Discord 서버",
    applicationId: "234567890123456789",
    status: "active"
  },
  modules: [{ id: "palworld.status", version: 1, enabled: true }],
  settings: {
    publicCommandsEnabled: true,
    palworldStatusEnabled: true,
    statusCommandEnabled: true,
    playerCommandEnabled: false,
    guideCommandEnabled: true,
    preferredLocale: "ko",
    statusFields: {
      players: true,
      version: true,
      latency: false,
      observedAt: true
    },
    revision: 2
  }
};

const validUpdate = {
  publicCommandsEnabled: true,
  palworldStatusEnabled: true,
  statusCommandEnabled: true,
  playerCommandEnabled: true,
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

test("Discord Bot 제어 응답은 저장된 플레이어 명령과 exact schema를 검증한다", () => {
  assert.deepEqual(parseDiscordBotControlOverview(validOverview), validOverview);
  assert.equal(parseDiscordBotControlOverview({
    ...validOverview,
    settings: {
      ...validOverview.settings,
      playerCommandEnabled: undefined
    }
  }), undefined);
  assert.equal(parseDiscordBotControlOverview({
    ...validOverview,
    modules: [{ id: "palworld.status", version: 1, enabled: false }]
  }), undefined);
  assert.equal(parseDiscordBotControlOverview({
    ...validOverview,
    internalSource: "database"
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
      player: true,
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
    commands: { help: true, status: true, player: true }
  }), undefined);
});
