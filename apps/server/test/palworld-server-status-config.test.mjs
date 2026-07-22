import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  PALWORLD_SERVER_CONNECTIONS_STATE_FILE,
  PALWORLD_SERVER_CREDENTIALS_SECRET_PATH,
  PALWORLD_SERVER_STATUS_CONFIG_FILE,
  PalworldServerStatusConfigError,
  loadPalworldServerStatusConfig,
  loadPalworldServerStatusFileConfig,
  palworldServerStatusAvailabilityCode
} = await import("../dist/services/palworld-server-status-config.js");

const strongMaterialA = crypto.createHash("sha256").update("palworld-config-test-material-a").digest();
const strongMaterialB = crypto.createHash("sha256").update("palworld-config-test-material-b").digest();
const strongBase64A = strongMaterialA.toString("base64");
const strongHexA = strongMaterialA.toString("hex");
const strongBase64B = strongMaterialB.toString("base64");
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const enabledConfig = {
  version: 1,
  enabled: true,
  allowedOrigins: [
    "https://palworld.example.com:8212",
    "http://palworld.internal:8212"
  ],
  allowedCidrs: ["10.0.0.0/8"],
  timeoutMs: 5_000,
  pollIntervalMs: 30_000
};

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "streamops-palworld-status-config-"));
  const configDir = path.join(directory, "config");
  const stateDir = path.join(directory, ".streamops");
  const configPath = path.join(configDir, PALWORLD_SERVER_STATUS_CONFIG_FILE);
  const secretPath = path.join(directory, "credentials-key");
  writeFileSync(path.join(directory, ".keep"), "fixture");
  return {
    directory,
    configDir,
    stateDir,
    configPath,
    secretPath,
    dispose() {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

function writeConfig(context, config = enabledConfig) {
  const parent = path.dirname(context.configPath);
  mkdirSync(parent, { recursive: true });
  writeFileSync(context.configPath, `${JSON.stringify(config)}\n`, { mode: 0o600 });
}

function mappedFileSystem(context, requestedPaths = []) {
  const mappedPath = (requestedPath) => requestedPath === PALWORLD_SERVER_CREDENTIALS_SECRET_PATH
    ? context.secretPath
    : requestedPath;
  return {
    resolvePath(requestedPath) {
      requestedPaths.push(requestedPath);
      return mappedPath(requestedPath);
    }
  };
}

function loadFixture(context, options = {}) {
  return loadPalworldServerStatusConfig({
    configDir: context.configDir,
    stateDir: options.stateDir ?? context.stateDir,
    ...(options.reusedSecrets ? { reusedSecrets: options.reusedSecrets } : {})
  }, {
    ...mappedFileSystem(context, options.requestedPaths)
  });
}

function assertConfigError(operation, code) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof PalworldServerStatusConfigError);
    assert.equal(error.code, code);
    return true;
  });
}

test("저장소 기본 config는 고정 allowlist를 secret 조회 없이 안전하게 검증한다", () => {
  const configDir = path.join(serverRoot, "config");
  const config = loadPalworldServerStatusFileConfig(configDir);
  assert.deepEqual({
    version: config.version,
    enabled: config.enabled,
    allowedOrigins: config.allowedOrigins,
    allowedCidrs: config.allowedCidrs,
    timeoutMs: config.timeoutMs,
    pollIntervalMs: config.pollIntervalMs
  }, {
    version: 1,
    enabled: true,
    allowedOrigins: ["https://seigatabi.com"],
    allowedCidrs: [],
    timeoutMs: 5_000,
    pollIntervalMs: 30_000
  });
});

test("config 파일 누락은 다른 경로나 기본값으로 우회하지 않고 안전하게 실패한다", () => {
  const context = fixture();
  try {
    assertConfigError(() => loadFixture(context), "config_missing");
  } finally {
    context.dispose();
  }
});

test("내부 config와 secret 오류는 브라우저용 안전 상태 코드로 축약된다", () => {
  const cases = [
    ["config_missing", "config_missing"],
    ["config_invalid_json", "config_invalid"],
    ["config_invalid_schema", "config_invalid"],
    ["config_version_unsupported", "config_invalid"],
    ["policy_missing", "policy_missing"],
    ["policy_invalid", "policy_missing"],
    ["key_missing", "key_missing"],
    ["key_invalid_file", "key_invalid"],
    ["key_invalid_encoding", "key_invalid"],
    ["key_weak", "key_invalid"],
    ["key_reused", "key_invalid"],
    ["state_invalid", "config_invalid"]
  ];
  for (const [internalCode, publicCode] of cases) {
    assert.equal(
      palworldServerStatusAvailabilityCode(new PalworldServerStatusConfigError(internalCode)),
      publicCode
    );
  }
  assert.equal(palworldServerStatusAvailabilityCode(new Error("initialization failed")), "config_invalid");
});

test("활성 config는 고정 파일명과 고정 secret 경로만 사용한다", () => {
  const context = fixture();
  const requestedPaths = [];
  try {
    writeConfig(context);
    writeFileSync(context.secretPath, `${strongBase64A}\n`, { mode: 0o600 });
    const config = loadFixture(context, { requestedPaths });
    assert.equal(config.configPath, context.configPath);
    assert.equal(config.secretPath, PALWORLD_SERVER_CREDENTIALS_SECRET_PATH);
    assert.equal(config.statePath, path.join(context.stateDir, PALWORLD_SERVER_CONNECTIONS_STATE_FILE));
    assert.equal(config.encryptionKey, strongBase64A);
    assert.ok(requestedPaths.includes(PALWORLD_SERVER_CREDENTIALS_SECRET_PATH));
    assert.equal(requestedPaths.some((entry) => /PALWORLD_.*FILE|\.env/u.test(entry)), false);
  } finally {
    context.dispose();
  }
});

test("활성 config는 broad state 디렉터리를 거부한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    assertConfigError(() => loadFixture(context, { stateDir: path.parse(context.stateDir).root }), "state_invalid");
    assertConfigError(() => loadFixture(context, { stateDir: tmpdir() }), "state_invalid");
    assertConfigError(() => loadFixture(context, { stateDir: "/etc" }), "state_invalid");
    assertConfigError(() => loadFixture(context, { stateDir: path.join(context.directory, "shared-state") }), "state_invalid");
  } finally {
    context.dispose();
  }
});

test("file-only loader는 활성 JSON도 secret 없이 schema와 정책만 검증한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    const config = loadPalworldServerStatusFileConfig(context.configDir, {
      ...mappedFileSystem(context)
    });
    assert.equal(config.enabled, true);
    assert.deepEqual(config.allowedOrigins, enabledConfig.allowedOrigins);
    assert.equal(config.allowedCidrs[0], "10.0.0.0/8");
    assert.equal(lstatSync(context.secretPath, { throwIfNoEntry: false }), undefined);
  } finally {
    context.dispose();
  }
});

test("config는 exact schema와 version 및 숫자 범위를 강제한다", () => {
  const context = fixture();
  try {
    writeConfig(context, { ...enabledConfig, debug: true });
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeConfig(context, { ...enabledConfig, version: 2 });
    assertConfigError(() => loadFixture(context), "config_version_unsupported");
    const { pollIntervalMs: _pollIntervalMs, ...missing } = enabledConfig;
    writeConfig(context, missing);
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeConfig(context, { ...enabledConfig, timeoutMs: 999 });
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeConfig(context, { ...enabledConfig, timeoutMs: 30_001 });
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeConfig(context, { ...enabledConfig, pollIntervalMs: 4_999 });
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeConfig(context, { ...enabledConfig, pollIntervalMs: 300_001 });
    assertConfigError(() => loadFixture(context), "config_invalid_schema");
    writeFileSync(context.configPath, "{invalid json", { mode: 0o600 });
    assertConfigError(() => loadFixture(context), "config_invalid_json");
  } finally {
    context.dispose();
  }
});

test("config는 symlink와 group 또는 world writable 파일을 거부한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    chmodSync(context.configPath, 0o660);
    assertConfigError(() => loadFixture(context), "config_invalid_file");

    rmSync(context.configPath);
    const realConfigPath = path.join(context.directory, "real-palworld-config.json");
    writeFileSync(realConfigPath, `${JSON.stringify(enabledConfig)}\n`, { mode: 0o600 });
    symlinkSync(realConfigPath, context.configPath);
    assertConfigError(() => loadFixture(context), "config_invalid_file");
  } finally {
    context.dispose();
  }
});

test("활성 설정은 비어 있지 않은 destination 정책을 요구한다", () => {
  const context = fixture();
  try {
    writeConfig(context, { ...enabledConfig, allowedOrigins: [] });
    assertConfigError(() => loadFixture(context), "policy_missing");
  } finally {
    context.dispose();
  }
});

test("origin 정책은 wildcard·userinfo·path·중복·localhost를 거부한다", () => {
  const invalidOrigins = [
    ["https://*.example.com:8212"],
    ["https://admin:password@palworld.example.com:8212"],
    ["https://palworld.example.com:8212/v1/api"],
    ["https://localhost:8212"],
    ["https://palworld.example.com:8212", "https://palworld.example.com:8212/"],
    ["https://PALWORLD.example.com:8212"],
    ["ftp://palworld.example.com:8212"]
  ];
  for (const allowedOrigins of invalidOrigins) {
    const context = fixture();
    try {
      writeConfig(context, { ...enabledConfig, allowedOrigins });
      assertConfigError(() => loadFixture(context), "policy_invalid");
    } finally {
      context.dispose();
    }
  }
});

test("HTTP는 private CIDR 정책이 있을 때만 허용하고 public HTTP는 차단한다", () => {
  const context = fixture();
  try {
    writeConfig(context, {
      ...enabledConfig,
      allowedOrigins: ["http://palworld.internal:8212"],
      allowedCidrs: []
    });
    assertConfigError(() => loadFixture(context), "policy_invalid");

    writeConfig(context, {
      ...enabledConfig,
      allowedOrigins: ["http://8.8.8.8:8212"],
      allowedCidrs: ["10.0.0.0/8"]
    });
    assertConfigError(() => loadFixture(context), "policy_invalid");

    writeConfig(context, {
      ...enabledConfig,
      allowedOrigins: ["https://8.8.8.8:8212"],
      allowedCidrs: []
    });
    writeFileSync(context.secretPath, strongBase64A, { mode: 0o600 });
    assert.equal(loadFixture(context).allowedOrigins[0], "https://8.8.8.8:8212");
  } finally {
    context.dispose();
  }
});

test("private literal origin은 일치하는 CIDR이 필요하다", () => {
  const context = fixture();
  try {
    writeConfig(context, {
      ...enabledConfig,
      allowedOrigins: ["https://10.10.0.5:8212"],
      allowedCidrs: ["192.168.0.0/16"]
    });
    assertConfigError(() => loadFixture(context), "policy_invalid");
    writeConfig(context, {
      ...enabledConfig,
      allowedOrigins: ["http://10.10.0.5:8212"],
      allowedCidrs: ["10.0.0.0/8"]
    });
    writeFileSync(context.secretPath, strongBase64A, { mode: 0o600 });
    assert.equal(loadFixture(context).allowedOrigins[0], "http://10.10.0.5:8212");
  } finally {
    context.dispose();
  }
});

test("CIDR 정책은 private/VPN 범위와 중복 없는 canonical 형식만 허용한다", () => {
  const invalidCidrs = [
    ["0.0.0.0/0"],
    ["8.8.8.0/24"],
    ["10.0.0.0/7"],
    ["10.1.2.3/8"],
    ["10.0.0.0/*"],
    ["10.0.0.0/8", "10.0.0.0/8"],
    ["fe80::/10"]
  ];
  for (const allowedCidrs of invalidCidrs) {
    const context = fixture();
    try {
      writeConfig(context, { ...enabledConfig, allowedCidrs });
      assertConfigError(() => loadFixture(context), "policy_invalid");
    } finally {
      context.dispose();
    }
  }
});

test("secret은 일반 파일이어야 하며 symlink와 directory를 거부한다", () => {
  const missing = fixture();
  try {
    writeConfig(missing);
    assertConfigError(() => loadFixture(missing), "key_missing");
  } finally {
    missing.dispose();
  }

  const symlink = fixture();
  try {
    writeConfig(symlink);
    const target = path.join(symlink.directory, "real-key");
    writeFileSync(target, strongBase64A, { mode: 0o600 });
    symlinkSync(target, symlink.secretPath);
    assertConfigError(() => loadFixture(symlink), "key_invalid_file");
  } finally {
    symlink.dispose();
  }

  const directory = fixture();
  try {
    writeConfig(directory);
    mkdirSync(directory.secretPath, { recursive: true });
    assertConfigError(() => loadFixture(directory), "key_invalid_file");
  } finally {
    directory.dispose();
  }
});

test("secret은 정확한 32-byte canonical base64 또는 64자리 hex만 허용한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    for (const invalid of ["short", `${strongBase64A}extra`, strongBase64A.replace(/=$/u, "")]) {
      writeFileSync(context.secretPath, invalid, { mode: 0o600 });
      assertConfigError(() => loadFixture(context), "key_invalid_encoding");
    }
    writeFileSync(context.secretPath, `${strongHexA}\n`, { mode: 0o600 });
    assert.equal(loadFixture(context).encryptionKey, strongHexA);
    writeFileSync(context.secretPath, `${strongBase64B}\r\n`, { mode: 0o600 });
    assert.equal(loadFixture(context).encryptionKey, strongBase64B);
  } finally {
    context.dispose();
  }
});

test("secret 파일은 owner 전용 0400 또는 0600 권한만 허용한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    writeFileSync(context.secretPath, strongBase64A, { mode: 0o600 });
    chmodSync(context.secretPath, 0o600);
    assert.equal(loadFixture(context).encryptionKey, strongBase64A);
    chmodSync(context.secretPath, 0o400);
    assert.equal(loadFixture(context).encryptionKey, strongBase64A);
    for (const mode of [0o444, 0o644, 0o700]) {
      chmodSync(context.secretPath, mode);
      assertConfigError(() => loadFixture(context), "key_invalid_file");
    }
  } finally {
    context.dispose();
  }
});

test("weak/default key와 다른 runtime secret의 재사용을 거부한다", () => {
  const context = fixture();
  try {
    writeConfig(context);
    writeFileSync(context.secretPath, Buffer.alloc(32, 1).toString("base64"), { mode: 0o600 });
    assertConfigError(() => loadFixture(context), "key_weak");

    writeFileSync(context.secretPath, strongBase64A, { mode: 0o600 });
    assertConfigError(
      () => loadFixture(context, { reusedSecrets: [strongHexA] }),
      "key_reused"
    );
  } finally {
    context.dispose();
  }
});

test("secret 관련 오류는 key 원문이나 고정 파일 경로를 노출하지 않는다", () => {
  const context = fixture();
  const sensitive = "default-secret-material-that-must-not-leak";
  try {
    writeConfig(context);
    writeFileSync(context.secretPath, sensitive, { mode: 0o600 });
    try {
      loadFixture(context);
      assert.fail("오류가 발생해야 합니다.");
    } catch (error) {
      const serialized = `${error.name}:${error.message}:${error.code}`;
      assert.doesNotMatch(serialized, new RegExp(sensitive, "u"));
      assert.doesNotMatch(serialized, /\/run\/secrets/u);
      assert.match(serialized, /key_invalid_encoding/u);
    }
  } finally {
    context.dispose();
  }
});
