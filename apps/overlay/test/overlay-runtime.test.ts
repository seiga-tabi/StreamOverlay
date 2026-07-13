import assert from "node:assert/strict";
import test from "node:test";
import { overlayDuration, overlayMockMode, overlayMode, overlayPreviewMode, shouldShowOverlay } from "../src/overlay-runtime";

test("Overlay URL query를 안전한 표시 모드로 정규화한다", () => {
  assert.equal(overlayMode("?mode=chat"), "chat");
  assert.equal(overlayMode("?mode=unknown"), "all");
  assert.equal(overlayMockMode("?mock=true"), true);
  assert.equal(overlayMockMode("", true), true);
  assert.equal(overlayPreviewMode("?preview=1"), true);
});

test("all 모드는 모든 채널을 표시하고 개별 모드는 대상만 표시한다", () => {
  assert.equal(shouldShowOverlay("all", "events"), true);
  assert.equal(shouldShowOverlay("chat", "chat"), true);
  assert.equal(shouldShowOverlay("chat", "events"), false);
});

test("표시 시간은 메시지 값이 없을 때만 fallback을 사용한다", () => {
  assert.equal(overlayDuration({ durationMs: 5000 }, 8000), 5000);
  assert.equal(overlayDuration(undefined, 8000), 8000);
});
