import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LolChampionBuildStatsReadyResponse, LolChampionBuildStatsResponse } from "@streamops/shared";
import {
  GLOBAL_BUILD_STATS_MAX_CANDIDATES,
  GlobalBuildStatsView,
  defaultBuildStatsPosition,
  globalBuildStatsCandidates,
  type GlobalBuildStatsHelpers,
  type GlobalBuildStatsState
} from "../src/features/public-lol/components/GlobalBuildStatsPanel";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import type { PublicLolProfile, PublicLolRecentMatch } from "../src/features/public-lol/types/public-lol";

/* 챔피언 글로벌 빌드 통계 패널 — 전체 유저 누적(/api/lol/champion-build-stats).
 * 시그니처 빌드(개인 최근 매치)와 별개의 상태 머신이라 로딩/오류/표본부족/정상
 * 네 상태와 진입 경로(칩 후보 · 기본 포지션)를 따로 단언합니다. */

function champion(championId: number, nameKo: string, mastery?: { level: number; points: number }) {
  return {
    championId,
    championKey: `Champ${championId}`,
    nameKo,
    iconUrl: `https://ddragon.leagueoflegends.com/cdn/15.17.1/img/champion/Champ${championId}.png`,
    ...(mastery ? { masteryLevel: mastery.level, masteryPoints: mastery.points } : {})
  };
}

let seq = 0;
function match(championId: number, position: string | undefined): PublicLolRecentMatch {
  seq += 1;
  return {
    matchId: `KR_${seq}`,
    champion: champion(championId, `챔피언${championId}`),
    result: "win",
    kills: 1, deaths: 1, assists: 1, kda: 2,
    position,
    items: [],
    summonerSpells: [],
    runes: [],
    teams: []
  } as unknown as PublicLolRecentMatch;
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
    fetchedAt: "2026-09-03T00:00:00.000Z",
    ...overrides
  } as PublicLolProfile;
}

const helpers: GlobalBuildStatsHelpers = {
  championName: (entry) => entry.nameKo,
  positionLabel: (position) => ({ TOP: "탑", JUNGLE: "정글", MIDDLE: "미드", BOTTOM: "원딜", UTILITY: "서포터" })[position] ?? position,
  assetUrl: (url) => url,
  spellIconUrl: (spellId, version) => (version ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spellId}.png` : undefined)
};

function readyData(overrides: Partial<LolChampionBuildStatsReadyResponse> = {}): LolChampionBuildStatsReadyResponse {
  return {
    championId: 103,
    teamPosition: "MIDDLE",
    queueId: 420,
    patch: "15.17",
    dataDragonVersion: "15.17.1",
    totalGames: 120,
    winRate: 55,
    sampleInsufficient: false,
    runeGroups: [
      {
        key: "rune:8112:8100:8300", games: 80, pickRate: 66.7, winRate: 56.3,
        keystonePerkId: 8112, primaryStyleId: 8100, subStyleId: 8300,
        keystone: { id: 8112, nameKo: "감전", nameJa: "電撃", iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk/8112.png" },
        primaryStyle: { id: 8100, nameKo: "지배" },
        subStyle: { id: 8300, nameKo: "영감" }
      },
      { key: "rune:8010:8000:8300", games: 15, pickRate: 12.5, winRate: undefined, keystonePerkId: 8010, primaryStyleId: 8000, subStyleId: 8300 }
    ],
    itemGroups: [
      { key: "item:1001-3157", games: 40, pickRate: 33.3, winRate: 55, itemIds: [1001, 3157], items: [{ id: 1001, nameKo: "장화", iconUrl: "https://ddragon.leagueoflegends.com/cdn/15.17.1/img/item/1001.png" }, { id: 3157 }] }
    ],
    spellGroups: [
      { key: "spell:4-14", games: 100, pickRate: 83.3, winRate: 55, summonerSpell1: 4, summonerSpell2: 14 }
    ],
    otherRuneGames: 25,
    otherItemGames: 80,
    otherSpellGames: 20,
    positions: [
      { teamPosition: "MIDDLE", games: 120, winRate: 55 },
      { teamPosition: "TOP", games: 8, winRate: undefined }
    ],
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides
  };
}

function render(state: GlobalBuildStatsState, extra: Partial<React.ComponentProps<typeof GlobalBuildStatsView>> = {}): string {
  const selected = champion(103, "아리", { level: 7, points: 500_000 });
  return renderToStaticMarkup(
    <GlobalBuildStatsView
      candidates={[{ champion: selected, games: 9 }, { champion: champion(64, "리 신") }]}
      helpers={helpers}
      onChampionChange={() => {}}
      onPositionChange={() => {}}
      onRetry={() => {}}
      position="MIDDLE"
      selectedChampion={selected}
      state={state}
      {...extra}
    />
  );
}

test.before(() => setActivePublicLocale("ko"));

test("로딩 상태 — 칩·탭은 유지하고 본문은 role=status 로 안내한다", () => {
  const html = render({ status: "loading" });
  assert.match(html, /public-champ-panel public-gbs-panel/u);
  assert.match(html, /aria-busy="true"[^>]*class="public-champ-empty public-gbs-loading" role="status"/u);
  assert.match(html, /글로벌 빌드 통계를 불러오는 중/u);
  assert.match(html, /aria-pressed="true"[^>]*class="public-gbs-champ"[^>]*>[\s\S]*?아리/u);
  assert.match(html, /aria-selected="true"[^>]*role="tab"[^>]*>미드/u);
  assert.equal((html.match(/role="tab"/gu) ?? []).length, 5, "5개 라인 탭을 항상 그린다");
  assert.match(html, /전체 유저 · 솔로랭크/u, "패치를 아직 모르면 패치 없는 칩 문구");
});

test("오류 상태 — role=alert 안내와 재시도 버튼", () => {
  const html = render({ status: "error", message: "요청이 실패했습니다." });
  assert.match(html, /role="alert"/u);
  assert.match(html, /빌드 통계를 불러오지 못했습니다/u);
  assert.match(html, /요청이 실패했습니다\./u);
  assert.match(html, /<button class="public-sig-view public-gbs-retry" type="button">다시 시도<\/button>/u);
});

test("표본 부족 상태 — 챔피언·포지션·표본 수를 문장에 넣고 그리드는 그리지 않는다", () => {
  const data: LolChampionBuildStatsResponse = {
    championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17", totalGames: 12,
    sampleInsufficient: true, positions: [{ teamPosition: "MIDDLE", games: 12, winRate: undefined }],
    updatedAt: "2026-09-03T00:00:00.000Z"
  };
  const html = render({ status: "ready", data });
  assert.match(html, /표본이 아직 부족합니다/u);
  assert.match(html, /이번 패치 미드 아리 표본이 12게임입니다\. 30게임 이상 쌓이면 통계가 표시됩니다\./u);
  assert.doesNotMatch(html, /public-gbs-grid/u);
  assert.match(html, /패치 15\.17/u);
});

test("정상 상태 — 3열(룬/아이템/스펠+포지션)과 채용률·승률·그 외·표본부족 승률 숨김을 그린다", () => {
  const html = render({ status: "ready", data: readyData() });
  assert.equal((html.match(/class="public-gbs-col"/gu) ?? []).length, 3);
  assert.match(html, /<b>55%<\/b>/u);
  assert.match(html, /120게임 · 승률 55%/u);
  /* 룬 열 */
  assert.match(html, /감전/u);
  assert.match(html, /지배 \+ 영감/u);
  assert.match(html, /채용률 66\.7% · 80게임/u);
  assert.match(html, /승률 56\.3%/u);
  assert.match(html, /승률 표본 부족/u, "15게임 조합은 승률 대신 표본 부족 문구");
  assert.match(html, /그 외 25게임/u);
  /* 아이템 열 — 2개 아이템 + 빈 슬롯 4개 */
  assert.match(html, /img\/item\/1001\.png/u);
  assert.equal((html.match(/public-sig-item is-empty/gu) ?? []).length, 4);
  assert.match(html, /그 외 80게임/u);
  /* 스펠 열 — Data Dragon 버전으로 아이콘 URL 조립 */
  assert.match(html, /img\/spell\/4\.png/u);
  assert.match(html, /img\/spell\/14\.png/u);
  assert.match(html, /그 외 20게임/u);
  /* 포지션 분포 */
  assert.match(html, /포지션별 승률/u);
  assert.match(html, /role="listitem"/u);
  assert.match(html, /탑<\/b>/u);
  /* 탭에 표본 수 */
  assert.match(html, /aria-label="미드 · 120게임"/u);
  assert.match(html, /aria-label="정글 · 표본 없음"/u);
  assert.match(html, /패치 15\.17 · 솔로랭크/u);
});

test("표시 조합이 없는 열은 안내 한 줄로 채운다", () => {
  const html = render({ status: "ready", data: readyData({ itemGroups: [], otherItemGames: 120 }) });
  assert.match(html, /채용률 10% 이상인 조합이 없습니다/u);
  assert.match(html, /그 외 120게임/u);
});

test("후보 챔피언이 없으면 빈 상태만 그린다", () => {
  const html = renderToStaticMarkup(
    <GlobalBuildStatsView
      candidates={[]}
      helpers={helpers}
      onChampionChange={() => {}}
      onPositionChange={() => {}}
      onRetry={() => {}}
      position="MIDDLE"
      selectedChampion={undefined}
      state={{ status: "loading" }}
    />
  );
  assert.match(html, /통계를 볼 챔피언이 없습니다/u);
  assert.doesNotMatch(html, /public-gbs-tabs/u);
});

test("칩 후보는 숙련도 순 → 최근 매치 챔피언 순으로 최대 6개", () => {
  const profile = profileWith({
    topChampions: [champion(64, "리 신", { level: 6, points: 1 }), champion(103, "아리", { level: 7, points: 2 })],
    championPerformance: [{ champion: champion(202, "진"), games: 7, wins: 5, winRate: 71, averageKda: 3 }],
    recentMatches: [match(1, "TOP"), match(1, "TOP"), match(2, "JUNGLE"), match(3, "MIDDLE"), match(4, "BOTTOM"), match(5, "UTILITY")]
  });
  const candidates = globalBuildStatsCandidates(profile);
  assert.equal(candidates.length, GLOBAL_BUILD_STATS_MAX_CANDIDATES);
  assert.deepEqual(candidates.map((entry) => entry.champion.championId), [64, 103, 202, 1, 2, 3]);
  assert.equal(candidates[2]?.games, 7);
  assert.deepEqual(globalBuildStatsCandidates(profileWith({})), []);
});

test("기본 포지션은 그 챔피언을 가장 많이 한 라인 → 주 포지션 → 미드 순으로 정한다", () => {
  const played = profileWith({
    recentMatches: [match(103, "MIDDLE"), match(103, "TOP"), match(103, "top"), match(64, "JUNGLE")],
    roleAnalysis: { mainRole: "UTILITY", confidence: 0.9, sampleSize: 20 }
  });
  assert.equal(defaultBuildStatsPosition(played, 103), "TOP");
  assert.equal(defaultBuildStatsPosition(played, 64), "JUNGLE");
  assert.equal(defaultBuildStatsPosition(played, 999), "UTILITY", "플레이 기록이 없으면 주 포지션");
  assert.equal(defaultBuildStatsPosition(profileWith({ roleAnalysis: { mainRole: "FILL", confidence: 0.5, sampleSize: 3 } }), 999), "MIDDLE");
  assert.equal(defaultBuildStatsPosition(profileWith({}), 999), "MIDDLE");
});

test("fetchChampionBuildStats 는 platform 없이 championId·teamPosition 만 보내고 응답 형태를 검증한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: { __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" } } as unknown as Window
  });
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.includes("championId=999")) {
      return new Response(JSON.stringify({ error: "챔피언 빌드 통계를 사용할 수 없습니다.", code: "LOL_CHAMPION_BUILD_STATS_UNAVAILABLE" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("championId=500")) {
      return new Response(JSON.stringify({ hello: "world" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(readyData()), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const { fetchChampionBuildStats } = await import("../src/features/public-lol/api/lol");
    const response = await fetchChampionBuildStats(103, "MIDDLE");
    assert.equal(response.championId, 103);
    const url = new URL(requested[0]!);
    assert.equal(url.pathname, "/api/lol/champion-build-stats");
    assert.equal(url.searchParams.get("championId"), "103");
    assert.equal(url.searchParams.get("teamPosition"), "MIDDLE");
    assert.equal(url.searchParams.has("platform"), false);
    assert.equal(url.searchParams.has("queueId"), false, "queueId 는 서버 기본값(솔로랭크)에 맡긴다");

    await fetchChampionBuildStats(103, "TOP", { queueId: 440 });
    assert.equal(new URL(requested[1]!).searchParams.get("queueId"), "440");

    await assert.rejects(fetchChampionBuildStats(999, "MIDDLE"), /챔피언 빌드 통계를 사용할 수 없습니다\./u);
    await assert.rejects(fetchChampionBuildStats(500, "MIDDLE"), /빌드 통계를 불러오지 못했습니다/u);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});

test("통계 탭은 시그니처 빌드 아래에 글로벌 빌드 패널을 렌더하고 CSS 청크가 import 된다", () => {
  const page = readFileSync(new URL("../src/pages/PublicLolPage.tsx", import.meta.url), "utf8");
  const statsTab = page.slice(page.indexOf('profileTab === "stats"'));
  assert.ok(statsTab.indexOf("<SignatureBuildsPanel") < statsTab.indexOf("<GlobalBuildStatsPanel"));
  assert.ok(statsTab.indexOf("<GlobalBuildStatsPanel") < statsTab.indexOf("<MiniGamesLabBanner"));
  const route = readFileSync(new URL("../src/styles/pages/public-lol/lol-route.css", import.meta.url), "utf8");
  assert.match(route, /43-global-build-stats\.css/u);
  const css = readFileSync(new URL("../src/styles/pages/public-lol/43-global-build-stats.css", import.meta.url), "utf8");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//gu, ""), /!important/u);
  assert.doesNotMatch(css, /\.public-sig-[a-z-]+\s*\{/u, "빌려 쓰는 .public-sig-* 규칙을 재정의하지 않는다");
});
