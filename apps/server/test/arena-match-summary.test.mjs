import test from "node:test";
import assert from "node:assert/strict";

/* 아레나(CHERRY — 큐 1700/1710/1750) 요약 계약 — docs/mockups/lol-arena-match-row.html §⑥.
 *
 * 실제 라우트(/api/lol/matches)를 통해 검증합니다. 매핑 헬퍼가 모듈 밖으로
 * 노출돼 있지 않기도 하고, 확인해야 할 계약이 "리스트 요약 응답에 필드가 실려
 * 오는가" 라서 라우트를 통과시키는 편이 실제 계약과 같습니다. */

const { createHttpHandler } = await import("../dist/routes/http-api.js");

const TARGET_PUUID = "puuid-target";
const TARGET_RIOT_ID = "YORO QA#JP1";

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

/** 아레나 참가자 1명. 1750 은 3인×6팀 = 18명. */
function arenaParticipant(index) {
  const subteam = Math.floor(index / 3) + 1;      // 1..6
  const placement = subteam;                       // 팀 id 와 순위를 같게 두어 검증이 읽기 쉽게
  const isTarget = index === 7;                    // 3팀(순위 3위)의 두 번째 자리
  return {
    puuid: isTarget ? TARGET_PUUID : `puuid-${index}`,
    riotIdGameName: isTarget ? "YORO QA" : `Player${index}`,
    riotIdTagline: isTarget ? "JP1" : "KR1",
    championId: 100 + index,
    championName: `Champ${index}`,
    teamId: 100,                                   // 아레나는 teamId 가 팀 구분이 아닙니다
    playerSubteamId: subteam,
    subteamPlacement: placement,
    win: placement <= 3,
    kills: index, deaths: 1, assists: 2,
    champLevel: 18,
    totalDamageDealtToChampions: 10_000 + index * 100,
    totalDamageTaken: 9_000,
    goldEarned: 12_000 + index * 50,
    item0: 3000 + index, item1: 3001, item2: 3002, item3: 0, item4: 0, item5: 0,
    item6: 3340,                                   // 장신구 — 아레나 응답엔 원래 없지만, 와도 슬롯 6으로만 들어감
    playerAugment1: 1 + index, playerAugment2: 2 + index, playerAugment3: 3 + index,
    playerAugment4: 4 + index, playerAugment5: 5 + index, playerAugment6: 6 + index,
    summoner1Id: 4, summoner2Id: 14
  };
}

function arenaMatch(queueId = 1750) {
  return {
    metadata: { matchId: `JP1_ARENA_${queueId}` },
    info: {
      queueId,
      gameMode: "CHERRY",
      gameType: "MATCHED_GAME",
      mapId: 30,
      gameCreation: Date.parse("2026-08-17T10:00:00.000Z"),
      gameDuration: 900,
      participants: Array.from({ length: 18 }, (_, index) => arenaParticipant(index)),
      teams: []
    }
  };
}

/** 비교용 5v5 — 아레나 필드가 하나도 붙지 않아야 합니다. */
function summonersRiftMatch() {
  return {
    metadata: { matchId: "JP1_SR" },
    info: {
      queueId: 420,
      gameMode: "CLASSIC",
      gameType: "MATCHED_GAME",
      mapId: 11,
      gameCreation: Date.parse("2026-08-17T09:00:00.000Z"),
      gameDuration: 1_800,
      participants: [
        {
          puuid: TARGET_PUUID, riotIdGameName: "YORO QA", riotIdTagline: "JP1",
          championId: 238, championName: "Zed", teamId: 100, win: true,
          kills: 9, deaths: 3, assists: 6, champLevel: 18,
          totalMinionsKilled: 200, goldEarned: 14_000,
          item0: 3006, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
          summoner1Id: 4, summoner2Id: 14,
          individualPosition: "MIDDLE", teamPosition: "MIDDLE"
        }
      ],
      teams: [{ teamId: 100, win: true, objectives: {} }]
    }
  };
}

function createRiot(match) {
  return {
    isConfigured: () => true,
    async getAccountByRiotId() {
      return { puuid: TARGET_PUUID, gameName: "YORO QA", tagLine: "JP1" };
    },
    async getSummonerByPuuid() {
      return { puuid: TARGET_PUUID, summonerLevel: 180, profileIconId: 1 };
    },
    async getRecentMatchIdsByPuuid() {
      return [match.metadata.matchId];
    },
    async getMatch() {
      return match;
    },
    async getLeagueEntriesByPuuid() {
      return [];
    },
    async getCurrentGameByPuuid() {
      return null;
    }
  };
}

async function fetchMatches(match) {
  const handler = createHttpHandler({ riot: createRiot(match) });
  const res = createResponse();
  await handler(
    createRequest("GET", `/api/lol/matches?riotId=${encodeURIComponent(TARGET_RIOT_ID)}&platform=jp1`),
    res
  );
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : undefined };
}

test("아레나 1750 요약은 placement·subteamId·augments 와 순위순 arenaTeams 를 싣는다", async () => {
  const { status, json } = await fetchMatches(arenaMatch(1750));
  assert.equal(status, 200);
  const [row] = json.recentMatches ?? [];
  assert.ok(row, "요약 행이 있어야 합니다");

  /* ① 행 렌더의 최소 요건 3종 */
  assert.equal(row.placement, 3, "대상 참가자의 subteamPlacement");
  assert.equal(row.subteamId, 3, "대상 참가자의 playerSubteamId");
  assert.deepEqual(row.augments, [8, 9, 10, 11, 12, 13], "playerAugment1~6 을 픽 순서대로");

  /* ② arenaTeams — 3인×6팀, 순위 오름차순 */
  assert.ok(Array.isArray(row.arenaTeams), "arenaTeams 는 요약에 실립니다");
  assert.equal(row.arenaTeams.length, 6, "1750 은 6팀");
  assert.deepEqual(row.arenaTeams.map((team) => team.placement), [1, 2, 3, 4, 5, 6]);
  for (const team of row.arenaTeams) {
    assert.equal(team.players.length, 3, "1750 은 팀당 3명");
  }

  /* ③ 대상 본인 표시와 팀 내 우선 정렬 */
  const myTeam = row.arenaTeams.find((team) => team.placement === 3);
  assert.equal(myTeam.players[0].isTarget, true, "본인이 팀 내 첫 번째");
  assert.equal(myTeam.players[0].riotId, "YORO QA#JP1");
  assert.equal(
    row.arenaTeams.flatMap((team) => team.players).filter((player) => player.isTarget).length,
    1,
    "isTarget 은 정확히 한 명"
  );

  /* ④ 플레이어 필드 — 증강·아이템·지표 */
  const player = myTeam.players[0];
  assert.deepEqual(player.augments, [8, 9, 10, 11, 12, 13]);
  assert.equal(player.kills, 7);
  assert.equal(typeof player.damageDealtToChampions, "number");
  assert.equal(typeof player.goldEarned, "number");
  assert.ok(Array.isArray(player.items) && player.items.length > 0);
  assert.ok(player.champion && typeof player.champion.championId === "number");
});

test("아레나 2인 큐(1700)도 같은 구조로 담긴다", async () => {
  /* 1700 은 2인×팀이지만 매핑은 subteamId 그룹핑이라 인원·팀 수만 달라집니다.
     여기서는 같은 18명 픽스처를 1700 으로 돌려 큐 id 경로만 확인합니다. */
  const { status, json } = await fetchMatches(arenaMatch(1700));
  assert.equal(status, 200);
  const [row] = json.recentMatches ?? [];
  assert.equal(row.placement, 3);
  assert.equal(row.arenaTeams.length, 6);
});

test("비아레나(5v5) 응답에는 아레나 필드가 전혀 붙지 않는다", async () => {
  const { status, json } = await fetchMatches(summonersRiftMatch());
  assert.equal(status, 200);
  const [row] = json.recentMatches ?? [];
  assert.ok(row);
  assert.equal(row.placement, undefined);
  assert.equal(row.subteamId, undefined);
  assert.equal(row.arenaTeams, undefined);
  /* 증강이 없는 큐라 augments 도 생략됩니다(값이 전부 0). */
  assert.equal(row.augments, undefined);
  /* 기존 필드는 그대로 */
  assert.equal(row.result, "win");
  assert.equal(row.kills, 9);
});

test("순위 정보가 불완전하면 arenaTeams 를 생략해 승/패 폴백을 남긴다", async () => {
  /* 한 명이라도 subteamPlacement 가 없으면 반쪽짜리 순위표가 되므로 통째로 생략합니다.
     프런트는 arenaTeams 가 없으면 기존 문법으로 폴백합니다(fail-soft). */
  const match = arenaMatch(1750);
  delete match.info.participants[5].subteamPlacement;
  const { status, json } = await fetchMatches(match);
  assert.equal(status, 200);
  const [row] = json.recentMatches ?? [];
  assert.equal(row.arenaTeams, undefined, "불완전하면 순위표를 내보내지 않습니다");
  /* 대상 본인의 placement 는 자기 값이 살아 있으므로 그대로 옵니다. */
  assert.equal(row.placement, 3);
});

test("subteamPlacement 가 없고 placement 만 있는 응답도 받는다", async () => {
  /* placement 는 초기 스키마의 잔재라 둘 다 지원합니다. */
  const match = arenaMatch(1750);
  for (const participant of match.info.participants) {
    participant.placement = participant.subteamPlacement;
    delete participant.subteamPlacement;
  }
  const { status, json } = await fetchMatches(match);
  assert.equal(status, 200);
  const [row] = json.recentMatches ?? [];
  assert.equal(row.placement, 3);
  assert.equal(row.arenaTeams.length, 6);
});
