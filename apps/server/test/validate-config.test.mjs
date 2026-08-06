import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeConfigDir(chatCommands) {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-config-"));
  writeJson(path.join(dir, "reward-actions.json"), {});
  writeJson(path.join(dir, "stream-events.json"), {});
  writeJson(path.join(dir, "chat-commands.json"), chatCommands);
  writeJson(path.join(dir, "lol-participation.json"), {
    enabled: true,
    showRiotIdPublicly: false,
    profileCacheTtlHours: 24,
    matchAnalysisCount: 20,
    mainRoleMinConfidence: 45,
    enabledQueues: [420, 440],
    rateLimit: { backoffMs: 60000, maxBackoffMs: 900000 }
  });
  writeJson(path.join(dir, "palworld-server-status.json"), {
    version: 1,
    enabled: false,
    allowedOrigins: [],
    allowedCidrs: [],
    timeoutMs: 5000,
    pollIntervalMs: 30000
  });
  return dir;
}

function runValidateConfig(configDir) {
  return spawnSync(process.execPath, ["dist/scripts/validate-config.js", `--config-dir=${configDir}`], {
    cwd: serverRoot,
    encoding: "utf8"
  });
}

test("config validator는 제거된 OBS action을 거부한다", () => {
  const dir = makeConfigDir({
    "!bad": [
      {
        type: "obs.setScene",
        sceneName: "{input}"
      }
    ]
  });

  try {
    const result = runValidateConfig(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /금지된 action type입니다: obs\.setScene/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("config validator는 안전한 viewer 템플릿 위치를 허용한다", () => {
  const dir = makeConfigDir({
    "!질문": [
      {
        type: "queue.question",
        question: "{input}",
        userName: "{user}"
      },
      {
        type: "twitch.chat",
        message: "{user}님 질문을 등록했습니다."
      }
    ]
  });

  try {
    const result = runValidateConfig(dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("config validator는 Palworld 상태 설정 파일 누락을 거부한다", () => {
  const dir = makeConfigDir({});
  rmSync(path.join(dir, "palworld-server-status.json"));

  try {
    const result = runValidateConfig(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /palworld-server-status\.json/);
    assert.match(result.stderr, /config_missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("config validator는 Palworld 상태 설정의 unknown field를 거부한다", () => {
  const dir = makeConfigDir({});
  writeJson(path.join(dir, "palworld-server-status.json"), {
    version: 1,
    enabled: false,
    allowedOrigins: [],
    allowedCidrs: [],
    timeoutMs: 5000,
    pollIntervalMs: 30000,
    unexpected: true
  });

  try {
    const result = runValidateConfig(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /palworld-server-status\.json/);
    assert.match(result.stderr, /config_invalid_schema/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
