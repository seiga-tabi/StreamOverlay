import test from "node:test";
import assert from "node:assert/strict";
import { validateBridgeCommand } from "../dist/validator.js";

const metadata = {
  id: "cmd_test",
  createdAt: "2026-06-15T00:00:00.000Z"
};

test("bridge는 유효한 OBS command만 허용한다", () => {
  const result = validateBridgeCommand({
    ...metadata,
    type: "obs.setScene",
    sceneName: "메인"
  });

  assert.equal(result.ok, true);
});

test("bridge는 OBS가 아닌 action을 거부한다", () => {
  const result = validateBridgeCommand({
    ...metadata,
    type: "twitch.chat",
    message: "안녕하세요"
  });

  assert.equal(result.ok, false);
});

test("bridge는 start/stop, stream key, raw OBS command를 거부한다", () => {
  for (const type of ["obs.startStream", "obs.stopStream", "obs.setStreamKey", "obs.call"]) {
    const result = validateBridgeCommand({
      ...metadata,
      type,
      requestType: "StartStream"
    });
    assert.equal(result.ok, false, `${type} should be rejected`);
  }
});

test("bridge command metadata는 필수다", () => {
  assert.equal(validateBridgeCommand({ type: "obs.saveReplayBuffer", createdAt: metadata.createdAt }).ok, false);
  assert.equal(validateBridgeCommand({ type: "obs.saveReplayBuffer", id: metadata.id }).ok, false);
  assert.equal(validateBridgeCommand({ type: "obs.saveReplayBuffer", id: metadata.id, createdAt: "not-a-date" }).ok, false);
});

test("bridge는 허용되지 않은 추가 필드를 거부한다", () => {
  const result = validateBridgeCommand({
    ...metadata,
    type: "obs.saveReplayBuffer",
    url: "file:///tmp/secret"
  });

  assert.equal(result.ok, false);
});
