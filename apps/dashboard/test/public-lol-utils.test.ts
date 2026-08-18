import assert from "node:assert/strict";
import test from "node:test";
import { formatCooldown, formatDecimal, formatDuration, formatPercent } from "../src/features/public-lol/utils/format";
import {
  compactMatchBadgeSelection,
  filteredMatches,
  profileWithPreservedStreamerStateAfterRefresh,
  summarizeMatches,
} from "../src/features/public-lol/utils/match";
import { rankScore, rankTrendLine, shortRankLabel } from "../src/features/public-lol/utils/rank";
import { platformTimezoneLabel, playtimeSummary } from "../src/features/public-lol/utils/playtime";
import {
  buildSuggestions,
  jpRiotIdQuery,
  publicSummonerPath,
  publicSummonerRouteFromPath,
  riotIdFromPublicSummonerPath,
  riotIdQuery
} from "../src/features/public-lol/utils/riot-id";
import { parseFavorites, parseRecentSearches } from "../src/features/public-lol/utils/storage";
import {
  normalizeShareRole,
  profileShareLanes,
  PROFILE_SHARE_MIN_SUB_LANE_GAMES,
} from "../src/features/public-lol/utils/profile-share";
import { publicPageRouteFromPath, publicPathForPage } from "../src/features/public-lol/utils/routes";
import {
  isLocalizablePublicPath,
  localizedPublicUrl,
  publicLocaleFromPathname,
  stripPublicLocalePrefix,
} from "../src/features/public-lol/utils/public-locale-path";
import {
  DASHBOARD_PAGES,
  dashboardPageFromPath,
  dashboardPathForPage,
  pageAllowed
} from "../src/routing/dashboard-routes";
import type { PublicLolProfile, PublicLolRecentMatch, SearchSuggestion } from "../src/features/public-lol/types/public-lol";

test("Riot ID를 기존 JP 검색 규칙으로 정규화한다", () => {
  assert.equal(jpRiotIdQuery(" Hide on bush ＃jp1 "), "Hide on bush#JP1");
  assert.equal(jpRiotIdQuery("Hide on bush"), "Hide on bush#JP1");
  assert.equal(jpRiotIdQuery("せいが"), "せいが#JP1");
});

test("전적 요약 뱃지는 MVP와 ACE만 직접 노출하고 나머지를 축약한다", () => {
  assert.deepEqual(compactMatchBadgeSelection([
    { code: "objective" },
    { code: "ace" },
    { code: "vision" }
  ]), {
    visibleBadges: [{ code: "ace" }],
    overflowCount: 2
  });
  assert.deepEqual(compactMatchBadgeSelection([
    { code: "objective" },
    { code: "vision" }
  ]), {
    visibleBadges: [],
    overflowCount: 2
  });
});

test("공개 소환사 경로를 동일한 Riot ID로 왕복 변환한다", () => {
  const path = publicSummonerPath("せいが#sei");
  assert.equal(path, "/lol/summoners/jp/%E3%81%9B%E3%81%84%E3%81%8C-SEI");
  assert.equal(riotIdFromPublicSummonerPath(path), "せいが#SEI");
  assert.equal(riotIdFromPublicSummonerPath(`/ko${path}`), "せいが#SEI");
  assert.equal(riotIdFromPublicSummonerPath(`/ja${path}`), "せいが#SEI");
  assert.equal(riotIdFromPublicSummonerPath("/ko/lol/summoners/jp/%E0%A4%A"), undefined);
  assert.equal(publicSummonerPath("Hide on bush#KR1", "kr"), "/lol/summoners/kr/Hide%20on%20bush-KR1");
  assert.deepEqual(publicSummonerRouteFromPath("/ko/lol/summoners/kr/Hide%20on%20bush-KR1"), {
    riotId: "Hide on bush#KR1",
    lolPlatform: "kr"
  });
  assert.equal(publicSummonerRouteFromPath("/lol/summoners/invalid/test-NA1"), undefined);
});

test("서버별 Riot ID 입력은 명시적인 태그를 보존하고 JP 레거시 입력만 호환한다", () => {
  assert.equal(riotIdQuery("Hide on bush#KR1", "kr"), "Hide on bush#KR1");
  assert.equal(riotIdQuery("Hide on bush", "kr"), "Hide on bush");
  assert.equal(riotIdQuery("せいが", "jp1"), "せいが#JP1");
});

test("공개 페이지 경로를 페이지 상태와 왕복 변환한다", () => {
  assert.equal(publicPageRouteFromPath("/palworld")?.page, "palworld");
  assert.equal(publicPageRouteFromPath("/bot")?.page, "bot");
  assert.equal(publicPageRouteFromPath("/lol/aram")?.page, "aram");
  assert.equal(publicPageRouteFromPath("/ja/lol/aram")?.page, "aram");
  assert.equal(publicPageRouteFromPath("/patch-notes")?.page, "patchNotes");
  assert.equal(publicPageRouteFromPath("/ja/patch-notes")?.page, "patchNotes");
  /* 커뮤니티는 걷어냈습니다. 앱이 아니라 서버가 308 로 넘깁니다. */
  assert.equal(publicPageRouteFromPath("/community/server"), undefined);
  assert.equal(publicPageRouteFromPath("/community/posts/post%201"), undefined);
  assert.equal(publicPathForPage("palworld"), "/palworld");
  assert.equal(publicPathForPage("bot"), "/bot");
  assert.equal(publicPathForPage("aram"), "/lol/aram");
  assert.equal(publicPathForPage("followJoin"), "/participation");
  assert.equal(publicPathForPage("patchNotes"), "/patch-notes");
});

test("공개 언어 URL은 경로·query·hash를 보존하고 비공개 경로에는 적용하지 않는다", () => {
  assert.equal(publicLocaleFromPathname("/ko/"), "ko");
  assert.equal(publicLocaleFromPathname("/ja/palworld/items"), "ja");
  assert.equal(publicLocaleFromPathname("/japanese"), undefined);
  assert.equal(stripPublicLocalePrefix("/ko/palworld/items"), "/palworld/items");
  assert.equal(stripPublicLocalePrefix("/ja"), "/");
  assert.equal(localizedPublicUrl("/", "ko"), "/ko/");
  assert.equal(
    localizedPublicUrl("/ko/palworld/items?q=스피어#result", "ja"),
    "/ja/palworld/items?q=스피어#result",
  );
  assert.equal(localizedPublicUrl("/dashboard", "ja"), "/dashboard");
  assert.equal(localizedPublicUrl("/api/palworld/meta", "ko"), "/api/palworld/meta");
  assert.equal(isLocalizablePublicPath("/ja/bot/commands"), true);
  assert.equal(isLocalizablePublicPath("/ja/dashboard"), false);
});

test("관리자 Dashboard 경로를 페이지 상태와 왕복 변환한다", () => {
  assert.equal(dashboardPathForPage("supportInbox"), "/admin/support");
  assert.equal(dashboardPageFromPath("/admin/support"), "supportInbox");
  /* 커뮤니티 관리 화면은 제거됐습니다. 모르는 경로는 첫 화면으로 돌아갑니다. */
  assert.equal(dashboardPageFromPath("/admin/community"), "streamerRiotRequests");
  assert.equal(dashboardPageFromPath("/admin"), "streamerRiotRequests");
  assert.equal(dashboardPageFromPath("/admin/unknown"), "streamerRiotRequests");
  assert.equal(DASHBOARD_PAGES.includes("streamerRiotRequests"), true);
  assert.equal(pageAllowed("supportInbox"), true);
});

test("검색 제안은 중복을 제거하고 최대 6개로 제한한다", () => {
  const recent: SearchSuggestion[] = Array.from({ length: 8 }, (_, index) => ({
    gameName: `player${index}`,
    tagLine: "JP1",
    source: "recent"
  }));
  const suggestions = buildSuggestions("player", recent, [recent[0]!]);
  assert.equal(suggestions.length, 6);
  assert.equal(new Set(suggestions.map((item) => `${item.gameName}#${item.tagLine}`.toLowerCase())).size, 6);
});

test("포맷 유틸리티가 기존 표시 형식을 유지한다", () => {
  assert.equal(formatDecimal(2.345, 2), "2.35");
  assert.equal(formatDuration(125), "2:05");
  assert.equal(formatCooldown(61_001), "1:02");
  assert.equal(formatPercent(52.4), "52%");
  assert.equal(formatPercent(undefined), "-");
});

test("최근 검색과 즐겨찾기 저장값을 정규화하고 제한한다", () => {
  const raw = JSON.stringify(Array.from({ length: 30 }, (_, index) => ({
    gameName: ` user${index} `,
    tagLine: " jp1 ",
    recentGames: index
  })));
  const recent = parseRecentSearches(raw);
  const favorites = parseFavorites(raw);
  assert.equal(recent.length, 8);
  assert.equal(favorites.length, 24);
  assert.deepEqual(recent[0] && { gameName: recent[0].gameName, tagLine: recent[0].tagLine }, { gameName: "user0", tagLine: "JP1" });
});

test("최근 검색과 즐겨찾기 저장값의 동일 서버 Riot ID 중복을 읽을 때 제거한다", () => {
  const raw = JSON.stringify([
    { gameName: " せいが ", tagLine: " sei ", lolPlatform: "jp1" },
    { gameName: "せいが", tagLine: "SEI", lolPlatform: "JP1" },
    { gameName: "せいが", tagLine: "SEI", lolPlatform: "kr" },
  ]);

  const recent = parseRecentSearches(raw);
  const favorites = parseFavorites(raw);

  assert.equal(recent.length, 2);
  assert.equal(favorites.length, 2);
  assert.deepEqual(recent.map((item) => item.lolPlatform), ["jp1", "kr"]);
  assert.deepEqual(favorites.map((item) => item.lolPlatform), ["jp1", "kr"]);
});

function match(partial: Partial<PublicLolRecentMatch>): PublicLolRecentMatch {
  return {
    matchId: partial.matchId ?? "match",
    result: partial.result ?? "win",
    queueId: partial.queueId ?? 420,
    startedAt: partial.startedAt ?? new Date().toISOString(),
    champion: partial.champion ?? { championId: 1, championKey: "Annie" },
    kills: partial.kills ?? 0,
    deaths: partial.deaths ?? 0,
    assists: partial.assists ?? 0,
    ...partial
  } as PublicLolRecentMatch;
}

test("매치 요약과 필터 계산을 기존 규칙으로 유지한다", () => {
  const matches = [
    match({ matchId: "solo", result: "win", queueId: 420, kills: 10, deaths: 2, assists: 8, csPerMinute: 7 }),
    match({ matchId: "aram", result: "loss", queueId: 450, kills: 2, deaths: 4, assists: 6, csPerMinute: 4 }),
    match({ matchId: "aram-mayhem", result: "win", queueId: 2400, kills: 8, deaths: 5, assists: 12, csPerMinute: 3 })
  ];
  const summary = summarizeMatches(matches);
  assert.equal(summary.recentGames, 3);
  assert.equal(summary.recentWins, 2);
  assert.equal(summary.recentWinRate, 67);
  assert.equal(summary.averageKda, 4.18);

  const profile = { recentMatches: matches } as PublicLolProfile;
  assert.deepEqual(filteredMatches(profile, { queue: "solo", championId: "all", period: "all" }).map((item) => item.matchId), ["solo"]);
  assert.deepEqual(filteredMatches(profile, { queue: "aram", championId: "all", period: "all" }).map((item) => item.matchId), ["aram"]);
  // Riot는 증강 칼바람(queueId 2400) 매치 조회를 공개 API에서 막고 있어 별도 필터를 제공하지 않습니다.
  // 다만 과거에 저장된 데이터에 남아 있을 수 있는 알 수 없는 큐도 "전체"에서는 계속 보여야 합니다.
  assert.deepEqual(
    filteredMatches(profile, { queue: "all", championId: "all", period: "all" }).map((item) => item.matchId),
    ["solo", "aram", "aram-mayhem"]
  );
});

test("전적 갱신 응답은 동일한 프로필의 지연 로딩된 스트리머 정보를 보존한다", () => {
  const twitchStream = {
    twitchUserId: "streamer-1",
    twitchLogin: "streamer",
    twitchDisplayName: "스트리머",
    channelUrl: "https://www.twitch.tv/streamer",
    isLive: true,
    source: "registered",
  } as NonNullable<PublicLolProfile["twitchStream"]>;
  const current = {
    riotId: "테스터#JP1",
    lolPlatform: "jp1",
    twitchStream,
    fetchedAt: "2026-08-07T00:00:00.000Z",
  } as PublicLolProfile;
  const refreshed = {
    riotId: "테스터#JP1",
    lolPlatform: "jp1",
    fetchedAt: "2026-08-07T00:10:00.000Z",
  } as PublicLolProfile;

  const merged = profileWithPreservedStreamerStateAfterRefresh(current, refreshed);

  assert.equal(merged.twitchStream, twitchStream);
  assert.equal(merged.fetchedAt, refreshed.fetchedAt);
  assert.equal(
    profileWithPreservedStreamerStateAfterRefresh(
      current,
      { ...refreshed, riotId: "다른계정#JP1" },
    ).twitchStream,
    undefined,
  );
});

test("랭크 점수와 추이 좌표가 유효 범위 안에 유지된다", () => {
  const rankedStats = { tier: "PLATINUM", rank: "I", leaguePoints: 8, wins: 10, losses: 8 } as const;
  assert.equal(rankScore(rankedStats), 1908);
  assert.equal(shortRankLabel(rankedStats), "P1");

  const profile = {
    riotId: "tester#JP1",
    rankedStats,
    rankHistory: [
      {
        date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        tier: "PLATINUM",
        rank: "I",
        leaguePoints: 80,
        wins: 9,
        losses: 8,
        rankScore: 80
      },
      {
        date: new Date(Date.now() - 86_400_000).toISOString(),
        tier: "PLATINUM",
        rank: "I",
        leaguePoints: 8,
        wins: 10,
        losses: 8,
        rankScore: 8
      }
    ],
    recentMatches: []
  } as PublicLolProfile;
  const trend = rankTrendLine(profile);
  assert.ok(trend);
  assert.equal(trend.points.length, 2);
  assert.deepEqual(trend.points.map((point) => point.value), [1980, 1908]);
  assert.equal(trend.change, -72);
  assert.ok(trend.axisTicks.length <= 3);
  assert.ok(trend.points.every((point) => point.x >= 52 && point.x <= 308));
  assert.ok(trend.points.every((point) => point.y >= 12 && point.y <= 140));
});

test("LP 추이는 랭크 큐 경기만 반영하고 다른 큐 승리로는 오르지 않는다", () => {
  /* 회귀 고정 — estimatedLpDelta 가 큐를 보지 않고 승패만 봐서, 솔로랭크 기록이
     하나도 없어도 칼바람(450)·일반(400) 승리가 +20 으로 잡혀 LP 가 오르는 것처럼
     보였습니다. rankHistory 가 없을 때 쓰는 추정 경로에서만 나던 결함입니다. */
  const rankedStats = {
    queueType: "RANKED_SOLO_5x5",
    tier: "PLATINUM",
    rank: "I",
    leaguePoints: 50,
    wins: 10,
    losses: 10,
    winRate: 50
  } as PublicLolProfile["rankedStats"];

  const match = (matchId: string, queueId: number, result: "win" | "loss", hoursAgo: number): PublicLolRecentMatch => ({
    matchId,
    queueId,
    result,
    startedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
  } as PublicLolRecentMatch);

  const base = { riotId: "tester#JP1", rankedStats, rankHistory: [] };

  /* 솔로랭크 기록이 없고 칼바람·일반만 이긴 경우 — 선이 평평해야 합니다. */
  const nonRanked = rankTrendLine({
    ...base,
    recentMatches: [match("m1", 450, "win", 1), match("m2", 400, "win", 2), match("m3", 450, "win", 3)]
  } as PublicLolProfile);
  assert.ok(nonRanked);
  assert.equal(nonRanked.change, 0);
  assert.deepEqual([...new Set(nonRanked.points.map((point) => point.value))].length, 1);

  /* 자유랭크(440)도 솔로 티어를 움직이면 안 됩니다. */
  const flexOnly = rankTrendLine({
    ...base,
    recentMatches: [match("f1", 440, "win", 1), match("f2", 440, "win", 2)]
  } as PublicLolProfile);
  assert.ok(flexOnly);
  assert.equal(flexOnly.change, 0);

  /* 솔로랭크(420) 경기는 그대로 반영됩니다 — 승 +20, 패 -18. */
  const soloOnly = rankTrendLine({
    ...base,
    recentMatches: [match("s1", 420, "win", 1), match("s2", 420, "loss", 2), match("s3", 450, "win", 3)]
  } as PublicLolProfile);
  assert.ok(soloOnly);
  assert.equal(soloOnly.change, 2);
});

test("플레이 시간대 요약은 플랫폼 현지 시간으로 집계하고 표본 규칙을 지킨다", () => {
  /* 근거: docs/mockups/lol-profile-playtime-card.html.
     시간대는 뷰어가 아니라 플랫폼(UTC+9) 기준 — UTC 16:30 은 KST 01:30 이라
     밤(22–02) 구간입니다. 자정 넘김과 날짜 경계가 이 한 케이스에 같이 걸립니다. */
  const at = (utcIso: string, result: "win" | "loss"): PublicLolRecentMatch =>
    ({ matchId: utcIso, result, startedAt: utcIso } as PublicLolRecentMatch);

  const summary = playtimeSummary([
    /* KST 01:30 → 밤(22–02) — UTC 로는 전날입니다 */
    at("2026-08-10T16:30:00.000Z", "win"),
    /* KST 23:00 → 밤 */
    at("2026-08-10T14:00:00.000Z", "win"),
    at("2026-08-11T14:00:00.000Z", "loss"),
    /* KST 19:00 → 저녁(18–22) */
    at("2026-08-10T10:00:00.000Z", "win"),
    at("2026-08-11T10:00:00.000Z", "win"),
    at("2026-08-12T10:00:00.000Z", "win"),
    at("2026-08-13T10:00:00.000Z", "loss"),
    /* KST 02:30 → 새벽(02–06) */
    at("2026-08-10T17:30:00.000Z", "loss"),
    /* startedAt 없음 → 집계 제외 */
    { matchId: "no-time", result: "win" } as PublicLolRecentMatch,
    /* KST 11:00 → 낮 */
    at("2026-08-10T02:00:00.000Z", "win"),
    at("2026-08-11T02:00:00.000Z", "win"),
    at("2026-08-12T02:00:00.000Z", "win")
  ], "kr");

  assert.equal(summary.totalGames, 11);
  assert.equal(summary.hourly[1], 1);   // KST 01시
  assert.equal(summary.hourly[23], 2);  // KST 23시
  assert.equal(summary.peak?.key, "evening");
  assert.equal(summary.peak?.games, 4);
  assert.equal(summary.thinSample, false);
  assert.equal(summary.peakWinRate, 75);
  assert.equal(summary.peakShare, 36);
  assert.equal(summary.daytime, false);
  /* others: 밤 3판(67%)·낮 3판(100%) — 게임 수 동수면 정의 순서로 낮이 먼저? 정렬은
     games desc 안정 정렬이라 dawn→night 순서상 낮(day)이 앞입니다. */
  assert.deepEqual(summary.others.map((band) => band.key), ["day", "night"]);
  /* 인사이트: 낮 100% vs 저녁 75% = +25%p — 발화합니다. */
  assert.equal(summary.insight?.band.key, "day");
  assert.equal(summary.insight?.diffPoints, 25);

  /* 표본 부족(9판): 승률 계열 전부 숨김 — 분포만 남습니다. */
  const thin = playtimeSummary(
    Array.from({ length: 9 }, (_, index) =>
      at(`2026-08-1${index % 3}T10:00:00.000Z`, "win")),
    "kr"
  );
  assert.equal(thin.thinSample, true);
  assert.equal(thin.peakWinRate, undefined);
  assert.deepEqual(thin.others, []);
  assert.equal(thin.insight, undefined);

  /* 빈 입력 */
  const empty = playtimeSummary([], "jp1");
  assert.equal(empty.totalGames, 0);
  assert.equal(empty.peak, undefined);

  assert.equal(platformTimezoneLabel("kr"), "KST");
  assert.equal(platformTimezoneLabel("jp1"), "JST");
});


/* ── 프로필 공유 카드 라인 집계(목업 lol-profile-share-card.html §④·§⑤) ── */

const shareChampionName = (champion: { nameKo?: string; championId: number }): string =>
  champion.nameKo ?? `Champion ${champion.championId}`;

function shareMatch(position: string, championId: number, nameKo: string, result: "win" | "loss", kda = 3): any {
  return {
    matchId: `M${championId}-${result}-${Math.random()}`,
    champion: { championId, nameKo, iconUrl: `https://cdn/${championId}.png` },
    position,
    result,
    kills: 5, deaths: 2, assists: 6, kda,
    items: [], summonerSpells: [], runes: [], teams: [],
  };
}

test("프로필 공유: 주·부 라인과 라인별 주력 챔피언 3개를 집계한다", () => {
  const matches = [
    ...Array.from({ length: 4 }, () => shareMatch("MIDDLE", 103, "아리", "win")),
    ...Array.from({ length: 2 }, () => shareMatch("MIDDLE", 157, "야스오", "loss")),
    shareMatch("MIDDLE", 238, "제드", "win"),
    shareMatch("MIDDLE", 99, "럭스", "loss"),
    ...Array.from({ length: 3 }, () => shareMatch("UTILITY", 412, "쓰레쉬", "win")),
  ];
  const lanes = profileShareLanes(
    [
      { role: "MIDDLE", games: 8, wins: 5, winRate: 62.5, averageKda: 3.2 },
      { role: "UTILITY", games: 3, wins: 3, winRate: 100, averageKda: 4 },
    ],
    matches,
    shareChampionName,
  );

  assert.equal(lanes.main?.role, "MIDDLE");
  assert.equal(lanes.main?.games, 8);
  assert.equal(lanes.main?.winRate, 63);
  /* 판수 상위 3개만, 판수 내림차순 — 4번째(럭스)는 카드에 들어가지 않습니다. */
  assert.deepEqual(lanes.main?.champions.map((champion) => champion.name), ["아리", "야스오", "제드"]);
  assert.equal(lanes.main?.champions[0]?.games, 4);
  assert.equal(lanes.main?.champions[0]?.winRate, 100);
  assert.equal(lanes.sub?.role, "UTILITY");
  assert.equal(lanes.sub?.champions.length, 1);
});

test("프로필 공유: 표본이 얇은 부 라인은 블록을 만들지 않는다", () => {
  /* 목업 §⑤ — 부 라인 games < 3 이면 빈 블록 대신 생략합니다. */
  const lanes = profileShareLanes(
    [
      { role: "MIDDLE", games: 9, wins: 5, winRate: 55.6, averageKda: 3 },
      { role: "TOP", games: PROFILE_SHARE_MIN_SUB_LANE_GAMES - 1, wins: 1, winRate: 50, averageKda: 2 },
    ],
    [shareMatch("MIDDLE", 103, "아리", "win"), shareMatch("TOP", 86, "가렌", "loss")],
    shareChampionName,
  );
  assert.equal(lanes.main?.role, "MIDDLE");
  assert.equal(lanes.sub, undefined);
});

test("프로필 공유: rolePerformance 가 없으면 최근 경기로 라인 순위를 폴백한다", () => {
  const lanes = profileShareLanes(
    [],
    [
      ...Array.from({ length: 5 }, () => shareMatch("BOTTOM", 222, "징크스", "win")),
      ...Array.from({ length: 3 }, () => shareMatch("MID", 103, "아리", "loss")),
    ],
    shareChampionName,
  );
  assert.equal(lanes.main?.role, "BOTTOM");
  assert.equal(lanes.main?.winRate, 100);
  /* MID 는 MIDDLE 로 정규화되어 한 라인으로 합쳐집니다. */
  assert.equal(lanes.sub?.role, "MIDDLE");
  assert.equal(lanes.sub?.games, 3);
});

test("프로필 공유: 라인 표기 정규화(MID·ADC·SUPPORT)", () => {
  assert.equal(normalizeShareRole("MID"), "MIDDLE");
  assert.equal(normalizeShareRole("adc"), "BOTTOM");
  assert.equal(normalizeShareRole("SUPPORT"), "UTILITY");
  assert.equal(normalizeShareRole("TOP"), "TOP");
  assert.equal(normalizeShareRole(undefined), "");
});
