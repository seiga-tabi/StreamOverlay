import assert from "node:assert/strict";
import test from "node:test";
import type { ParticipationStatus } from "@streamops/shared";
import {
  getParticipationDisplayPhase,
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
