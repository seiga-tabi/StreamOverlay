import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { OverlayHub } = await import("../dist/services/overlay-hub.js");
const { Store } = await import("../dist/services/store.js");
const { JsonlLogger } = await import("../dist/logging/jsonl-logger.js");

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent = [];

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }
}

function createHub() {
  const store = new Store();
  const logger = new JsonlLogger(mkdtempSync(join(tmpdir(), "streamops-overlay-test-")));
  return { hub: new OverlayHub(logger, store), store };
}

test("OverlayHub는 channel별로 message를 필터링한다", () => {
  const { hub } = createHub();
  const eventsSocket = new FakeSocket();
  const subtitleSocket = new FakeSocket();
  const allSocket = new FakeSocket();

  hub.add(eventsSocket, "events");
  hub.add(subtitleSocket, "subtitles");
  hub.add(allSocket, "all");

  const sent = hub.broadcast({
    type: "subtitle.update",
    sourceLanguage: "ko",
    targetLanguage: "ja",
    translated: "字幕テスト",
    isFinal: true
  });

  assert.equal(sent, true);
  assert.equal(eventsSocket.sent.length, 0);
  assert.equal(subtitleSocket.sent.length, 1);
  assert.equal(allSocket.sent.length, 1);
});

test("OverlayHub는 reconnect client에 마지막 안전 상태를 복구한다", () => {
  const { hub } = createHub();
  const firstSocket = new FakeSocket();
  hub.add(firstSocket, "mission");
  hub.broadcast({
    type: "mission.update",
    title: "오늘의 목표",
    missions: [{ id: "m1", text: "첫 승 하기", done: false }]
  });

  const reconnectSocket = new FakeSocket();
  hub.add(reconnectSocket, "mission");

  assert.equal(reconnectSocket.sent.length, 1);
  assert.equal(reconnectSocket.sent[0].type, "mission.update");
  assert.equal(reconnectSocket.sent[0].missions[0].text, "첫 승 하기");
});

test("OverlayHub는 invalid overlay message를 전송하지 않는다", () => {
  const { hub, store } = createHub();
  const socket = new FakeSocket();
  hub.add(socket, "events");

  const sent = hub.broadcast({
    type: "overlay.banner",
    message: "invalid",
    raw: { accessToken: "secret" }
  });

  assert.equal(sent, false);
  assert.equal(socket.sent.length, 0);
  assert.equal(store.getOverlayStatus().recentMessages.length, 0);
});

test("OverlayHub status는 client 수와 최근 message 로그를 노출한다", () => {
  const { hub, store } = createHub();
  const socket = new FakeSocket();
  hub.add(socket, "events");
  hub.broadcast({ type: "overlay.banner", message: "테스트", source: "dashboard.test" });

  const status = store.getOverlayStatus();
  assert.equal(status.clientCount, 1);
  assert.equal(status.clientsByChannel.events, 1);
  assert.equal(status.recentMessages[0].type, "overlay.banner");
});
