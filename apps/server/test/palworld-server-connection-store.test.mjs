import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { PalworldServerConnectionStore } = await import("../dist/services/palworld-server-connection-store.js");

function temporaryStore(prefix, keyByte = 17) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  const filePath = path.join(directory, "palworld-connections.json.enc");
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
    assert.throws(() => new PalworldServerConnectionStore({
      filePath: fixture.filePath,
      encryptionKey: Buffer.alloc(32, 32).toString("base64")
    }), /복호화하거나 검증/);

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
