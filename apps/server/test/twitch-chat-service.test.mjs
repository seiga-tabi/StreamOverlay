import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const {
  TwitchChatService,
  renderSafeChatTemplate,
  sanitizeChatMessage
} = await import("../dist/services/twitch-chat-service.js");
const { Store } = await import("../dist/services/store.js");
const { JsonlLogger } = await import("../dist/logging/jsonl-logger.js");

function createLogger() {
  return new JsonlLogger(mkdtempSync(join(tmpdir(), "streamops-chat-test-")));
}

function createProvider(scopes = ["user:write:chat"]) {
  return {
    async getChatAccessContext(mode) {
      return {
        clientId: "client-id",
        accessToken: "access-token",
        broadcasterId: "broadcaster-1",
        senderId: mode === "bot" ? "bot-1" : "broadcaster-1",
        scopes,
        source: "oauth"
      };
    }
  };
}

function createService(input = {}) {
  const store = input.store ?? new Store();
  const calls = [];
  const fetchImpl = input.fetchImpl ?? (async (_url, init) => {
    calls.push({ at: Date.now(), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ data: [{ message_id: `message-${calls.length}`, is_sent: true }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
  const service = new TwitchChatService(
    input.provider ?? createProvider(),
    createLogger(),
    store,
    {
      mode: input.mode ?? "broadcaster",
      throttleMs: input.throttleMs ?? 0,
      cooldownMs: input.cooldownMs ?? 0,
      maxQueue: input.maxQueue ?? 10,
      maxMessageLength: input.maxMessageLength ?? 500,
      templateValueMaxLength: input.templateValueMaxLength ?? 20
    },
    fetchImpl
  );
  return { service, store, calls };
}

test("chat message는 길이 제한과 제어문자 제거를 적용한다", () => {
  const message = sanitizeChatMessage(`hello\n${"가".repeat(20)}`, 10);
  assert.equal(message.length, 10);
  assert.equal(message.includes("\n"), false);
});

test("chat template은 viewer input을 sanitize하고 placeholder별 길이를 제한한다", () => {
  const rendered = renderSafeChatTemplate("답변: {input}", {
    input: "Bearer abcdefghijklmnopqrstuvwxyz\n긴문장긴문장긴문장"
  }, {
    maxMessageLength: 100,
    templateValueMaxLength: 18
  });

  assert.equal(rendered.includes("\n"), false);
  assert.match(rendered, /\[REDACTED\]/);
  assert.ok(rendered.length <= 100);
});

test("chat queue는 throttle 간격을 두고 순차 발송한다", async () => {
  const { service, calls } = createService({ throttleMs: 25 });

  await Promise.all([
    service.sendChatMessage("첫 번째"),
    service.sendChatMessage("두 번째")
  ]);

  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 20);
  assert.deepEqual(calls.map((call) => call.body.message), ["첫 번째", "두 번째"]);
});

test("같은 메시지는 cooldown 동안 반복 발송하지 않는다", async () => {
  const { service, calls } = createService({ cooldownMs: 1000 });

  const first = await service.sendChatMessage("반복 메시지");
  const second = await service.sendChatMessage("반복 메시지");

  assert.equal(first.status, "sent");
  assert.equal(second.status, "skipped");
  assert.equal(second.reason, "cooldown");
  assert.equal(calls.length, 1);
});

test("token이 없으면 실패를 status에 기록한다", async () => {
  const provider = { async getChatAccessContext() { return undefined; } };
  const { service, store } = createService({ provider });

  await assert.rejects(() => service.sendChatMessage("hello"), /token/);
  const status = store.getTwitchChatStatus();
  assert.equal(status.recentFailures.length, 1);
  assert.match(status.recentFailures[0].reason, /token/);
});

test("API 실패는 statusCode와 함께 실패 상태에 기록한다", async () => {
  const { service, store } = createService({
    fetchImpl: async () => new Response(JSON.stringify({ error: "nope" }), { status: 500 })
  });

  await assert.rejects(() => service.sendChatMessage("hello"), /500/);
  const failure = store.getTwitchChatStatus().recentFailures[0];
  assert.equal(failure.statusCode, 500);
  assert.match(failure.reason, /500/);
});
