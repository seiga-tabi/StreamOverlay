import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLivenessResponse,
  buildReadinessResponse,
  resolveReadiness
} from "../dist/routing/health-responses.js";

test("readiness 결과와 요청 수락 상태를 합친다", () => {
  const snapshot = resolveReadiness(
    () => ({ ok: true, checks: { store: true }, errors: [] }),
    false
  );

  assert.deepEqual(snapshot, {
    ok: true,
    status: "ready",
    checks: { store: true, acceptingRequests: true },
    errors: []
  });
});

test("종료 중에는 readiness를 실패로 전환한다", () => {
  const snapshot = resolveReadiness(() => ({ ok: true }), true);

  assert.equal(snapshot.ok, false);
  assert.equal(snapshot.status, "not_ready");
  assert.equal(snapshot.checks.acceptingRequests, false);
});

test("readiness 검사 예외를 안전한 오류로 변환한다", () => {
  const snapshot = resolveReadiness(() => {
    throw new Error("민감한 내부 오류");
  }, false);

  assert.equal(snapshot.ok, false);
  assert.deepEqual(snapshot.errors, ["readiness 검사에 실패했습니다."]);
});

test("liveness와 readiness 응답 형식을 유지한다", () => {
  const build = { version: "test", gitSha: "abc123" };
  const liveness = buildLivenessResponse({
    startedAt: "2026-07-13T00:00:00.000Z",
    uptimeSeconds: 12.9,
    build
  });
  const readiness = buildReadinessResponse(resolveReadiness(undefined, false), build);

  assert.equal(liveness.uptimeSeconds, 12);
  assert.equal(liveness.status, "live");
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.build, build);
});
