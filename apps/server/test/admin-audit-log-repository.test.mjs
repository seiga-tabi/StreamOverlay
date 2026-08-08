import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminAuditLogListResponse } from "@streamops/shared";
import { SafeDatabaseError } from "../dist/database/errors.js";
import {
  AdminAuditLogQueryError,
  AdminAuditLogRepository,
  parseAdminAuditLogQuery,
  safeAuditReference
} from "../dist/database/repositories/admin-audit-log-repository.js";

const from = "2026-08-01T00:00:00.000Z";
const to = "2026-08-08T01:00:00.000Z";
const organizationRow = {
  scope: "organization",
  entry_reference_hash: Buffer.from("11".repeat(32), "hex"),
  organization_reference_hash: Buffer.from("22".repeat(32), "hex"),
  actor_reference_hash: Buffer.from("33".repeat(32), "hex"),
  action: "discord.bot.settings.updated",
  target_type: "discord_bot_control",
  target_reference_hash: Buffer.from("44".repeat(32), "hex"),
  safe_metadata: {
    revision: 7,
    token: "절대 노출하지 않음",
    email: "private@example.com"
  },
  outcome: null,
  created_at: "2026-08-08T00:00:00.000Z",
  completed_at: null
};
const globalRow = {
  scope: "global",
  entry_reference_hash: Buffer.from("55".repeat(32), "hex"),
  organization_reference_hash: null,
  actor_reference_hash: Buffer.from("66".repeat(32), "hex"),
  action: "streamer.riot_id_request.resolved",
  target_type: "streamer_riot_id_request",
  target_reference_hash: Buffer.from("77".repeat(32), "hex"),
  safe_metadata: {
    decision: "rejected",
    noteProvided: true,
    note: "원문 거절 사유는 내려보내지 않음"
  },
  outcome: "succeeded",
  created_at: "2026-08-07T23:59:00.000Z",
  completed_at: "2026-08-07T23:59:01.000Z"
};

test("감사 로그 repository는 tenant·global을 UNION하고 원본 식별자·임의 metadata를 제거한다", async () => {
  const calls = [];
  const repository = new AdminAuditLogRepository({
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [organizationRow, globalRow], rowCount: 2 };
    }
  });
  const query = parseAdminAuditLogQuery(new URLSearchParams({
    from,
    to,
    action: "discord.bot.settings.updated",
    target: "discord_bot_control",
    actor: "33".repeat(32),
    offset: "25",
    limit: "1"
  }));
  const response = await repository.list(query);

  assert.equal(response.logs.length, 1);
  assert.deepEqual(response.page, {
    from,
    to,
    offset: 25,
    limit: 1,
    hasMore: true,
    truncated: false,
    nextOffset: 26
  });
  assert.deepEqual(response.logs[0], {
    reference: "11".repeat(32),
    scope: "organization",
    organizationReference: "22".repeat(32),
    actorReference: "33".repeat(32),
    action: "discord.bot.settings.updated",
    targetType: "discord_bot_control",
    targetReference: "44".repeat(32),
    metadata: { revision: 7 },
    createdAt: "2026-08-08T00:00:00.000Z"
  });
  assert.doesNotMatch(JSON.stringify(response), /private@example\.com|절대 노출|원문 거절/u);
  assert.match(calls[0].text, /FROM audit_logs[\s\S]+UNION ALL[\s\S]+FROM admin_audit_logs/u);
  assert.match(calls[0].text, /LIMIT \$\d+ OFFSET \$\d+/u);
  assert.ok(calls[0].values.includes("discord.bot.settings.updated"));
  assert.equal(calls[0].values.at(-1), 25);
  assert.ok(parseAdminAuditLogListResponse(response));
  assert.equal(Object.hasOwn(response.page, "nextCursor"), false);
});

test("감사 로그 repository는 global outcome과 안전한 action metadata만 반환한다", async () => {
  const repository = new AdminAuditLogRepository({
    async query() {
      return { rows: [globalRow], rowCount: 1 };
    }
  });
  const response = await repository.list(parseAdminAuditLogQuery(new URLSearchParams({
    from,
    to,
    limit: "2"
  })));
  assert.deepEqual(response.logs[0], {
    reference: "55".repeat(32),
    scope: "global",
    actorReference: "66".repeat(32),
    action: "streamer.riot_id_request.resolved",
    targetType: "streamer_riot_id_request",
    targetReference: "77".repeat(32),
    metadata: { decision: "rejected", noteProvided: true },
    outcome: "succeeded",
    createdAt: "2026-08-07T23:59:00.000Z",
    completedAt: "2026-08-07T23:59:01.000Z"
  });
  assert.equal(response.page.hasMore, false);
  assert.equal(response.page.truncated, false);
  assert.equal(response.logs[0].organizationReference, undefined);
  assert.doesNotMatch(JSON.stringify(response), /원문 거절/u);
});

test("감사 로그 repository는 offset 상한 뒤 추가 row를 truncated로 명시한다", async () => {
  const repository = new AdminAuditLogRepository({
    async query() {
      return { rows: Array.from({ length: 101 }, () => organizationRow), rowCount: 101 };
    }
  });
  const response = await repository.list(parseAdminAuditLogQuery(new URLSearchParams({
    from,
    to,
    offset: "10000",
    limit: "100"
  })));

  assert.equal(response.logs.length, 100);
  assert.deepEqual(response.page, {
    from,
    to,
    offset: 10_000,
    limit: 100,
    hasMore: false,
    truncated: true
  });
  assert.ok(parseAdminAuditLogListResponse(response));
  assert.equal(Object.hasOwn(response.page, "nextOffset"), false);
});

test("감사 로그 query는 canonical snapshot·bounded offset·known filter만 허용한다", () => {
  assert.deepEqual(parseAdminAuditLogQuery(new URLSearchParams({ from, to, offset: "10000", limit: "100" })), {
    from,
    to,
    offset: 10_000,
    limit: 100
  });
  for (const params of [
    { offset: "10001" },
    { offset: "1e2" },
    { limit: "101" },
    { cursor: "legacy-cursor" },
    { action: "discord.bot.settings.updated' OR TRUE --" },
    { target: "unknown_target" },
    { from: "2026-08-01T00:00:00" }
  ]) {
    assert.throws(
      () => parseAdminAuditLogQuery(new URLSearchParams(params)),
      (error) => error instanceof AdminAuditLogQueryError && error.code === "INVALID_AUDIT_FILTER"
    );
  }
  assert.throws(
    () => parseAdminAuditLogQuery(new URLSearchParams({
      from: "2025-01-01T00:00:00.000Z",
      to: "2026-08-08T00:00:00.000Z"
    })),
    (error) => error instanceof AdminAuditLogQueryError && error.code === "INVALID_AUDIT_FILTER"
  );
});

test("global mutation은 raw session·target을 hash한 started row만 쓰고 한 번만 finalize한다", async () => {
  const calls = [];
  let completionCount = 0;
  const repository = new AdminAuditLogRepository({
    async query(text, values) {
      calls.push({ text, values });
      if (text.startsWith("UPDATE")) {
        completionCount += 1;
        return { rows: [], rowCount: completionCount === 1 ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    }
  });
  const actorSessionId = "raw_admin_session_SENTINEL";
  const targetIdentifier = "raw_riot_request_SENTINEL";
  const mutation = await repository.beginGlobalMutation({
    actorMethod: "session",
    actorSessionId,
    action: "streamer.riot_id_request.resolved",
    targetIdentifier,
    metadata: { decision: "approved", noteProvided: false }
  });
  assert.match(mutation.mutationId, /^[0-9a-f-]{36}$/u);
  assert.match(calls[0].text, /INSERT INTO admin_audit_logs/u);
  assert.ok(calls[0].values[1] instanceof Buffer);
  assert.ok(calls[0].values[5] instanceof Buffer);
  assert.equal(calls[0].values[1].toString("hex"), safeAuditReference(actorSessionId));
  assert.equal(calls[0].values[5].toString("hex"), safeAuditReference(targetIdentifier));
  assert.doesNotMatch(JSON.stringify(calls[0]), /raw_admin_session|raw_riot_request/u);

  await repository.completeGlobalMutation({ mutationId: mutation.mutationId, outcome: "succeeded" });
  await assert.rejects(
    repository.completeGlobalMutation({ mutationId: mutation.mutationId, outcome: "failed" }),
    (error) => error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT"
  );
  await assert.rejects(
    repository.beginGlobalMutation({
      actorMethod: "token",
      actorSessionId: "actual-bearer-token-must-not-be-accepted",
      action: "streamer.dashboard_access.updated",
      targetIdentifier,
      metadata: { dashboardEnabled: true, noteProvided: true }
    }),
    (error) => error instanceof SafeDatabaseError && error.code === "DATABASE_INVALID_INPUT"
  );
  await assert.rejects(
    repository.beginGlobalMutation({
      actorMethod: "token",
      action: "streamer.riot_id_request.resolved",
      targetIdentifier,
      metadata: { decision: "rejected", noteProvided: true, note: "raw note" }
    }),
    (error) => error instanceof SafeDatabaseError && error.code === "DATABASE_INVALID_INPUT"
  );
});

test("token mutation은 비밀이 아닌 고정 sentinel만 hash한다", async () => {
  const calls = [];
  const repository = new AdminAuditLogRepository({
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [], rowCount: 1 };
    }
  });
  await repository.beginGlobalMutation({
    actorMethod: "token",
    action: "streamer.dashboard_access.updated",
    targetIdentifier: "riotreq_safe_target",
    metadata: { dashboardEnabled: false, noteProvided: false }
  });
  assert.equal(calls[0].values[1].toString("hex"), safeAuditReference("dashboard-token"));
});
