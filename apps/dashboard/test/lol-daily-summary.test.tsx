import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LolDailySummaryBar,
  groupLolMatchesByLocalDay,
  withLolDailySummaryBars,
} from "../src/features/public-lol/components/LolDailySummaryBar";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import type { PublicLolRecentMatch } from "../src/features/public-lol/types/public-lol";

function match(overrides: Partial<PublicLolRecentMatch>): PublicLolRecentMatch {
  return {
    matchId: Math.random().toString(36).slice(2),
    champion: { championId: 1, name: "Ahri" } as PublicLolRecentMatch["champion"],
    result: "win",
    kills: 5,
    deaths: 2,
    assists: 7,
    kda: 6,
    items: [],
    summonerSpells: [],
    runes: [],
    ...overrides,
  } as PublicLolRecentMatch;
}

/* 로컬 타임존 고정 없이도 성립하도록 now 를 매치와 같은 날로 줍니다. */
const NOW = new Date(2026, 7, 15, 21, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 7, day, hour).toISOString();

test("그날의 종합은 로컬 날짜 경계로 최신순 목록을 자르고 승률·흐름을 계산한다", () => {
  const matches = [
    match({ startedAt: at(15, 20), result: "win" }),
    match({ startedAt: at(15, 18), result: "loss" }),
    match({ startedAt: at(15, 15), result: "win" }),
    match({ startedAt: at(14, 23), result: "loss" }),
    match({ startedAt: at(14, 21), result: "unknown" }),
  ];
  const groups = groupLolMatchesByLocalDay(matches, NOW);
  assert.equal(groups.length, 2);
  const [today, yesterday] = groups;
  assert.equal(today?.matchCount, 3);
  assert.equal(today?.summary?.dayOffset, 0);
  assert.equal(today?.summary?.wins, 2);
  assert.equal(today?.summary?.losses, 1);
  assert.equal(today?.summary?.winRatePercent, 67);
  /* 점 막대는 시간순(이른 경기부터) — 최신순 입력의 역순 */
  assert.deepEqual(today?.summary?.results, ["win", "loss", "win"]);
  assert.equal(yesterday?.summary?.dayOffset, 1);
  /* unknown 만으로는 승률을 만들지 않되 게임 수에는 포함 */
  assert.equal(yesterday?.summary?.games, 2);
  assert.equal(yesterday?.summary?.winRatePercent, 0);
});

test("startedAt 이 없는 매치는 요약 없이 이어지고 행 수는 보존된다", () => {
  const matches = [
    match({ startedAt: at(15, 20) }),
    match({ startedAt: undefined }),
    match({ startedAt: undefined }),
  ];
  const rows = matches.map((entry) => <span key={entry.matchId} />);
  const output = withLolDailySummaryBars(matches, rows);
  /* 요약 바 1개 + 행 3개 */
  assert.equal(output.length, 4);
  const groups = groupLolMatchesByLocalDay(matches, NOW);
  assert.equal(groups[1]?.summary, undefined);
  assert.equal(groups[1]?.matchCount, 2);
});

test("요약 바는 ko·ja 라벨과 Perfect KDA·승률 색 클래스를 렌더한다", () => {
  setActivePublicLocale("ko");
  const matches = [
    match({ startedAt: at(15, 20), result: "win", kills: 10, deaths: 0, assists: 4 }),
    match({ startedAt: at(15, 18), result: "win", kills: 6, deaths: 0, assists: 9 }),
  ];
  const [bar] = withLolDailySummaryBars(matches, matches.map((entry) => <span key={entry.matchId} />));
  const korean = renderToStaticMarkup(<>{bar}</>);
  assert.match(korean, /2게임/u);
  assert.match(korean, /2승/u);
  assert.match(korean, /0패/u);
  assert.match(korean, /승률 100%/u);
  assert.match(korean, /is-hot/u);
  assert.match(korean, /Perfect/u);
  assert.match(korean, /data-testid="lol-daily-summary"/u);

  setActivePublicLocale("ja");
  const japaneseBar = renderToStaticMarkup(
    <LolDailySummaryBar summary={{
      key: "2026-08-13", date: new Date(2026, 7, 13), dayOffset: 2,
      games: 4, wins: 1, losses: 3, winRatePercent: 25, averageKda: 1.5,
      results: ["loss", "loss", "win", "loss"],
    }} />,
  );
  assert.match(japaneseBar, /4試合/u);
  assert.match(japaneseBar, /1勝/u);
  assert.match(japaneseBar, /3敗/u);
  assert.match(japaneseBar, /勝率 25%/u);
  assert.match(japaneseBar, /is-cold/u);
  assert.match(japaneseBar, /8月13日/u);
  setActivePublicLocale("ko");
});

test("5vs5 랭크 필터는 실측 큐 710 만 매칭한다 — 솔로·자유와 상호 배타", async () => {
  const { queueMatchesFilter } = await import("../src/features/public-lol/utils/match");
  assert.equal(queueMatchesFilter(match({ queueId: 710 }), "ranked5v5"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 420 }), "ranked5v5"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 440 }), "ranked5v5"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 42 }), "ranked5v5"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 420 }), "solo"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 710 }), "solo"), false);
});

test("증강 칼바람 필터는 실측 큐 2300 만 매칭한다", async () => {
  const { queueMatchesFilter } = await import("../src/features/public-lol/utils/match");
  assert.equal(queueMatchesFilter(match({ queueId: 2300 }), "aramMayhem"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 2400 }), "aramMayhem"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 450 }), "aramMayhem"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 2400 }), "aram"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 2400 }), "all"), true);
});

test("아레나 필터는 1700/1710/1750 큐만 매칭한다", async () => {
  const { queueMatchesFilter } = await import("../src/features/public-lol/utils/match");
  assert.equal(queueMatchesFilter(match({ queueId: 1700 }), "arena"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 1710 }), "arena"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 1750 }), "arena"), true);
  assert.equal(queueMatchesFilter(match({ queueId: 450 }), "arena"), false);
  assert.equal(queueMatchesFilter(match({ queueId: 2300 }), "arena"), false);
});

test("증강 역필터는 해당 증강을 픽한 경기만 남긴다", async () => {
  const { filteredMatches } = await import("../src/features/public-lol/utils/match");
  const profile = { recentMatches: [
    match({ queueId: 2300, augments: [93, 89] }),
    match({ queueId: 2300, augments: [7] }),
    match({ queueId: 450 }),
  ] } as never;
  const base = { queue: "all", championId: "all", period: "all" } as const;
  assert.equal(filteredMatches(profile, { ...base, augmentId: 93 }).length, 1);
  assert.equal(filteredMatches(profile, { ...base, augmentId: 1 }).length, 0);
  assert.equal(filteredMatches(profile, { ...base }).length, 3);
});
