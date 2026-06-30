import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TWITCH_ENABLE_EVENTSUB = "true";

const { TwitchEventSubClient } = await import("../dist/services/twitch-eventsub-client.js");
const { getMissingScopesForEventSubTypes } = await import("../dist/services/twitch-eventsub-subscriptions.js");
const { Store } = await import("../dist/services/store.js");
const { EventBus } = await import("../dist/core/event-bus.js");
const { JsonlLogger } = await import("../dist/logging/jsonl-logger.js");
const { resolveRewardActionConfig } = await import("../dist/modules/rewards.module.js");

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  closed = false;

  close() {
    this.closed = true;
    this.readyState = 3;
    this.emit("close");
  }

  emitOpen() {
    this.emit("open");
  }

  emitMessage(payload) {
    this.emit("message", JSON.stringify(payload));
  }
}

function createLogger() {
  return new JsonlLogger(mkdtempSync(join(tmpdir(), "streamops-eventsub-test-")));
}

function createTwitchMock(scopes = ["user:read:chat", "channel:read:redemptions"]) {
  const calls = [];
  return {
    calls,
    async getEventSubAccessContext() {
      return {
        broadcasterId: "broadcaster-1",
        senderId: "sender-1",
        scopes
      };
    },
    async createEventSubSubscription(type, version, condition, sessionId) {
      calls.push({ type, version, condition, sessionId });
      return "created";
    }
  };
}

function welcome(sessionId) {
  return {
    metadata: { message_id: `welcome-${sessionId}`, message_type: "session_welcome" },
    payload: { session: { id: sessionId } }
  };
}

function reconnect(url) {
  return {
    metadata: { message_id: "reconnect-1", message_type: "session_reconnect" },
    payload: { session: { id: "old-session", reconnect_url: url } }
  };
}

function chatNotification(messageId, eventId) {
  return {
    metadata: {
      message_id: messageId,
      message_type: "notification",
      subscription_type: "channel.chat.message"
    },
    payload: {
      subscription: { type: "channel.chat.message" },
      event: {
        message_id: eventId,
        broadcaster_user_id: "broadcaster-1",
        chatter_user_id: "user-1",
        chatter_user_name: "Tester",
        message: { text: "!hello" }
      }
    }
  };
}

function emoteChatNotification(messageId, eventId) {
  const payload = chatNotification(messageId, eventId);
  payload.payload.event.message = {
    text: "안녕 Kappa",
    fragments: [
      { type: "text", text: "안녕 ", cheermote: null, emote: null, mention: null },
      { type: "emote", text: "Kappa", cheermote: null, emote: { id: "25", emote_set_id: "0" }, mention: null }
    ]
  };
  return payload;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("session_welcome 후 config 기반 subscription을 생성한다", async () => {
  const sockets = [];
  const twitch = createTwitchMock();
  const client = new TwitchEventSubClient(new EventBus(), twitch, new Store(), createLogger(), {
    subscriptions: ["stream.online", "channel.chat.message"],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(welcome("session-1"));
  await settle();

  assert.deepEqual(twitch.calls.map((call) => call.type), ["stream.online", "channel.chat.message"]);
  assert.equal(twitch.calls[0].sessionId, "session-1");
  assert.equal(twitch.calls[1].condition.user_id, "sender-1");
});

test("reconnect welcome 후 새 session_id로 재구독하고 기존 socket을 닫는다", async () => {
  const sockets = [];
  const twitch = createTwitchMock();
  const client = new TwitchEventSubClient(new EventBus(), twitch, new Store(), createLogger(), {
    subscriptions: ["stream.online"],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(welcome("session-1"));
  await settle();

  sockets[0].emitMessage(reconnect("wss://eventsub.wss.twitch.tv/reconnect-test"));
  assert.equal(sockets.length, 2);
  sockets[1].emitOpen();
  sockets[1].emitMessage(welcome("session-2"));
  await settle();

  assert.deepEqual(twitch.calls.map((call) => call.sessionId), ["session-1", "session-2"]);
  assert.equal(sockets[0].closed, true);
});

test("scope가 누락된 subscription은 생성하지 않고 status에 표시한다", async () => {
  const sockets = [];
  const twitch = createTwitchMock(["user:read:chat"]);
  const store = new Store();
  const client = new TwitchEventSubClient(new EventBus(), twitch, store, createLogger(), {
    subscriptions: ["channel.cheer"],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(welcome("session-1"));
  await settle();

  const status = store.getTwitchEventSubStatus();
  assert.equal(twitch.calls.length, 0);
  assert.deepEqual(status.missingScopes, ["bits:read"]);
  assert.equal(status.subscriptions[0].status, "skipped");
});

test("EventSub OAuth 갱신 실패는 서버 프로세스를 죽이지 않고 실패 상태로 표시한다", async () => {
  const sockets = [];
  const store = new Store();
  const twitch = {
    async getEventSubAccessContext() {
      throw new Error("Twitch OAuth refresh failed: 400");
    },
    async createEventSubSubscription() {
      assert.fail("OAuth 갱신 실패 시 subscription 생성은 호출되지 않아야 합니다.");
    }
  };
  const client = new TwitchEventSubClient(new EventBus(), twitch, store, createLogger(), {
    subscriptions: ["stream.online"],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(welcome("session-oauth-fail"));
  await settle();
  await settle();

  const status = store.getTwitchEventSubStatus();
  assert.equal(status.websocket, "disconnected");
  assert.equal(status.subscriptions[0].status, "failed");
  assert.match(status.subscriptions[0].error, /Twitch OAuth 인증 갱신/);
  assert.equal(sockets[0].closed, true);
});

test("channel.follow subscription은 moderator scope와 moderator_user_id 조건을 사용한다", async () => {
  const sockets = [];
  const twitch = createTwitchMock(["moderator:read:followers"]);
  const client = new TwitchEventSubClient(new EventBus(), twitch, new Store(), createLogger(), {
    subscriptions: ["channel.follow"],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(welcome("session-follow"));
  await settle();

  assert.equal(twitch.calls.length, 1);
  assert.equal(twitch.calls[0].type, "channel.follow");
  assert.equal(twitch.calls[0].version, "2");
  assert.equal(twitch.calls[0].condition.broadcaster_user_id, "broadcaster-1");
  assert.equal(twitch.calls[0].condition.moderator_user_id, "sender-1");
});

test("message_id와 event id 기준으로 duplicate notification을 dedupe한다", async () => {
  const sockets = [];
  const received = [];
  const events = new EventBus();
  events.on("twitch.chatMessage", (event) => received.push(event));
  const client = new TwitchEventSubClient(events, createTwitchMock(), new Store(), createLogger(), {
    subscriptions: [],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(chatNotification("message-1", "event-1"));
  sockets[0].emitMessage(chatNotification("message-2", "event-1"));
  await settle();

  assert.equal(received.length, 1);
  assert.equal(received[0].message, "!hello");
});

test("channel.chat.message fragments는 내부 emote fragment로 정규화된다", async () => {
  const sockets = [];
  const received = [];
  const events = new EventBus();
  events.on("twitch.chatMessage", (event) => received.push(event));
  const client = new TwitchEventSubClient(events, createTwitchMock(), new Store(), createLogger(), {
    subscriptions: [],
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }
  });

  client.start();
  sockets[0].emitOpen();
  sockets[0].emitMessage(emoteChatNotification("message-emote-1", "event-emote-1"));
  await settle();

  assert.equal(received.length, 1);
  assert.equal(received[0].message, "안녕 Kappa");
  assert.deepEqual(received[0].fragments, [
    { type: "text", text: "안녕 " },
    { type: "emote", id: "25", text: "Kappa", emoteSetId: "0" }
  ]);
});

test("EventSub missing scope 계산은 대체 scope를 고려한다", () => {
  assert.deepEqual(
    getMissingScopesForEventSubTypes(["channel.channel_points_custom_reward_redemption.add", "channel.cheer"], ["channel:manage:redemptions"]),
    ["bits:read"]
  );
});

test("reward action config는 reward_id를 title보다 우선하고 title fallback을 지원한다", () => {
  const config = {
    "reward-1": { name: "id match", actions: [{ type: "noop" }] },
    "Reward Title": { name: "title match", actions: [{ type: "noop" }] }
  };

  assert.equal(resolveRewardActionConfig(config, { rewardId: "reward-1", rewardTitle: "Reward Title" }).matchedBy, "reward_id");
  assert.equal(resolveRewardActionConfig(config, { rewardId: "", rewardTitle: "Reward Title" }).matchedBy, "title");
});
