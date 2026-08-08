import test from "node:test";
import assert from "node:assert/strict";

const { ActionDispatcher } = await import("../dist/core/action-dispatcher.js");

/* dispatcher 는 twitchChat / store / logger 만 있으면 동작합니다.
   discord.notify 경로에서 실제로 건드리는 것만 최소로 흉내 냅니다. */
function harness(publisher) {
  const actions = [];
  const events = [];
  const errors = [];
  const store = {
    addAction: (record) => actions.push(record),
    addQuestion: () => ({}),
    addHighlight: () => ({}),
    getParticipationSession: () => undefined,
    setParticipationOpen: () => {}
  };
  const logger = {
    action: () => {},
    event: (record) => events.push(record),
    error: (record) => errors.push(record),
    question: () => {},
    highlight: () => {}
  };
  const twitchChat = {
    sendChatMessage: async () => {},
    renderMessageTemplate: (message) => message
  };
  const dispatcher = new ActionDispatcher(twitchChat, store, logger, publisher);
  return { dispatcher, actions, events, errors };
}

test("discord.notify는 발행자가 없으면 ok가 아니라 skipped로 기록한다", async () => {
  const { dispatcher, actions, events } = harness(undefined);

  await dispatcher.dispatchOne(
    { type: "discord.notify", event: "participation.recruiting" },
    { streamerId: "123456789" }
  );

  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "discord.notify");
  assert.equal(actions[0].status, "skipped", "발행하지 않았는데 ok로 보고하면 안 됩니다.");
  assert.equal(
    events.some((entry) => entry.type === "discord.notify_skipped" && entry.reason === "publisher_unavailable"),
    true
  );
});

test("discord.notify는 streamerId가 없으면 발행하지 않고 skipped로 기록한다", async () => {
  const calls = [];
  const { dispatcher, actions, events } = harness({
    publish: async (input) => { calls.push(input); }
  });

  await dispatcher.dispatchOne({ type: "discord.notify", event: "participation.closed" }, {});

  assert.equal(calls.length, 0, "streamerId 없이 발행하면 안 됩니다.");
  assert.equal(actions[0].status, "skipped");
  assert.equal(
    events.some((entry) => entry.type === "discord.notify_skipped" && entry.reason === "missing_streamer"),
    true
  );
});

test("discord.notify는 event와 context의 streamerId만 발행자에게 넘긴다", async () => {
  const calls = [];
  const { dispatcher, actions } = harness({
    publish: async (input) => { calls.push(input); }
  });

  await dispatcher.dispatchOne(
    { type: "discord.notify", event: "participation.recruiting" },
    { streamerId: "123456789", channelId: "987654321", message: "무시되어야 합니다" }
  );

  assert.equal(actions[0].status, "ok");
  assert.deepEqual(calls, [{ event: "participation.recruiting", streamerId: "123456789" }]);
});

test("payload로 채널·본문·멘션을 실으면 validation 단계에서 실패한다", async () => {
  const calls = [];
  const { dispatcher, actions, errors } = harness({
    publish: async (input) => { calls.push(input); }
  });

  await dispatcher.dispatchOne(
    {
      type: "discord.notify",
      event: "participation.recruiting",
      channelId: "987654321",
      content: "@everyone"
    },
    { streamerId: "123456789" }
  );

  assert.equal(calls.length, 0);
  assert.equal(actions[0].status, "failed");
  assert.equal(errors.some((entry) => entry.type === "action.validation_failed"), true);
});

test("event에 템플릿을 넣어도 렌더 후 허용 목록에서 걸린다", async () => {
  const calls = [];
  const { dispatcher, actions } = harness({
    publish: async (input) => { calls.push(input); }
  });

  await dispatcher.dispatchOne(
    { type: "discord.notify", event: "{injected}" },
    { streamerId: "123456789", injected: "participation.recruiting" }
  );

  assert.equal(
    calls.length,
    0,
    "context 값이 event 로 치환되어 허용 목록을 우회하면 안 됩니다."
  );
  assert.equal(actions[0].status, "failed");
});

test("발행자가 던지면 action은 failed로 남고 예외가 밖으로 새지 않는다", async () => {
  const { dispatcher, actions, errors } = harness({
    publish: async () => { throw new Error("discord unavailable"); }
  });

  await dispatcher.dispatchOne(
    { type: "discord.notify", event: "participation.recruiting" },
    { streamerId: "123456789" }
  );

  assert.equal(actions[0].status, "failed");
  assert.equal(errors.some((entry) => entry.type === "action.dispatch_failed"), true);
});
