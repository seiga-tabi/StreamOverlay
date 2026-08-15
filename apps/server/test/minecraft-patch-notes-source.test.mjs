import test from "node:test";
import assert from "node:assert/strict";

const {
  MINECRAFT_JAVA_PATCH_NOTES_HUB_URL,
  MINECRAFT_JAVA_VERSION_MANIFEST_URL,
  fetchMinecraftJavaPatchEntries,
  minecraftJavaPatchEntriesFromManifest
} = await import("../dist/services/minecraft-patch-notes-source.js");

function sourceEntry(id, type, releaseTime) {
  return {
    id,
    type,
    url: `https://piston-meta.mojang.com/v1/packages/${"a".repeat(40)}/${id}.json`,
    time: releaseTime,
    releaseTime,
    sha1: "a".repeat(40),
    complianceLevel: 1
  };
}

function manifest() {
  return {
    latest: { release: "26.2", snapshot: "26.3-snapshot-8" },
    versions: [
      sourceEntry("26.2", "release", "2026-06-16T09:00:00+00:00"),
      sourceEntry("b1.8.1", "old_beta", "2011-09-19T00:00:00+00:00"),
      sourceEntry("26.3-snapshot-8", "snapshot", "2026-08-12T09:39:37+00:00"),
      sourceEntry("25w42a", "snapshot", "2025-10-14T12:00:00+00:00")
    ]
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("Mojang Java manifest를 계약 형식으로 바꾸고 발행일 내림차순으로 정렬한다", () => {
  const entries = minecraftJavaPatchEntriesFromManifest(manifest());
  assert.deepEqual(entries.map((entry) => entry.version), ["26.3-snapshot-8", "26.2", "25w42a"]);
  assert.deepEqual(entries.map((entry) => entry.type), ["snapshot", "release", "snapshot"]);
  assert.equal(entries[0].publishedAt, "2026-08-12T09:39:37.000Z");
  assert.equal(entries[0].officialUrl, MINECRAFT_JAVA_PATCH_NOTES_HUB_URL);
  assert.equal(entries[0].title, undefined, "기계 요약을 생성하지 않습니다.");
});

test("Java 수집 URL은 외부 입력과 무관한 Mojang 공식 endpoint로 고정한다", () => {
  assert.equal(
    MINECRAFT_JAVA_VERSION_MANIFEST_URL,
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
  );
});

test("현재 release/snapshot 엔트리가 손상되면 부분 결과 대신 fail-closed한다", () => {
  const tampered = manifest();
  tampered.versions[0].url = "https://evil.example/release.json";
  assert.throws(
    () => minecraftJavaPatchEntriesFromManifest(tampered),
    /MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID/u
  );
  assert.throws(
    () => minecraftJavaPatchEntriesFromManifest({ versions: [] }),
    /MINECRAFT_JAVA_MANIFEST_SIZE_INVALID/u
  );
});

test("일시적인 upstream 오류는 제한된 횟수만 재시도한다", async () => {
  let calls = 0;
  const sleeps = [];
  const entries = await fetchMinecraftJavaPatchEntries({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 503);
      if (calls === 2) return jsonResponse({}, 429);
      return jsonResponse(manifest());
    },
    sleepImpl: async (delay) => { sleeps.push(delay); }
  });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [250, 500]);
  assert.equal(entries.length, 3);
});

test("재시도해도 의미 없는 4xx와 크기 초과 응답은 즉시 거부한다", async () => {
  let calls = 0;
  await assert.rejects(
    fetchMinecraftJavaPatchEntries({
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({}, 404);
      },
      sleepImpl: async () => undefined
    }),
    /MINECRAFT_JAVA_MANIFEST_STATUS_404/u
  );
  assert.equal(calls, 1);
  await assert.rejects(
    fetchMinecraftJavaPatchEntries({
      fetchImpl: async () => new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(3 * 1024 * 1024)
        }
      })
    }),
    /MINECRAFT_JAVA_MANIFEST_TOO_LARGE/u
  );
});
