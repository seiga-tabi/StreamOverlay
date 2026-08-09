import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchPatchNotes,
  patchNoteSourceUrl,
  patchNotesFromSourceHtml
} from "../dist/services/patch-notes-source.js";
import { LocalPatchNotesFeedStore, PatchNotesService } from "../dist/services/patch-notes-service.js";

const fixtureDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const koHtml = readFileSync(path.join(fixtureDirectory, "patch-notes-ko.html"), "utf8");
const jaHtml = readFileSync(path.join(fixtureDirectory, "patch-notes-ja.html"), "utf8");
const DDRAGON_VERSIONS = ["16.15.1", "16.14.1", "16.13.1"];

function htmlResponse(html, init = {}) {
  return new Response(html, { status: 200, headers: { "content-type": "text/html" }, ...init });
}

test("목록 페이지에서 카드 값을 그대로 옮긴다", () => {
  const notes = patchNotesFromSourceHtml(koHtml, DDRAGON_VERSIONS);
  assert.equal(notes.length, 3);
  assert.deepEqual(notes[0], {
    slug: "league-of-legends-patch-26-15-notes",
    title: "리그 오브 레전드 26.15 패치 노트",
    summary: "시즌 3가 시작됩니다. 그런데... 몇 년도죠?!",
    publishedAt: "2026-07-28T18:00:00.000Z",
    patchVersion: "26.15",
    dataDragonVersion: "16.15.1",
    url: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-15-notes",
    imageUrl: notes[0].imageUrl,
    /* Riot 이 썸네일에서 뽑아 함께 주는 값입니다. 우리가 계산하지 않습니다. */
    accentColor: "#341a1c"
  });
  assert.match(notes[0].imageUrl, /^https:\/\/cmsassets\.rgpub\.io\//u);
  /* 최신순이 유지되어야 화면이 다시 정렬하지 않습니다. */
  assert.ok(notes[0].publishedAt > notes[1].publishedAt);
});

test("일본어 목록도 같은 slug 로 이어진다", () => {
  const ko = patchNotesFromSourceHtml(koHtml, DDRAGON_VERSIONS);
  const ja = patchNotesFromSourceHtml(jaHtml, DDRAGON_VERSIONS);
  assert.deepEqual(ja.map((note) => note.slug), ko.map((note) => note.slug));
  assert.equal(ja[0].title, "リーグ・オブ・レジェンド パッチノート 26.15");
  assert.match(ja[0].url, /\/ja-jp\//u);
});

test("Data Dragon 버전을 몰라도 나머지는 그대로 수집한다", () => {
  const notes = patchNotesFromSourceHtml(koHtml, []);
  assert.equal(notes.length, 3);
  assert.equal(notes[0].dataDragonVersion, undefined);
  assert.equal(notes[0].patchVersion, "26.15");
});

test("외부 도메인으로 향하는 카드는 버린다", () => {
  const tampered = koHtml
    .replace('"/ko-kr/news/game-updates/league-of-legends-patch-26-15-notes"', '"https://evil.example/steal"')
    .replaceAll("https://cmsassets.rgpub.io", "https://evil.example");
  const notes = patchNotesFromSourceHtml(tampered, DDRAGON_VERSIONS);
  /* 링크가 바뀐 1건은 사라지고, 썸네일이 바뀐 나머지도 통째로 버려집니다. */
  assert.equal(notes.length, 0);
});

test("구조가 바뀌거나 비면 빈 목록을 돌려준다", () => {
  assert.deepEqual(patchNotesFromSourceHtml("<html></html>", []), []);
  assert.deepEqual(patchNotesFromSourceHtml('<script id="__NEXT_DATA__" type="application/json">{oops</script>', []), []);
  assert.deepEqual(
    patchNotesFromSourceHtml('<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>', []),
    []
  );
});

test("수집 URL 은 두 개로 고정되어 있다", () => {
  assert.equal(patchNoteSourceUrl("ko"), "https://www.leagueoflegends.com/ko-kr/news/tags/patch-notes/");
  assert.equal(patchNoteSourceUrl("ja"), "https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes/");
});

test("응답이 비정상이면 캐시를 덮지 않도록 실패시킨다", async () => {
  await assert.rejects(
    fetchPatchNotes("ko", { fetchImpl: async () => new Response("", { status: 503 }) }),
    /PATCH_NOTES_SOURCE_STATUS_503/u
  );
  await assert.rejects(
    fetchPatchNotes("ko", { fetchImpl: async () => htmlResponse("<html></html>") }),
    /PATCH_NOTES_SOURCE_EMPTY/u
  );
});

test("본문이 상한을 넘으면 끝까지 읽지 않는다", async () => {
  const huge = `${koHtml}${"a".repeat(4_000_000)}`;
  await assert.rejects(
    fetchPatchNotes("ko", { fetchImpl: async () => htmlResponse(huge) }),
    /PATCH_NOTES_SOURCE_TOO_LARGE/u
  );
});

test("성공하면 캐시하고 같은 응답을 다시 받아오지 않는다", async () => {
  let calls = 0;
  const service = new PatchNotesService({
    fetchImpl: async () => {
      calls += 1;
      return htmlResponse(koHtml);
    },
    dataDragonVersions: DDRAGON_VERSIONS
  });
  const first = await service.getFeed("ko");
  const second = await service.getFeed("ko");
  assert.equal(calls, 1);
  assert.equal(first.stale, false);
  assert.equal(second.notes.length, 3);
  assert.equal(second.locale, "ko");
});

test("수집에 실패하면 마지막 성공본을 stale 로 내보낸다", async () => {
  let now = Date.UTC(2026, 7, 9);
  let fail = false;
  const service = new PatchNotesService({
    fetchImpl: async () => {
      if (fail) throw new Error("network down");
      return htmlResponse(koHtml);
    },
    dataDragonVersions: DDRAGON_VERSIONS,
    now: () => now,
    refreshIntervalMs: 1_000
  });
  const fresh = await service.getFeed("ko");
  assert.equal(fresh.stale, false);

  fail = true;
  now += 2_000;
  const stale = await service.getFeed("ko");
  assert.equal(stale.stale, true);
  assert.equal(stale.notes.length, 3);
  /* 저장본의 수집 시각은 그대로여야 화면이 언제 것인지 말할 수 있습니다. */
  assert.equal(stale.fetchedAt, fresh.fetchedAt);
});

test("원문이 죽어 있으면 요청마다 다시 찌르지 않는다", async () => {
  let now = Date.UTC(2026, 7, 9);
  let calls = 0;
  let fail = false;
  const service = new PatchNotesService({
    fetchImpl: async () => {
      calls += 1;
      if (fail) throw new Error("network down");
      return htmlResponse(koHtml);
    },
    dataDragonVersions: DDRAGON_VERSIONS,
    now: () => now,
    refreshIntervalMs: 1_000
  });
  await service.getFeed("ko");
  fail = true;
  now += 2_000;
  await service.getFeed("ko");
  const afterFirstFailure = calls;
  now += 1_000;
  await service.getFeed("ko");
  await service.getFeed("ko");
  assert.equal(calls, afterFirstFailure, "backoff 안에서는 다시 요청하지 않는다");
});

test("한 번도 못 받아왔으면 undefined 로 알린다", async () => {
  const service = new PatchNotesService({
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });
  assert.equal(await service.getFeed("ko"), undefined);
});

test("Data Dragon 버전 조회가 실패해도 패치 노트는 나온다", async () => {
  const service = new PatchNotesService({
    fetchImpl: async () => htmlResponse(koHtml),
    dataDragonVersionsProvider: async () => {
      throw new Error("ddragon down");
    }
  });
  const feed = await service.getFeed("ko");
  assert.equal(feed.notes.length, 3);
  assert.equal(feed.notes[0].dataDragonVersion, undefined);
});

test("마지막 성공본은 디스크에 남아 재기동 뒤에도 쓰인다", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "streamops-patch-notes-"));
  try {
    const store = new LocalPatchNotesFeedStore(directory);
    const writer = new PatchNotesService({
      store,
      fetchImpl: async () => htmlResponse(koHtml),
      dataDragonVersions: DDRAGON_VERSIONS
    });
    await writer.getFeed("ko");

    const reader = new PatchNotesService({
      store,
      fetchImpl: async () => {
        throw new Error("network down");
      }
    });
    const restored = await reader.getFeed("ko");
    assert.equal(restored.notes.length, 3);
    assert.equal(restored.stale, true, "저장본은 언제나 stale 로 표시한다");

    /* 손상된 저장본은 조용히 무시합니다. */
    writeFileSync(path.join(directory, "ja.json"), "{ broken");
    assert.equal(await store.load("ja"), undefined);
    /* 다른 언어 파일에 들어 있는 목록은 쓰지 않습니다. */
    writeFileSync(path.join(directory, "ja.json"), readFileSync(path.join(directory, "ko.json"), "utf8"));
    assert.equal(await store.load("ja"), undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
