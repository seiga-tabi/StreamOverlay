import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCORD_BOT_PREFIX_COMMAND_MANIFEST,
  DISCORD_BOT_MESSAGES,
  DEFAULT_DISCORD_BOT_CONTROL_SETTINGS,
  discordBotMessageLocale,
  parseDiscordBotControlOverview,
  parseDiscordBotCommandPolicyRequest,
  parseDiscordBotCommandPolicyResponse,
  parseDiscordBotResponseLocaleUpdateRequest,
  parseDiscordBotResponseLocaleUpdateResponse,
  parseUpdateDiscordBotControlInput
} from "../dist/index.js";

test("Discord Bot 공개 명령 manifest는 영어 단일 문법과 지연 특성을 함께 정의한다", () => {
  assert.deepEqual(
    DISCORD_BOT_PREFIX_COMMAND_MANIFEST.map((entry) => entry.command),
    ["help", "status", "player", "guide"]
  );
  const help = DISCORD_BOT_PREFIX_COMMAND_MANIFEST[0];
  const status = DISCORD_BOT_PREFIX_COMMAND_MANIFEST[1];
  const player = DISCORD_BOT_PREFIX_COMMAND_MANIFEST[2];
  assert.deepEqual(help.aliases, ["", "help"]);
  assert.deepEqual(status.aliases, ["status"]);
  assert.deepEqual(player.aliases, ["player"]);
  assert.equal(help.showTyping, false);
  assert.equal(status.requiresPalworldRest, true);
  assert.equal(status.showTyping, true);
  assert.equal(player.acceptsNickname, true);
});

test("Discord Bot 메시지 catalog는 한국어·일본어·영어와 영어 fallback을 제공한다", () => {
  assert.deepEqual(Object.keys(DISCORD_BOT_MESSAGES), ["ko", "ja", "en"]);
  assert.equal(discordBotMessageLocale("ko"), "ko");
  assert.equal(discordBotMessageLocale("ja-JP"), "ja");
  assert.equal(discordBotMessageLocale("en-US"), "en");
  assert.equal(discordBotMessageLocale("fr"), "en");
  assert.match(DISCORD_BOT_MESSAGES.en.prefix.statusTitle, /Palworld Server/u);
});

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
    deleteInvocationAfterReply: false,
    preferredLocale: "ko",
    statusFields: {
      players: true,
      version: true,
      latency: false,
      observedAt: true
    },
    participationAnnounceEnabled: true,
    revision: 2
  }
};

const validUpdate = {
  publicCommandsEnabled: true,
  palworldStatusEnabled: true,
  statusCommandEnabled: true,
  playerCommandEnabled: true,
  guideCommandEnabled: false,
  deleteInvocationAfterReply: true,
  preferredLocale: "ko",
  statusFields: {
    players: true,
    version: true,
    latency: false,
    observedAt: true
  },
  participationAnnounceEnabled: false,
  expectedRevision: 3
};

test("Discord Bot 제어 입력은 exact schema와 revision을 검증한다", () => {
  assert.deepEqual(parseUpdateDiscordBotControlInput(validUpdate), validUpdate);
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    organizationId: "위조된 tenant"
  }), undefined);
  assert.equal(
    parseUpdateDiscordBotControlInput({ ...validUpdate, preferredLocale: "en" })
      ?.preferredLocale,
    "en"
  );
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    expectedRevision: -1
  }), undefined);
  assert.equal(parseUpdateDiscordBotControlInput({
    ...validUpdate,
    statusFields: { ...validUpdate.statusFields, players: "yes" }
  }), undefined);
});

test("Discord Bot 응답 언어 변경 계약은 Guild·사용자 binding과 영어를 검증한다", () => {
  const request = {
    applicationId: "123456789012345678",
    guildId: "223456789012345678",
    userId: "323456789012345678",
    preferredLocale: "en"
  };
  assert.deepEqual(parseDiscordBotResponseLocaleUpdateRequest(request), request);
  assert.equal(parseDiscordBotResponseLocaleUpdateRequest({
    ...request,
    preferredLocale: "fr"
  }), undefined);
  assert.equal(parseDiscordBotResponseLocaleUpdateRequest({
    ...request,
    organizationId: "forged"
  }), undefined);
  assert.deepEqual(parseDiscordBotResponseLocaleUpdateResponse({
    preferredLocale: "en",
    revision: 4
  }), { preferredLocale: "en", revision: 4 });
  assert.equal(parseDiscordBotResponseLocaleUpdateResponse({
    preferredLocale: "en",
    revision: 0
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
    deleteInvocationAfterReply: false,
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
