import assert from "node:assert/strict";
import test from "node:test";
import type { ParticipationState, ParticipationStatus } from "@streamops/shared";
import {
  getParticipationDisplayPhase,
  getStreamerNextAction,
  getViewerAvailableActions
} from "../src/features/participation/participation-display";

const phases: Record<ParticipationStatus, string> = {
  pending: "checking",
  verified: "waiting",
  waitlisted: "waiting",
  selected: "action_required",
  checked_in: "ready",
  invited: "ready",
  in_game: "playing",
  played: "completed",
  skipped: "ended",
  cancelled: "ended",
  no_show: "ended",
  rejected: "ended",
  blocked: "ended"
};

test("참여 도메인 상태를 시청자 표시 단계로 일관되게 변환한다", () => {
  for (const [status, phase] of Object.entries(phases)) {
    assert.equal(getParticipationDisplayPhase(status as ParticipationStatus), phase);
  }
});

function stateWith(status: ParticipationStatus, waiting = 0): ParticipationState {
  return {
    streamerId: "streamer",
    isOpen: true,
    session: {
      streamerId: "streamer",
      sessionId: "session",
      publicSessionId: "public-session",
      status: status === "in_game" ? "in_game" : "recruiting",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z"
    },
    queue: status === "waitlisted" ? [] : [{
      id: "entry",
      position: 1,
      twitchUserName: "viewer",
      riotId: "viewer#KR1",
      source: "dashboard",
      status,
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z"
    }],
    activeQueue: [],
    summary: { total: 1, active: 1, waiting, selected: 0, checkedIn: 0, noShow: 0, played: 0 }
  };
}

test("스트리머 화면은 운영 상태마다 하나의 다음 행동만 선택한다", () => {
  assert.equal(getStreamerNextAction(undefined).type, "start_session");
  assert.equal(getStreamerNextAction(stateWith("waitlisted", 0)).type, "copy_public_url");
  assert.equal(getStreamerNextAction(stateWith("waitlisted", 2)).type, "select_next");
  assert.equal(getStreamerNextAction(stateWith("selected")).type, "wait_check_in");
  assert.equal(getStreamerNextAction(stateWith("checked_in")).type, "start_game");
  assert.equal(getStreamerNextAction(stateWith("in_game")).type, "finish_game");
});

test("시청자 행동은 체크인·취소·재참여 조건을 분리한다", () => {
  assert.deepEqual(
    getViewerAvailableActions({ status: "selected" }, { isOpen: true, status: "recruiting" }),
    { canCancel: true, canCheckIn: true, canRejoin: false }
  );
  assert.deepEqual(
    getViewerAvailableActions({ status: "played" }, { isOpen: true, status: "recruiting", allowRejoin: true }),
    { canCancel: false, canCheckIn: false, canRejoin: true }
  );
  assert.equal(
    getViewerAvailableActions({ status: "played" }, { isOpen: false, status: "closed" }).canRejoin,
    false
  );
  assert.equal(
    getViewerAvailableActions({ status: "skipped" }, { isOpen: true, status: "recruiting", allowRejoin: true }).canRejoin,
    true
  );
});
