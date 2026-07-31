import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DiscordInternalAuthBootstrapError,
  bootstrapDiscordInternalAuth
} from "../dist/services/discord-internal-auth-bootstrap.js";

function context() {
  const directory = mkdtempSync(path.join(tmpdir(), "yoro-discord-auth-"));
  let sequence = 0;
  const uid = process.getuid?.() ?? 0;
  const gid = process.getgid?.() ?? 0;
  return {
    directory,
    options: {
      directory,
      serverUid: uid,
      serverGid: gid,
      botUid: uid,
      botGid: gid,
      randomBytes(size) {
        sequence += 1;
        return Buffer.alloc(size, sequence);
      }
    },
    dispose() {
      rmSync(directory, { recursive: true, force: true });
    }
  };
}

test("Discord 내부 인증 bootstrap은 동일 key의 UID별 사본을 생성하고 재사용한다", () => {
  const value = context();
  try {
    assert.equal(bootstrapDiscordInternalAuth(value.options).keyStatus, "created");
    const serverPath = path.join(value.directory, "server_key");
    const botPath = path.join(value.directory, "bot_key");
    assert.equal(readFileSync(serverPath, "utf8"), readFileSync(botPath, "utf8"));
    assert.match(readFileSync(serverPath, "utf8"), /^[a-f0-9]{64}$/u);
    assert.equal(statSync(serverPath).mode & 0o777, 0o400);
    assert.equal(statSync(botPath).mode & 0o777, 0o400);
    assert.equal(bootstrapDiscordInternalAuth(value.options).keyStatus, "reused");
  } finally {
    value.dispose();
  }
});

test("Discord 내부 인증 bootstrap은 한쪽 사본만 유실되면 같은 값으로 복구한다", () => {
  const value = context();
  try {
    bootstrapDiscordInternalAuth(value.options);
    const serverPath = path.join(value.directory, "server_key");
    const botPath = path.join(value.directory, "bot_key");
    const expected = readFileSync(serverPath, "utf8");
    unlinkSync(botPath);
    assert.equal(bootstrapDiscordInternalAuth(value.options).keyStatus, "recovered");
    assert.equal(readFileSync(botPath, "utf8"), expected);
  } finally {
    value.dispose();
  }
});

test("Discord 내부 인증 bootstrap은 서로 다른 key 사본을 fail-closed로 거부한다", () => {
  const value = context();
  try {
    bootstrapDiscordInternalAuth(value.options);
    const botPath = path.join(value.directory, "bot_key");
    chmodSync(botPath, 0o600);
    writeFileSync(botPath, "f".repeat(64));
    assert.throws(
      () => bootstrapDiscordInternalAuth(value.options),
      (error) => error instanceof DiscordInternalAuthBootstrapError
        && error.code === "key_mismatch"
    );
  } finally {
    value.dispose();
  }
});
