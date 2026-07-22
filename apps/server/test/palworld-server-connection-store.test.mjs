import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { PalworldServerConnectionStore } = await import("../dist/services/palworld-server-connection-store.js");
const secureTemporaryRoot = realpathSync(tmpdir());

function temporaryStore(prefix, keyByte = 17) {
  const directory = mkdtempSync(path.join(secureTemporaryRoot, prefix));
  const filePath = path.join(directory, "palworld-server-connections.json.enc");
  const encryptionKey = Buffer.alloc(32, keyByte).toString("base64");
  return {
    directory,
    filePath,
    encryptionKey,
    store: new PalworldServerConnectionStore({ filePath, encryptionKey })
  };
}

test("Palworld 연결 저장소는 tenant별 record 전체를 AES-256-GCM으로 암호화한다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-");
  try {
    await Promise.all([
      fixture.store.set({
        ownerId: "streamer-a",
        baseUrl: "https://pal-a.internal.example:8212",
        adminPassword: "admin-password-a"
      }),
      fixture.store.set({
        ownerId: "streamer-b",
        baseUrl: "https://pal-b.internal.example:8212",
        adminPassword: "admin-password-b"
      })
    ]);

    assert.equal(fixture.store.get("streamer-a")?.baseUrl, "https://pal-a.internal.example:8212");
    assert.equal(fixture.store.get("streamer-b")?.adminPassword, "admin-password-b");
    const encrypted = readFileSync(fixture.filePath, "utf8");
    assert.doesNotMatch(encrypted, /streamer-a|streamer-b/);
    assert.doesNotMatch(encrypted, /pal-a\.internal|pal-b\.internal/);
    assert.doesNotMatch(encrypted, /admin-password/);
    assert.equal(statSync(fixture.filePath).mode & 0o777, 0o600);
    assert.equal(statSync(fixture.directory).mode & 0o777, 0o700);

    const restarted = new PalworldServerConnectionStore({
      filePath: fixture.filePath,
      encryptionKey: fixture.encryptionKey
    });
    assert.deepEqual(new Set(restarted.listOwnerIds()), new Set(["streamer-a", "streamer-b"]));
    assert.equal(await restarted.remove("streamer-a"), true);
    assert.equal(restarted.get("streamer-a"), undefined);
    assert.equal(restarted.get("streamer-b")?.baseUrl, "https://pal-b.internal.example:8212");
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Palworld 연결 저장소는 저장할 때마다 새 IV를 사용한다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-iv-", 23);
  try {
    await fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" });
    const first = JSON.parse(readFileSync(fixture.filePath, "utf8"));
    await fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" });
    const second = JSON.parse(readFileSync(fixture.filePath, "utf8"));
    assert.notEqual(first.iv, second.iv);
    assert.notEqual(first.ciphertext, second.ciphertext);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Palworld 연결 저장소는 다른 key와 손상된 ciphertext를 fail-closed 처리한다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-fail-closed-", 31);
  try {
    await fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" });
    const originalCiphertext = readFileSync(fixture.filePath);
    assert.throws(() => new PalworldServerConnectionStore({
      filePath: fixture.filePath,
      encryptionKey: Buffer.alloc(32, 32).toString("base64")
    }), /복호화하거나 검증/);
    assert.deepEqual(readFileSync(fixture.filePath), originalCiphertext);

    const encrypted = JSON.parse(readFileSync(fixture.filePath, "utf8"));
    encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -4)}AAAA`;
    writeFileSync(fixture.filePath, JSON.stringify(encrypted));
    assert.throws(() => new PalworldServerConnectionStore({
      filePath: fixture.filePath,
      encryptionKey: fixture.encryptionKey
    }), /복호화하거나 검증/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Palworld 연결 저장소는 기존 state 디렉터리와 파일 권한을 안전하게 보정한다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-permissions-", 41);
  try {
    await fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" });
    chmodSync(fixture.directory, 0o755);
    chmodSync(fixture.filePath, 0o644);

    const restarted = new PalworldServerConnectionStore({
      filePath: fixture.filePath,
      encryptionKey: fixture.encryptionKey
    });

    assert.equal(restarted.get("a")?.baseUrl, "https://pal.example:8212");
    assert.equal(statSync(fixture.directory).mode & 0o777, 0o700);
    assert.equal(statSync(fixture.filePath).mode & 0o777, 0o600);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Palworld 연결 저장소는 broad 경로와 state 디렉터리 symlink를 거부한다", () => {
  const encryptionKey = Buffer.alloc(32, 51).toString("base64");
  assert.throws(() => new PalworldServerConnectionStore({
    filePath: path.join(tmpdir(), "palworld-server-connections.json.enc"),
    encryptionKey
  }), /storage_invalid/);
  assert.throws(() => new PalworldServerConnectionStore({
    filePath: path.join("/etc", "palworld-server-connections.json.enc"),
    encryptionKey
  }), /storage_invalid/);
  assert.throws(() => new PalworldServerConnectionStore({
    filePath: path.join(secureTemporaryRoot, "shared-state", "palworld-server-connections.json.enc"),
    encryptionKey
  }), /storage_invalid/);

  const directory = mkdtempSync(path.join(secureTemporaryRoot, "streamops-palworld-store-symlink-dir-"));
  const actualDirectory = path.join(directory, "actual");
  const linkedDirectory = path.join(directory, "linked");
  mkdirSync(actualDirectory, { mode: 0o700 });
  symlinkSync(actualDirectory, linkedDirectory, "dir");
  try {
    assert.throws(() => new PalworldServerConnectionStore({
      filePath: path.join(linkedDirectory, "palworld-server-connections.json.enc"),
      encryptionKey
    }), /storage_invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Palworld 연결 저장소는 dangling symlink와 과도한 암호문을 신규 저장소로 취급하지 않는다", () => {
  const encryptionKey = Buffer.alloc(32, 61).toString("base64");
  const danglingDirectory = mkdtempSync(path.join(secureTemporaryRoot, "streamops-palworld-store-dangling-"));
  const danglingPath = path.join(danglingDirectory, "palworld-server-connections.json.enc");
  symlinkSync(path.join(danglingDirectory, "missing-ciphertext"), danglingPath);
  try {
    assert.throws(() => new PalworldServerConnectionStore({ filePath: danglingPath, encryptionKey }), /storage_invalid/);
    assert.equal(lstatSync(danglingPath).isSymbolicLink(), true);
  } finally {
    rmSync(danglingDirectory, { recursive: true, force: true });
  }

  const oversizedDirectory = mkdtempSync(path.join(secureTemporaryRoot, "streamops-palworld-store-oversized-"));
  const oversizedPath = path.join(oversizedDirectory, "palworld-server-connections.json.enc");
  writeFileSync(oversizedPath, Buffer.alloc(8 * 1024 * 1024 + 1), { mode: 0o600 });
  try {
    assert.throws(() => new PalworldServerConnectionStore({ filePath: oversizedPath, encryptionKey }), /storage_invalid/);
    assert.equal(statSync(oversizedPath).size, 8 * 1024 * 1024 + 1);
  } finally {
    rmSync(oversizedDirectory, { recursive: true, force: true });
  }
});

test("기존 암호문이 사라지면 빈 state로 덮어쓰지 않는다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-disappeared-", 71);
  try {
    await fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" });
    unlinkSync(fixture.filePath);
    await assert.rejects(
      fixture.store.set({ ownerId: "b", baseUrl: "https://pal.example:8212", adminPassword: "password-b" }),
      /storage_write_failed/
    );
    assert.equal(lstatSync(fixture.filePath, { throwIfNoEntry: false }), undefined);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("초기 load 뒤 새 state 파일이 생기면 원자적으로 덮어쓰기를 거부한다", async () => {
  const fixture = temporaryStore("streamops-palworld-store-appeared-", 81);
  const externallyCreated = Buffer.from("externally-restored-ciphertext", "utf8");
  try {
    writeFileSync(fixture.filePath, externallyCreated, { mode: 0o600, flag: "wx" });
    await assert.rejects(
      fixture.store.set({ ownerId: "a", baseUrl: "https://pal.example:8212", adminPassword: "password-a" }),
      /storage_write_failed/
    );
    assert.deepEqual(readFileSync(fixture.filePath), externallyCreated);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
