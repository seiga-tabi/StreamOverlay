import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CHAT_TRANSLATION_PROVIDER = "mock";
process.env.CHAT_TRANSLATION_ENABLED = "true";

const TEST_BROADCASTER_ID = "broadcaster-1";

const { ActionDispatcher } = await import("../dist/core/action-dispatcher.js");
const { EventBus } = await import("../dist/core/event-bus.js");
const { JsonlLogger } = await import("../dist/logging/jsonl-logger.js");
const { chatCommandsModule } = await import("../dist/modules/chat-commands.module.js");
const { chatOverlayModule } = await import("../dist/modules/chat-overlay.module.js");
const { lolProfileEnrichmentModule } = await import("../dist/modules/lol-profile-enrichment.module.js");
const { participationModule } = await import("../dist/modules/participation.module.js");
const { rewardsModule } = await import("../dist/modules/rewards.module.js");
const { streamStatusModule } = await import("../dist/modules/stream-status.module.js");
const { twitchOverlayModule } = await import("../dist/modules/twitch-overlay.module.js");
const { OverlayHub } = await import("../dist/services/overlay-hub.js");
const { DashboardHub } = await import("../dist/services/dashboard-hub.js");
const { Store } = await import("../dist/services/store.js");
const { appConfig } = await import("../dist/config.js");

class FakeSocket extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  sent = [];

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }
}

function createHarness(options = {}) {
  const store = new Store();
  const logger = new JsonlLogger(mkdtempSync(join(tmpdir(), "streamops-twitch-overlay-routing-")));
  const dashboard = new DashboardHub(store);
  const overlay = new OverlayHub(logger, store);
  const bridge = { send: () => "cmd-test" };
  const sentChatMessages = [];
  const twitchChat = {
    renderMessageTemplate(template, ctx) {
      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(ctx[key] ?? ""));
    },
    async sendChatMessage(message, options) {
      sentChatMessages.push({ message, options });
      return { status: "sent" };
    }
  };
  const actions = new ActionDispatcher(bridge, twitchChat, overlay, store, logger, undefined, options.localTts);
  const events = new EventBus();
  const socket = new FakeSocket();
  overlay.add(socket, "all", TEST_BROADCASTER_ID);
  const riot = options.riot ?? {
    isConfigured: () => false,
    getAccountByRiotId: async () => null,
    getRankedStatsByPuuid: async () => undefined
  };
  const twitch = options.twitch ?? {};
  const ctx = { events, actions, logger, store, overlay, dashboard, twitch, riot, lolProfileEnrichment: options.lolProfileEnrichment };
  return { events, actions, store, socket, ctx, sentChatMessages };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function settleUntil(predicate, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await settle();
  }
  throw new Error("비동기 상태 변경이 제한 시간 안에 반영되지 않았습니다.");
}

test("channel point redemption은 reward config를 거쳐 overlay.banner를 표시한다", async () => {
  const { events, socket, ctx } = createHarness();
  rewardsModule.setup(ctx);

  events.emit({
    type: "twitch.rewardRedemption",
    id: "reward-event-1",
    broadcasterUserId: "broadcaster-1",
    userId: "user-1",
    userName: "<ViewerTest>",
    rewardId: "",
    rewardTitle: "화면 흔들기",
    userInput: "<script>alert(1)</script>",
    createdAt: new Date().toISOString()
  });
  await settle();

  const banner = socket.sent.find((message) => message.type === "overlay.banner");
  assert.ok(banner);
  assert.equal(banner.title, "画面揺らし！");
  assert.match(banner.message, /ViewerTestさんが画面揺らしを発動しました/);
  assert.equal(banner.speechEnabled, true);
  assert.equal(banner.speechLanguage, "ja-JP");
  assert.doesNotMatch(banner.message, /[<>]/);
});

test("participation.open action은 시참 상태와 대기열 overlay를 함께 갱신한다", async () => {
  const { actions, store, socket } = createHarness();

  await actions.dispatchOne({ type: "participation.open", mode: "normal5" }, {}, "test.participation_open");

  const status = socket.sent.find((message) => message.type === "participation.status.update");
  const queue = socket.sent.find((message) => message.type === "participation.queue.update");

  assert.equal(store.getStatus().participation, "open");
  assert.ok(status);
  assert.equal(status.isOpen, true);
  assert.equal(status.phase, "recruiting");
  assert.ok(queue);
  assert.equal(queue.isOpen, true);
  assert.deepEqual(queue.queue, []);
});

test("DashboardHub는 스트리머별 시참 WebSocket snapshot을 격리한다", () => {
  const store = new Store();
  const dashboard = new DashboardHub(store);
  for (const streamerId of ["streamer-a", "streamer-b"]) {
    store.setParticipationOpen(true, streamerId);
    store.addParticipation(store.makeParticipationEntry({
      streamerId,
      twitchUserId: `viewer-${streamerId}`,
      twitchUserName: `Viewer-${streamerId}`,
      riotGameName: `Viewer-${streamerId}`,
      riotTagLine: "JP1",
      preferredRole: "fill",
      status: "waitlisted",
      source: "dashboard"
    }), streamerId);
  }

  const socketA = new FakeSocket();
  const socketB = new FakeSocket();
  dashboard.add(socketA, { role: "streamer", twitchUserId: "streamer-a" });
  dashboard.add(socketB, { role: "streamer", twitchUserId: "streamer-b" });

  assert.deepEqual(socketA.sent[0]?.participationQueue.map((entry) => entry.twitchUserName), ["Viewer-streamer-a"]);
  assert.deepEqual(socketB.sent[0]?.participationQueue.map((entry) => entry.twitchUserName), ["Viewer-streamer-b"]);
  assert.equal(socketA.sent[0]?.participationState.session?.streamerId, "streamer-a");
  assert.equal(socketB.sent[0]?.participationState.session?.streamerId, "streamer-b");
});

test("!질문 명령은 질문 큐에 저장되고 question overlay를 표시한다", async () => {
  const { events, store, socket, ctx } = createHarness();
  chatCommandsModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-event-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "<QuestionViewer>",
    message: "!질문 <b>다음 판은 어떤 챔피언을 할 예정인가요?</b>",
    createdAt: new Date().toISOString()
  });
  await settle();

  const question = store.getQuestions()[0];
  const overlayQuestion = socket.sent.find((message) => message.type === "question.show");
  assert.equal(question.userName, "QuestionViewer");
  assert.doesNotMatch(question.question, /[<>]/);
  assert.ok(overlayQuestion);
  assert.equal(overlayQuestion.userName, "QuestionViewer");
  assert.doesNotMatch(overlayQuestion.question, /[<>]/);
});

test("chat overlay는 일반 채팅만 안전하게 표시하고 명령어는 숨긴다", async () => {
  const { events, socket, ctx } = createHarness();
  chatOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-overlay-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "<ChatViewer>",
    message: "<script>alert(1)</script> 안녕하세요",
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-overlay-command-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "CommandViewer",
    message: "!질문 이 명령어는 chat overlay에 직접 표시하지 않습니다",
    createdAt: "2026-06-17T00:00:01.000Z"
  });
  await settle();

  const messages = socket.sent.filter((message) => message.type === "chat.message.add");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].userName, "ChatViewer");
  assert.doesNotMatch(messages[0].message, /[<>]/);
  assert.equal(messages[0].translationSourceLanguage, "ko");
  assert.equal(messages[0].translationTargetLanguage, "ja");
  assert.match(messages[0].translatedMessage, /^\[ja\]/);
  assert.equal("raw" in messages[0], false);
});

test("chat overlay는 Twitch 유저 프로필사진 URL을 메시지에 포함한다", async () => {
  const profileImageUrl = "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image-70x70.png";
  const { events, socket, ctx } = createHarness({
    twitch: {
      async getUserProfileImageUrl(userId) {
        assert.equal(userId, "123456");
        return profileImageUrl;
      }
    }
  });
  chatOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-overlay-profile-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "123456",
    chatterUserName: "ProfileViewer",
    message: "프로필사진 테스트",
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const message = socket.sent.find((sent) => sent.type === "chat.message.add");
  assert.ok(message);
  assert.equal(message.profileImageUrl, profileImageUrl);
});

test("chat overlay는 Twitch emote fragment를 이미지 URL로 변환한다", async () => {
  const { events, socket, ctx } = createHarness();
  chatOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-overlay-emote-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "EmoteViewer",
    message: "안녕 Kappa",
    fragments: [
      { type: "text", text: "안녕 " },
      { type: "emote", id: "25", text: "Kappa", emoteSetId: "0" }
    ],
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const message = socket.sent.find((sent) => sent.type === "chat.message.add");
  assert.ok(message);
  assert.equal(message.message, "안녕 Kappa");
  assert.deepEqual(message.fragments, [
    { type: "text", text: "안녕" },
    { type: "emote", id: "25", text: "Kappa", imageUrl: "https://static-cdn.jtvnw.net/emoticons/v2/25/static/light/3.0" }
  ]);
});

test("일본어/영어 질문 명령 alias는 같은 action으로 처리된다", async () => {
  const { events, store, socket, ctx } = createHarness();
  chatCommandsModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-event-alias-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "QuestionViewer",
    message: "！質問 次の試合ではどのチャンピオンを使いますか？",
    createdAt: new Date().toISOString()
  });
  await settle();

  const question = store.getQuestions()[0];
  const overlayQuestion = socket.sent.find((message) => message.type === "question.show");
  assert.ok(question);
  assert.match(question.question, /次の試合/);
  assert.ok(overlayQuestion);
  assert.match(overlayQuestion.question, /次の試合/);
});

test("stream.online은 stream status를 갱신하고 overlay.banner를 표시한다", async () => {
  const { events, store, socket, ctx } = createHarness();
  streamStatusModule.setup(ctx);

  events.emit({
    type: "twitch.streamOnline",
    id: "stream-online-1",
    broadcasterUserId: "broadcaster-1",
    createdAt: new Date().toISOString()
  });
  await settle();

  assert.equal(store.getStatus().stream, "online");
  assert.equal(store.getStatus().postStreamReportReady, false);
  assert.ok(socket.sent.some((message) => message.type === "overlay.banner" && message.source === "stream.online"));
});

test("stream.offline은 방송 상태 캐시를 지우고 post-stream report 준비 flag만 세운다", async () => {
  const clearedStreamUserIds = [];
  const { events, store, ctx } = createHarness({
    twitch: {
      clearStreamStatusCache(userId) {
        clearedStreamUserIds.push(userId);
      }
    }
  });
  streamStatusModule.setup(ctx);

  events.emit({
    type: "twitch.streamOffline",
    id: "stream-offline-1",
    broadcasterUserId: "broadcaster-1",
    createdAt: new Date().toISOString()
  });
  await settle();

  assert.equal(store.getStatus().stream, "offline");
  assert.equal(store.getStatus().postStreamReportReady, true);
  assert.deepEqual(clearedStreamUserIds, ["broadcaster-1"]);
  assert.equal(store.recentActions().some((action) => String(action.type).startsWith("shell.")), false);
});

test("twitch.follow 이벤트는 팔로우 알림 배너로 전달된다", async () => {
  const { events, socket, ctx } = createHarness();
  twitchOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.follow",
    id: "follow-1",
    broadcasterUserId: "broadcaster-1",
    userId: "user-1",
    userName: "<FollowViewer>",
    followedAt: "2026-06-17T00:00:00.000Z",
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "twitch.follow");
  assert.ok(banner);
  assert.equal(banner.eventKind, "follow");
  assert.match(banner.message, /FollowViewerさんがフォローしました/);
  assert.equal(banner.speechEnabled, true);
  assert.equal(banner.speechLanguage, "ja-JP");
  assert.doesNotMatch(banner.message, /[<>]/);
});

test("twitch.cheer 이벤트는 비트 수, 닉네임, 댓글을 배너와 TTS 문장에 반영한다", async () => {
  const { events, socket, ctx } = createHarness();
  twitchOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.cheer",
    id: "cheer-1",
    broadcasterUserId: "broadcaster-1",
    userId: "user-1",
    userName: "<BitViewer>",
    bits: 1500,
    message: "좋은 방송입니다!",
    isAnonymous: false,
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "twitch.cheer");
  assert.ok(banner);
  assert.equal(banner.eventKind, "cheer");
  assert.equal(banner.title, "1500 Bits");
  assert.match(banner.message, /BitViewerさん、1500 Bitsありがとうございます/);
  assert.match(banner.message, /좋은 방송입니다!/);
  assert.equal(banner.speechText, "BitViewerさん、1500ビッツありがとうございます。コメント、좋은 방송입니다!");
  assert.equal(banner.speechEnabled, true);
  assert.equal(banner.speechLanguage, "ja-JP");
  assert.doesNotMatch(banner.message, /[<>]/);
});

test("twitch.subscription 이벤트는 구독 tier와 닉네임을 TTS 문장에 반영한다", async () => {
  const { events, socket, ctx } = createHarness();
  twitchOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.subscription",
    id: "sub-1",
    broadcasterUserId: "broadcaster-1",
    userId: "user-1",
    userName: "<SubViewer>",
    tier: "2000",
    isGift: false,
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "twitch.subscription");
  assert.ok(banner);
  assert.equal(banner.eventKind, "subscription");
  assert.match(banner.message, /SubViewerさん、Tier 2サブスクありがとうございます/);
  assert.equal(banner.speechText, "SubViewerさん、ティア2のサブスクありがとうございます。");
  assert.equal(banner.speechEnabled, true);
  assert.equal(banner.speechLanguage, "ja-JP");
  assert.doesNotMatch(banner.message, /[<>]/);
});

test("twitch.subscriptionMessage 이벤트는 누적 개월과 댓글을 TTS 문장에 반영한다", async () => {
  const { events, socket, ctx } = createHarness();
  twitchOverlayModule.setup(ctx);

  events.emit({
    type: "twitch.subscriptionMessage",
    id: "resub-1",
    broadcasterUserId: "broadcaster-1",
    userId: "user-1",
    userName: "<ResubViewer>",
    tier: "1000",
    cumulativeMonths: 7,
    streakMonths: 3,
    message: "이번 달도 잘 볼게요!",
    createdAt: "2026-06-17T00:00:00.000Z"
  });
  await settle();

  const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "twitch.subscription_message");
  assert.ok(banner);
  assert.equal(banner.eventKind, "subscription_message");
  assert.match(banner.message, /ResubViewerさん、7か月のサブスクありがとうございます/);
  assert.match(banner.message, /이번 달도 잘 볼게요!/);
  assert.equal(banner.speechText, "ResubViewerさん、7か月のサブスクありがとうございます。コメント、이번 달도 잘 볼게요!");
  assert.equal(banner.speechEnabled, true);
  assert.equal(banner.speechLanguage, "ja-JP");
  assert.doesNotMatch(banner.message, /[<>]/);
});

test("overlay action은 동일 메시지 cooldown을 적용한다", async () => {
  const { actions, store, socket } = createHarness();
  const action = {
    type: "overlay.banner",
    title: "중복 테스트",
    message: "같은 메시지",
    variant: "info",
    durationMs: 3000,
    source: "test.cooldown"
  };

  await actions.dispatch([action, action], {}, "cooldown.test");

  const sent = socket.sent.filter((message) => message.type === "overlay.banner" && message.source === "test.cooldown");
  const statuses = store.recentActions(2).map((record) => record.status).sort();
  assert.equal(sent.length, 1);
  assert.deepEqual(statuses, ["ok", "skipped"]);
});

test("시참 snapshot은 cooldown 안에서도 최신 revision을 모두 전달한다", async () => {
  const { actions, socket } = createHarness();
  const baseAction = {
    type: "overlay.participationSnapshot",
    streamerId: TEST_BROADCASTER_ID,
    sessionId: "session-latest",
    status: {
      isOpen: true,
      mode: "normal5",
      phase: "recruiting",
      message: "롤 시참 모집 중"
    },
    queue: [],
    source: "test.snapshot.latest"
  };

  await actions.dispatchOne({
    ...baseAction,
    revision: 1,
    emittedAt: "2026-07-20T00:00:00.000Z"
  }, {}, "snapshot.latest");
  await actions.dispatchOne({
    ...baseAction,
    revision: 2,
    emittedAt: "2026-07-20T00:00:00.100Z"
  }, {}, "snapshot.latest");

  const sent = socket.sent.filter(
    (message) => message.type === "participation.snapshot.update"
      && message.sessionId === "session-latest"
  );
  assert.deepEqual(sent.map((message) => message.revision), [1, 2]);
});

test("overlay.banner는 로컬 TTS 생성이 지연되어도 배너 전송을 오래 막지 않는다", async () => {
  const previousLocalTts = { ...appConfig.localTts };
  try {
    appConfig.localTts.enabled = true;
    appConfig.localTts.broadcastWaitMs = 500;
    const { actions, socket } = createHarness({
      localTts: {
        async synthesizeOverlaySpeech() {
          return new Promise(() => {});
        }
      }
    });
    const startedAt = Date.now();

    await actions.dispatchOne({
      type: "overlay.banner",
      message: "TTS timeout test",
      speechEnabled: true,
      speechLanguage: "ja-JP",
      source: "test.tts_timeout"
    }, {}, "test.tts_timeout");

    const elapsedMs = Date.now() - startedAt;
    const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "test.tts_timeout");
    assert.ok(elapsedMs < 4000, `dispatch took ${elapsedMs}ms`);
    assert.ok(banner);
    assert.equal(banner.speechAudioUrl, undefined);
    assert.equal(banner.speechEnabled, true);
    assert.equal(banner.speechLanguage, "ja-JP");
  } finally {
    Object.assign(appConfig.localTts, previousLocalTts);
  }
});

test("overlay.banner는 설정된 대기 시간 안에 생성된 로컬 TTS URL을 배너에 포함한다", async () => {
  const previousLocalTts = { ...appConfig.localTts };
  try {
    appConfig.localTts.enabled = true;
    appConfig.localTts.broadcastWaitMs = 1000;
    const { actions, socket } = createHarness({
      localTts: {
        async synthesizeOverlaySpeech() {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return "/tts/generated-follow.wav";
        }
      }
    });

    await actions.dispatchOne({
      type: "overlay.banner",
      message: "TTS generated test",
      speechEnabled: true,
      speechLanguage: "ja-JP",
      source: "test.tts_generated"
    }, {}, "test.tts_generated");

    const banner = socket.sent.find((message) => message.type === "overlay.banner" && message.source === "test.tts_generated");
    assert.ok(banner);
    assert.equal(banner.speechEnabled, true);
    assert.equal(banner.speechAudioUrl, "/tts/generated-follow.wav");
  } finally {
    Object.assign(appConfig.localTts, previousLocalTts);
  }
});

test("!시참 신청은 Riot 프로필 분석 결과를 안전한 overlay queue로 전달한다", async () => {
  const { events, store, socket, ctx } = createHarness({
    riot: {
      isConfigured: () => true,
      getAccountByRiotId: async () => ({ puuid: "puuid-1", gameName: "HideOnBush", tagLine: "KR1" })
    },
    lolProfileEnrichment: {
      getCachedPatch: () => undefined,
      enrich: async () => ({
        profileStatus: "ready",
        mainRole: "MIDDLE",
        mainRoleConfidence: 70,
        topChampions: [{ championId: 157, championKey: "Yasuo", nameKo: "야스오" }],
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 64,
          wins: 92,
          losses: 74,
          winRate: 55,
          summonerLevel: 421,
          profileIconId: 29,
          fetchedAt: "2026-06-16T00:00:00.000Z"
        }
      })
    }
  });
  lolProfileEnrichmentModule.setup(ctx);
  participationModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-open-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "broadcaster-1",
    chatterUserName: "Streamer",
    message: "!queueopen",
    createdAt: new Date().toISOString()
  });
  await settle();

  const openedStatus = socket.sent.find((message) => message.type === "participation.status.update" && message.isOpen === true);
  assert.ok(openedStatus);
  assert.equal(openedStatus.message, "롤 시참 모집 중");

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-apply-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "RankViewer",
    message: "！参加 HideOnBush#KR1",
    createdAt: new Date().toISOString()
  });
  await settle();
  await settle();

  const entry = store.getParticipationQueue(TEST_BROADCASTER_ID)[0];
  const queueMessages = socket.sent.filter((message) => message.type === "participation.queue.update" && message.queue.length > 0);
  const queueMessage = queueMessages[queueMessages.length - 1];

  assert.equal(entry.riotPuuid, "puuid-1");
  assert.equal(entry.preferredRole, "unknown");
  assert.equal(entry.mainRole, "MIDDLE");
  assert.equal(entry.rankedStats?.tier, "DIAMOND");
  assert.ok(queueMessage);
  assert.equal(queueMessage.queue[0].twitchUserName, "RankViewer");
  assert.equal(queueMessage.queue[0].rankedStats.tier, "DIAMOND");
  assert.equal(queueMessage.queue[0].mainRole, "MIDDLE");
  assert.equal(queueMessage.queue[0].topChampions[0].nameKo, "야스오");
  assert.equal("riotId" in queueMessage.queue[0], false);
  assert.equal("riotPuuid" in queueMessage.queue[0], false);

  assert.ok(store.selectNextParticipant(30, TEST_BROADCASTER_ID));

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-checkin-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-1",
    chatterUserName: "RankViewer",
    message: "!checkin",
    createdAt: new Date().toISOString()
  });
  await settle();

  assert.equal(store.getParticipationQueue(TEST_BROADCASTER_ID)[0].status, "checked_in");
  const lastQueueMessage = socket.sent.filter((message) => message.type === "participation.queue.update").at(-1);
  const retainedStatus = socket.sent.filter((message) => message.type === "participation.status.update").at(-1);
  assert.ok(lastQueueMessage);
  assert.equal(lastQueueMessage.isOpen, true);
  assert.equal(lastQueueMessage.queue.length, 0);
  assert.ok(retainedStatus);
  assert.equal(retainedStatus.isOpen, true);
});

test("Riot 검증이 지연되어도 pending snapshot을 먼저 전송하고 검증 후 승격한다", async () => {
  let resolveAccount;
  const accountPromise = new Promise((resolve) => {
    resolveAccount = resolve;
  });
  const { events, store, socket, ctx } = createHarness({
    riot: {
      isConfigured: () => true,
      getAccountByRiotId: () => accountPromise,
      getRankedStatsByPuuid: async () => undefined
    }
  });
  participationModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-delayed-open-1",
    broadcasterUserId: TEST_BROADCASTER_ID,
    chatterUserId: TEST_BROADCASTER_ID,
    chatterUserName: "Streamer",
    message: "!queueopen",
    createdAt: new Date().toISOString()
  });
  await settleUntil(() => store.getParticipationState(TEST_BROADCASTER_ID).isOpen === true);

  const sentBeforeApply = socket.sent.length;
  events.emit({
    type: "twitch.chatMessage",
    id: "chat-delayed-apply-1",
    broadcasterUserId: TEST_BROADCASTER_ID,
    chatterUserId: "user-delayed",
    chatterUserName: "DelayedViewer",
    message: "！参加 HideOnBush#KR1",
    createdAt: new Date().toISOString()
  });
  await settleUntil(
    () => store.getParticipationQueue(TEST_BROADCASTER_ID)[0]?.status === "pending"
  );

  const pendingSnapshot = socket.sent.slice(sentBeforeApply).find((message) => (
    message.type === "participation.snapshot.update"
    && message.queue[0]?.status === "pending"
  ));
  assert.ok(pendingSnapshot);

  resolveAccount({
    puuid: "puuid-delayed",
    gameName: "HideOnBush",
    tagLine: "KR1"
  });
  await settleUntil(() => (
    store.getParticipationQueue(TEST_BROADCASTER_ID)[0]?.status === "verified"
    && socket.sent.some((message) => (
      message.type === "participation.snapshot.update"
      && message.sessionId === pendingSnapshot.sessionId
      && message.queue[0]?.status === "verified"
    ))
  ), 100);

  const verifiedSnapshot = socket.sent
    .filter((message) => (
      message.type === "participation.snapshot.update"
      && message.sessionId === pendingSnapshot.sessionId
    ))
    .at(-1);
  assert.ok(verifiedSnapshot);
  assert.equal(verifiedSnapshot.queue[0]?.status, "verified");
  assert.ok(verifiedSnapshot.revision > pendingSnapshot.revision);
});

test("!시참시작 명령이 반복되어도 Twitch 안내 채팅은 한 번만 전송한다", async () => {
  const { events, store, ctx, sentChatMessages } = createHarness();
  participationModule.setup(ctx);

  const baseEvent = {
    type: "twitch.chatMessage",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "broadcaster-1",
    chatterUserName: "Streamer",
    message: "!시참시작",
    createdAt: new Date().toISOString()
  };

  events.emit({ ...baseEvent, id: "chat-open-once-1" });
  await settle();
  events.emit({ ...baseEvent, id: "chat-open-once-2" });
  await settle();

  assert.equal(store.getParticipationState(TEST_BROADCASTER_ID).isOpen, true);
  assert.equal(sentChatMessages.length, 1);
  assert.match(sentChatMessages[0].message, /参加案内/);
});

test("!시참 신청은 이전 비활성 참가 기록을 새로 만들지 않고 재사용한다", async () => {
  const { events, store, socket, ctx } = createHarness();
  participationModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-reuse-open-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "broadcaster-1",
    chatterUserName: "Streamer",
    message: "!queueopen",
    createdAt: new Date().toISOString()
  });
  await settle();

  const firstApply = {
    type: "twitch.chatMessage",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-reuse-1",
    chatterUserName: "ReuseViewer",
    message: "!시참 HideOnBush#KR1",
    createdAt: new Date().toISOString()
  };
  events.emit({ ...firstApply, id: "chat-reuse-apply-1" });
  await settle();

  const firstEntry = store.getParticipationQueue(TEST_BROADCASTER_ID)[0];
  assert.ok(firstEntry);
  store.markParticipant(firstEntry.id, "played", TEST_BROADCASTER_ID);
  assert.equal(store.getParticipationQueue(TEST_BROADCASTER_ID)[0].status, "played");

  events.emit({ ...firstApply, id: "chat-reuse-apply-2", chatterUserName: "ReuseViewerRenamed" });
  await settleUntil(() => (
    store.getParticipationQueue(TEST_BROADCASTER_ID)[0]?.twitchUserName === "ReuseViewerRenamed"
    && socket.sent.some((message) => (
      message.type === "participation.snapshot.update"
      && message.queue[0]?.twitchUserName === "ReuseViewerRenamed"
    ))
  ));

  const queue = store.getParticipationQueue(TEST_BROADCASTER_ID);
  const lastQueueMessage = socket.sent.filter((message) => message.type === "participation.snapshot.update").at(-1);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, firstEntry.id);
  assert.equal(queue[0].createdAt, firstEntry.createdAt);
  assert.equal(queue[0].twitchUserName, "ReuseViewerRenamed");
  assert.equal(queue[0].status, "waitlisted");
  assert.equal(queue[0].playedAt, undefined);
  assert.ok(lastQueueMessage);
  assert.equal(lastQueueMessage.queue.length, 1);
  assert.equal(lastQueueMessage.queue[0].twitchUserName, "ReuseViewerRenamed");
});

test("!시참취소 명령은 본인 신청을 취소하고 overlay 대기열에서 제거한다", async () => {
  const { events, store, socket, ctx } = createHarness();
  participationModule.setup(ctx);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-open-cancel-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "broadcaster-1",
    chatterUserName: "Streamer",
    message: "!queueopen",
    createdAt: new Date().toISOString()
  });
  await settle();

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-apply-cancel-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-cancel-1",
    chatterUserName: "CancelViewer",
    message: "!시참 HideOnBush#KR1",
    createdAt: new Date().toISOString()
  });
  await settle();

  assert.equal(store.getParticipationQueue(TEST_BROADCASTER_ID)[0].status, "waitlisted");
  assert.equal(store.getParticipationOverlayQueue(undefined, TEST_BROADCASTER_ID).length, 1);

  events.emit({
    type: "twitch.chatMessage",
    id: "chat-cancel-1",
    broadcasterUserId: "broadcaster-1",
    chatterUserId: "user-cancel-1",
    chatterUserName: "CancelViewer",
    message: "!cancel",
    createdAt: new Date().toISOString()
  });
  await settle();

  assert.equal(store.getParticipationQueue(TEST_BROADCASTER_ID)[0].status, "cancelled");
  assert.equal(store.getParticipationOverlayQueue(undefined, TEST_BROADCASTER_ID).length, 0);

  const lastQueueMessage = socket.sent.filter((message) => message.type === "participation.queue.update").at(-1);
  assert.ok(lastQueueMessage);
  assert.equal(lastQueueMessage.queue.length, 0);
});
