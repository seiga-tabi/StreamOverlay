import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { DataDragonService } = await import("../dist/services/data-dragon.js");
const { inferMainRoleFromMatches, LolProfileEnrichmentService } = await import("../dist/services/lol-profile-enrichment.js");
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

test("최근 경기 기반 주라인 추정은 confidence를 계산하고 낮으면 FILL을 반환한다", () => {
  const matches = [
    { info: { participants: [{ puuid: "puuid-1", championId: 1, individualPosition: "MIDDLE" }] }, metadata: { matchId: "1", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "puuid-1", championId: 2, individualPosition: "MIDDLE" }] }, metadata: { matchId: "2", participants: ["puuid-1"] } },
    { info: { participants: [{ puuid: "puuid-1", championId: 3, individualPosition: "TOP" }] }, metadata: { matchId: "3", participants: ["puuid-1"] } }
  ];

  assert.deepEqual(inferMainRoleFromMatches(matches, "puuid-1", 45), { mainRole: "MIDDLE", confidence: 67, sampleSize: 3 });
  assert.deepEqual(inferMainRoleFromMatches(matches, "puuid-1", 80), { mainRole: "FILL", confidence: 67, sampleSize: 3 });
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
      info: { participants: [{ puuid: "puuid-1", championId: 103, individualPosition: "MIDDLE" }] }
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
