import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCORD_NOTIFY_EVENTS,
  normalizeLolRole,
  redactSensitiveString,
  redactSensitiveValue,
  validateBotAction
} from "../dist/index.js";

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
    { type: "discord.notify", event: "participation.recruiting" },
    { type: "noop", note: "처리하지 않음" }
  ]) {
    assert.equal(validateBotAction(action).ok, true, JSON.stringify(action));
  }
});

test("discord.notify는 고정 enum 한 필드만 받는다", () => {
  for (const event of DISCORD_NOTIFY_EVENTS) {
    assert.equal(validateBotAction({ type: "discord.notify", event }).ok, true, event);
  }
  assert.equal(DISCORD_NOTIFY_EVENTS.length, 2);
});

test("discord.notify는 대상·본문·멘션을 payload로 받지 않는다", () => {
  // viewer 나 외부 입력이 임의 채널·본문·멘션을 실어 보내는 통로를 막는 회귀 테스트입니다.
  for (const action of [
    { type: "discord.notify", event: "participation.recruiting", channelId: "123456789012345678" },
    { type: "discord.notify", event: "participation.recruiting", guildId: "123456789012345678" },
    { type: "discord.notify", event: "participation.recruiting", content: "@everyone 지금 참여하세요" },
    { type: "discord.notify", event: "participation.recruiting", mentionRoleId: "123456789012345678" },
    { type: "discord.notify", event: "participation.recruiting", webhookUrl: "https://example.invalid/hook" },
    { type: "discord.notify", event: "participation.recruiting", streamerId: "999" }
  ]) {
    assert.equal(validateBotAction(action).ok, false, JSON.stringify(action));
  }
});

test("discord.notify는 허용 목록 밖 event와 템플릿 잔재를 거부한다", () => {
  for (const event of [
    "participation.opened",
    "stream.online",
    "",
    "{event}",
    "participation.recruiting ",
    "PARTICIPATION.RECRUITING",
    123,
    null
  ]) {
    assert.equal(
      validateBotAction({ type: "discord.notify", event }).ok,
      false,
      JSON.stringify(event)
    );
  }
  assert.equal(validateBotAction({ type: "discord.notify" }).ok, false, "event 누락");
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
