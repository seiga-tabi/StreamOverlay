import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAMPION_FORM_MIN_GAMES,
  championAnalysisTableRows,
  championSpotlights
} from "../src/features/public-lol/utils/match";
import type { PublicLolProfile } from "../src/features/public-lol/types/public-lol";

function champion(championId: number, nameKo: string, mastery?: { level: number; points: number }) {
  return {
    championId,
    championKey: `Champ${championId}`,
    nameKo,
    ...(mastery ? { masteryLevel: mastery.level, masteryPoints: mastery.points } : {})
  };
}

function performance(championId: number, nameKo: string, games: number, wins: number, extras?: Partial<{ averageKda: number }>) {
  return {
    champion: champion(championId, nameKo),
    games,
    wins,
    winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
    averageKda: extras?.averageKda ?? 3
  };
}

function profileWith(overrides: Partial<PublicLolProfile>): PublicLolProfile {
  return {
    status: "ready",
    riotId: "QA#KR1",
    gameName: "QA",
    tagLine: "KR1",
    accountRegion: "asia",
    lolPlatform: "kr",
    topChampions: [],
    recentMatches: [],
    recentMatchStart: 0,
    hasMoreRecentMatches: false,
    summary: { recentGames: 0, recentWins: 0, recentWinRate: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0 },
    championPerformance: [],
    rolePerformance: [],
    fetchedAt: "2026-08-17T00:00:00.000Z",
    ...overrides
  } as PublicLolProfile;
}

test("championAnalysisTableRows: 최근 성과 행(games desc)과 숙련도만 있는 ghost 행을 분리한다", () => {
  const profile = profileWith({
    topChampions: [
      champion(64, "리 신", { level: 6, points: 462_107 }),
      champion(103, "아리", { level: 7, points: 523_341 })
    ],
    championPerformance: [
      performance(202, "진", 7, 5),
      performance(103, "아리", 9, 7)
    ]
  });

  const { active, ghosts } = championAnalysisTableRows(profile);
  assert.deepEqual(active.map((row) => row.champion.championId), [103, 202]);
  // 숙련도 정보는 topChampions 와 조인되어 유지된다.
  assert.equal(active[0]?.masteryPoints, 523_341);
  // 최근 기록이 없는 리 신은 ghost 로 분리된다("-" 반복 행 방지).
  assert.deepEqual(ghosts.map((row) => row.champion.championId), [64]);
  assert.equal(ghosts[0]?.performance, undefined);
});

test("championAnalysisTableRows: 게임 수 동률이면 승률 내림차순", () => {
  const profile = profileWith({
    championPerformance: [
      performance(1, "가렌", 5, 2),
      performance(2, "티모", 5, 4)
    ]
  });
  const { active } = championAnalysisTableRows(profile);
  assert.deepEqual(active.map((row) => row.champion.championId), [2, 1]);
});

test("championSpotlights: 시그니처는 숙련도 1위, 최근 폼은 3게임 이상 최고 승률", () => {
  const profile = profileWith({
    topChampions: [champion(103, "아리", { level: 7, points: 523_341 })],
    championPerformance: [
      performance(103, "아리", 9, 7),
      performance(202, "진", 4, 4),
      // 100% 지만 표본 2게임 — 폼 후보에서 제외되어야 한다.
      performance(112, "빅토르", 2, 2)
    ]
  });

  const { signature, form } = championSpotlights(profile);
  assert.equal(signature?.champion.championId, 103);
  assert.equal(signature?.masteryRank, 1);
  assert.equal(form?.champion.championId, 202);
  assert.ok(CHAMPION_FORM_MIN_GAMES >= 3);
});

test("championSpotlights: 시그니처와 같은 챔피언은 폼 타일에 중복 노출하지 않는다", () => {
  const profile = profileWith({
    topChampions: [champion(103, "아리", { level: 7, points: 523_341 })],
    championPerformance: [
      // 아리가 최근 폼도 1위지만 시그니처 타일이 이미 보여주므로 다음 챔피언이 폼이 된다.
      performance(103, "아리", 9, 8),
      performance(202, "진", 5, 3)
    ]
  });
  const { signature, form } = championSpotlights(profile);
  assert.equal(signature?.champion.championId, 103);
  assert.equal(form?.champion.championId, 202);

  // 시그니처 외에 3게임 이상 후보가 없으면 폼 타일 없음.
  const solo = championSpotlights(profileWith({
    topChampions: [champion(103, "아리", { level: 7, points: 523_341 })],
    championPerformance: [performance(103, "아리", 9, 8)]
  }));
  assert.equal(solo.form, undefined);
});

test("championSpotlights: 승률 동률이면 게임 수 많은 쪽, 3게임 이상이 없으면 폼 없음", () => {
  const tie = championSpotlights(profileWith({
    championPerformance: [
      performance(1, "가렌", 4, 3),
      performance(2, "티모", 8, 6)
    ]
  }));
  assert.equal(tie.form?.champion.championId, 2);

  const thin = championSpotlights(profileWith({
    championPerformance: [performance(1, "가렌", 2, 2)]
  }));
  assert.equal(thin.form, undefined);
  assert.equal(thin.signature, undefined);
});
