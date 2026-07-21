import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

const { BridgeManager } = await import("../dist/services/bridge-manager.js");

class FakeSocket extends EventEmitter {
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
  readyState = this.OPEN;
  sent = [];
  closed = [];

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close(code, reason) {
    this.readyState = this.CLOSING;
    this.closed.push({ code, reason });
  }

  finishClose() {
    this.readyState = this.CLOSED;
    this.emit("close");
  }

  receive(payload) {
    this.emit("message", JSON.stringify(payload));
  }
}

class FakeStore {
  status = {
    bridge: "disconnected",
    obs: "unknown"
  };

  patchStatus(patch) {
    this.status = { ...this.status, ...patch };
  }

  getStatus() {
    return { ...this.status };
  }
}

function createHarness() {
  const store = new FakeStore();
  const logs = {
    events: [],
    actions: [],
    errors: []
  };
  const logger = {
    event(entry) {
      logs.events.push(entry);
    },
    action(entry) {
      logs.actions.push(entry);
    },
    error(entry) {
      logs.errors.push(entry);
    }
  };
  const dashboard = {
    broadcasts: 0,
    broadcastSnapshot() {
      this.broadcasts += 1;
    }
  };
  const manager = new BridgeManager(logger, store, dashboard);
  return { manager, store, logs, dashboard };
}

const replayAction = { type: "obs.saveReplayBuffer" };

test("BridgeManager는 같은 이름을 쓰는 서로 다른 tenant Bridge를 동시에 유지한다", () => {
  const { manager } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "main-streaming-pc", "streamer-a");
  manager.attach(socketB, "main-streaming-pc", "streamer-b");

  assert.equal(manager.count(), 2);
  assert.equal(manager.isConnected("streamer-a"), true);
  assert.equal(manager.isConnected("streamer-b"), true);
  assert.deepEqual(socketA.closed, []);
  assert.deepEqual(socketB.closed, []);
});

test("BridgeManager는 같은 tenant의 재연결만 교체하고 이전 socket의 지연 close를 무시한다", () => {
  const { manager } = createHarness();
  const firstA = new FakeSocket();
  const secondA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(firstA, "pc-a-old", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");
  manager.attach(secondA, "pc-a-new", "streamer-a");

  assert.deepEqual(firstA.closed, [{ code: 4000, reason: "동일한 Bridge 식별자의 새 연결로 교체됨" }]);
  assert.deepEqual(socketB.closed, []);
  assert.equal(manager.count(), 2);

  firstA.finishClose();

  assert.equal(manager.count(), 2);
  assert.equal(manager.isConnected("streamer-a"), true);
  assert.equal(manager.isConnected("streamer-b"), true);

  manager.send(replayAction, "test.reconnect", "streamer-a");
  assert.equal(firstA.sent.length, 0);
  assert.equal(secondA.sent.length, 1);
  assert.equal(socketB.sent.length, 0);
});

test("BridgeManager는 일부 Bridge 종료 시 연결 상태를 유지하고 마지막 종료 때만 disconnected로 바꾼다", () => {
  const { manager, store } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "pc-a", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");
  socketA.finishClose();

  assert.equal(manager.count(), 1);
  assert.equal(store.getStatus().bridge, "connected");
  assert.equal(manager.isConnected("streamer-b"), true);

  socketB.finishClose();

  assert.equal(manager.count(), 0);
  assert.equal(store.getStatus().bridge, "disconnected");
  assert.equal(store.getStatus().obs, "unknown");
});

test("BridgeManager는 연결별 OBS 상태를 true/false/mixed/missing 규칙으로 집계한다", () => {
  const { manager, store } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "pc-a", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");
  assert.equal(store.getStatus().obs, "unknown");

  socketA.receive({ type: "obs.status", connected: false });
  assert.equal(store.getStatus().obs, "unknown", "false와 미보고 상태가 섞이면 unknown이어야 한다");

  socketB.receive({ type: "obs.status", connected: false });
  assert.equal(store.getStatus().obs, "disconnected", "모든 활성 Bridge가 false를 보고하면 disconnected여야 한다");

  socketA.receive({ type: "obs.status", connected: true });
  assert.equal(store.getStatus().obs, "unknown", "true와 false가 섞이면 일부 장애를 숨기지 않도록 unknown이어야 한다");

  socketA.finishClose();
  assert.equal(store.getStatus().obs, "disconnected", "true Bridge가 종료되면 남은 false 상태를 반영해야 한다");
});

test("BridgeManager는 targetStreamerId에 해당하는 단일 Bridge에만 명령을 보낸다", () => {
  const { manager } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "pc-a", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");

  const commandA = manager.send({ type: "obs.setScene", sceneName: "A 장면" }, "test.route.a", "streamer-a");
  const commandB = manager.send(replayAction, "test.route.b", "streamer-b");

  assert.equal(socketA.sent.length, 1);
  assert.equal(socketA.sent[0].id, commandA);
  assert.equal(socketA.sent[0].sceneName, "A 장면");
  assert.equal(socketA.sent[0].reason, "test.route.a");
  assert.equal(socketB.sent.length, 1);
  assert.equal(socketB.sent[0].id, commandB);
  assert.equal(socketB.sent[0].reason, "test.route.b");
});

test("BridgeManager는 일치하지 않는 target을 다른 tenant로 fallback하지 않는다", () => {
  const { manager } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "pc-a", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");

  assert.throws(() => manager.send(replayAction, "test.unknown", "streamer-c"));
  assert.equal(socketA.sent.length, 0);
  assert.equal(socketB.sent.length, 0);
});

test("BridgeManager는 여러 Bridge가 연결된 상태에서 target 없는 명령을 fail closed 처리한다", () => {
  const { manager } = createHarness();
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();

  manager.attach(socketA, "pc-a", "streamer-a");
  manager.attach(socketB, "pc-b", "streamer-b");

  assert.throws(() => manager.send(replayAction, "test.missing_target"));
  assert.equal(socketA.sent.length, 0);
  assert.equal(socketB.sent.length, 0);
});

test("BridgeManager는 단일 legacy Bridge에 한해 target 없는 기존 명령을 호환한다", () => {
  const { manager } = createHarness();
  const legacySocket = new FakeSocket();

  manager.attach(legacySocket, "legacy-broadcast-pc");

  const commandId = manager.send(replayAction, "test.legacy");

  assert.equal(manager.count(), 1);
  assert.equal(manager.isConnected(), true);
  assert.equal(legacySocket.sent.length, 1);
  assert.equal(legacySocket.sent[0].id, commandId);
  assert.equal(legacySocket.sent[0].reason, "test.legacy");
});
