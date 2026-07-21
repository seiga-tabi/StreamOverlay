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

test("OverlayHub는 시참 snapshot을 스트리머별 client에만 전송한다", () => {
  const { hub } = createHub();
  const streamerASocket = new FakeSocket();
  const streamerBSocket = new FakeSocket();
  hub.add(streamerASocket, "participation", "streamer-a");
  hub.add(streamerBSocket, "participation", "streamer-b");

  hub.broadcast({
    type: "participation.snapshot.update",
    streamerId: "streamer-a",
    sessionId: "session-a",
    revision: 1,
    status: {
      isOpen: true,
      phase: "recruiting",
      message: "스트리머 A 대기열"
    },
    queue: [],
    emittedAt: "2026-07-20T00:00:00.000Z"
  });

  assert.equal(streamerASocket.sent.length, 1);
  assert.equal(streamerASocket.sent[0].streamerId, "streamer-a");
  assert.equal(streamerBSocket.sent.length, 0);
  assert.equal(hub.statusForStreamer("streamer-a").clientCount, 1);
  assert.equal(hub.statusForStreamer("streamer-a").clientsByChannel.participation, 1);
  assert.equal(hub.statusForStreamer("streamer-b").clientCount, 1);
  assert.equal(hub.statusForStreamer("streamer-c").clientCount, 0);
  assert.deepEqual(hub.statusForStreamer("streamer-a").recentMessages, []);
});

test("OverlayHub는 A/B 스트리머의 실시간 메시지와 retained replay/clear를 완전히 격리한다", () => {
  const { hub } = createHub();
  const liveA = new FakeSocket();
  const liveB = new FakeSocket();
  hub.add(liveA, "all", "streamer-a");
  hub.add(liveB, "all", "streamer-b");

  for (const streamerId of ["streamer-a", "streamer-b"]) {
    hub.broadcast({
      type: "participation.queue.update",
      streamerId,
      isOpen: true,
      queue: [{ position: 1, twitchUserName: `Viewer-${streamerId}`, status: "waitlisted" }]
    });
    hub.broadcast({
      type: "solo-rank.profile.update",
      streamerId,
      profile: { displayName: `Profile-${streamerId}` },
      region: "JP"
    });
    hub.broadcast({
      type: "participation.teams.update",
      streamerId,
      teams: {
        a: [{ twitchUserName: `TeamA-${streamerId}` }],
        b: [{ twitchUserName: `TeamB-${streamerId}` }]
      }
    });
    hub.broadcast({
      type: "participation.selected.show",
      streamerId,
      twitchUserName: `Selected-${streamerId}`,
      checkInSeconds: 30
    });
  }

  assert.equal(liveA.sent.every((message) => message.streamerId === "streamer-a"), true);
  assert.equal(liveB.sent.every((message) => message.streamerId === "streamer-b"), true);
  assert.deepEqual(liveA.sent.map((message) => message.type), [
    "participation.queue.update",
    "solo-rank.profile.update",
    "participation.teams.update",
    "participation.selected.show"
  ]);
  assert.deepEqual(liveB.sent.map((message) => message.type), [
    "participation.queue.update",
    "solo-rank.profile.update",
    "participation.teams.update",
    "participation.selected.show"
  ]);

  hub.broadcast({ type: "participation.selected.clear", streamerId: "streamer-a" });
  hub.broadcast({
    type: "participation.status.update",
    streamerId: "streamer-a",
    isOpen: false,
    phase: "closed",
    message: "A 모집 종료"
  });

  assert.equal(liveA.sent.some((message) => message.type === "participation.selected.clear"), true);
  assert.equal(liveB.sent.some((message) => message.type === "participation.selected.clear"), false);
  assert.equal(liveB.sent.some((message) => message.type === "participation.status.update"), false);

  const reconnectA = new FakeSocket();
  const reconnectB = new FakeSocket();
  hub.add(reconnectA, "all", "streamer-a");
  hub.add(reconnectB, "all", "streamer-b");

  assert.equal(reconnectA.sent.every((message) => message.streamerId === "streamer-a"), true);
  assert.equal(reconnectB.sent.every((message) => message.streamerId === "streamer-b"), true);
  assert.equal(reconnectA.sent.some((message) => message.type === "participation.selected.show"), false);
  assert.equal(reconnectA.sent.some((message) => message.type === "participation.teams.update"), false);
  assert.equal(reconnectA.sent.some((message) => message.type === "participation.status.update"), true);
  assert.equal(reconnectB.sent.some((message) => message.type === "participation.selected.show"), true);
  assert.equal(reconnectB.sent.some((message) => message.type === "participation.teams.update"), true);
  assert.equal(reconnectB.sent.some((message) => message.type === "participation.status.update"), false);
  assert.equal(reconnectA.sent.find((message) => message.type === "solo-rank.profile.update")?.profile.displayName, "Profile-streamer-a");
  assert.equal(reconnectB.sent.find((message) => message.type === "solo-rank.profile.update")?.profile.displayName, "Profile-streamer-b");
});

test("OverlayHub는 legacy 전역과 A/B tenant의 실시간 및 retained replay를 서로 격리한다", () => {
  const { hub } = createHub();
  const liveLegacy = new FakeSocket();
  const liveA = new FakeSocket();
  const liveB = new FakeSocket();
  hub.add(liveLegacy, "all");
  hub.add(liveA, "all", "streamer-a");
  hub.add(liveB, "all", "streamer-b");

  hub.broadcast({
    type: "mission.update",
    title: "전역 미션",
    missions: [{ id: "global-mission", text: "legacy 전용", done: false }]
  });
  hub.broadcast({
    type: "participation.queue.update",
    streamerId: "streamer-a",
    isOpen: true,
    queue: [{ position: 1, twitchUserName: "ViewerA", status: "waitlisted" }]
  });
  hub.broadcast({
    type: "participation.queue.update",
    streamerId: "streamer-b",
    isOpen: true,
    queue: [{ position: 1, twitchUserName: "ViewerB", status: "waitlisted" }]
  });

  assert.deepEqual(liveLegacy.sent.map((message) => message.type), ["mission.update"]);
  assert.deepEqual(liveA.sent.map((message) => message.streamerId), ["streamer-a"]);
  assert.deepEqual(liveB.sent.map((message) => message.streamerId), ["streamer-b"]);

  const replayLegacy = new FakeSocket();
  const replayA = new FakeSocket();
  const replayB = new FakeSocket();
  hub.add(replayLegacy, "all");
  hub.add(replayA, "all", "streamer-a");
  hub.add(replayB, "all", "streamer-b");

  assert.deepEqual(replayLegacy.sent.map((message) => message.type), ["mission.update"]);
  assert.deepEqual(replayA.sent.map((message) => message.streamerId), ["streamer-a"]);
  assert.deepEqual(replayB.sent.map((message) => message.streamerId), ["streamer-b"]);
});

test("OverlayHub는 reconnect 시 해당 스트리머의 최신 revision snapshot만 복구한다", () => {
  const { hub } = createHub();

  for (const revision of [1, 2]) {
    hub.broadcast({
      type: "participation.snapshot.update",
      streamerId: "streamer-a",
      sessionId: "session-a",
      revision,
      status: {
        isOpen: true,
        phase: "recruiting",
        message: `revision ${revision}`
      },
      queue: [],
      emittedAt: `2026-07-20T00:00:0${revision}.000Z`
    });
  }

  const streamerAReconnect = new FakeSocket();
  const streamerBReconnect = new FakeSocket();
  hub.add(streamerAReconnect, "participation", "streamer-a");
  hub.add(streamerBReconnect, "participation", "streamer-b");

  const snapshots = streamerAReconnect.sent.filter((message) => message.type === "participation.snapshot.update");
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].revision, 2);
  assert.equal(streamerBReconnect.sent.length, 0);
});

test("OverlayHub는 게임 중 상태에서 이전 시참 팀 retained message를 지운다", () => {
  const { hub } = createHub();
  const firstSocket = new FakeSocket();
  hub.add(firstSocket, "participation");
  hub.broadcast({
    type: "participation.teams.update",
    teams: {
      a: [{ twitchUserName: "ViewerA" }],
      b: [{ twitchUserName: "ViewerB" }]
    }
  });
  hub.broadcast({
    type: "participation.status.update",
    isOpen: true,
    phase: "in_game",
    message: "게임 중"
  });

  const reconnectSocket = new FakeSocket();
  hub.add(reconnectSocket, "participation");

  assert.equal(reconnectSocket.sent.some((message) => message.type === "participation.teams.update"), false);
  assert.equal(reconnectSocket.sent.some((message) => message.type === "participation.status.update" && message.phase === "in_game"), true);
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
