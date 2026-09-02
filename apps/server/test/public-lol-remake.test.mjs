import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");

const TARGET_PUUID = "puuid-remake-target";
const TARGET_RIOT_ID = "Remake QA#JP1";

function createRequest(method, url) {
  return {
    method,
    url,
    headers: { host: "localhost:3000" },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {}
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers ?? {};
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

async function get(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  return {
    status: res.statusCode,
    json: res.body ? JSON.parse(res.body) : undefined
  };
}

function riotMatch(matchId, win, gameEndedInEarlySurrender = false, index = 0) {
  return {
    metadata: { matchId, participants: [TARGET_PUUID] },
    info: {
      queueId: 420,
      gameMode: "CLASSIC",
      gameType: "MATCHED_GAME",
      mapId: 11,
      gameCreation: Date.parse("2026-09-01T12:00:00.000Z") - index * 3_600_000,
      gameDuration: gameEndedInEarlySurrender ? 180 : 1_800,
      participants: [{
        participantId: 1,
        puuid: TARGET_PUUID,
        riotIdGameName: "Remake QA",
        riotIdTagline: "JP1",
        championId: 1,
        championName: "Annie",
        teamId: 100,
        win,
        gameEndedInEarlySurrender,
        kills: gameEndedInEarlySurrender ? 99 : win ? 8 : 2,
        deaths: gameEndedInEarlySurrender ? 99 : win ? 2 : 5,
        assists: gameEndedInEarlySurrender ? 99 : win ? 10 : 4,
        champLevel: gameEndedInEarlySurrender ? 3 : 18,
        totalMinionsKilled: gameEndedInEarlySurrender ? 10 : 180,
        goldEarned: gameEndedInEarlySurrender ? 1_000 : 12_000,
        totalDamageDealtToChampions: gameEndedInEarlySurrender ? 500 : 20_000,
        visionScore: gameEndedInEarlySurrender ? 0 : 25,
        individualPosition: "MIDDLE",
        teamPosition: "MIDDLE",
        summoner1Id: 4,
        summoner2Id: 14
      }],
      teams: [{ teamId: 100, win, objectives: {} }]
    }
  };
}

function createRiot() {
  const matches = [
    riotMatch("JP1_WIN_1", true, false, 0),
    riotMatch("JP1_REMAKE", false, true, 1),
    riotMatch("JP1_LOSS_1", false, false, 2),
    riotMatch("JP1_WIN_2", true, false, 3),
    riotMatch("JP1_LOSS_2", false, false, 4)
  ];
  const byId = new Map(matches.map((match) => [match.metadata.matchId, match]));
  return {
    isConfigured: () => true,
    async getAccountByRiotId() {
      return { puuid: TARGET_PUUID, gameName: "Remake QA", tagLine: "JP1" };
    },
    async getSummonerByPuuid() {
      return { puuid: TARGET_PUUID, summonerLevel: 100, profileIconId: 1 };
    },
    async getRankedStatsByPuuid() {
      return undefined;
    },
    async getChampionMasteryTopByPuuid() {
      return [];
    },
    async getRecentMatchIdsByPuuid() {
      return matches.map((match) => match.metadata.matchId);
    },
    async getMatch(matchId) {
      return byId.get(matchId) ?? null;
    },
    async getMatchTimeline() {
      return null;
    },
    async getCurrentGameByPuuid() {
      return null;
    }
  };
}

test("다시하기는 모든 공개 전적 매핑에서 승패보다 우선한다", async () => {
  const handler = createHttpHandler({ riot: createRiot(), store: {} });

  const matches = await get(
    handler,
    `/api/lol/matches?riotId=${encodeURIComponent(TARGET_RIOT_ID)}&platform=jp1`
  );
  assert.equal(matches.status, 200);
  const remake = matches.json.recentMatches.find((match) => match.matchId === "JP1_REMAKE");
  assert.equal(remake.result, "remake");
  assert.equal(remake.teams[0].result, "remake");

  const detail = await get(
    handler,
    `/api/lol/match-detail?matchId=JP1_REMAKE&riotId=${encodeURIComponent(TARGET_RIOT_ID)}`
  );
  assert.equal(detail.status, 200, JSON.stringify(detail.json));
  assert.equal(detail.json.teams[0].result, "remake");

  const build = await get(handler, "/api/lol/match-build?matchId=JP1_REMAKE");
  assert.equal(build.status, 200, JSON.stringify(build.json));
  assert.equal(build.json.participants[0].result, "remake");
});

test("최근 승률과 승수의 분자·분모에서 다시하기를 제외한다", async () => {
  const handler = createHttpHandler({ riot: createRiot(), store: {} });
  const profile = await get(
    handler,
    `/api/lol/profile?riotId=${encodeURIComponent(TARGET_RIOT_ID)}&platform=jp1`
  );

  assert.equal(profile.status, 200);
  assert.equal(profile.json.recentMatches.length, 5, "목록에는 다시하기를 보존합니다");
  assert.equal(profile.json.summary.recentGames, 4, "집계 표본에서는 다시하기를 뺍니다");
  assert.equal(profile.json.summary.recentWins, 2);
  assert.equal(profile.json.summary.recentWinRate, 50);
});
