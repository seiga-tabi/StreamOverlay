import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  PalworldServerCredentialsBootstrapError,
  bootstrapPalworldServerCredentials
} = await import("../dist/services/palworld-server-credentials-bootstrap.js");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "streamops-palworld-credentials-bootstrap-"));
  return {
    root,
    secretDirectory: path.join(root, "secrets"),
    stateDirectory: path.join(root, ".streamops"),
    uid: process.getuid(),
    gid: process.getgid(),
    dispose() {
      rmSync(root, { recursive: true, force: true });
    }
  };
}

function bootstrap(context, randomMaterial = crypto.createHash("sha256").update("bootstrap-fixture").digest()) {
  return bootstrapPalworldServerCredentials({
    secretDirectory: context.secretDirectory,
    stateDirectory: context.stateDirectory,
    targetUid: context.uid,
    targetGid: context.gid,
    randomBytes(size) {
      assert.equal(size, 32);
      return Buffer.from(randomMaterial);
    }
  });
}

function assertBootstrapError(operation, code) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof PalworldServerCredentialsBootstrapError);
    assert.equal(error.code, code);
    return true;
  });
}

test("최초 실행은 고정 경로에 key를 한 번만 생성하고 권한을 제한한다", () => {
  const context = fixture();
  try {
    const first = bootstrap(context);
    assert.equal(first.keyStatus, "created");
    assert.equal(first.stateStatus, "empty");
    assert.match(readFileSync(first.keyPath, "utf8"), /^[A-Za-z0-9+/]{43}=\n$/u);
    assert.equal(lstatSync(first.keyPath).mode & 0o777, 0o400);
    assert.equal(lstatSync(context.secretDirectory).mode & 0o777, 0o700);
    assert.equal(lstatSync(context.stateDirectory).mode & 0o777, 0o700);
  } finally {
    context.dispose();
  }
});

test("반복 실행은 기존 key bytes를 유지하고 새 key로 교체하지 않는다", () => {
  const context = fixture();
  try {
    const first = bootstrap(context);
    const original = readFileSync(first.keyPath);
    const second = bootstrap(
      context,
      crypto.createHash("sha256").update("different-material").digest()
    );
    assert.equal(second.keyStatus, "reused");
    assert.deepEqual(readFileSync(second.keyPath), original);
  } finally {
    context.dispose();
  }
});

test("기존 암호문이 있는데 key가 없으면 자동 생성하지 않고 중단한다", () => {
  const context = fixture();
  try {
    mkdirSync(context.stateDirectory, { recursive: true });
    writeFileSync(
      path.join(context.stateDirectory, "palworld-server-connections.json.enc"),
      "{\"existing\":true}\n",
      { mode: 0o600 }
    );
    assertBootstrapError(() => bootstrap(context), "state_exists_without_key");
    assert.equal(
      lstatSync(
        path.join(context.secretDirectory, "palworld-server-credentials-encryption-key"),
        { throwIfNoEntry: false }
      ),
      undefined
    );
  } finally {
    context.dispose();
  }
});

test("손상된 기존 key는 덮어쓰지 않고 안전하게 실패한다", () => {
  const context = fixture();
  try {
    mkdirSync(context.secretDirectory, { recursive: true });
    const keyPath = path.join(
      context.secretDirectory,
      "palworld-server-credentials-encryption-key"
    );
    writeFileSync(keyPath, "not-a-valid-key\n", { mode: 0o600 });
    assertBootstrapError(() => bootstrap(context), "invalid_key");
    assert.equal(readFileSync(keyPath, "utf8"), "not-a-valid-key\n");
    assert.equal(lstatSync(keyPath).mode & 0o777, 0o400);
  } finally {
    context.dispose();
  }
});

test("key 경로 symlink는 실제 파일을 수정하지 않고 거부한다", () => {
  const context = fixture();
  try {
    mkdirSync(context.secretDirectory, { recursive: true });
    const external = path.join(context.root, "external-key");
    writeFileSync(external, `${Buffer.alloc(32, 7).toString("base64")}\n`, { mode: 0o400 });
    symlinkSync(
      external,
      path.join(context.secretDirectory, "palworld-server-credentials-encryption-key")
    );
    assertBootstrapError(() => bootstrap(context), "unsafe_file");
    assert.equal(readFileSync(external, "utf8"), `${Buffer.alloc(32, 7).toString("base64")}\n`);
    chmodSync(external, 0o600);
  } finally {
    context.dispose();
  }
});
