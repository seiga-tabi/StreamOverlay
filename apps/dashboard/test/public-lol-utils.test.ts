import assert from "node:assert/strict";
import test from "node:test";
import { formatCooldown, formatDecimal, formatDuration, formatPercent } from "../src/features/public-lol/utils/format";
import { filteredMatches, summarizeMatches } from "../src/features/public-lol/utils/match";
import { rankScore, rankTrendLine, shortRankLabel } from "../src/features/public-lol/utils/rank";
import { buildSuggestions, jpRiotIdQuery, publicSummonerPath, riotIdFromPublicSummonerPath } from "../src/features/public-lol/utils/riot-id";
import { parseFavorites, parseRecentSearches } from "../src/features/public-lol/utils/storage";
import { publicPageRouteFromPath, publicPathForPage } from "../src/features/public-lol/utils/routes";
import {
  dashboardPageFromPath,
  dashboardPathForPage,
  isLolOperationsPage,
  pageAllowedForRole,
  streamerDashboardBasePath,
  streamerDashboardTenantFromPath,
  streamerDashboardTenantMatches
} from "../src/routing/dashboard-routes";
import type { PublicLolProfile, PublicLolRecentMatch, SearchSuggestion } from "../src/features/public-lol/types/public-lol";

test("Riot ID를 기존 JP 검색 규칙으로 정규화한다", () => {
  assert.equal(jpRiotIdQuery(" Hide on bush ＃jp1 "), "Hide on bush#JP1");
  assert.equal(jpRiotIdQuery("Hide on bush"), "Hide on bush#JP1");
  assert.equal(jpRiotIdQuery("せいが"), "せいが#JP1");
});

test("공개 소환사 경로를 동일한 Riot ID로 왕복 변환한다", () => {
  const path = publicSummonerPath("せいが#sei");
  assert.equal(path, "/lol/summoners/jp/%E3%81%9B%E3%81%84%E3%81%8C-SEI");
  assert.equal(riotIdFromPublicSummonerPath(path), "せいが#SEI");
});

test("공개 페이지 경로를 페이지 상태와 왕복 변환한다", () => {
  assert.equal(publicPageRouteFromPath("/palworld")?.page, "palworld");
  assert.equal(publicPageRouteFromPath("/community/server")?.page, "patch");
  assert.equal(publicPageRouteFromPath("/community/party/")?.page, "communityParty");
  assert.deepEqual(publicPageRouteFromPath("/community/posts/post%201"), {
    page: "communityDetail",
    postId: "post 1"
  });
  assert.equal(publicPathForPage("communityDetail", { postId: "post 1" }), "/community/posts/post%201");
  assert.equal(publicPathForPage("palworld"), "/palworld");
  assert.equal(publicPathForPage("followJoin"), "/participation");
});

test("Dashboard 역할별 경로를 페이지 상태와 왕복 변환한다", () => {
  const tenant = {
    streamerSlug: "streamer_name",
    dashboardKey: "sdk_0123456789abcdefghijklmnopqrstuv"
  };
  assert.equal(dashboardPathForPage("overlayStatus", "streamer"), "/dashboard/overlay");
  assert.equal(dashboardPageFromPath("/dashboard/overlay/", "streamer"), "overlayStatus");
  assert.equal(dashboardPathForPage("lolAccount", "streamer"), "/dashboard/lol/account");
  assert.equal(dashboardPathForPage("lolAutomation", "streamer"), "/dashboard/lol/automation");
  assert.equal(dashboardPathForPage("lolParticipation", "streamer"), "/dashboard/lol/participation");
  assert.equal(dashboardPageFromPath("/dashboard/lol", "streamer"), "lolAccount");
  assert.equal(dashboardPageFromPath("/dashboard/riot-account", "streamer"), "lolAccount");
  assert.equal(dashboardPageFromPath("/dashboard/solo-rank", "streamer"), "lolAutomation");
  assert.equal(dashboardPageFromPath("/dashboard/participation", "streamer"), "lolParticipation");
  assert.equal(dashboardPathForPage("myRiotAccount", "streamer"), "/dashboard/lol/account");
  assert.equal(dashboardPathForPage("soloRank", "streamer"), "/dashboard/lol/automation");
  assert.equal(dashboardPathForPage("participation", "streamer"), "/dashboard/lol/participation");
  assert.equal(isLolOperationsPage("lolParticipation"), true);
  assert.equal(isLolOperationsPage("overlayStatus"), false);
  assert.equal(dashboardPathForPage("supportInbox", "admin"), "/admin/support");
  assert.equal(dashboardPageFromPath("/admin/support", "admin"), "supportInbox");
  assert.equal(dashboardPageFromPath("/admin/community", "admin"), "communityModeration");
  assert.equal(dashboardPageFromPath("/admin/unknown", "admin"), "serverStatus");
  assert.equal(streamerDashboardBasePath(tenant), `/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}`);
  assert.equal(
    dashboardPathForPage("overlayStatus", "streamer", tenant),
    `/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}/overlay`
  );
  assert.equal(
    dashboardPathForPage("lolParticipation", "streamer", tenant),
    `/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}/lol/participation`
  );
  assert.equal(
    dashboardPageFromPath(`/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}/lol/automation`, "streamer"),
    "lolAutomation"
  );
  assert.deepEqual(streamerDashboardTenantFromPath(`/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}/alerts`), tenant);
  assert.equal(streamerDashboardTenantMatches(streamerDashboardTenantFromPath(`/dashboard/${tenant.streamerSlug}/${tenant.dashboardKey}`), tenant), true);
  assert.equal(streamerDashboardTenantFromPath("/dashboard/streamer_name/not-a-dashboard-key"), undefined);
  assert.equal(streamerDashboardTenantFromPath("/dashboard/lol/account"), undefined);
  assert.equal(pageAllowedForRole("overlayAlerts", "streamer"), false);
  assert.equal(pageAllowedForRole("followers", "streamer"), false);
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
    match({ matchId: "aram", result: "loss", queueId: 450, kills: 2, deaths: 4, assists: 6, csPerMinute: 4 })
  ];
  const summary = summarizeMatches(matches);
  assert.equal(summary.recentGames, 2);
  assert.equal(summary.recentWins, 1);
  assert.equal(summary.recentWinRate, 50);
  assert.equal(summary.averageKda, 4.33);

  const profile = { recentMatches: matches } as PublicLolProfile;
  assert.deepEqual(filteredMatches(profile, { queue: "solo", championId: "all", period: "all" }).map((item) => item.matchId), ["solo"]);
});

test("랭크 점수와 추이 좌표가 유효 범위 안에 유지된다", () => {
  const rankedStats = { tier: "PLATINUM", rank: "I", leaguePoints: 8, wins: 10, losses: 8 } as const;
  assert.equal(rankScore(rankedStats), 1908);
  assert.equal(shortRankLabel(rankedStats), "P1");

  const profile = {
    riotId: "tester#JP1",
    rankedStats,
    rankHistory: [
      { date: new Date(Date.now() - 2 * 86_400_000).toISOString(), rankScore: 1880 },
      { date: new Date(Date.now() - 86_400_000).toISOString(), rankScore: 1908 }
    ],
    recentMatches: []
  } as PublicLolProfile;
  const trend = rankTrendLine(profile);
  assert.ok(trend);
  assert.equal(trend.points.length, 2);
  assert.ok(trend.points.every((point) => point.x >= 36 && point.x <= 300));
  assert.ok(trend.points.every((point) => point.y >= 16 && point.y <= 152));
});
