import test from "node:test";
import assert from "node:assert/strict";
import {
  discordInternalCanonicalRequest,
  parseDiscordGameServerStatusRequest,
  parseDiscordAnnouncementAckRequest,
  parseDiscordAnnouncementPendingRequest,
  parseDiscordGuildDirectoryReportRequest,
  parseDiscordGameServerStatusResponse,
  parseDiscordPalworldPlayerLookupRequest,
  parseDiscordPalworldPlayerLookupResponse,
  parseDiscordInstallationObservationRequest,
  parseDiscordSetupSessionRequest
} from "../dist/discord-internal.js";

test("Palworld 플레이어 내부 계약은 닉네임 외 검색 식별자를 받지 않는다", () => {
  const request = {
    applicationId: "123456789012345678",
    guildId: "223456789012345678",
    nickname: "세이가"
  };
  assert.deepEqual(parseDiscordPalworldPlayerLookupRequest(request), request);
  assert.equal(parseDiscordPalworldPlayerLookupRequest({
    ...request,
    organizationId: "tenant-a"
  }), undefined);
  const response = {
    connected: true,
    serverConfigured: true,
    displayName: "Palworld",
    result: {
      kind: "profile",
      player: {
        nickname: "세이가",
        level: 42,
        buildingCount: 7
      }
    }
  };
  assert.deepEqual(parseDiscordPalworldPlayerLookupResponse(response), response);
  const withoutBuildingCount = {
    ...response,
    result: {
      kind: "profile",
      player: {
        nickname: "세이가",
        level: 42
      }
    }
  };
  assert.deepEqual(
    parseDiscordPalworldPlayerLookupResponse(withoutBuildingCount),
    withoutBuildingCount
  );
  assert.deepEqual(parseDiscordPalworldPlayerLookupResponse({
    connected: true,
    serverConfigured: true,
    displayName: "Palworld",
    reason: "rest_invalid_response"
  }), {
    connected: true,
    serverConfigured: true,
    displayName: "Palworld",
    reason: "rest_invalid_response"
  });
  assert.equal(parseDiscordPalworldPlayerLookupResponse({
    ...response,
    result: {
      kind: "profile",
      player: {
        ...response.result.player,
        ip: "203.0.113.10"
      }
    }
  }), undefined);
});

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
      source: "rest",
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

test("길드 채널 보고는 exact schema와 상한을 강제한다", () => {
  const valid = {
    applicationId: "123456789012345678",
    guildId: "223456789012345678",
    channels: [{ id: "323456789012345678", name: "참여-알림" }],
    roles: [{ id: "423456789012345678", name: "참여알림" }],
    channelsTruncated: false,
    rolesTruncated: false
  };
  assert.deepEqual(parseDiscordGuildDirectoryReportRequest(valid), valid);

  // 빈 목록은 정상입니다. 봇이 쓸 수 있는 채널이 하나도 없을 수 있습니다.
  assert.ok(parseDiscordGuildDirectoryReportRequest({
    ...valid,
    channels: [],
    roles: []
  }));

  for (const invalid of [
    { ...valid, extra: true },
    { ...valid, applicationId: "not-a-snowflake" },
    { ...valid, channelsTruncated: "false" },
    { ...valid, channels: [{ id: "323456789012345678" }] },
    { ...valid, channels: [{ id: "323456789012345678", name: "", }] },
    { ...valid, channels: [{ id: "323456789012345678", name: "x".repeat(101) }] },
    { ...valid, channels: [{ id: "nope", name: "일반" }] },
    { ...valid, channels: [{ id: "323456789012345678", name: "a", kind: "text" }] },
    // 같은 채널을 두 번 보고하면 캐시가 어긋납니다.
    {
      ...valid,
      channels: [
        { id: "323456789012345678", name: "a" },
        { id: "323456789012345678", name: "b" }
      ]
    },
    // 상한 초과
    {
      ...valid,
      channels: Array.from({ length: 201 }, (_, index) => ({
        id: String(300000000000000000 + index),
        name: `c${index}`
      }))
    }
  ]) {
    assert.equal(
      parseDiscordGuildDirectoryReportRequest(invalid),
      undefined,
      JSON.stringify(invalid).slice(0, 90)
    );
  }
});

test("길드 채널 이름의 제어문자는 거부한다", () => {
  const withControl = {
    applicationId: "123456789012345678",
    guildId: "223456789012345678",
    channels: [{ id: "323456789012345678", name: `일반${String.fromCharCode(0)}` }],
    roles: [],
    channelsTruncated: false,
    rolesTruncated: false
  };
  assert.equal(parseDiscordGuildDirectoryReportRequest(withControl), undefined);
});

test("참여 알림 폴링 요청은 applicationId 하나만 받는다", () => {
  const valid = { applicationId: "123456789012345678" };
  assert.deepEqual(parseDiscordAnnouncementPendingRequest(valid), valid);
  for (const invalid of [
    { ...valid, guildId: "223456789012345678" },
    { applicationId: "nope" },
    {}
  ]) {
    assert.equal(parseDiscordAnnouncementPendingRequest(invalid), undefined);
  }
});

test("참여 알림 ack 은 성공 시 messageId를 반드시 요구한다", () => {
  const base = {
    applicationId: "123456789012345678",
    jobId: "11111111-1111-4111-8111-111111111111",
    result: "ok",
    messageId: "323456789012345678"
  };
  assert.deepEqual(parseDiscordAnnouncementAckRequest(base), base);

  // 실패 보고에는 messageId 가 없어도 됩니다.
  assert.ok(parseDiscordAnnouncementAckRequest({
    applicationId: base.applicationId,
    jobId: base.jobId,
    result: "permission_missing"
  }));

  for (const invalid of [
    // 성공인데 어떤 메시지인지 모르면 다음 편집을 할 수 없습니다.
    { applicationId: base.applicationId, jobId: base.jobId, result: "ok" },
    { ...base, result: "exploded" },
    { ...base, jobId: "not-a-uuid" },
    { ...base, channelId: "423456789012345678" },
    { ...base, messageId: "nope" }
  ]) {
    assert.equal(
      parseDiscordAnnouncementAckRequest(invalid),
      undefined,
      JSON.stringify(invalid)
    );
  }
});
