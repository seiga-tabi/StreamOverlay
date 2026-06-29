import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { DataDragonService } = await import("../dist/services/data-dragon.js");
const { inferMainRoleFromMatches, LolProfileEnrichmentService, performanceStatsFromMatches } = await import("../dist/services/lol-profile-enrichment.js");
const { LocalJsonLolProfileRepository } = await import("../dist/services/lol-profile-store.js");
const { RiotApiHttpError } = await import("../dist/services/riot-api.js");

const logger = {
  event() {},
  error() {}
};

function entry(overrides = {}) {
  return {
    id: "part-1",
    twitchUserId: "user-1",
    twitchUserName: "Viewer",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotPuuid: "puuid-1",
    requestedRole: "mid",
    preferredRole: "mid",
    status: "verified",
    source: "chat_command",
    createdAt: "2026-06-16T00:00:00.000Z",
    updatedAt: "2026-06-16T00:00:00.000Z",
    ...overrides
  };
}

function config(overrides = {}) {
  return {
    enabled: true,
    showRiotIdPublicly: false,
    profileCacheTtlHours: 24,
    matchAnalysisCount: 20,
    mainRoleMinConfidence: 45,
    enabledQueues: [420, 440],
    rateLimit: { backoffMs: 60000, maxBackoffMs: 900000 },
    ...overrides
  };
}

test("DataDragonService는 championId를 ko_KR/ja_JP 이름과 챔피언 이미지로 매핑한다", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/champion.json")) {
      return new Response(JSON.stringify({ data: { Aatrox: { id: "Aatrox", key: "266", name: "아트록스", image: { full: "Aatrox.png" } } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion.json")) {
      return new Response(JSON.stringify({ data: { Aatrox: { id: "Aatrox", key: "266", name: "エイトロックス", image: { full: "Aatrox.png" } } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champion = await service.mapChampionSummary({ championId: 266, masteryLevel: 7, masteryPoints: 123456 });

  assert.equal(champion.nameKo, "아트록스");
  assert.equal(champion.nameJa, "エイトロックス");
  assert.equal(champion.iconUrl, "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/Aatrox.png");
  assert.equal(champion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg");
  assert.equal(champion.loadingUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg");
  assert.equal(champion.imageVersion, "16.12.1");
  assert.equal(champion.imageLocale, "neutral");
  assert.equal(champion.masteryLevel, 7);
});

test("DataDragonService는 동시 챔피언 매핑에서 Data Dragon 조회를 한 번으로 합친다", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const target = String(url);
    calls.push(target);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/champion.json")) {
      return new Response(JSON.stringify({
        data: {
          Ahri: { id: "Ahri", key: "103", name: "아리", image: { full: "Ahri.png" } },
          Zed: { id: "Zed", key: "238", name: "제드", image: { full: "Zed.png" } }
        }
      }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion.json")) {
      return new Response(JSON.stringify({
        data: {
          Ahri: { id: "Ahri", key: "103", name: "アーリ", image: { full: "Ahri.png" } },
          Zed: { id: "Zed", key: "238", name: "ゼド", image: { full: "Zed.png" } }
        }
      }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champions = await Promise.all([
    service.mapChampionSummary({ championId: 103 }),
    service.mapChampionSummary({ championId: 238 }),
    service.mapChampionSummary({ championId: 103 })
  ]);

  assert.deepEqual(champions.map((champion) => champion.nameKo), ["아리", "제드", "아리"]);
  assert.equal(calls.filter((url) => url.endsWith("/api/versions.json")).length, 1);
  assert.equal(calls.filter((url) => url.includes("/ko_KR/champion.json")).length, 1);
  assert.equal(calls.filter((url) => url.includes("/ja_JP/champion.json")).length, 1);
});

test("DataDragonService는 locale별 이름을 합치더라도 이미지 URL은 championKey 기반 neutral asset으로 고정한다", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/champion.json")) {
      return new Response(JSON.stringify({ data: { MonkeyKing: { id: "MonkeyKing", key: "62", name: "오공", image: { full: "MonkeyKing.png" } } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion.json")) {
      return new Response(JSON.stringify({ data: { Wukong: { id: "Wukong", key: "62", name: "ウーコン", image: { full: "Wukong.png" } } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champion = await service.mapChampionSummary({ championId: 62 });

  assert.equal(champion.nameKo, "오공");
  assert.equal(champion.nameJa, "ウーコン");
  assert.equal(champion.championKey, "MonkeyKing");
  assert.equal(champion.iconUrl, "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/MonkeyKing.png");
  assert.equal(champion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/MonkeyKing_0.jpg");
  assert.equal(champion.imageLocale, "neutral");
});

test("DataDragonService는 설정된 skin number로 챔피언 스플래시와 로딩 이미지를 바꾼다", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/champion.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "아리", image: { full: "Ahri.png" } } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "アーリ", image: { full: "Ahri.png" } } } }), { status: 200 });
    }
    if (target.includes("/ko_KR/champion/Ahri.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "아리", skins: [{ num: 0, name: "default" }, { num: 27, name: "영혼의 꽃 아리" }] } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion/Ahri.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "アーリ", skins: [{ num: 0, name: "default" }, { num: 27, name: "精霊の花祭りアーリ" }] } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champion = await service.mapChampionSummary({ championId: 103, skinOverrides: { Ahri: 27 } });

  assert.equal(champion.skinNum, 27);
  assert.equal(champion.skinNameKo, "영혼의 꽃 아리");
  assert.equal(champion.skinNameJa, "精霊の花祭りアーリ");
  assert.equal(champion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_27.jpg");
  assert.equal(champion.loadingUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_27.jpg");

  const defaultChampion = await service.mapChampionSummary({ championId: 103, skinOverrides: { Ahri: 0 } });
  assert.equal(defaultChampion.skinNum, 0);
  assert.equal(defaultChampion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg");

  const options = await service.getChampionSkinOptions(103);
  assert.equal(options.champion.nameKo, "아리");
  assert.equal(options.skins[0].skinNum, 0);
  assert.equal(options.skins[0].nameKo, "아리");
  assert.equal(options.skins[1].skinNum, 27);
  assert.equal(options.skins[1].splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_27.jpg");
});

test("최근 경기 기반 주라인 추정은 confidence를 계산하고 낮으면 FILL을 반환한다", () => {
  const matches = [
    { info: { participants: [{ puuid: "puuid-1", championId: 1, individualPosition: "MIDDLE" }] }, metadata: { matchId: "1", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "puuid-1", championId: 2, individualPosition: "MIDDLE" }] }, metadata: { matchId: "2", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "puuid-1", championId: 3, individualPosition: "TOP" }] }, metadata: { matchId: "3", participants: ["puuid-1"] } }
  ];

  assert.deepEqual(inferMainRoleFromMatches(matches, "puuid-1", 45), { mainRole: "MIDDLE", confidence: 67, sampleSize: 3 });
  assert.deepEqual(inferMainRoleFromMatches(matches, "puuid-1", 80), { mainRole: "FILL", confidence: 67, sampleSize: 3 });
});

test("최근 경기 기반 performance stats는 평균 KDA 지표만 집계한다", () => {
  const matches = [
    { info: { participants: [{ puuid: "puuid-1", championId: 1, kills: 8, deaths: 4, assists: 10 }] }, metadata: { matchId: "1", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "puuid-1", championId: 2, kills: 3, deaths: 2, assists: 6 }] }, metadata: { matchId: "2", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "other", championId: 3, kills: 20, deaths: 1, assists: 20 }] }, metadata: { matchId: "3", participants: ["other"] } }
  ];

  assert.deepEqual(performanceStatsFromMatches(matches, "puuid-1"), {
    sampleSize: 2,
    averageKills: 5.5,
    averageDeaths: 3,
    averageAssists: 8,
    kda: 4.5
  });
  assert.equal(performanceStatsFromMatches(matches, "missing"), undefined);
});

test("LolProfileEnrichmentService는 fresh cache hit를 즉시 반환하고 miss는 undefined를 반환한다", () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-cache-")), "profiles.json"));
  const service = new LolProfileEnrichmentService({}, {}, repo, logger);
  repo.save({
    riotPuuid: "puuid-1",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotIdKey: "hideonbush#kr1",
    status: "ready",
    mainRole: "MIDDLE",
    mainRoleConfidence: 70,
    topChampions: [{ championId: 157, nameKo: "야스오" }],
    analyzedAt: new Date().toISOString()
  });

  const hit = service.getCachedPatch(entry(), config());
  const miss = service.getCachedPatch(entry({ riotPuuid: "puuid-miss", riotGameName: "Other" }), config());

  assert.equal(hit?.mainRole, "MIDDLE");
  assert.equal(hit?.topChampions?.[0]?.nameKo, "야스오");
  assert.equal(miss, undefined);
});

test("LolProfileEnrichmentService는 mastery API 실패 시에도 ready profile을 반환한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-fallback-")), "profiles.json"));
  const riot = {
    isConfigured: () => true,
    getAccountByRiotId: async () => ({ puuid: "puuid-1", gameName: "HideOnBush", tagLine: "KR1" }),
    getChampionMasteryTopByPuuid: async () => {
      throw new Error("mastery down");
    },
    getRankedStatsByPuuid: async () => undefined,
    getRecentMatchIdsByPuuid: async () => ["match-1"],
    getMatch: async () => ({
      metadata: { matchId: "match-1", participants: ["puuid-1"] },
      info: { participants: [{ puuid: "puuid-1", championId: 103, individualPosition: "MIDDLE", kills: 7, deaths: 3, assists: 8, win: false }] }
    })
  };
  const dataDragon = {
    mapChampionSummary: async (input) => ({ championId: input.championId, nameKo: `챔피언 ${input.championId}`, games: input.games })
  };
  const service = new LolProfileEnrichmentService(riot, dataDragon, repo, logger);

  const patch = await service.enrich(entry({ riotPuuid: undefined }), config(), true);

  assert.equal(patch.profileStatus, "ready");
  assert.equal(patch.mainRole, "MIDDLE");
  assert.equal(patch.topChampions?.[0]?.championId, 103);
  assert.deepEqual(patch.performanceStats, { sampleSize: 1, averageKills: 7, averageDeaths: 3, averageAssists: 8, kda: 5 });
  assert.equal(patch.recentMatches?.[0]?.championId, 103);
  assert.equal(patch.recentMatches?.[0]?.nameKo, "챔피언 103");
  assert.equal(patch.recentMatches?.[0]?.won, false);
});

test("LolProfileEnrichmentService는 방송자 프로필 최근 전적을 솔로랭크 10개로 제한하고 랭크 히스토리를 저장한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-streamer-solo-")), "profiles.json"));
  const puuid = "real-puuid-value-with-enough-length-1234567890";
  let requestedQueueIds;
  let requestedRankedQueueTypes;
  let requestedLadderQueueTypes;
  const riot = {
    isConfigured: () => true,
    getChampionMasteryTopByPuuid: async () => [],
    getRankedStatsByPuuid: async (_puuid, queueTypes) => {
      requestedRankedQueueTypes = queueTypes;
      return {
        queueType: "RANKED_SOLO_5x5",
        tier: "DIAMOND",
        rank: "II",
        leaguePoints: 64,
        wins: 92,
        losses: 74,
        winRate: 55,
        fetchedAt: "2026-06-16T00:00:00.000Z"
      };
    },
    getLadderRankByPuuid: async (_puuid, queueTypes) => {
      requestedLadderQueueTypes = queueTypes;
      return 12;
    },
    getRecentMatchIdsByPuuid: async (_puuid, _count, queueIds) => {
      requestedQueueIds = queueIds;
      return ["match-1", "match-2", "match-3", "match-4", "match-5", "match-6", "match-7", "match-8", "match-9", "match-10", "match-11", "match-12"];
    },
    getMatch: async (matchId) => {
      const index = Number(String(matchId).replace("match-", ""));
      return {
        metadata: { matchId, participants: [puuid] },
        info: { participants: [{ puuid, championId: 100 + index, individualPosition: "MIDDLE", kills: 1, deaths: 1, assists: 1, win: index % 2 === 0 }] }
      };
    }
  };
  const dataDragon = {
    mapChampionSummary: async (input) => ({ championId: input.championId, nameKo: `챔피언 ${input.championId}` })
  };
  const service = new LolProfileEnrichmentService(riot, dataDragon, repo, logger);

  const patch = await service.enrich(
    entry({ id: "streamer-profile", riotPuuid: puuid }),
    config({ matchAnalysisCount: 12, enabledQueues: [440] }),
    true
  );

  assert.deepEqual(requestedQueueIds, [420]);
  assert.deepEqual(requestedRankedQueueTypes, ["RANKED_SOLO_5x5"]);
  assert.deepEqual(requestedLadderQueueTypes, ["RANKED_SOLO_5x5"]);
  assert.equal(patch.ladderRank, 12);
  assert.equal(patch.recentMatches?.length, 10);
  assert.deepEqual(patch.recentMatches?.map((match) => match.championId), [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
  assert.equal(patch.rankHistory?.length, 1);
  assert.equal(patch.rankHistory?.[0]?.tier, "DIAMOND");
  assert.equal(patch.rankHistory?.[0]?.leaguePoints, 64);
});

test("LolProfileEnrichmentService는 Riot API key 오류를 failed profile로 표시한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-auth-failed-")), "profiles.json"));
  const errors = [];
  const riot = {
    isConfigured: () => true,
    getAccountByRiotId: async () => {
      throw new RiotApiHttpError(401, "account.by_riot_id", "asia.api.riotgames.com", "{\"status\":{\"message\":\"Unknown apikey\"}}");
    }
  };
  const service = new LolProfileEnrichmentService(riot, {}, repo, {
    event() {},
    error(payload) {
      errors.push(payload);
    }
  });

  const patch = await service.enrich(entry({ riotPuuid: undefined }), config(), true);

  assert.equal(patch.profileStatus, "failed");
  assert.match(patch.profileFailureReason, /RIOT_API_KEY/);
  assert.equal(patch.riotPuuid, undefined);
  assert.equal(errors[0].type, "lol_profile.enrichment_failed");
  assert.match(errors[0].error, /RIOT_API_KEY/);
});

test("LolProfileEnrichmentService는 실패 캐시의 임시 key를 PUUID처럼 재사용하지 않는다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-failed-retry-")), "profiles.json"));
  let accountLookups = 0;
  const riot = {
    isConfigured: () => true,
    getAccountByRiotId: async () => {
      accountLookups += 1;
      return { puuid: "real-puuid-value-with-enough-length-1234567890", gameName: "HideOnBush", tagLine: "KR1" };
    },
    getChampionMasteryTopByPuuid: async () => [],
    getRankedStatsByPuuid: async () => undefined,
    getRecentMatchIdsByPuuid: async () => []
  };
  const service = new LolProfileEnrichmentService(riot, {}, repo, logger);

  repo.save({
    riotPuuid: "hideonbush#kr1",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotIdKey: "hideonbush#kr1",
    status: "failed",
    failedReason: "old key failed",
    analyzedAt: new Date().toISOString()
  });

  const patch = await service.enrich(entry({ riotPuuid: "hideonbush#kr1" }), config(), false);

  assert.equal(accountLookups, 1);
  assert.equal(patch.profileStatus, "ready");
  assert.equal(patch.riotPuuid, "real-puuid-value-with-enough-length-1234567890");
  assert.equal(repo.getByRiotId("HideOnBush", "KR1")?.status, "ready");
});

test("LocalJsonLolProfileRepository는 손상된 cache 파일을 무시하고 다음 저장을 atomic JSON으로 복구한다", () => {
  const dir = mkdtempSync(join(tmpdir(), "lol-profile-broken-cache-"));
  const filePath = join(dir, "profiles.json");
  writeFileSync(filePath, "{ broken json", "utf8");

  const repo = new LocalJsonLolProfileRepository(filePath);
  assert.equal(repo.getByPuuid("puuid-1"), undefined);

  repo.save({
    riotPuuid: "real-puuid-value-with-enough-length-1234567890",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotIdKey: "hideonbush#kr1",
    status: "ready",
    analyzedAt: new Date().toISOString()
  });

  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(parsed.profiles.length, 1);
  assert.ok(readdirSync(dir).some((name) => name.startsWith("profiles.json.broken-")));
});

test("LocalJsonLolProfileRepository는 저장된 Riot ID를 부분 검색 후보로 반환한다", () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-search-")), "profiles.json"));
  repo.save({
    riotPuuid: "puuid-hide",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotIdKey: "hideonbush#kr1",
    status: "ready",
    analyzedAt: "2026-06-26T00:00:00.000Z"
  });

  const results = repo.searchByText("hide", 5);

  assert.equal(results.length, 1);
  assert.equal(results[0].riotGameName, "HideOnBush");
  assert.equal(results[0].riotTagLine, "KR1");
});
