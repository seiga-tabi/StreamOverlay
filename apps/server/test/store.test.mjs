import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { Store } = await import("../dist/services/store.js");

test("Store EventSub dedupe 캐시는 오래된 message id를 정리한다", () => {
  const store = new Store();

  assert.equal(store.markTwitchEventSeen(["event-0"]), true);
  assert.equal(store.markTwitchEventSeen(["event-0"]), false);

  for (let index = 1; index <= 5000; index += 1) {
    assert.equal(store.markTwitchEventSeen([`event-${index}`]), true);
  }

  assert.equal(store.markTwitchEventSeen(["event-0"]), true);
});

test("Store는 질문과 하이라이트를 최근 항목으로 제한해 메모리 증가를 막는다", () => {
  const store = new Store();

  for (let index = 0; index < 250; index += 1) {
    store.addQuestion({ userName: "viewer", question: `question-${index}` });
    store.addHighlight({ userName: "viewer", reason: `highlight-${index}` });
  }

  assert.equal(store.getQuestions().length, 200);
  assert.equal(store.getHighlights().length, 200);
  assert.equal(store.getQuestions()[0].question, "question-249");
  assert.equal(store.getQuestions().at(-1).question, "question-50");
  assert.equal(store.getHighlights()[0].reason, "highlight-249");
  assert.equal(store.getHighlights().at(-1).reason, "highlight-50");
});

test("Store는 overlay 시참 대기열을 4명으로 제한하고 게임 시작 batch를 새 대기열로 갱신한다", () => {
  const store = new Store();
  store.setParticipationOpen(true);

  for (let index = 1; index <= 6; index += 1) {
    store.addParticipation(store.makeParticipationEntry({
      twitchUserId: `viewer-${index}`,
      twitchUserName: `Viewer${index}`,
      riotGameName: `Viewer${index}`,
      riotTagLine: "KR1",
      preferredRole: "fill",
      status: "waitlisted",
      source: "chat_command"
    }));
  }

  assert.deepEqual(store.getParticipationOverlayQueue().map((entry) => entry.twitchUserName), ["Viewer1", "Viewer2", "Viewer3", "Viewer4"]);

  const changed = store.markVisibleParticipationQueueInGame();
  assert.deepEqual(changed.map((entry) => entry.twitchUserName), ["Viewer1", "Viewer2", "Viewer3", "Viewer4"]);
  assert.deepEqual(store.getParticipationOverlayQueue().map((entry) => `${entry.position}:${entry.twitchUserName}`), ["1:Viewer5", "2:Viewer6"]);
});

test("Store는 이전 참가자의 비활성 Riot 프로필 기록을 재사용 후보로 반환한다", () => {
  const store = new Store();
  const previous = store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-1",
    twitchUserName: "Viewer1",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotPuuid: "puuid-hide",
    preferredRole: "mid",
    status: "played",
    source: "chat_command",
    profileStatus: "ready",
    mainRole: "MIDDLE",
    mainRoleConfidence: 82,
    topChampions: [{ championId: 103, nameKo: "아리" }],
    rankedStats: {
      queueType: "RANKED_SOLO_5x5",
      tier: "DIAMOND",
      rank: "I",
      leaguePoints: 55,
      wins: 100,
      losses: 80,
      winRate: 56,
      fetchedAt: "2026-06-26T00:00:00.000Z"
    },
    verifiedRank: "솔로랭크 DIAMOND I 55LP",
    profileAnalyzedAt: "2026-06-26T00:00:00.000Z"
  }));

  const reusable = store.findReusableParticipationProfile({
    riotGameName: "hideonbush",
    riotTagLine: "kr1"
  });

  assert.equal(reusable?.id, previous.id);
  assert.equal(reusable?.profileStatus, "ready");
  assert.equal(reusable?.mainRole, "MIDDLE");
  assert.equal(reusable?.topChampions?.[0]?.nameKo, "아리");
});

test("Store는 follower snapshot 차이로 팔로우 취소를 추정한다", () => {
  const store = new Store();

  store.reconcileFollowerSnapshot({
    followers: [
      { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" },
      { userId: "2", userLogin: "bravo", userName: "Bravo", followedAt: "2026-01-02T00:00:00.000Z" }
    ],
    total: 2,
    truncated: false
  });
  store.recordFollowerActivity({ userId: "1", userName: "Alpha", kind: "chat", genre: "채팅 참여" });
  store.recordFollowerActivity({ userId: "1", userName: "Alpha", kind: "participation", genre: "League of Legends 시참" });

  const state = store.reconcileFollowerSnapshot({
    followers: [
      { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" }
    ],
    total: 1,
    truncated: false
  });

  assert.equal(state.summary.activeFollowers, 1);
  assert.equal(state.summary.unfollowed, 1);
  assert.equal(state.recentUnfollowers[0].userId, "2");
  assert.deepEqual(state.topObservedGenres, [
    { name: "채팅 참여", count: 1 },
    { name: "League of Legends 시참", count: 1 }
  ]);
});

test("Store는 truncated follower snapshot으로 언팔로우를 추정하지 않는다", () => {
  const store = new Store();

  store.reconcileFollowerSnapshot({
    followers: [
      { userId: "1", userName: "Alpha" },
      { userId: "2", userName: "Bravo" }
    ],
    truncated: false
  });

  const state = store.reconcileFollowerSnapshot({
    followers: [{ userId: "1", userName: "Alpha" }],
    truncated: true
  });

  assert.equal(state.summary.activeFollowers, 2);
  assert.equal(state.summary.unfollowed, 0);
  assert.equal(state.lastSnapshotTruncated, true);
});

test("Store는 follower snapshot을 저장하고 재시작 후 팔로우 취소를 추정한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-followers-"));
  const filePath = path.join(dir, "followers.json");
  try {
    const firstStore = new Store({ followerStatePath: filePath });
    firstStore.reconcileFollowerSnapshot({
      followers: [
        { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" },
        { userId: "2", userLogin: "bravo", userName: "Bravo", followedAt: "2026-01-02T00:00:00.000Z" }
      ],
      total: 2,
      truncated: false
    });

    const restartedStore = new Store({ followerStatePath: filePath });
    const state = restartedStore.reconcileFollowerSnapshot({
      followers: [
        { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" }
      ],
      total: 1,
      truncated: false
    });

    assert.equal(state.summary.activeFollowers, 1);
    assert.equal(state.summary.unfollowed, 1);
    assert.equal(state.recentUnfollowers[0].userId, "2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
