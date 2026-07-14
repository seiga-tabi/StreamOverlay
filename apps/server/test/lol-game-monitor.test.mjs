import test from "node:test";
import assert from "node:assert/strict";

const { LolGameMonitorController } = await import("../dist/modules/lol-game-monitor.module.js");
const { EventBus } = await import("../dist/core/event-bus.js");
const { Store } = await import("../dist/services/store.js");

function createLogger() {
  return {
    events: [],
    errors: [],
    event(payload) {
      this.events.push(payload);
    },
    error(payload) {
      this.errors.push(payload);
    },
    action() {},
    question() {},
    highlight() {},
    translation() {}
  };
}

function createHarness() {
  const store = new Store();
  store.setParticipationOpen(true);
  const overlayMessages = [];
  const chatActions = [];
  const logger = createLogger();
  const ctx = {
    events: new EventBus(),
    actions: {
      async dispatchOne(action, _ctx, reason) {
        chatActions.push({ action, reason });
        return { id: "action-test", type: action.type, status: "ok", createdAt: new Date().toISOString() };
      }
    },
    logger,
    store,
    overlay: {
      broadcast(message) {
        overlayMessages.push(message);
        return true;
      }
    },
    dashboard: {
      snapshots: 0,
      broadcastSnapshot() {
        this.snapshots += 1;
      }
    },
    twitch: {},
    riot: {
      currentGame: {
        gameId: 10001,
        gameStartTime: 1760000000000,
        participants: [
          { puuid: "streamer-puuid", championId: 103, teamId: 100 },
          { puuid: "viewer-1-puuid", championId: 1, teamId: 100 },
          { puuid: "viewer-2-puuid", championId: 2, teamId: 100 },
          { puuid: "viewer-3-puuid", championId: 3, teamId: 100 },
          { puuid: "viewer-4-puuid", championId: 4, teamId: 100 }
        ]
      },
      isConfigured() {
        return true;
      },
      async getAccountByRiotId(gameName, tagLine) {
        assert.equal(gameName, "Streamer");
        assert.equal(tagLine, "KR1");
        return { puuid: "streamer-puuid", gameName, tagLine };
      },
      async getCurrentGameByPuuid(puuid) {
        assert.equal(puuid, "streamer-puuid");
        return this.currentGame;
      }
    }
  };
  return { ctx, overlayMessages, chatActions, logger };
}

test("LolGameMonitorController는 게임 시작 시 current game에 있는 참가자만 in_game으로 표시한다", async () => {
  const { ctx, overlayMessages } = createHarness();
  for (let index = 1; index <= 5; index += 1) {
    ctx.store.addParticipation(ctx.store.makeParticipationEntry({
      twitchUserId: `viewer-${index}`,
      twitchUserName: `Viewer${index}`,
      riotGameName: `Viewer${index}`,
      riotTagLine: "KR1",
      riotPuuid: `viewer-${index}-puuid`,
      preferredRole: "mid",
      status: "waitlisted",
      source: "chat_command"
    }));
  }

  const controller = new LolGameMonitorController(ctx, {
    enabled: true,
    streamerRiotId: "Streamer#KR1",
    pollIntervalMs: 60000,
    gameEndDebounceMs: 0,
    autoSelectNextAfterGame: true,
    announceInChat: false
  }, { mode: "normal5", checkInSeconds: 30 });

  await controller.start();
  controller.stop();

  const queue = ctx.store.getParticipationQueue();
  assert.deepEqual(queue.slice(0, 4).map((entry) => entry.status), ["in_game", "in_game", "in_game", "in_game"]);
  assert.equal(queue[4].status, "waitlisted");
  assert.ok(overlayMessages.some((message) => message.type === "participation.status.update" && message.phase === "in_game" && message.nextCandidate?.twitchUserName === "Viewer5"));
  assert.ok(overlayMessages.some((message) => message.type === "participation.queue.update" && message.queue.length === 1 && message.queue[0].position === 1 && message.queue[0].twitchUserName === "Viewer5"));
  assert.equal(overlayMessages.some((message) => message.type === "participation.selected.clear"), false);
});

test("LolGameMonitorController는 게임 종료 후 in_game을 played로 바꾸고 다음 참가자를 선정한다", async () => {
  const { ctx, overlayMessages, chatActions } = createHarness();
  for (let index = 1; index <= 5; index += 1) {
    ctx.store.addParticipation(ctx.store.makeParticipationEntry({
      twitchUserId: `viewer-${index}`,
      twitchUserName: `Viewer${index}`,
      riotGameName: `Viewer${index}`,
      riotTagLine: "KR1",
      riotPuuid: `viewer-${index}-puuid`,
      preferredRole: "mid",
      status: "waitlisted",
      source: "chat_command"
    }));
  }

  const controller = new LolGameMonitorController(ctx, {
    enabled: true,
    streamerRiotId: "Streamer#KR1",
    pollIntervalMs: 60000,
    gameEndDebounceMs: 0,
    autoSelectNextAfterGame: true,
    announceInChat: true
  }, { mode: "normal5", checkInSeconds: 30 });

  await controller.start();
  controller.stop();
  ctx.riot.currentGame = null;
  await controller.pollOnce();

  const queue = ctx.store.getParticipationQueue();
  assert.deepEqual(queue.slice(0, 4).map((entry) => entry.status), ["played", "played", "played", "played"]);
  assert.equal(queue[4].status, "selected");
  assert.ok(overlayMessages.some((message) => message.type === "participation.status.update" && message.phase === "game_ended" && message.nextCandidate?.twitchUserName === "Viewer5"));
  assert.equal(overlayMessages.some((message) => message.type === "participation.selected.show"), false);
  assert.equal(chatActions.some((item) => item.reason === "lol_game_monitor.game_ended"), false);
});

test("LolGameMonitorController는 방송자 Riot 계정 조회 실패 시 설정 저장 흐름을 깨지 않는다", async () => {
  const { ctx, logger } = createHarness();
  ctx.riot.getAccountByRiotId = async () => {
    throw new Error("Riot API account.by_riot_id failed: 401 Unknown apikey");
  };

  const controller = new LolGameMonitorController(ctx, {
    enabled: true,
    streamerRiotId: "Streamer#KR1",
    pollIntervalMs: 60000,
    gameEndDebounceMs: 0,
    autoSelectNextAfterGame: true,
    announceInChat: false
  }, { mode: "normal5", checkInSeconds: 30 });

  await assert.doesNotReject(() => controller.start());

  assert.equal(logger.errors.at(-1)?.type, "lol_game_monitor.disabled");
  assert.match(logger.errors.at(-1)?.reason, /Unknown apikey/);
});

test("LolGameMonitorController는 해당 스트리머의 게임 종료만 해당 대기열에 반영한다", async () => {
  const { ctx } = createHarness();
  const streamerA = "streamer-a";
  const streamerB = "streamer-b";
  ctx.store.setParticipationOpen(true, streamerA);
  ctx.store.setParticipationOpen(true, streamerB);
  for (const streamerId of [streamerA, streamerB]) {
    ctx.store.addParticipation(ctx.store.makeParticipationEntry({
      streamerId,
      twitchUserId: `viewer-${streamerId}`,
      twitchUserName: `Viewer-${streamerId}`,
      riotGameName: `Viewer-${streamerId}`,
      riotTagLine: "JP1",
      riotPuuid: `viewer-${streamerId}-puuid`,
      preferredRole: "fill",
      status: "in_game",
      source: "dashboard"
    }), streamerId);
  }

  const controller = new LolGameMonitorController(ctx, {
    enabled: true,
    streamerRiotId: "Streamer#KR1",
    pollIntervalMs: 60000,
    gameEndDebounceMs: 0,
    autoSelectNextAfterGame: false,
    announceInChat: false
  }, { mode: "normal5", checkInSeconds: 30 }, () => Date.now(), streamerA);

  await controller.start();
  controller.stop();
  assert.equal(ctx.store.getParticipationSession(streamerA)?.status, "in_game");
  assert.equal(ctx.store.getParticipationSession(streamerB)?.status, "recruiting");
  ctx.riot.currentGame = null;
  await controller.pollOnce();

  assert.equal(ctx.store.getParticipationQueue(streamerA)[0]?.status, "played");
  assert.equal(ctx.store.getParticipationQueue(streamerB)[0]?.status, "in_game");
  assert.equal(ctx.store.getParticipationSession(streamerA)?.status, "recruiting");
  assert.equal(ctx.store.getParticipationSession(streamerB)?.status, "recruiting");
});
