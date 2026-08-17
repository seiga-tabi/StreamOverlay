import assert from "node:assert/strict";
import test from "node:test";

import {
  SIGNATURE_BUILD_MAX_CHAMPIONS,
  SIGNATURE_BUILD_MIN_GAMES,
  isBootItem,
  signatureBuilds
} from "../src/features/public-lol/utils/match";
import type { PublicLolProfile, PublicLolRecentMatch } from "../src/features/public-lol/types/public-lol";

function champion(championId: number, nameKo: string, mastery?: { level: number; points: number }) {
  return {
    championId,
    championKey: `Champ${championId}`,
    nameKo,
    ...(mastery ? { masteryLevel: mastery.level, masteryPoints: mastery.points } : {})
  };
}

let seq = 0;
function match(
  championId: number,
  win: boolean,
  runePage: { keystone: number; primary: number; secondary: number } | undefined,
  itemIds: number[]
): PublicLolRecentMatch {
  seq += 1;
  return {
    matchId: `KR_${seq}`,
    champion: champion(championId, `챔피언${championId}`),
    result: win ? "win" : "loss",
    kills: 5, deaths: 3, assists: 7, kda: 4,
    items: itemIds.map((itemId, slot) => ({ slot, itemId, nameKo: `아이템${itemId}` })),
    summonerSpells: [],
    runes: runePage
      ? [
          { runeId: runePage.keystone, kind: "primary", category: "keystone", nameKo: `킵${runePage.keystone}` },
          { runeId: runePage.primary, kind: "primary", category: "style", nameKo: `주${runePage.primary}` },
          { runeId: runePage.secondary, kind: "secondary", category: "style", nameKo: `부${runePage.secondary}` }
        ]
      : [],
    teams: []
  } as unknown as PublicLolRecentMatch;
}

function profileWith(overrides: Partial<PublicLolProfile>): PublicLolProfile {
  return {
    status: "ready",
    riotId: "QA#KR1", gameName: "QA", tagLine: "KR1",
    accountRegion: "asia", lolPlatform: "kr",
    topChampions: [], recentMatches: [],
    recentMatchStart: 0, hasMoreRecentMatches: false,
    summary: { recentGames: 0, recentWins: 0, recentWinRate: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0 },
    championPerformance: [], rolePerformance: [],
    fetchedAt: "2026-08-17T00:00:00.000Z",
    ...overrides
  } as PublicLolProfile;
}

const ELECTROCUTE = { keystone: 8112, primary: 8100, secondary: 8200 };
const COMET = { keystone: 8229, primary: 8200, secondary: 8100 };

test("signatureBuilds: 룬 페이지별로 게임을 나누고 그룹 안에서만 아이템 채용률을 집계한다", () => {
  const profile = profileWith({
    topChampions: [champion(103, "아리", { level: 7, points: 523_341 })],
    recentMatches: [
      // 감전 6게임 — 루덴(3020 신발 포함) 위주
      ...Array.from({ length: 6 }, (_, i) => match(103, i < 4, ELECTROCUTE, [3020, 6655, 4645])),
      // 유성 3게임 — 모렐로 위주(감전 게임엔 없는 아이템)
      ...Array.from({ length: 3 }, (_, i) => match(103, i < 1, COMET, [3020, 3165]))
    ]
  });

  const { entries, ghosts } = signatureBuilds(profile);
  assert.equal(entries.length, 1);
  assert.equal(ghosts.length, 0);
  const entry = entries[0]!;
  assert.equal(entry.games, 9);
  assert.equal(entry.masteryRank, 1);
  assert.equal(entry.groups.length, 2);

  const [first, second] = entry.groups;
  // 채용 수 내림차순 — 감전(6) 이 빌드 1.
  assert.equal(first!.keystone?.runeId, ELECTROCUTE.keystone);
  assert.equal(first!.games, 6);
  assert.equal(first!.wins, 4);
  // 그룹 내 아이템 분모 = 그룹 게임 수: 루덴 6/6, 모렐로는 감전 그룹에 없음.
  assert.ok(first!.items.every((item) => item.games <= first!.games));
  assert.ok(first!.items.some((item) => item.itemId === 6655 && item.games === 6));
  assert.ok(!first!.items.some((item) => item.itemId === 3165));
  assert.equal(second!.keystone?.runeId, COMET.keystone);
  assert.ok(second!.items.some((item) => item.itemId === 3165 && item.games === 3));
  assert.equal(entry.otherGames, 0);
});

test("signatureBuilds: 2게임 미만 룬 조합은 그룹이 되지 않고 기타로 집계된다", () => {
  const profile = profileWith({
    recentMatches: [
      ...Array.from({ length: 3 }, () => match(103, true, ELECTROCUTE, [6655])),
      match(103, false, COMET, [3165]),
      match(103, false, undefined, [3165]) // 룬 데이터 누락 매치도 기타로
    ]
  });
  const { entries } = signatureBuilds(profile);
  const entry = entries[0]!;
  assert.equal(entry.games, 5);
  assert.equal(entry.groups.length, 1);
  assert.equal(entry.groups[0]!.games, 3);
  assert.equal(entry.otherGames, 2);
});

test("signatureBuilds: 챔피언은 최대 3개, 표본 부족 숙련도 챔피언은 ghost 로 분리된다", () => {
  const matches: PublicLolRecentMatch[] = [];
  for (const championId of [1, 2, 3, 4]) {
    matches.push(match(championId, true, ELECTROCUTE, [6655]), match(championId, false, ELECTROCUTE, [6655]));
  }
  const profile = profileWith({
    topChampions: [
      champion(1, "가렌", { level: 7, points: 500_000 }),
      champion(64, "리 신", { level: 6, points: 400_000 }) // 최근 0게임 → ghost
    ],
    recentMatches: matches
  });
  const { entries, ghosts } = signatureBuilds(profile);
  assert.equal(entries.length, SIGNATURE_BUILD_MAX_CHAMPIONS);
  // 숙련도 1위 가렌이 먼저.
  assert.equal(entries[0]!.champion.championId, 1);
  assert.deepEqual(ghosts.map((row) => row.champion.championId), [64]);
  assert.ok(SIGNATURE_BUILD_MIN_GAMES >= 2);
});

test("signatureBuilds: 트링킷 슬롯은 아이템 집계에서 제외되고 신발 ID 판별이 동작한다", () => {
  const withTrinket = match(103, true, ELECTROCUTE, [3020, 6655, 4645, 3165, 4629, 3089, 3364]);
  const profile = profileWith({ recentMatches: [withTrinket, match(103, true, ELECTROCUTE, [3020, 6655])] });
  const { entries } = signatureBuilds(profile);
  const items = entries[0]!.groups[0]!.items;
  assert.ok(!items.some((item) => item.itemId === 3364), "슬롯 6(트링킷)은 제외");
  assert.ok(isBootItem(3020));
  assert.ok(!isBootItem(6655));
});

test("signatureBuilds: 집계 가능한 챔피언이 없으면 빈 목록(카드 미렌더 조건)", () => {
  const profile = profileWith({ recentMatches: [match(103, true, ELECTROCUTE, [6655])] });
  const { entries } = signatureBuilds(profile);
  assert.equal(entries.length, 0);
});
