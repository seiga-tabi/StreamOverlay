import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { DataDragonService } = await import("../dist/services/data-dragon.js");
const { buildRankHistory, buildRankHistoryByQueue, championMatchBuildRecordsFromMatch, inferMainRoleFromMatches, LolProfileEnrichmentService, performanceStatsFromMatches } = await import("../dist/services/lol-profile-enrichment.js");
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

test("랭크 이력은 저장된 계산값 대신 티어·단계·LP로 점수를 다시 계산한다", () => {
  const history = buildRankHistory([
    {
      date: "2026-06-15T00:00:00.000Z",
      tier: "PLATINUM",
      rank: "II",
      leaguePoints: 55,
      wins: 30,
      losses: 25,
      rankScore: 12
    }
  ], undefined, "2026-06-16T00:00:00.000Z");

  assert.equal(history?.[0]?.rankScore, 1855);
});

test("큐별 랭크 이력은 갱신된 큐만 누적하고 나머지 큐의 이전 값을 유지한다", () => {
  const previousPoint = (date, queueType, leaguePoints) => ({
    date,
    tier: queueType === "RANKED_TEAM_5x5" ? "GOLD" : "PLATINUM",
    rank: "II",
    leaguePoints,
    wins: 10,
    losses: 8,
    rankScore: 0
  });
  const analyzedAt = "2026-06-16T00:30:00.000Z";
  const previous = {
    solo: [previousPoint("2026-06-15T00:00:00.000Z", "RANKED_SOLO_5x5", 40)],
    flex: [previousPoint("2026-06-15T00:00:00.000Z", "RANKED_FLEX_SR", 50)],
    ranked5v5: [previousPoint("2026-06-15T00:00:00.000Z", "RANKED_TEAM_5x5", 60)]
  };
  const history = buildRankHistoryByQueue(previous, {
    flex: {
      queueType: "RANKED_FLEX_SR",
      tier: "PLATINUM",
      rank: "II",
      leaguePoints: 72,
      wins: 11,
      losses: 8,
      winRate: 58,
      fetchedAt: analyzedAt
    }
  }, analyzedAt);

  assert.equal(history.solo?.length, 1);
  assert.equal(history.solo?.[0]?.leaguePoints, 40);
  assert.equal(history.flex?.length, 2);
  assert.equal(history.flex?.[1]?.leaguePoints, 72);
  assert.equal(history.ranked5v5?.length, 1);
  assert.equal(history.ranked5v5?.[0]?.leaguePoints, 60);
});

test("이전 배열 형식의 랭크 캐시는 로드할 때 solo 큐 이력으로 변환한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "lol-profile-legacy-history-"));
  const filePath = join(directory, "profiles.json");
  const legacyPoint = {
    date: "2026-06-15T00:00:00.000Z",
    tier: "DIAMOND",
    rank: "III",
    leaguePoints: 33,
    wins: 30,
    losses: 20,
    rankScore: 2533
  };
  writeFileSync(filePath, JSON.stringify({
    profiles: [{
      riotPuuid: "legacy-puuid",
      riotGameName: "Legacy",
      riotTagLine: "JP1",
      riotIdKey: "legacy#jp1",
      status: "ready",
      rankHistory: [legacyPoint]
    }]
  }));

  const repository = new LocalJsonLolProfileRepository(filePath);
  const loaded = repository.getByPuuid("legacy-puuid");
  assert.deepEqual(loaded?.rankHistory?.solo, [legacyPoint]);
  assert.equal(loaded?.rankHistory?.flex, undefined);
  assert.equal(loaded?.rankHistory?.ranked5v5, undefined);
});

test("DataDragonService는 championId를 ko_KR/ja_JP/en_US 이름과 챔피언 이미지로 매핑한다", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/champion.json")) {
      return new Response(JSON.stringify({ data: { Aatrox: { id: "Aatrox", key: "266", name: "아트록스", image: { full: "Aatrox.png" } } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion.json")) {
      return new Response(JSON.stringify({ data: { Aatrox: { id: "Aatrox", key: "266", name: "エイトロックス", image: { full: "Aatrox.png" } } } }), { status: 200 });
    }
    if (target.includes("/en_US/champion.json")) {
      return new Response(JSON.stringify({ data: { Aatrox: { id: "Aatrox", key: "266", name: "Aatrox", image: { full: "Aatrox.png" } } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champion = await service.mapChampionSummary({ championId: 266, masteryLevel: 7, masteryPoints: 123456 });

  assert.equal(champion.nameKo, "아트록스");
  assert.equal(champion.nameJa, "エイトロックス");
  assert.equal(champion.nameEn, "Aatrox");
  assert.equal(champion.iconUrl, "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/champion/Aatrox.png");
  assert.equal(champion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg");
  assert.equal(champion.loadingUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg");
  assert.equal(champion.imageVersion, "16.12.1");
  assert.equal(champion.imageLocale, "neutral");
  assert.equal(champion.masteryLevel, 7);
});

test("DataDragonService는 스킬 상세에서 tooltip 을 빼고 미해결 템플릿 소모값을 화면에 올리지 않는다", async () => {
  /* 픽스처 모양은 2026-09-04 실측(ddragon 16.17.1 ko_KR)입니다 — costType 이
     " {{ cost }}" 로 오고, 자원 이름은 챔피언 partype 에만 온전한 값이 있습니다. */
  const championDetail = (locale) => ({
    data: {
      Ahri: {
        id: "Ahri",
        key: "103",
        name: locale === "ja" ? "アーリ" : locale === "en" ? "Ahri" : "아리",
        partype: locale === "ja" ? "マナ" : locale === "en" ? "Mana" : "마나",
        passive: {
          name: locale === "en" ? "Essence Theft" : "정기 흡수",
          description: locale === "en" ? "Ahri heals." : "아리가 체력을 회복합니다.<br>더 많은 체력을 회복합니다.",
          image: { full: "Ahri_SoulEater2.png" }
        },
        spells: [
          {
            id: "AhriQ",
            name: locale === "en" ? "Orb of Deception" : "현혹의 구슬",
            description: locale === "en" ? "Ahri throws her orb." : "아리가 구슬을 던지고 다시 받습니다.",
            tooltip: "마법 피해 {{ qbasedamage }}",
            cooldown: [7, 7, 7, 7, 7],
            costType: " {{ cost }}",
            resource: "{{ abilityresourcename }} {{ cost }}",
            costBurn: "55/65/75/85/95",
            range: [970, 970, 970, 970, 970],
            image: { full: "AhriQ.png" }
          },
          {
            /* 체력을 쓰는 스킬 — 자원 이름 자리가 챔피언 자원이 아니고 소모값은 0 입니다.
               「마나 0」이라고 적으면 화면이 사실이 아닌 것을 말하게 됩니다. */
            id: "AhriW",
            name: "여우불",
            description: "설명 {{ wdamage }}",
            cooldown: [9, 8, 7, 6, 5],
            costType: "",
            resource: "체력 {{ healthcost }}",
            costBurn: "0",
            range: "self",
            image: { full: "AhriW.png" }
          },
          {
            /* 자기 대상 스킬 — ddragon 은 사거리를 1 로 표시합니다(베인 R 실측 형태). */
            id: "AhriE",
            name: "매혹",
            description: "아리가 입맞춤을 날립니다.",
            cooldown: [0, 0, 0, 0, 0],
            costType: "소모값 없음",
            resource: "소모값 없음",
            costBurn: "0",
            range: [1, 1, 1, 1, 1],
            image: { full: "AhriE.png" }
          }
        ]
      }
    }
  });
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.17.1"]), { status: 200 });
    const locale = target.includes("/ja_JP/") ? "ja" : target.includes("/en_US/") ? "en" : "ko";
    if (target.includes("/champion/Ahri.json")) return new Response(JSON.stringify(championDetail(locale)), { status: 200 });
    if (target.includes("/champion.json")) {
      return new Response(JSON.stringify({
        data: { Ahri: { id: "Ahri", key: "103", name: "아리", image: { full: "Ahri.png" }, stats: { hp: 590, critperlevel: 0 } } }
      }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const details = await service.getChampionAbilityDetails(103);

  assert.equal(details.championKey, "Ahri");
  assert.equal(details.passive.nameKo, "정기 흡수");
  assert.equal(details.passive.nameEn, "Essence Theft");
  assert.equal(details.passive.iconUrl, "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/passive/Ahri_SoulEater2.png");

  const [q, w, e] = details.spells;
  assert.equal(q.key, "Q");
  assert.equal(q.descriptionKo, "아리가 구슬을 던지고 다시 받습니다.");
  assert.equal(q.tooltip, undefined, "tooltip 은 계약에 없습니다");
  assert.deepEqual(q.cooldown, [7, 7, 7, 7, 7]);
  assert.equal(q.costBurn, "55/65/75/85/95");
  /* 자원 이름은 partype 에서 오고 언어별로 갈립니다 — costType 의 템플릿은 버립니다. */
  assert.equal(q.costTypeKo, "마나");
  assert.equal(q.costTypeJa, "マナ");
  assert.equal(q.costTypeEn, "Mana");
  assert.deepEqual(q.range, [970, 970, 970, 970, 970]);

  assert.equal(w.costBurn, undefined, "소모값 0 은 항목 자체를 내보내지 않습니다");
  assert.equal(w.costTypeKo, undefined);
  assert.equal(w.descriptionKo, undefined, "미해결 변수가 섞인 문장은 통째로 뺍니다");
  assert.equal(w.range, undefined, '"self" 는 숫자 사거리가 아닙니다');
  assert.deepEqual(w.cooldown, [9, 8, 7, 6, 5]);
  assert.equal(e.range, undefined, "사거리 1 은 자기 대상 표식이라 「사거리 1」로 적지 않습니다");
  assert.equal(e.costBurn, undefined);
  assert.equal(e.cooldown, undefined, "전 레벨 0 은 쿨타임이 없다는 뜻입니다 — 「쿨타임 0초」로 적지 않습니다");

  /* 기본 스탯은 챔피언 목록을 읽을 때 채운 캐시를 그대로 재사용합니다. */
  assert.deepEqual(await service.getChampionBaseStats(103, "16.17.1"), { hp: 590, critperlevel: 0 });
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
  assert.equal(calls.filter((url) => url.includes("/en_US/champion.json")).length, 1);
});

test("DataDragonService는 전적 아이템 ID를 공식 한국어·일본어·영어 이름으로 매핑한다", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target.endsWith("/api/versions.json")) return new Response(JSON.stringify(["16.12.1"]), { status: 200 });
    if (target.includes("/ko_KR/item.json")) {
      return new Response(JSON.stringify({
        data: {
          "3157": { name: "존야의 모래시계", image: { full: "3157.png" } }
        }
      }), { status: 200 });
    }
    if (target.includes("/ja_JP/item.json")) {
      return new Response(JSON.stringify({
        data: {
          "3157": { name: "ゾーニャの砂時計", image: { full: "3157.png" } }
        }
      }), { status: 200 });
    }
    if (target.includes("/en_US/item.json")) {
      return new Response(JSON.stringify({
        data: {
          "3157": { name: "Zhonya's Hourglass", image: { full: "3157.png" } }
        }
      }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const [item, unknown] = await service.mapItemSummaries([3157, 999999]);

  assert.equal(item.nameKo, "존야의 모래시계");
  assert.equal(item.nameJa, "ゾーニャの砂時計");
  assert.equal(item.nameEn, "Zhonya's Hourglass");
  assert.equal(item.iconUrl, "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/item/3157.png");
  assert.deepEqual(unknown, { itemId: 999999 });
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
    if (target.includes("/en_US/champion.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "Ahri", image: { full: "Ahri.png" } } } }), { status: 200 });
    }
    if (target.includes("/ko_KR/champion/Ahri.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "아리", skins: [{ num: 0, name: "default" }, { num: 27, name: "영혼의 꽃 아리" }] } } }), { status: 200 });
    }
    if (target.includes("/ja_JP/champion/Ahri.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "アーリ", skins: [{ num: 0, name: "default" }, { num: 27, name: "精霊の花祭りアーリ" }] } } }), { status: 200 });
    }
    if (target.includes("/en_US/champion/Ahri.json")) {
      return new Response(JSON.stringify({ data: { Ahri: { id: "Ahri", key: "103", name: "Ahri", skins: [{ num: 0, name: "default" }, { num: 27, name: "Spirit Blossom Ahri" }] } } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const service = new DataDragonService(fetchImpl);
  const champion = await service.mapChampionSummary({ championId: 103, skinOverrides: { Ahri: 27 } });

  assert.equal(champion.skinNum, 27);
  assert.equal(champion.skinNameKo, "영혼의 꽃 아리");
  assert.equal(champion.skinNameJa, "精霊の花祭りアーリ");
  assert.equal(champion.skinNameEn, "Spirit Blossom Ahri");
  assert.equal(champion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_27.jpg");
  assert.equal(champion.loadingUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_27.jpg");

  const defaultChampion = await service.mapChampionSummary({ championId: 103, skinOverrides: { Ahri: 0 } });
  assert.equal(defaultChampion.skinNum, 0);
  assert.equal(defaultChampion.splashUrl, "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg");

  const options = await service.getChampionSkinOptions(103);
  assert.equal(options.champion.nameKo, "아리");
  assert.equal(options.champion.nameEn, "Ahri");
  assert.equal(options.skins[0].skinNum, 0);
  assert.equal(options.skins[0].nameKo, "아리");
  assert.equal(options.skins[1].skinNum, 27);
  assert.equal(options.skins[1].nameEn, "Spirit Blossom Ahri");
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

test("매치 빌드 부산물은 프로필 소유자뿐 아니라 유효한 참가자 전원을 매핑한다", () => {
  const match = {
    metadata: { matchId: "KR_123", participants: ["owner", "other", "invalid"] },
    info: {
      queueId: 420,
      gameVersion: "14.18.567.1234",
      gameCreation: Date.parse("2026-06-16T01:02:03.000Z"),
      participants: [
        {
          puuid: "owner",
          championId: 103,
          teamPosition: "MIDDLE",
          win: true,
          summoner1Id: 4,
          summoner2Id: 14,
          item0: 1001,
          item1: 3157,
          item6: 3340,
          perks: {
            styles: [
              { style: 8100, selections: [{ perk: 8112 }] },
              { style: 8300, selections: [{ perk: 8345 }] }
            ]
          }
        },
        {
          puuid: "other",
          championId: 266,
          individualPosition: "TOP",
          win: false
        },
        {
          puuid: "invalid",
          championId: 238,
          teamPosition: "MIDDLE"
        }
      ]
    }
  };

  const records = championMatchBuildRecordsFromMatch(match);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    matchId: "KR_123",
    puuid: "owner",
    championId: 103,
    teamPosition: "MIDDLE",
    queueId: 420,
    patch: "14.18",
    win: true,
    observedTier: undefined,
    keystonePerkId: 8112,
    primaryStyleId: 8100,
    subStyleId: 8300,
    summonerSpell1: 4,
    summonerSpell2: 14,
    items: [1001, 3157, undefined, undefined, undefined, undefined],
    matchCreatedAt: "2026-06-16T01:02:03.000Z"
  });
  assert.equal(records[1].puuid, "other");
  assert.equal(records[1].teamPosition, "TOP");
  assert.equal(records[1].win, false);
  assert.deepEqual(championMatchBuildRecordsFromMatch({
    ...match,
    info: { ...match.info, queueId: undefined }
  }), []);
  assert.deepEqual(championMatchBuildRecordsFromMatch({
    ...match,
    info: { ...match.info, gameVersion: "invalid" }
  }), []);
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
    routingStatus: () => ({ lolPlatform: "jp1" }),
    getAccountByRiotId: async () => ({ puuid: "puuid-1", gameName: "HideOnBush", tagLine: "KR1" }),
    getChampionMasteryTopByPuuid: async () => {
      throw new Error("mastery down");
    },
    getRankedStatsByPuuid: async () => undefined,
    getRecentMatchIdsByPuuid: async () => ["match-1"],
    getMatch: async () => ({
      metadata: { matchId: "match-1", participants: ["puuid-1"] },
      info: {
        gameCreation: Date.parse("2026-06-16T01:02:03.000Z"),
        participants: [{ puuid: "puuid-1", championId: 103, individualPosition: "MIDDLE", kills: 7, deaths: 3, assists: 8, win: false }]
      }
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
  assert.equal(patch.recentMatches?.[0]?.startedAt, "2026-06-16T01:02:03.000Z");
  assert.equal(patch.recentMatches?.[0]?.won, false);
  assert.equal(repo.getByRiotId("HideOnBush", "KR1")?.lolPlatform, "jp1");
});

test("LolProfileEnrichmentService는 방송자 프로필 최근 전적을 솔로랭크 10개로 제한하고 랭크 히스토리를 저장한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-streamer-solo-")), "profiles.json"));
  const puuid = "real-puuid-value-with-enough-length-1234567890";
  let requestedQueueIds;
  let requestedRankedQueueTypes;
  let requestedLadderQueueTypes;
  const riot = {
    isConfigured: () => true,
    routingStatus: () => ({ lolPlatform: "jp1" }),
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
  assert.equal(patch.rankHistory?.solo?.length, 1);
  assert.equal(patch.rankHistory?.solo?.[0]?.tier, "DIAMOND");
  assert.equal(patch.rankHistory?.solo?.[0]?.leaguePoints, 64);
  assert.equal(patch.rankHistory?.flex, undefined);
  assert.equal(patch.rankHistory?.ranked5v5, undefined);
});

test("LolProfileEnrichmentService는 Riot API key 오류를 failed profile로 표시한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-auth-failed-")), "profiles.json"));
  const errors = [];
  const riot = {
    isConfigured: () => true,
    routingStatus: () => ({ lolPlatform: "jp1" }),
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
  assert.equal(repo.getByRiotId("HideOnBush", "KR1")?.failureCode, "riot_auth");
  assert.equal(repo.getByRiotId("HideOnBush", "KR1")?.lolPlatform, "jp1");
});

test("LolProfileEnrichmentService는 계정 없음 사실을 표시 문구가 아닌 structured failureCode로 저장한다", async () => {
  const repo = new LocalJsonLolProfileRepository(join(mkdtempSync(join(tmpdir(), "lol-profile-not-found-")), "profiles.json"));
  const riot = {
    isConfigured: () => true,
    routingStatus: () => ({ lolPlatform: "jp1" }),
    getAccountByRiotId: async () => null
  };
  const service = new LolProfileEnrichmentService(riot, {}, repo, logger);

  const patch = await service.enrich(entry({ riotPuuid: undefined }), config(), true);
  const cached = repo.getByRiotId("HideOnBush", "KR1");

  assert.equal(patch.profileStatus, "failed");
  assert.equal(cached?.failureCode, "account_not_found");
  assert.equal(cached?.lolPlatform, "jp1");
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
