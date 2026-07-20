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
    getNextWaitingParticipationOverlayEntry: () => undefined,
    getParticipationStreamerProfile: () => undefined,
    getParticipationOverlaySnapshotQueue: () => [],
    ...overrides
  };
}

test("시참 snapshot은 저장 완료 후 전송되며 저장 대기 중 이벤트 루프를 막지 않는다", async () => {
  let persisted = false;
  let timerFired = false;
  const dispatched = [];
  const store = createStore({
    flushRuntimeState: () => new Promise((resolve) => {
      setTimeout(() => {
        persisted = true;
        resolve();
      }, 200);
    })
  });
  const actions = {
    dispatchOne: async (action) => {
      if (action.type === "overlay.participationSnapshot") {
        assert.equal(persisted, true);
      }
      dispatched.push(action);
    }
  };

  const publishPromise = publishParticipationSnapshot(
    { store, actions },
    { reason: "test.snapshot", streamerId: "streamer-a" }
  );
  setTimeout(() => {
    timerFired = true;
  }, 0);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(timerFired, true);
  assert.equal(dispatched.length, 0);

  await publishPromise;
  const snapshot = dispatched.find((action) => action.type === "overlay.participationSnapshot");
  assert.equal(snapshot?.streamerId, "streamer-a");
  assert.equal(snapshot?.sessionId, "session-a");
  assert.equal(snapshot?.revision, 1);
});

test("시참 snapshot은 저장 실패 시 성공 상태를 오버레이에 전송하지 않는다", async () => {
  const dispatched = [];
  const store = createStore({
    flushRuntimeState: async () => {
      throw new Error("runtime persistence failed");
    }
  });
  const actions = {
    dispatchOne: async (action) => {
      dispatched.push(action);
    }
  };

  await assert.rejects(
    publishParticipationSnapshot(
      { store, actions },
      { reason: "test.snapshot.failure", streamerId: "streamer-a" }
    ),
    /runtime persistence failed/
  );
  assert.equal(dispatched.length, 0);
});
