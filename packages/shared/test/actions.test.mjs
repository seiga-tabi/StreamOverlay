import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLolRole, redactSensitiveString, redactSensitiveValue, validateBotAction } from "../dist/index.js";

test("제거되었거나 위험한 action type은 allowlist에서 차단한다", () => {
  for (const type of [
    "obs.startStream",
    "obs.saveReplayBuffer",
    "overlay.banner",
    "overlay.participationQueue",
    "shell.exec",
    "file.delete",
    "browser.open_url_any"
  ]) {
    assert.equal(validateBotAction({ type }).ok, false, `${type}은 거부되어야 합니다.`);
  }
});

test("정상 allowlist action은 exact schema로 통과한다", () => {
  for (const action of [
    { type: "twitch.chat", message: "테스트 메시지" },
    { type: "queue.question", question: "질문입니다", userName: "viewer" },
    { type: "log.highlight", reason: "viewer_clip_request" },
    { type: "participation.open", mode: "aram", requiredPlayers: 5 },
    { type: "participation.close" },
    { type: "noop", note: "처리하지 않음" }
  ]) {
    assert.equal(validateBotAction(action).ok, true, JSON.stringify(action));
  }
});

test("허용 action도 정의되지 않은 위험 필드를 거부한다", () => {
  for (const action of [
    { type: "twitch.chat", message: "안녕하세요", command: "rm -rf /" },
    { type: "noop", url: "file:///etc/passwd" },
    { type: "participation.open", requiredPlayers: 11 }
  ]) {
    assert.equal(validateBotAction(action).ok, false, JSON.stringify(action));
  }
});

test("role parser는 한국어·일본어·영어 포지션 입력을 정규화한다", () => {
  assert.equal(normalizeLolRole("미드"), "mid");
  assert.equal(normalizeLolRole("jgl"), "jungle");
  assert.equal(normalizeLolRole("サポート"), "support");
  assert.equal(normalizeLolRole("???"), "unknown");
});

test("로그 redaction은 민감정보 문자열과 키를 가린다", () => {
  assert.equal(
    redactSensitiveString("Bearer abc.def secret=top access_token=token-value"),
    "Bearer [REDACTED] secret=[REDACTED] access_token=[REDACTED]"
  );
  assert.deepEqual(redactSensitiveValue({ streamKey: "abc", nested: { message: "password=hunter2" } }), {
    streamKey: "[REDACTED]",
    nested: { message: "password=[REDACTED]" }
  });
});
