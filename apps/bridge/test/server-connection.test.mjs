import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

process.env.DOTENV_CONFIG_PATH = "/private/tmp/streamoverlay-bridge-client-test-no-env";
process.env.SERVER_WS_URL = "ws://streamops.test/bridge";
process.env.BRIDGE_NAME = "broadcast-pc-01";
process.env.BRIDGE_STREAMER_ID = "123456789";
process.env.BRIDGE_SHARED_SECRET = "bridge-test-secret";

const {
  BRIDGE_REPLACED_CLOSE_CODE,
  ServerConnection,
  buildServerWebSocketUrl,
  shouldReconnectAfterServerClose
} = await import("../dist/server-connection.js");

class MockSocket extends EventEmitter {
  OPEN = 1;
  readyState = 0;
  sent = [];

  send(payload) {
    this.sent.push(payload);
  }

  closeWith(code) {
    this.readyState = 3;
    this.emit("close", code, Buffer.alloc(0));
  }
}

function createConnection(reconnectDelayMs = 5) {
  const sockets = [];
  const requests = [];
  const connection = new ServerConnection({
    execute: async () => {},
    isConnected: () => true
  }, {
    reconnectDelayMs,
    webSocketFactory: (url, headers) => {
      const socket = new MockSocket();
      sockets.push(socket);
      requests.push({ url, headers });
      return socket;
    }
  });
  return { connection, requests, sockets };
}

test("Bridge URL은 PC 이름과 선택적 스트리머 ID를 전달한다", () => {
  const scoped = buildServerWebSocketUrl(
    "wss://streamops.test/bridge?existing=1",
    "broadcast pc #1",
    "123456789"
  );
  assert.equal(scoped.searchParams.get("existing"), "1");
  assert.equal(scoped.searchParams.get("name"), "broadcast pc #1");
  assert.equal(scoped.searchParams.get("streamerId"), "123456789");

  const legacy = buildServerWebSocketUrl("ws://localhost:3000/bridge", "legacy-pc");
  assert.equal(legacy.searchParams.get("name"), "legacy-pc");
  assert.equal(legacy.searchParams.has("streamerId"), false);
});

test("ServerConnection은 설정된 BRIDGE_STREAMER_ID를 연결 query로 사용한다", () => {
  const { connection, requests } = createConnection();
  connection.start();

  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(url.searchParams.get("name"), "broadcast-pc-01");
  assert.equal(url.searchParams.get("streamerId"), "123456789");
});

test("동일 logical identity 교체 종료는 자동 재연결하지 않는다", async (context) => {
  const errorMessages = [];
  context.mock.method(console, "error", (...args) => errorMessages.push(args.join(" ")));
  const { connection, sockets } = createConnection();
  connection.start();

  sockets[0].closeWith(BRIDGE_REPLACED_CLOSE_CODE);
  await delay(15);

  assert.equal(shouldReconnectAfterServerClose(BRIDGE_REPLACED_CLOSE_CODE), false);
  assert.equal(sockets.length, 1);
  assert.match(errorMessages.join("\n"), /BRIDGE_NAME/);
});

test("일반 서버 연결 종료는 지연 후 재연결한다", async (context) => {
  context.mock.method(console, "warn", () => {});
  const { connection, sockets } = createConnection();
  connection.start();

  sockets[0].closeWith(1006);
  await delay(15);

  assert.equal(shouldReconnectAfterServerClose(1006), true);
  assert.equal(sockets.length, 2);
});

test("오래된 socket의 close는 현재 연결에 재연결 timer를 만들지 않는다", async (context) => {
  context.mock.method(console, "warn", () => {});
  const { connection, sockets } = createConnection();
  connection.start();

  const staleSocket = sockets[0];
  staleSocket.closeWith(1006);
  await delay(15);
  assert.equal(sockets.length, 2);

  staleSocket.closeWith(1006);
  await delay(15);
  assert.equal(sockets.length, 2);
});
