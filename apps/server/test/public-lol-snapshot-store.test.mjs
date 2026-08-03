import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const { LocalPublicLolSnapshotStore } = await import("../dist/services/public-lol-snapshot-store.js");

test("공개 LoL snapshot은 checksum과 원자 파일을 사용해 재시작 뒤 복원한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "public-lol-snapshot-"));
  const store = new LocalPublicLolSnapshotStore(directory);
  const fetchedAt = "2026-08-03T00:00:00.000Z";
  const payload = { status: "ready", riotId: "HideOnBush#KR1", fetchedAt, recentMatches: [] };

  await store.save({ key: "hideonbush#kr1", puuid: "public-puuid", fetchedAt, payload });
  const restored = await store.load("hideonbush#kr1");

  assert.equal(restored?.puuid, "public-puuid");
  assert.deepEqual(restored?.payload, payload);
});

test("공개 LoL snapshot은 payload 변조를 캐시 miss로 처리한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "public-lol-snapshot-tamper-"));
  const store = new LocalPublicLolSnapshotStore(directory);
  const fetchedAt = "2026-08-03T00:00:00.000Z";
  await store.save({
    key: "hideonbush#kr1",
    puuid: "public-puuid",
    fetchedAt,
    payload: { status: "ready", fetchedAt }
  });

  const filePath = join(directory, readdirSync(directory)[0]);
  const persisted = JSON.parse(readFileSync(filePath, "utf8"));
  persisted.payload.status = "tampered";
  writeFileSync(filePath, JSON.stringify(persisted), "utf8");

  assert.equal(await store.load("hideonbush#kr1"), undefined);
});
