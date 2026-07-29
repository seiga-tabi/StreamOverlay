import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AgentClient, AgentClientError } from "../dist/agent-client.js";
import { AgentDaemon } from "../dist/agent-daemon.js";
import { loadAgentConfig } from "../dist/config.js";
import { CredentialStore } from "../dist/credential-store.js";
import { AgentHealth, AgentHealthServer } from "../dist/health.js";
import { OfflineBuffer } from "../dist/offline-buffer.js";
import { AgentScheduler } from "../dist/scheduler.js";
import {
  PalworldAdapterError,
  PalworldRestStatusAdapter
} from "../dist/adapters/palworld-status-adapter.js";

const installationId = "11111111-1111-4111-8111-111111111111";
const gameServerId = "22222222-2222-4222-8222-222222222222";
const agentToken = "a".repeat(64);
const bootstrapToken = "b".repeat(64);
const serverOrigin = "http://127.0.0.1:3000";
const validPayload = {
  payloadVersion: 1,
  observedAt: new Date().toISOString(),
  online: true,
  players: 2,
  maxPlayers: 16,
  gameVersion: "v1.0.0",
  uptimeSeconds: 3600,
  latencyMs: 12
};

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "yoro-agent-test-"));
}

function validRegistration() {
  return {
    installationId,
    agentToken,
    gameServer: { id: gameServerId, gameType: "palworld" },
    ingestion: {
      endpoint: `${serverOrigin}/api/agent/v1/status`,
      payloadVersion: 1
    }
  };
}

test("Agent 설정은 기본 비활성이고 외부 Palworld origin을 차단한다", () => {
  const config = loadAgentConfig({ NODE_ENV: "test" });
  assert.equal(config.enabled, false);
  assert.equal(config.pushIntervalSeconds, 300);
  assert.throws(() => loadAgentConfig({
    NODE_ENV: "test",
    PALWORLD_REST_ORIGIN: "http://example.com:8212"
  }), /palworld_origin_not_loopback/);
  assert.throws(() => loadAgentConfig({
    NODE_ENV: "production",
    YORO_AGENT_ENABLED: "true",
    YORO_AGENT_SERVER_ORIGIN: "http://127.0.0.1:3000",
    PALWORLD_ADMIN_PASSWORD: "not-a-placeholder"
  }), /palworld_admin_password_file_required|server_origin_invalid/);
  assert.throws(() => loadAgentConfig({
    NODE_ENV: "production",
    PALWORLD_STATUS_ADAPTER: "mock"
  }), /mock_adapter_production_forbidden/);
  assert.throws(() => loadAgentConfig({
    NODE_ENV: "production"
  }), /release_identity_invalid/);
  assert.equal(loadAgentConfig({
    NODE_ENV: "production",
    APP_VERSION: "1.0.0",
    GIT_SHA: "a".repeat(40),
    BUILD_TIME: "2026-07-29T00:00:00.000Z"
  }).release.version, "1.0.0");
});

test("production secret file 권한·symlink·직접값 충돌을 차단한다", () => {
  const directory = tempDirectory();
  const bootstrapFile = path.join(directory, "bootstrap");
  const passwordFile = path.join(directory, "password");
  fs.writeFileSync(bootstrapFile, bootstrapToken, { mode: 0o600 });
  fs.writeFileSync(passwordFile, "local-admin-password", { mode: 0o600 });
  const base = {
    NODE_ENV: "production",
    APP_VERSION: "1.0.0",
    GIT_SHA: "a".repeat(40),
    BUILD_TIME: "2026-07-29T00:00:00.000Z",
    YORO_AGENT_ENABLED: "true",
    YORO_AGENT_SERVER_ORIGIN: "https://yoro.example",
    YORO_AGENT_BOOTSTRAP_TOKEN_FILE: bootstrapFile,
    PALWORLD_ADMIN_PASSWORD_FILE: passwordFile
  };
  assert.equal(loadAgentConfig(base).enabled, true);
  assert.throws(() => loadAgentConfig({
    ...base,
    YORO_AGENT_BOOTSTRAP_TOKEN: bootstrapToken
  }), /bootstrap_token_ambiguous/);
  fs.chmodSync(passwordFile, 0o644);
  assert.throws(() => loadAgentConfig(base), /secret_file_unreadable/);
  fs.unlinkSync(passwordFile);
  const target = path.join(directory, "password-target");
  fs.writeFileSync(target, "local-admin-password", { mode: 0o600 });
  fs.symlinkSync(target, passwordFile);
  assert.throws(() => loadAgentConfig(base), /secret_file_unreadable/);
  assert.throws(() => loadAgentConfig({
    NODE_ENV: "test",
    YORO_AGENT_PUSH_INTERVAL_SECONDS: "59"
  }), /push_interval_invalid/);
});

test("credential은 0600 파일에 원자적으로 저장하고 손상 시 fail-closed한다", () => {
  const directory = tempDirectory();
  const file = path.join(directory, "credential.json");
  const store = new CredentialStore(file, serverOrigin, false);
  const saved = store.save(validRegistration(), new Date("2026-07-29T00:00:00.000Z"));
  assert.equal(saved.agentToken, agentToken);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.throws(() => store.save(validRegistration()), /target_exists/);
  fs.writeFileSync(file, "{", { mode: 0o600 });
  assert.throws(() => store.load(), /credential_corrupted/);
});

test("credential symlink와 origin mismatch를 거부한다", () => {
  const directory = tempDirectory();
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "credential.json");
  fs.writeFileSync(target, "{}\n", { mode: 0o600 });
  fs.symlinkSync(target, link);
  assert.throws(
    () => new CredentialStore(link, serverOrigin, false).load(),
    /credential_corrupted/
  );
});

test("offline buffer는 상태 하나만 보존하고 손상 파일을 빈 queue로 바꾸지 않는다", () => {
  const directory = tempDirectory();
  const file = path.join(directory, "pending.json");
  const buffer = new OfflineBuffer(file, false);
  assert.equal(buffer.load(), undefined);
  buffer.save(validPayload);
  const replacement = { ...validPayload, players: 3, observedAt: new Date().toISOString() };
  buffer.save(replacement);
  assert.equal(new OfflineBuffer(file, false).load()?.players, 3);
  buffer.clear();
  assert.equal(fs.existsSync(file), false);
  fs.writeFileSync(file, "{", { mode: 0o600 });
  assert.throws(() => new OfflineBuffer(file, false).load(), /offline_buffer_corrupted/);
  assert.equal(fs.readFileSync(file, "utf8"), "{");
});

test("Palworld REST adapter는 exact info와 metrics만 aggregate한다", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), authorization: init.headers.Authorization });
    if (String(url).endsWith("/v1/api/info")) {
      return new Response(JSON.stringify({
        version: "v1.0.0",
        servername: "로컬 서버",
        description: "",
        worldguid: "A7E97BAA767DB9029EF013BB71E993A0"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      serverfps: 60,
      currentplayernum: 2,
      serverframetime: 16.6,
      maxplayernum: 16,
      uptime: 3600,
      basecampnum: 3,
      days: 10
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const adapter = new PalworldRestStatusAdapter({
    origin: "http://127.0.0.1:8212",
    adminPassword: "local-only-password",
    timeoutMs: 1000
  }, fetchImpl);
  const status = await adapter.collect(new AbortController().signal);
  assert.deepEqual(
    Object.keys(status).sort(),
    ["gameVersion", "latencyMs", "maxPlayers", "online", "players", "uptimeSeconds"].sort()
  );
  assert.equal(status.players, 2);
  assert.equal(JSON.stringify(status).includes("local-only-password"), false);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.authorization.startsWith("Basic ")));
});

test("Palworld REST adapter는 인증 실패와 unknown field를 offline으로 숨기지 않는다", async () => {
  const authFailure = new PalworldRestStatusAdapter({
    origin: "http://127.0.0.1:8212",
    adminPassword: "password",
    timeoutMs: 1000
  }, async () => new Response("{}", {
    status: 401,
    headers: { "content-type": "application/json" }
  }));
  await assert.rejects(
    authFailure.collect(new AbortController().signal),
    (error) => error instanceof PalworldAdapterError && error.code === "palworld_auth_failed"
  );
  const invalid = new PalworldRestStatusAdapter({
    origin: "http://127.0.0.1:8212",
    adminPassword: "password",
    timeoutMs: 1000
  }, async (url) => new Response(JSON.stringify(
    String(url).endsWith("/info")
      ? {
          version: "v1", servername: "x", description: "", worldguid: "A".repeat(32), extra: true
        }
      : {
          serverfps: 60, currentplayernum: 0, serverframetime: 16,
          maxplayernum: 16, uptime: 1, basecampnum: 0, days: 1
        }
  ), { status: 200, headers: { "content-type": "application/json" } }));
  await assert.rejects(
    invalid.collect(new AbortController().signal),
    (error) => error instanceof PalworldAdapterError
      && error.code === "palworld_invalid_response"
  );
});

test("Agent client는 등록 응답을 엄격히 검증하고 redirect를 차단한다", async () => {
  const client = new AgentClient({
    serverOrigin,
    timeoutMs: 1000,
    maximumRetryAttempts: 1
  }, async () => new Response(JSON.stringify(validRegistration()), {
    status: 201,
    headers: { "content-type": "application/json" }
  }));
  const response = await client.register(bootstrapToken, new AbortController().signal);
  assert.equal(response.installationId, installationId);

  const redirected = new AgentClient({
    serverOrigin,
    timeoutMs: 1000,
    maximumRetryAttempts: 1
  }, async () => new Response("", { status: 302, headers: { location: "https://example.com" } }));
  await assert.rejects(
    redirected.register(bootstrapToken, new AbortController().signal),
    (error) => error instanceof AgentClientError && error.code === "redirect_blocked"
  );
});

test("status 전송은 요청마다 nonce를 새로 만들고 credential 오류를 재시도하지 않는다", async () => {
  const nonces = [];
  const bodies = [];
  const client = new AgentClient({
    serverOrigin,
    timeoutMs: 1000,
    maximumRetryAttempts: 1
  }, async (_url, init) => {
    nonces.push(init.headers["X-Yoro-Agent-Nonce"]);
    bodies.push(init.body);
    return new Response(JSON.stringify({
      accepted: true,
      currentUpdated: true,
      duplicate: false
    }), { status: 202, headers: { "content-type": "application/json" } });
  });
  const credential = new CredentialStore(
    path.join(tempDirectory(), "credential.json"),
    serverOrigin,
    false
  ).save(validRegistration());
  await client.sendStatus(credential, validPayload, new AbortController().signal);
  await client.sendStatus(credential, validPayload, new AbortController().signal);
  assert.equal(nonces.length, 2);
  assert.notEqual(nonces[0], nonces[1]);
  assert.equal(bodies[0], bodies[1]);

  let attempts = 0;
  const rejected = new AgentClient({
    serverOrigin,
    timeoutMs: 1000,
    maximumRetryAttempts: 5
  }, async () => {
    attempts += 1;
    return new Response("{}", { status: 401 });
  });
  await assert.rejects(
    rejected.sendStatus(credential, validPayload, new AbortController().signal),
    (error) => error instanceof AgentClientError && error.code === "credential_rejected"
  );
  assert.equal(attempts, 1);
});

test("health endpoint는 live와 ready 의미를 분리하고 민감정보를 노출하지 않는다", async () => {
  const health = new AgentHealth("0.1.0-test");
  const server = new AgentHealthServer(health, "127.0.0.1", 0);
  const port = await server.start();
  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/health/live`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/health/ready`)).status, 503);
    health.update({ state: "palworld_unavailable", ready: true, errorCode: "palworld_timeout" });
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(body.includes(agentToken), false);
    assert.equal(body.includes("password"), false);
  } finally {
    await server.stop();
  }
});

test("scheduler는 작업을 겹치지 않고 종료 시 진행 중 요청을 중단한다", async () => {
  let active = 0;
  let maximumActive = 0;
  let calls = 0;
  const scheduler = new AgentScheduler({
    intervalMs: 10,
    random: () => 0,
    task: async (signal) => {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (!signal.aborted) active -= 1;
    }
  });
  scheduler.start();
  await new Promise((resolve) => setTimeout(resolve, 55));
  await scheduler.stop();
  assert.ok(calls >= 1);
  assert.equal(maximumActive, 1);
});

test("mock 기반 등록·credential 복원·status 왕복에서 bootstrap을 저장하지 않는다", async () => {
  const directory = tempDirectory();
  const config = loadAgentConfig({
    NODE_ENV: "test",
    YORO_AGENT_ENABLED: "true",
    YORO_AGENT_SERVER_ORIGIN: serverOrigin,
    YORO_AGENT_STATE_DIR: directory,
    YORO_AGENT_BOOTSTRAP_TOKEN: bootstrapToken,
    YORO_AGENT_PUSH_INTERVAL_SECONDS: "60",
    PALWORLD_STATUS_ADAPTER: "mock",
    YORO_AGENT_MOCK_STATE: "online",
    YORO_AGENT_HEALTH_PORT: "0"
  });
  const calls = { register: 0, status: 0 };
  const client = {
    async register(token) {
      calls.register += 1;
      assert.equal(token, bootstrapToken);
      return validRegistration();
    },
    async sendStatus(_credential, payload) {
      calls.status += 1;
      assert.equal(payload.online, true);
      return { accepted: true, currentUpdated: true, duplicate: false };
    }
  };
  const healthServer = { async start() { return 0; }, async stop() {} };
  const first = new AgentDaemon(config, { client, healthServer, random: () => 0 });
  await first.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await first.stop();
  assert.equal(calls.register, 1);
  assert.ok(calls.status >= 1);
  const credentialBody = fs.readFileSync(config.credentialFile, "utf8");
  assert.equal(credentialBody.includes(bootstrapToken), false);
  assert.equal(credentialBody.includes(agentToken), true);

  const restartClient = {
    async register() {
      throw new Error("기존 credential이 있으면 호출되면 안 됩니다.");
    },
    async sendStatus() {
      calls.status += 1;
      return { accepted: true, currentUpdated: true, duplicate: false };
    }
  };
  const restarted = new AgentDaemon(
    { ...config, bootstrapToken: undefined },
    { client: restartClient, healthServer, random: () => 0 }
  );
  await restarted.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await restarted.stop();
  assert.equal(calls.register, 1);
});
