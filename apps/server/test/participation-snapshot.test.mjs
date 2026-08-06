import test from "node:test";
import assert from "node:assert/strict";

const { publishParticipationSnapshot } = await import("../dist/services/participation-snapshot.js");

function createStore(overrides = {}) {
  return {
    advanceParticipationRevision: () => 1,
    flushRuntimeState: async () => undefined,
    getParticipationState: () => ({
      isOpen: true,
      streamerId: "streamer-a",
      revision: 1,
      queue: [],
      session: {
        sessionId: "session-a",
        streamerId: "streamer-a",
        status: "recruiting",
        createdAt: "2026-07-20T00:00:00.000Z"
      }
    }),
    ...overrides
  };
}

test("시참 상태는 저장 완료 후 추적 로그를 남기며 저장 대기 중 이벤트 루프를 막지 않는다", async () => {
  let persisted = false;
  let timerFired = false;
  const events = [];
  const store = createStore({
    flushRuntimeState: () => new Promise((resolve) => {
      setTimeout(() => {
        persisted = true;
        resolve();
      }, 200);
    })
  });

  const publishPromise = publishParticipationSnapshot(
    { store, logger: { event: (event) => events.push(event) } },
    { reason: "test.snapshot", streamerId: "streamer-a" }
  );
  setTimeout(() => {
    timerFired = true;
  }, 0);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(timerFired, true);
  assert.equal(events.length, 0);

  await publishPromise;
  assert.equal(persisted, true);
  assert.equal(events[0]?.type, "participation.snapshot_trace");
  assert.equal(events[0]?.streamerId, "streamer-a");
  assert.equal(events[0]?.sessionId, "session-a");
  assert.equal(events[0]?.revision, 1);
});

test("시참 상태는 저장 실패 시 성공 추적 로그를 남기지 않는다", async () => {
  const events = [];
  const store = createStore({
    flushRuntimeState: async () => {
      throw new Error("runtime persistence failed");
    }
  });

  await assert.rejects(
    publishParticipationSnapshot(
      { store, logger: { event: (event) => events.push(event) } },
      { reason: "test.snapshot.failure", streamerId: "streamer-a" }
    ),
    /runtime persistence failed/
  );
  assert.equal(events.length, 0);
});
