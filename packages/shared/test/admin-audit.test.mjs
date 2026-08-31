import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAdminAuditLogListResponse,
  parseAdminAuditLogMetadata,
  sanitizeAdminAuditLogMetadata
} from "../dist/index.js";

const hash = "a".repeat(64);
const organizationEntry = {
  reference: hash,
  scope: "organization",
  organizationReference: "b".repeat(64),
  actorReference: "c".repeat(64),
  action: "discord.bot.settings.updated",
  targetType: "discord_bot_control",
  targetReference: "d".repeat(64),
  metadata: { revision: 3 },
  createdAt: "2026-08-08T00:00:00.000Z"
};
const globalEntry = {
  reference: "e".repeat(64),
  scope: "global",
  actorReference: "f".repeat(64),
  action: "streamer.riot_id_request.resolved",
  targetType: "streamer_riot_id_request",
  targetReference: "1".repeat(64),
  metadata: { decision: "approved", noteProvided: true },
  outcome: "succeeded",
  createdAt: "2026-08-08T00:01:00.000Z",
  completedAt: "2026-08-08T00:01:01.000Z"
};
const validResponse = {
  logs: [organizationEntry, globalEntry],
  page: {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-08T00:02:00.000Z",
    offset: 0,
    limit: 50,
    hasMore: false,
    truncated: false
  }
};

test("관리자 감사 로그 parser는 organization·global scope와 해시 reference만 허용한다", () => {
  assert.deepEqual(parseAdminAuditLogListResponse(validResponse), validResponse);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    logs: [{ ...organizationEntry, actorReference: "원본-user-id" }]
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    logs: [{ ...globalEntry, organizationReference: "b".repeat(64) }]
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    logs: [{ ...organizationEntry, scope: "global", outcome: "succeeded" }]
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    logs: [{ ...globalEntry, outcome: "started", completedAt: globalEntry.completedAt }]
  }), undefined);
});

test("관리자 감사 metadata는 action별 키와 enum 값만 허용하고 raw note·token을 제거한다", () => {
  assert.deepEqual(sanitizeAdminAuditLogMetadata("discord.bot.response_locale.updated", {
    revision: 7,
    preferredLocale: "ja",
    source: "discord_command",
    token: "절대 노출하지 않음"
  }), {
    revision: 7,
    preferredLocale: "ja",
    source: "discord_command"
  });
  assert.equal(parseAdminAuditLogMetadata("discord.bot.response_locale.updated", {
    revision: 7,
    preferredLocale: "ja",
    source: "secret-token-value"
  }), undefined);
  assert.equal(parseAdminAuditLogMetadata("streamer.riot_id_request.resolved", {
    decision: "rejected",
    noteProvided: true,
    note: "원문 거절 사유"
  }), undefined);
  assert.deepEqual(parseAdminAuditLogMetadata("streamer.riot_id_request.resolved", {
    decision: "approved",
    noteProvided: false,
    adminAccountLabel: "김운영"
  }), {
    decision: "approved",
    noteProvided: false,
    adminAccountLabel: "김운영"
  });
  for (const adminAccountLabel of ["", "   ", "운영\u0000자", "가".repeat(101)]) {
    const metadata = { decision: "approved", noteProvided: false, adminAccountLabel };
    assert.equal(parseAdminAuditLogMetadata("streamer.riot_id_request.resolved", metadata), undefined);
    assert.equal(sanitizeAdminAuditLogMetadata("streamer.riot_id_request.resolved", metadata), undefined);
  }
  assert.deepEqual(parseAdminAuditLogMetadata("streamer.dashboard_access.updated", {
    dashboardEnabled: false,
    noteProvided: false
  }), {
    dashboardEnabled: false,
    noteProvided: false
  });
  assert.equal(parseAdminAuditLogMetadata("streamer.dashboard_access.updated", {
    dashboardEnabled: false,
    noteProvided: false,
    adminAccountLabel: "추가하면 안 됨"
  }), undefined);
});

test("관리자 감사 로그 parser는 bounded offset pagination을 exact하게 검증한다", () => {
  const { truncated: _truncated, ...pageWithoutTruncated } = validResponse.page;
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    page: pageWithoutTruncated
  }), undefined);
  assert.deepEqual(parseAdminAuditLogListResponse({
    logs: [organizationEntry],
    page: { ...validResponse.page, offset: 50, limit: 1, hasMore: true, truncated: false, nextOffset: 51 }
  }), {
    logs: [organizationEntry],
    page: { ...validResponse.page, offset: 50, limit: 1, hasMore: true, truncated: false, nextOffset: 51 }
  });
  assert.deepEqual(parseAdminAuditLogListResponse({
    logs: [organizationEntry],
    page: {
      ...validResponse.page,
      offset: 10_000,
      limit: 1,
      hasMore: false,
      truncated: true
    }
  }), {
    logs: [organizationEntry],
    page: {
      ...validResponse.page,
      offset: 10_000,
      limit: 1,
      hasMore: false,
      truncated: true
    }
  });
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    page: { ...validResponse.page, hasMore: true, nextOffset: 49 }
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    logs: [organizationEntry],
    page: {
      ...validResponse.page,
      offset: 50,
      limit: 1,
      hasMore: false,
      truncated: true
    }
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    logs: [organizationEntry],
    page: {
      ...validResponse.page,
      offset: 10_000,
      limit: 1,
      hasMore: true,
      truncated: true,
      nextOffset: 10_000
    }
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    page: { ...validResponse.page, offset: 10_001 }
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    page: { ...validResponse.page, nextCursor: "raw-cursor" }
  }), undefined);
  assert.equal(parseAdminAuditLogListResponse({
    ...validResponse,
    page: { ...validResponse.page, from: "2026-08-09T00:00:00.000Z" }
  }), undefined);
});
