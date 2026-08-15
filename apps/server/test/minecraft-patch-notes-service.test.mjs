import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const {
  LocalMinecraftPatchSnapshotStore,
  MinecraftPatchNotesService,
  mergeMinecraftPatchCuration,
  parseMinecraftPatchCuration,
  parseMinecraftPatchNotesQuery
} = await import("../dist/services/minecraft-patch-notes-service.js");

function sourceEntry(id, type, releaseTime) {
  return {
    id,
    type,
    url: `https://piston-meta.mojang.com/v1/packages/${"b".repeat(40)}/${id}.json`,
    time: releaseTime,
    releaseTime,
    sha1: "b".repeat(40),
    complianceLevel: 1
  };
}

function manifestResponse() {
  return new Response(JSON.stringify({
    latest: { release: "26.2", snapshot: "26.3-snapshot-8" },
    versions: [
      sourceEntry("26.3-snapshot-8", "snapshot", "2026-08-12T09:39:37Z"),
      sourceEntry("26.2", "release", "2026-06-16T09:00:00Z")
    ]
  }), { headers: { "content-type": "application/json" } });
}

const curation = parseMinecraftPatchCuration({
  schemaVersion: 1,
  java: {
    "26.3-snapshot-8": {
      title: { ko: "사람이 작성한 스냅샷 요약", ja: "人が作成したスナップショット要約" },
      highlights: [{ ko: "검수한 핵심 변경", ja: "確認済みの主な変更" }]
    }
  },
  bedrock: {}
});

test("큐레이션은 version 키가 일치하는 엔트리에만 병합한다", () => {
  const entries = [
    {
      id: "java-26.3-snapshot-8",
      edition: "java",
      version: "26.3-snapshot-8",
      type: "snapshot",
      publishedAt: "2026-08-12T09:39:37.000Z",
      officialUrl: "https://www.minecraft.net/en-us/articles"
    },
    {
      id: "java-26.2",
      edition: "java",
      version: "26.2",
      type: "release",
      publishedAt: "2026-06-16T09:00:00.000Z",
      officialUrl: "https://www.minecraft.net/en-us/articles"
    }
  ];
  const merged = mergeMinecraftPatchCuration(entries, curation);
  assert.equal(merged[0].title.ko, "사람이 작성한 스냅샷 요약");
  assert.equal(merged[1].title, undefined);
  assert.equal(entries[0].title, undefined, "원천 snapshot을 변경하지 않습니다.");
});

test("큐레이션 저장소는 unknown field·불완전 ko/ja·빈 요약을 거부한다", () => {
  for (const invalid of [
    { schemaVersion: 1, java: {}, bedrock: {}, extra: true },
    { schemaVersion: 1, java: { "26.2": { title: { ko: "한국어만" } } }, bedrock: {} },
    { schemaVersion: 1, java: { "26.2": {} }, bedrock: {} }
  ]) assert.throws(() => parseMinecraftPatchCuration(invalid));
});

test("strict query는 allowlist·중복·형식 오류를 거부한다", () => {
  assert.deepEqual(
    parseMinecraftPatchNotesQuery(new URLSearchParams("edition=java&type=release&page=2")),
    { edition: "java", type: "release", page: 2 }
  );
  for (const query of [
    "",
    "edition=unknown",
    "edition=java&edition=bedrock",
    "edition=java&type=beta",
    "edition=java&page=0",
    "edition=java&page=01",
    "edition=java&limit=100"
  ]) assert.throws(() => parseMinecraftPatchNotesQuery(new URLSearchParams(query)), query);
});

test("수집 성공본을 큐레이션과 병합하고 유형별 pagination을 반환한다", async () => {
  let calls = 0;
  const service = new MinecraftPatchNotesService({
    curation,
    fetchImpl: async () => {
      calls += 1;
      return manifestResponse();
    },
    sleepImpl: async () => undefined
  });
  const response = await service.page(new URLSearchParams("edition=java&type=snapshot&page=1"));
  assert.equal(response.state, "ready");
  assert.equal(response.entries.length, 1);
  assert.equal(response.entries[0].type, "snapshot");
  assert.equal(response.entries[0].title.ko, "사람이 작성한 스냅샷 요약");
  assert.deepEqual(response.pagination, { page: 1, totalPages: 1, hasNextPage: false, total: 1 });
  assert.equal(service.hasReadyData(), true);
  await service.page(new URLSearchParams("edition=java"));
  assert.equal(calls, 1, "갱신 주기 안에서는 upstream을 다시 호출하지 않습니다.");
});

test("Bedrock은 공식 피드가 없으므로 호출 없이 data_unavailable을 반환한다", async () => {
  let calls = 0;
  const service = new MinecraftPatchNotesService({
    fetchImpl: async () => {
      calls += 1;
      return manifestResponse();
    }
  });
  assert.deepEqual(await service.page(new URLSearchParams("edition=bedrock")), {
    state: "data_unavailable"
  });
  assert.equal(calls, 0);
});

test("갱신 실패 시 마지막 정상 snapshot을 유지하고 재시작 뒤에도 복구한다", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "yoro-minecraft-patches-"));
  let now = Date.UTC(2026, 7, 15);
  let fail = false;
  try {
    const store = new LocalMinecraftPatchSnapshotStore(directory);
    const writer = new MinecraftPatchNotesService({
      store,
      fetchImpl: async () => {
        if (fail) throw new Error("network down");
        return manifestResponse();
      },
      sleepImpl: async () => undefined,
      now: () => now,
      refreshIntervalMs: 1_000
    });
    const fresh = await writer.page(new URLSearchParams("edition=java"));
    assert.equal(fresh.state, "ready");
    fail = true;
    now += 2_000;
    const stale = await writer.page(new URLSearchParams("edition=java"));
    assert.deepEqual(stale, fresh);

    const reader = new MinecraftPatchNotesService({
      store,
      fetchImpl: async () => { throw new Error("network down"); },
      sleepImpl: async () => undefined
    });
    const restored = await reader.page(new URLSearchParams("edition=java"));
    assert.equal(restored.state, "ready");
    assert.equal(restored.entries.length, 2);

    writeFileSync(path.join(directory, "java.json"), "{ broken");
    const broken = new MinecraftPatchNotesService({
      store,
      fetchImpl: async () => { throw new Error("network down"); },
      sleepImpl: async () => undefined
    });
    assert.deepEqual(await broken.page(new URLSearchParams("edition=java")), {
      state: "data_unavailable"
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
