import test from "node:test";
import assert from "node:assert/strict";
import {
  PATCH_PLAY_SAMPLE_LIMIT,
  parsePatchPlaySummary,
  patchKeyFromDataDragonVersion,
  patchKeyFromGameVersion,
  patchPlayRecords
} from "../dist/index.js";

const summary = {
  schemaVersion: 1,
  gameName: "YORO",
  tagLine: "KR1",
  lolPlatform: "kr",
  sampledMatches: 7,
  fetchedAt: "2026-08-09T00:00:00.000Z",
  patches: [
    { patchKey: "16.15", games: 3, wins: 2, winRate: 66.7 },
    { patchKey: "16.14", games: 4, wins: 1, winRate: 25 }
  ]
};

test("경기의 gameVersion 을 패치 열쇠로 바꾼다", () => {
  // 실측값입니다.
  assert.equal(patchKeyFromGameVersion("16.12.788.4269"), "16.12");
  assert.equal(patchKeyFromGameVersion("16.7.760.9485"), "16.7");
  assert.equal(patchKeyFromGameVersion("16.5.752.7101"), "16.5");
  assert.equal(patchKeyFromGameVersion("16.15"), "16.15");
  for (const bad of ["", "16", "abc", undefined, null, 16.15]) {
    assert.equal(patchKeyFromGameVersion(bad), undefined, String(bad));
  }
});

test("패치 노트의 Data Dragon 버전도 같은 열쇠가 된다", () => {
  // 이 한 줄이 노트와 전적을 잇습니다.
  assert.equal(patchKeyFromDataDragonVersion("16.15.1"), "16.15");
  assert.equal(patchKeyFromGameVersion("16.15.788.4269"), patchKeyFromDataDragonVersion("16.15.1"));
});

test("같은 패치의 다른 build 는 한 칸으로 묶인다", () => {
  const records = patchPlayRecords([
    { gameVersion: "16.15.788.4269", won: true },
    { gameVersion: "16.15.760.5228", won: true },
    { gameVersion: "16.15.760.5228", won: false },
    { gameVersion: "16.14.760.9485", won: false }
  ]);
  assert.deepEqual(records, [
    { patchKey: "16.15", games: 3, wins: 2, winRate: 66.7 },
    { patchKey: "16.14", games: 1, wins: 0, winRate: 0 }
  ]);
});

test("승패나 버전을 모르는 경기는 세지 않는다", () => {
  assert.deepEqual(patchPlayRecords([
    { gameVersion: "16.15.788.4269" },
    { won: true },
    { gameVersion: undefined, won: false },
    { gameVersion: "16.15.788.4269", won: null }
  ]), []);
});

test("최신 패치가 먼저 오고 숫자로 정렬한다", () => {
  const records = patchPlayRecords([
    { gameVersion: "16.9.1.1", won: true },
    { gameVersion: "16.10.1.1", won: true },
    { gameVersion: "17.1.1.1", won: true }
  ]);
  // 문자열로 비교하면 "16.9" 가 "16.10" 보다 뒤로 갑니다.
  assert.deepEqual(records.map((record) => record.patchKey), ["17.1", "16.10", "16.9"]);
});

test("정상 요약을 통과시킨다", () => {
  const parsed = parsePatchPlaySummary(summary);
  assert.ok(parsed);
  assert.equal(parsed.patches.length, 2);
  assert.equal(parsed.patches[0].winRate, 66.7);
});

test("앞뒤가 맞지 않는 요약은 통째로 버린다", () => {
  // 이긴 판이 전체보다 많을 수 없습니다.
  assert.equal(parsePatchPlaySummary({
    ...summary,
    patches: [{ patchKey: "16.15", games: 2, wins: 3, winRate: 150 }]
  }), undefined);
  // 승률이 승/판과 어긋나면 화면이 틀린 숫자를 보여 주게 됩니다.
  assert.equal(parsePatchPlaySummary({
    ...summary,
    patches: [{ patchKey: "16.15", games: 2, wins: 1, winRate: 90 }]
  }), undefined);
  // 패치별 합계가 표본보다 클 수 없습니다.
  assert.equal(parsePatchPlaySummary({ ...summary, sampledMatches: 3 }), undefined);
  // 같은 패치가 두 번 나올 수 없습니다.
  assert.equal(parsePatchPlaySummary({
    ...summary,
    sampledMatches: 6,
    patches: [
      { patchKey: "16.15", games: 3, wins: 2, winRate: 66.7 },
      { patchKey: "16.15", games: 3, wins: 2, winRate: 66.7 }
    ]
  }), undefined);
  assert.equal(parsePatchPlaySummary({
    ...summary,
    sampledMatches: PATCH_PLAY_SAMPLE_LIMIT + 1
  }), undefined);
  assert.equal(parsePatchPlaySummary({ ...summary, schemaVersion: 2 }), undefined);
  assert.equal(parsePatchPlaySummary({ ...summary, gameName: "" }), undefined);
  // 모르는 key 가 섞이면 통과시키지 않습니다.
  assert.equal(parsePatchPlaySummary({ ...summary, extra: 1 }), undefined);
  assert.equal(parsePatchPlaySummary({ ...summary, patches: [{ patchKey: "16", games: 1, wins: 1, winRate: 100 }] }), undefined);
});

test("경기가 없어도 요약 자체는 유효하다", () => {
  const parsed = parsePatchPlaySummary({ ...summary, sampledMatches: 0, patches: [] });
  assert.ok(parsed);
  assert.deepEqual(parsed.patches, []);
});
