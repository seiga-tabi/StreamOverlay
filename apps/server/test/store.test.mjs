import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("Store는 같은 트위치 유저의 이전 비활성 참가 기록을 다시 대기열에 올린다", () => {
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
    topChampions: [{ championId: 103, nameKo: "아리" }],
    playedAt: "2026-06-26T00:00:00.000Z"
  }));

  const result = store.reactivateReusableParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-1",
    twitchUserName: "ViewerRenamed",
    riotGameName: "HideOnBush",
    riotTagLine: "KR1",
    riotPuuid: "puuid-hide",
    preferredRole: "jungle",
    requestedRole: "jungle",
    status: "verified",
    source: "chat_command"
  }));

  assert.equal(result.reused, true);
  assert.equal(result.entry.id, previous.id);
  assert.equal(result.entry.createdAt, previous.createdAt);
  assert.equal(result.entry.twitchUserName, "ViewerRenamed");
  assert.equal(result.entry.status, "verified");
  assert.equal(result.entry.preferredRole, "jungle");
  assert.equal(result.entry.playedAt, undefined);
  assert.equal(result.entry.profileStatus, "ready");
  assert.equal(result.entry.mainRole, "MIDDLE");
  assert.equal(result.entry.topChampions?.[0]?.nameKo, "아리");
  assert.equal(store.getParticipationQueue().length, 1);
  assert.deepEqual(store.getParticipationOverlayQueue().map((entry) => entry.twitchUserName), ["ViewerRenamed"]);
});

test("Store는 참여 운영 상태를 atomic JSON 파일에서 복원한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-runtime-state-"));
  const filePath = path.join(dir, "runtime-state.json");
  try {
    const firstStore = new Store({ runtimeStatePath: filePath });
    firstStore.setParticipationOpen(true);
    firstStore.addParticipation(firstStore.makeParticipationEntry({
      twitchUserId: "viewer-persisted",
      twitchUserName: "ViewerPersisted",
      riotGameName: "PersistedPlayer",
      riotTagLine: "JP1",
      preferredRole: "mid",
      status: "waitlisted",
      source: "dashboard"
    }));
    firstStore.close();

    const restartedStore = new Store({ runtimeStatePath: filePath });
    assert.equal(restartedStore.getParticipationState().isOpen, true);
    assert.equal(restartedStore.getParticipationQueue().length, 1);
    assert.equal(restartedStore.getParticipationQueue()[0]?.twitchUserName, "ViewerPersisted");
    assert.equal(restartedStore.getReadiness().ok, true);
    restartedStore.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 대회와 커뮤니티 저장 실패를 callback과 readiness에 노출한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-persistence-failure-"));
  const failures = [];
  try {
    const store = new Store({
      tournamentStatePath: dir,
      communityStatePath: dir,
      onPersistenceError: (failure) => failures.push(failure)
    });
    store.flush();

    assert.ok(failures.some((failure) => failure.scope === "tournaments" && failure.operation === "save"));
    assert.ok(failures.some((failure) => failure.scope === "community" && failure.operation === "save"));
    assert.equal(store.getReadiness().ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 스트리머 Riot ID 등록 요청을 저장하고 승인 목록을 갱신한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-riot-requests-"));
  const filePath = path.join(dir, "streamer-riot-ids.json");
  try {
    const store = new Store({ streamerRiotIdStatePath: filePath });
    const first = store.upsertStreamerRiotIdRequest({
      twitchUserId: "twitch-1",
      twitchLogin: "streamer",
      twitchDisplayName: "Streamer",
      twitchProfileImageUrl: "https://example.test/avatar.png",
      riotGameName: "Seiga",
      riotTagLine: "JP1"
    });

    assert.equal(first.status, "pending");
    assert.equal(store.listStreamerRiotIdRequests().length, 1);

    const approved = store.resolveStreamerRiotIdRequest({ requestId: first.id, decision: "approved", reviewer: "dashboard" });
    assert.equal(approved?.status, "approved");
    assert.equal(approved?.overlaySlug, "streamer");
    assert.match(approved?.overlayKey ?? "", /^sok_/);
    assert.deepEqual(store.listApprovedStreamerRiotIds().map((request) => request.normalizedRiotId), ["seiga#jp1"]);
    const linked = store.updateApprovedStreamerProfileLink({
      twitchUserId: "twitch-1",
      profileLinks: [
        {
          id: "profile-youtube",
          url: "https://youtube.com/@streamer",
          label: "YouTube",
          platform: "youtube"
        },
        {
          id: "profile-discord",
          url: "https://discord.gg/example",
          label: "Discord",
          platform: "discord"
        }
      ]
    });
    assert.equal(linked?.profileLinkUrl, "https://youtube.com/@streamer");
    assert.equal(linked?.profileLinkLabel, "YouTube");
    assert.equal(linked?.profileLinks?.length, 2);
    assert.equal(linked?.profileLinks?.[1]?.platform, "discord");
    const renamed = store.updateApprovedStreamerRiotId({
      twitchUserId: "twitch-1",
      riotGameName: "SeigaChanged",
      riotTagLine: "JP2"
    });
    assert.equal(renamed?.normalizedRiotId, "seigachanged#jp2");
    assert.equal(renamed?.overlayKey, approved?.overlayKey);
    assert.equal(renamed?.profileLinkUrl, "https://youtube.com/@streamer");
    assert.equal(renamed?.profileLinks?.length, 2);
    assert.deepEqual(store.listApprovedStreamerRiotIds().map((request) => request.normalizedRiotId), ["seigachanged#jp2"]);

    const second = store.upsertStreamerRiotIdRequest({
      twitchUserId: "twitch-1",
      twitchLogin: "streamer",
      twitchDisplayName: "Streamer",
      riotGameName: "Seiga",
      riotTagLine: "SEI"
    });
    store.resolveStreamerRiotIdRequest({ requestId: second.id, decision: "approved", reviewer: "dashboard" });

    const approvedRequests = store.listApprovedStreamerRiotIds();
    assert.equal(approvedRequests.length, 1);
    assert.equal(approvedRequests[0].normalizedRiotId, "seiga#sei");
    assert.equal(approvedRequests[0].overlayKey, approved?.overlayKey);
    assert.equal(approvedRequests[0].profileLinkUrl, "https://youtube.com/@streamer");
    assert.equal(approvedRequests[0].profileLinks?.length, 2);

    const restartedStore = new Store({ streamerRiotIdStatePath: filePath });
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].normalizedRiotId, "seiga#sei");
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].overlayKey, approved?.overlayKey);
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].profileLinkLabel, "YouTube");
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].profileLinks?.[1]?.label, "Discord");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 승인 스트리머 대회를 저장하고 공개 목록만 노출한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-tournaments-"));
  const riotPath = path.join(dir, "streamer-riot-ids.json");
  const tournamentPath = path.join(dir, "tournaments.json");
  try {
    const store = new Store({ streamerRiotIdStatePath: riotPath, tournamentStatePath: tournamentPath });
    const request = store.upsertStreamerRiotIdRequest({
      twitchUserId: "twitch-1",
      twitchLogin: "seiga",
      twitchDisplayName: "Seiga",
      twitchProfileImageUrl: "https://example.test/avatar.png",
      riotGameName: "Seiga",
      riotTagLine: "JP1"
    });
    const owner = store.resolveStreamerRiotIdRequest({ requestId: request.id, decision: "approved", reviewer: "dashboard" });

    const draft = store.upsertStreamerTournament({
      title: "비공개 스크림",
      visibility: "draft",
      teams: [{ id: "team-a", name: "A팀" }]
    }, owner);
    const publicTournament = store.upsertStreamerTournament({
      title: "SEIGA CUP",
      description: "스트리머 롤 대회",
      startsAt: "2026-07-10T19:00",
      endsAt: "2026-07-20T22:00",
      formatLabel: "16강 BO3 · 결승 BO5",
      prizeLabel: "1,000,000원",
      visibility: "public",
      teams: [
        { id: "team-1", name: "세이가팀", seed: 1 },
        { id: "team-2", name: "하루팀", seed: 16 }
      ],
      matches: [
        {
          id: "match-1",
          round: "16강",
          teamAId: "team-1",
          teamBId: "team-2",
          scheduledAt: "2026-07-10T19:00",
          format: "BO3",
          status: "scheduled"
        }
      ],
      news: [{ id: "news-1", title: "대진 공개", body: "16강 대진이 공개되었습니다.", publishedAt: "2026-07-02T00:00:00.000Z" }]
    }, owner);

    assert.equal(draft?.visibility, "draft");
    assert.equal(publicTournament?.visibility, "public");
    assert.equal(store.listDashboardTournaments({ role: "streamer", twitchUserId: "twitch-1" }).length, 2);
    assert.deepEqual(store.listDashboardTournaments({ role: "streamer", twitchUserId: "other" }), []);
    assert.deepEqual(store.listPublicTournaments().map((tournament) => tournament.title), ["SEIGA CUP"]);
    assert.equal(store.getPublicTournamentBySlug(publicTournament.slug)?.matches[0].teamAId, "team-1");
    assert.equal(store.deleteStreamerTournament(draft.id, { ...owner, twitchUserId: "other" }), false);

    const restartedStore = new Store({ streamerRiotIdStatePath: riotPath, tournamentStatePath: tournamentPath });
    assert.equal(restartedStore.listPublicTournaments()[0].title, "SEIGA CUP");
    assert.equal(restartedStore.listPublicTournaments()[0].ownerTwitchLogin, "seiga");
    assert.equal(restartedStore.listPublicTournaments()[0].news[0].title, "대진 공개");
    assert.equal(restartedStore.deleteStreamerTournament(draft.id, owner), true);
    assert.deepEqual(restartedStore.listDashboardTournaments({ role: "streamer", twitchUserId: "twitch-1" }).map((tournament) => tournament.title), ["SEIGA CUP"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 파티 모집글 댓글을 저장하고 서버 모집글에는 허용하지 않는다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-community-"));
  const communityPath = path.join(dir, "community.json");
  try {
    const store = new Store({ communityStatePath: communityPath });
    const partyPost = store.createCommunityPost({
      category: "party",
      title: "파티 모집",
      body: "랭크 같이 하실 분",
      partyTier: "Emerald",
      partyRole: "MID",
      authorTwitchUserId: "twitch-1",
      authorTwitchLogin: "seiga",
      authorDisplayName: "Seiga",
      authorProfileImageUrl: "https://example.test/seiga.png"
    });
    const serverPost = store.createCommunityPost({
      category: "server",
      title: "서버 모집",
      body: "디스코드 서버 모집",
      authorTwitchUserId: "twitch-2",
      authorTwitchLogin: "server",
      authorDisplayName: "Server"
    });

    assert.ok(partyPost);
    assert.ok(serverPost);
    assert.deepEqual(partyPost.comments, []);

    let commented = partyPost;
    for (let index = 0; index < 105; index += 1) {
      commented = store.addCommunityPostComment(partyPost.id, {
        body: `참여하고 싶어요 ${index}`,
        authorTwitchUserId: "twitch-3",
        authorTwitchLogin: "viewer",
        authorDisplayName: "Viewer",
        authorProfileImageUrl: "https://example.test/viewer.png"
      });
    }
    assert.equal(commented?.comments.length, 105);
    assert.equal(commented?.comments[0].body, "참여하고 싶어요 0");
    assert.equal(commented?.comments.at(-1).body, "참여하고 싶어요 104");
    assert.equal(commented?.comments[0].authorTwitchLogin, "viewer");

    const rejected = store.addCommunityPostComment(serverPost.id, {
      body: "서버 글에는 댓글을 막습니다",
      authorTwitchUserId: "twitch-4",
      authorTwitchLogin: "blocked",
      authorDisplayName: "Blocked"
    });
    assert.equal(rejected, undefined);

    const restartedStore = new Store({ communityStatePath: communityPath });
    const persistedPost = restartedStore.getCommunityPostById(partyPost.id);
    assert.equal(persistedPost?.comments.length, 105);
    assert.equal(persistedPost?.comments[0].authorDisplayName, "Viewer");
    assert.deepEqual(restartedStore.getCommunityPostById(serverPost.id)?.comments, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 파티 모집글을 최근 24시간 2개까지 허용하고 오래된 글을 정리한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-party-community-"));
  const communityPath = path.join(dir, "community.json");
  const expiredAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  try {
    writeFileSync(communityPath, `${JSON.stringify({
      version: 1,
      posts: [{
        id: "post-expired-party",
        category: "party",
        title: "오래된 파티 모집",
        body: "정리 대상",
        tags: [],
        authorTwitchUserId: "twitch-1",
        authorTwitchLogin: "seiga",
        authorDisplayName: "Seiga",
        comments: [],
        createdAt: expiredAt,
        updatedAt: expiredAt
      }]
    }, null, 2)}\n`);

    const store = new Store({ communityStatePath: communityPath });
    assert.equal(store.getCommunityPostById("post-expired-party"), undefined);
    assert.equal(store.countCommunityPostsByAuthor("twitch-1", "party"), 0);

    const first = store.createCommunityPost({
      category: "party",
      title: "첫 번째 파티 모집",
      body: "랭크 같이 하실 분",
      authorTwitchUserId: "twitch-1",
      authorTwitchLogin: "seiga",
      authorDisplayName: "Seiga"
    });
    const second = store.createCommunityPost({
      category: "party",
      title: "두 번째 파티 모집",
      body: "일반 같이 하실 분",
      authorTwitchUserId: "twitch-1",
      authorTwitchLogin: "seiga",
      authorDisplayName: "Seiga"
    });
    const third = store.createCommunityPost({
      category: "party",
      title: "세 번째 파티 모집",
      body: "제한 대상",
      authorTwitchUserId: "twitch-1",
      authorTwitchLogin: "seiga",
      authorDisplayName: "Seiga"
    });

    assert.ok(first);
    assert.ok(second);
    assert.equal(third, undefined);
    assert.equal(store.countCommunityPostsByAuthor("twitch-1", "party"), 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 follower snapshot 차이로 팔로우 취소를 추정한다", () => {
  const store = new Store();

  store.reconcileFollowerSnapshot({
    followers: [
      { userId: "1", userLogin: "alpha", userName: "Alpha", profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/alpha.png", followedAt: "2026-01-01T00:00:00.000Z" },
      { userId: "2", userLogin: "bravo", userName: "Bravo", followedAt: "2026-01-02T00:00:00.000Z" }
    ],
    total: 2,
    truncated: false
  });
  store.recordFollowerActivity({ userId: "1", userName: "Alpha", kind: "chat", genre: "채팅 참여" });
  store.recordFollowerActivity({
    userId: "1",
    userName: "Alpha",
    kind: "participation",
    genre: "League of Legends 시참",
    riotGameName: "Seiga",
    riotTagLine: "JP1",
    riotPuuid: "puuid-1"
  });

  const state = store.reconcileFollowerSnapshot({
    followers: [
      { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" }
    ],
    total: 1,
    truncated: false
  });

  assert.equal(state.summary.activeFollowers, 1);
  assert.equal(state.summary.unfollowed, 1);
  assert.equal(state.followers.find((follower) => follower.userId === "1")?.profileImageUrl, "https://static-cdn.jtvnw.net/jtv_user_pictures/alpha.png");
  assert.equal(state.followers.find((follower) => follower.userId === "1")?.riotGameName, "Seiga");
  assert.equal(state.followers.find((follower) => follower.userId === "1")?.riotTagLine, "JP1");
  assert.equal(state.followers.find((follower) => follower.userId === "1")?.riotPuuid, "puuid-1");
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
