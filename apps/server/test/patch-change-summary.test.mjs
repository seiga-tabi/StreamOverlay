import test from "node:test";
import assert from "node:assert/strict";

/* 패치 변경 요약 — docs/mockups/lol-patch-summary-share.html v1.2 §④ 계약.
 *
 * 픽스처 값은 실측(2026-08-18, Data Dragon 16.15.1 → 16.16.1)에서 가져왔습니다:
 * 마법 저항력 30→33(27명), 레벨당 마저 1.3→1.1(28명), 뽀삐 mp 280→300 등,
 * 태양불꽃 방패 2700→2800. */

const {
  PATCH_SYSTEM_CHANGE_MIN_CHAMPIONS,
  PatchChangeSummaryService,
  buildPatchChangeSummary,
  championChangeDirection,
  comparedVersionsForPatch,
} = await import("../dist/services/patch-change-summary.js");

function note(patchVersion, dataDragonVersion) {
  return {
    slug: `patch-${patchVersion}`,
    title: `패치 ${patchVersion}`,
    publishedAt: "2026-08-18T00:00:00.000Z",
    url: `https://example.test/${patchVersion}`,
    patchVersion,
    ...(dataDragonVersion === undefined ? {} : { dataDragonVersion }),
  };
}

const NOTES = [note("26.16", "16.16.1"), note("26.15", "16.15.1"), note("26.14", "16.14.1")];

function statsMap(entries) {
  return new Map(entries.map(([championId, stats]) => [championId, stats]));
}

function namesMap(entries) {
  return new Map(entries.map(([id, name]) => [id, { name, iconUrl: `https://ddragon.test/${id}.png` }]));
}

test("비교 버전은 해당 패치와 직전 패치의 dataDragonVersion 쌍이다", () => {
  /* 날짜로 추측하지 않습니다 — 노트가 주는 값만 씁니다. */
  assert.deepEqual(comparedVersionsForPatch(NOTES, "26.16"), ["16.15.1", "16.16.1"]);
  assert.deepEqual(comparedVersionsForPatch(NOTES, "26.15"), ["16.14.1", "16.15.1"]);

  /* 목록 순서가 뒤섞여 와도 패치 번호로 정렬해 직전 노트를 고릅니다. */
  assert.deepEqual(comparedVersionsForPatch([...NOTES].reverse(), "26.16"), ["16.15.1", "16.16.1"]);

  /* 가장 오래된 노트는 직전이 없어 비교가 성립하지 않습니다. */
  assert.equal(comparedVersionsForPatch(NOTES, "26.14"), undefined);
  /* 목록에 없는 패치. */
  assert.equal(comparedVersionsForPatch(NOTES, "26.99"), undefined);
  /* 한쪽 버전이 비면 비교하지 않습니다. */
  assert.equal(comparedVersionsForPatch([note("26.16"), note("26.15", "16.15.1")], "26.16"), undefined);
  assert.equal(comparedVersionsForPatch([note("26.16", "16.16.1"), note("26.15")], "26.16"), undefined);
});

test("5명 이상이 같은 변경을 받으면 시스템 변경으로 묶고 개별 목록에서 뺀다", () => {
  const shared = { spellblock: 30, spellblockperlevel: 1.3 };
  const sharedAfter = { spellblock: 33, spellblockperlevel: 1.1 };
  const previous = statsMap([
    [1, { ...shared }], [2, { ...shared }], [3, { ...shared }],
    [4, { ...shared }], [5, { ...shared }],
    /* 6번은 시스템 변경에 더해 자기 스탯도 바뀝니다. */
    [6, { ...shared, mp: 280 }],
    /* 7번은 4명짜리 묶음이라 시스템 변경이 되지 못합니다. */
    [7, { attackdamage: 60 }], [8, { attackdamage: 60 }], [9, { attackdamage: 60 }], [10, { attackdamage: 60 }],
  ]);
  const current = statsMap([
    [1, { ...sharedAfter }], [2, { ...sharedAfter }], [3, { ...sharedAfter }],
    [4, { ...sharedAfter }], [5, { ...sharedAfter }],
    [6, { ...sharedAfter, mp: 300 }],
    [7, { attackdamage: 56 }], [8, { attackdamage: 56 }], [9, { attackdamage: 56 }], [10, { attackdamage: 56 }],
  ]);

  const summary = buildPatchChangeSummary({
    patchVersion: "26.16",
    comparedVersions: ["16.15.1", "16.16.1"],
    previousChampionStats: previous,
    currentChampionStats: current,
    previousItemGold: new Map(),
    currentItemGold: new Map(),
    championNames: namesMap([[1, "가렌"], [2, "다리우스"], [3, "잭스"], [4, "리븐"], [5, "이렐리아"],
      [6, "뽀삐"], [7, "베인"], [8, "케이틀린"], [9, "이즈리얼"], [10, "징크스"]]),
    itemNames: new Map(),
  });

  assert.equal(PATCH_SYSTEM_CHANGE_MIN_CHAMPIONS, 5);
  assert.deepEqual(summary.systemChanges, [
    { stat: "spellblock", from: 30, to: 33, championCount: 6 },
    { stat: "spellblockperlevel", from: 1.3, to: 1.1, championCount: 6 },
  ]);

  /* 묶인 6명 중 자기 변경이 따로 있는 뽀삐만 개별 목록에 남습니다. */
  const poppy = summary.championChanges.find((champion) => champion.championId === 6);
  assert.deepEqual(poppy.changes, [{ stat: "mp", from: 280, to: 300 }]);
  assert.equal(poppy.name, "뽀삐");
  for (const championId of [1, 2, 3, 4, 5]) {
    assert.equal(summary.championChanges.some((champion) => champion.championId === championId), false, String(championId));
  }
  /* 4명짜리 공격력 변경은 묶이지 않고 개별로 남습니다. */
  assert.equal(summary.championChanges.filter((champion) => champion.championId >= 7).length, 4);
  assert.equal(summary.skillChangesIncluded, false);
});

test("방향은 스탯별 표로 판정하고 상충하면 adjust 다", () => {
  assert.equal(championChangeDirection([{ stat: "hp", from: 600, to: 650 }]), "buff");
  assert.equal(championChangeDirection([{ stat: "armor", from: 30, to: 28 }]), "nerf");
  /* 실측: 뽀삐는 마나·마나재생이 오르고 공격력이 내렸습니다. */
  assert.equal(championChangeDirection([
    { stat: "mp", from: 280, to: 300 },
    { stat: "attackdamage", from: 60, to: 56 },
  ]), "adjust");
  /* 방향을 모르는 키만 있으면 단정하지 않습니다. */
  assert.equal(championChangeDirection([{ stat: "unknownstat", from: 1, to: 2 }]), "adjust");
  /* 모르는 키가 섞여도 아는 키의 방향은 살아 있습니다. */
  assert.equal(championChangeDirection([
    { stat: "unknownstat", from: 1, to: 2 },
    { stat: "hp", from: 600, to: 650 },
  ]), "buff");
});

test("아이템은 가격 변경·신규·삭제를 구분한다", () => {
  const summary = buildPatchChangeSummary({
    patchVersion: "26.16",
    comparedVersions: ["16.15.1", "16.16.1"],
    previousChampionStats: new Map(),
    currentChampionStats: new Map(),
    previousItemGold: new Map([[3068, 2700], [9999, 1000]]),
    currentItemGold: new Map([[3068, 2800], [3070, 400]]),
    championNames: new Map(),
    itemNames: namesMap([[3068, "태양불꽃 방패"], [3070, "신규 아이템"], [9999, "사라진 아이템"]]),
  });
  assert.deepEqual(summary.itemChanges.map((item) => [item.itemId, item.kind, item.from, item.to]), [
    [3068, "price", 2700, 2800],
    [3070, "new", undefined, undefined],
    [9999, "removed", undefined, undefined],
  ]);
  assert.equal(summary.itemChanges[0].name, "태양불꽃 방패");
  assert.ok(summary.itemChanges[0].iconUrl);
});

test("변경이 없으면 요약을 만들지 않는다", () => {
  const same = statsMap([[1, { hp: 600 }]]);
  assert.equal(buildPatchChangeSummary({
    patchVersion: "26.16",
    comparedVersions: ["16.15.1", "16.16.1"],
    previousChampionStats: same,
    currentChampionStats: statsMap([[1, { hp: 600 }]]),
    previousItemGold: new Map([[3068, 2700]]),
    currentItemGold: new Map([[3068, 2700]]),
    championNames: namesMap([[1, "가렌"]]),
    itemNames: namesMap([[3068, "태양불꽃 방패"]]),
  }), undefined);

  /* 신규 챔피언은 "변경"이 아닙니다 — 비교 대상이 없습니다. */
  assert.equal(buildPatchChangeSummary({
    patchVersion: "26.16",
    comparedVersions: ["16.15.1", "16.16.1"],
    previousChampionStats: new Map(),
    currentChampionStats: statsMap([[999, { hp: 600 }]]),
    previousItemGold: new Map(),
    currentItemGold: new Map(),
    championNames: namesMap([[999, "신규 챔피언"]]),
    itemNames: new Map(),
  }), undefined);

  /* 이름을 모르는 항목은 화면에 올릴 수 없으므로 빠집니다. */
  assert.equal(buildPatchChangeSummary({
    patchVersion: "26.16",
    comparedVersions: ["16.15.1", "16.16.1"],
    previousChampionStats: statsMap([[1, { hp: 600 }]]),
    currentChampionStats: statsMap([[1, { hp: 650 }]]),
    previousItemGold: new Map(),
    currentItemGold: new Map(),
    championNames: new Map(),
    itemNames: new Map(),
  }), undefined);
});

test("요약은 패치·언어별로 캐시되고 없다는 사실도 캐시한다", async () => {
  let championStatsCalls = 0;
  let notesCalls = 0;
  const deps = {
    notesFor: async () => {
      notesCalls += 1;
      return NOTES;
    },
    championStats: async (version) => {
      championStatsCalls += 1;
      return version === "16.16.1" ? statsMap([[1, { hp: 650 }]]) : statsMap([[1, { hp: 600 }]]);
    },
    itemGold: async () => new Map(),
    championNames: async (_version, locale) => namesMap([[1, locale === "ja" ? "ガレン" : "가렌"]]),
    itemNames: async () => new Map(),
  };
  const service = new PatchChangeSummaryService(deps);

  const first = await service.summaryFor("26.16", "ko");
  assert.equal(first.championChanges[0].name, "가렌");
  assert.equal(championStatsCalls, 2, "두 버전을 한 번씩만 받습니다");

  await service.summaryFor("26.16", "ko");
  assert.equal(championStatsCalls, 2, "같은 패치·언어는 캐시에서 나옵니다");

  const ja = await service.summaryFor("26.16", "ja");
  assert.equal(ja.championChanges[0].name, "ガレン", "언어가 다르면 따로 계산합니다");

  /* 요약이 성립하지 않는 패치도 캐시합니다 — 없다는 것을 확인하려고 매번
     Data Dragon 을 두 판씩 내려받지 않습니다. */
  const callsBeforeMiss = championStatsCalls;
  assert.equal(await service.summaryFor("26.14", "ko"), undefined);
  const notesAfterMiss = notesCalls;
  assert.equal(await service.summaryFor("26.14", "ko"), undefined);
  assert.equal(notesCalls, notesAfterMiss, "없음도 캐시합니다");
  assert.equal(championStatsCalls, callsBeforeMiss, "비교 경계가 없으면 Data Dragon 을 받지 않습니다");
});

test("동시에 같은 요약을 요청해도 한 번만 계산한다", async () => {
  let calls = 0;
  const service = new PatchChangeSummaryService({
    notesFor: async () => NOTES,
    championStats: async (version) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return version === "16.16.1" ? statsMap([[1, { hp: 650 }]]) : statsMap([[1, { hp: 600 }]]);
    },
    itemGold: async () => new Map(),
    championNames: async () => namesMap([[1, "가렌"]]),
    itemNames: async () => new Map(),
  });
  const [a, b] = await Promise.all([service.summaryFor("26.16", "ko"), service.summaryFor("26.16", "ko")]);
  assert.equal(a, b);
  assert.equal(calls, 2, "두 버전 각 1회 — 요청이 겹쳐도 중복 계산하지 않습니다");
});
