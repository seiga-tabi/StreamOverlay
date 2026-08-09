import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

test("Store는 공개 시참 대기열을 4명으로 제한하고 게임 시작 batch를 새 대기열로 갱신한다", () => {
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

  assert.deepEqual(store.getParticipationPublicQueue().map((entry) => entry.twitchUserName), ["Viewer1", "Viewer2", "Viewer3", "Viewer4"]);

  const changed = store.markVisibleParticipationQueueInGame();
  assert.deepEqual(changed.map((entry) => entry.twitchUserName), ["Viewer1", "Viewer2", "Viewer3", "Viewer4"]);
  assert.deepEqual(store.getParticipationPublicQueue().map((entry) => `${entry.position}:${entry.twitchUserName}`), ["1:Viewer5", "2:Viewer6"]);
});

test("Store는 검증 중 신청을 snapshot에 표시하되 실제 참가 후보에서는 제외한다", () => {
  const store = new Store();
  store.setParticipationOpen(true);
  store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-pending",
    twitchUserName: "PendingViewer",
    riotGameName: "PendingViewer",
    riotTagLine: "JP1",
    preferredRole: "fill",
    status: "pending",
    source: "chat_command"
  }));
  store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-verified",
    twitchUserName: "VerifiedViewer",
    riotGameName: "VerifiedViewer",
    riotTagLine: "JP1",
    preferredRole: "mid",
    status: "verified",
    source: "chat_command"
  }));

  assert.deepEqual(
    store.getParticipationPublicSnapshotQueue().map((entry) => `${entry.position}:${entry.twitchUserName}:${entry.status}`),
    ["1:PendingViewer:pending", "2:VerifiedViewer:verified"]
  );
  assert.deepEqual(
    store.getParticipationPublicQueue().map((entry) => `${entry.position}:${entry.twitchUserName}`),
    ["1:VerifiedViewer"]
  );
  assert.equal(store.getNextWaitingParticipationPublicEntry()?.twitchUserName, "VerifiedViewer");
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
  store.addParticipation(store.makeParticipationEntry({
    twitchUserId: "viewer-2",
    twitchUserName: "Viewer2",
    riotGameName: "SecondViewer",
    riotTagLine: "KR1",
    preferredRole: "top",
    status: "waitlisted",
    source: "dashboard"
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
  assert.equal(result.entry.attemptNumber, 2);
  assert.ok(result.entry.lastRequeuedAt);
  assert.equal(result.entry.twitchUserName, "ViewerRenamed");
  assert.equal(result.entry.status, "verified");
  assert.equal(result.entry.preferredRole, "jungle");
  assert.equal(result.entry.playedAt, undefined);
  assert.equal(result.entry.profileStatus, "ready");
  assert.equal(result.entry.mainRole, "MIDDLE");
  assert.equal(result.entry.topChampions?.[0]?.nameKo, "아리");
  assert.equal(store.getParticipationQueue().length, 2);
  assert.deepEqual(store.getParticipationPublicQueue().map((entry) => entry.twitchUserName), ["Viewer2", "ViewerRenamed"]);
});

test("Store는 참여 운영 상태를 atomic JSON 파일에서 복원한다", async () => {
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
    await firstStore.closeAsync();

    const restartedStore = new Store({ runtimeStatePath: filePath });
    assert.equal(restartedStore.getParticipationState().isOpen, true);
    assert.equal(restartedStore.getParticipationQueue().length, 1);
    assert.equal(restartedStore.getParticipationQueue()[0]?.twitchUserName, "ViewerPersisted");
    assert.equal(restartedStore.getReadiness().ok, true);
    await restartedStore.closeAsync();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 시청자 참여 프로필의 상위 챔피언을 공개 응답 계약상 3개로 제한한다", () => {
  const store = new Store();
  const topChampions = Array.from({ length: 4 }, (_, index) => ({
    championId: index + 1,
    nameKo: `챔피언${index + 1}`
  }));

  const profile = store.setParticipationStreamerProfile({
    displayName: "Streamer",
    topChampions
  });

  assert.deepEqual(profile?.topChampions?.map((champion) => champion.championId), [1, 2, 3]);
  assert.equal(topChampions.length, 4);
  assert.deepEqual(store.getParticipationStreamerProfile()?.topChampions?.map((champion) => champion.championId), [1, 2, 3]);
});

test("Store는 스트리머별 참여 대기열과 자동화 설정을 격리한다", () => {
  const store = new Store();
  const streamerA = "streamer-a";
  const streamerB = "streamer-b";

  store.setParticipationOpen(true, streamerA);
  store.setParticipationOpen(true, streamerB);
  const entryA = store.addParticipation(store.makeParticipationEntry({
    streamerId: streamerA,
    twitchUserId: "viewer-a",
    twitchUserName: "ViewerA",
    riotGameName: "ViewerA",
    riotTagLine: "JP1",
    preferredRole: "mid",
    status: "waitlisted",
    source: "dashboard"
  }), streamerA);
  store.addParticipation(store.makeParticipationEntry({
    streamerId: streamerB,
    twitchUserId: "viewer-b",
    twitchUserName: "ViewerB",
    riotGameName: "ViewerB",
    riotTagLine: "KR1",
    preferredRole: "jungle",
    status: "waitlisted",
    source: "dashboard"
  }), streamerB);

  store.setLolAutomationSettings(streamerA, { enabled: true, autoSelectNextAfterGame: true });
  store.setLolAutomationSettings(streamerB, { enabled: false, autoSelectNextAfterGame: false });

  assert.deepEqual(store.getParticipationQueue(streamerA).map((entry) => entry.twitchUserName), ["ViewerA"]);
  assert.deepEqual(store.getParticipationQueue(streamerB).map((entry) => entry.twitchUserName), ["ViewerB"]);
  assert.equal(store.getParticipationEntryById(entryA.id, streamerB), undefined);
  assert.equal(store.getLolAutomationSettings(streamerA).enabled, true);
  assert.equal(store.getLolAutomationSettings(streamerB).enabled, false);
});

test("Store는 스트리머별 참여 session과 설정을 재시작 후 복원한다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-scoped-runtime-state-"));
  const filePath = path.join(dir, "runtime-state.json");
  const streamerId = "streamer-persisted";
  try {
    const firstStore = new Store({ runtimeStatePath: filePath });
    firstStore.setParticipationOpen(true, streamerId);
    const session = firstStore.startParticipationSession(streamerId, {
      riotGameName: "Streamer",
      riotTagLine: "JP1",
      normalizedRiotId: "streamer#jp1",
      capturedAt: "2026-07-14T00:00:00.000Z"
    }, { listingVisibility: "followers" });
    firstStore.addParticipation(firstStore.makeParticipationEntry({
      streamerId,
      sessionId: session.sessionId,
      twitchUserId: "viewer-persisted",
      twitchUserName: "ViewerPersisted",
      riotGameName: "Viewer",
      riotTagLine: "JP1",
      preferredRole: "fill",
      status: "waitlisted",
      source: "dashboard"
    }), streamerId);
    firstStore.setLolAutomationSettings(streamerId, { enabled: true, announceInChat: false });
    firstStore.advanceParticipationRevision(streamerId);
    firstStore.advanceParticipationRevision(streamerId);
    await firstStore.closeAsync();

    const restartedStore = new Store({ runtimeStatePath: filePath });
    assert.equal(restartedStore.getParticipationState(streamerId).isOpen, true);
    assert.equal(restartedStore.getParticipationState(streamerId).session?.sessionId, session.sessionId);
    assert.equal(restartedStore.getParticipationState(streamerId).session?.publicSessionId, session.publicSessionId);
    assert.equal(restartedStore.getParticipationState(streamerId).session?.listingVisibility, "followers");
    assert.match(session.publicSessionId, /^ps_[A-Za-z0-9_-]{32}$/);
    assert.equal(restartedStore.getParticipationQueue(streamerId)[0]?.sessionId, session.sessionId);
    assert.equal(restartedStore.getLolAutomationSettings(streamerId).announceInChat, false);
    assert.equal(restartedStore.getParticipationState(streamerId).revision, 2);
    await restartedStore.closeAsync();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 종료된 참여 session을 기본 모집이나 상태 갱신으로 다시 활성화하지 않는다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-completed-participation-state-"));
  const filePath = path.join(dir, "runtime-state.json");
  const streamerId = "streamer-completed";
  try {
    const store = new Store({ runtimeStatePath: filePath });
    store.startParticipationSession(streamerId);
    store.endParticipationSession(streamerId);

    store.setParticipationOpen(true, streamerId);
    store.updateParticipationSessionStatus(streamerId, "recruiting");

    assert.equal(store.getParticipationState(streamerId).isOpen, false);
    assert.equal(store.getParticipationSession(streamerId)?.status, "completed");
    await store.closeAsync();

    const persistedState = JSON.parse(readFileSync(filePath, "utf8"));
    persistedState.participationByStreamer[streamerId].isOpen = true;
    writeFileSync(filePath, `${JSON.stringify(persistedState, null, 2)}\n`, "utf8");

    const restartedStore = new Store({ runtimeStatePath: filePath });
    assert.equal(restartedStore.getParticipationState(streamerId).isOpen, false);
    assert.equal(restartedStore.getParticipationSession(streamerId)?.status, "completed");
    await restartedStore.closeAsync();
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
    assert.equal(approved?.dashboardKey, undefined);
    const dashboardApproved = store.setStreamerRiotIdDashboardEnabled({
      requestId: first.id,
      dashboardEnabled: true,
      reviewer: "dashboard"
    });
    assert.equal(dashboardApproved?.dashboardSlug, "streamer");
    assert.match(dashboardApproved?.dashboardKey ?? "", /^sdk_/);
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
    assert.equal(renamed?.dashboardKey, dashboardApproved?.dashboardKey);
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
    assert.equal(approvedRequests[0].dashboardKey, dashboardApproved?.dashboardKey);
    assert.equal(approvedRequests[0].dashboardEnabled, true);
    assert.equal(approvedRequests[0].profileLinkUrl, "https://youtube.com/@streamer");
    assert.equal(approvedRequests[0].profileLinks?.length, 2);

    const restartedStore = new Store({ streamerRiotIdStatePath: filePath });
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].normalizedRiotId, "seiga#sei");
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].overlayKey, approved?.overlayKey);
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].dashboardKey, dashboardApproved?.dashboardKey);
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].profileLinkLabel, "YouTube");
    assert.equal(restartedStore.listApprovedStreamerRiotIds()[0].profileLinks?.[1]?.label, "Discord");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 Riot ID 승인·Dashboard 권한 저장 실패를 호출자에 전파하고 메모리를 원복한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-riot-admin-persistence-failure-"));
  const filePath = path.join(dir, "streamer-riot-ids.json");
  const backupPath = path.join(dir, "streamer-riot-ids.backup.json");
  const failures = [];
  const blockStateRename = () => {
    renameSync(filePath, backupPath);
    mkdirSync(filePath);
  };
  const restoreStateFile = () => {
    rmSync(filePath, { recursive: true, force: true });
    renameSync(backupPath, filePath);
  };

  try {
    const store = new Store({
      streamerRiotIdStatePath: filePath,
      onPersistenceError(failure) {
        failures.push(failure);
      }
    });
    const request = store.upsertStreamerRiotIdRequest({
      twitchUserId: "twitch-persistence",
      twitchLogin: "persistence_streamer",
      twitchDisplayName: "Persistence Streamer",
      riotGameName: "Persistence",
      riotTagLine: "JP1"
    });
    const pendingOnDisk = readFileSync(filePath, "utf8");

    blockStateRename();
    try {
      assert.throws(() => store.resolveStreamerRiotIdRequest({
        requestId: request.id,
        decision: "approved",
        reviewer: "dashboard"
      }));
      assert.equal(store.listStreamerRiotIdRequests()[0]?.status, "pending");
    } finally {
      restoreStateFile();
    }
    assert.equal(readFileSync(filePath, "utf8"), pendingOnDisk);

    const approved = store.resolveStreamerRiotIdRequest({
      requestId: request.id,
      decision: "approved",
      reviewer: "dashboard"
    });
    assert.equal(approved?.status, "approved");
    assert.equal(approved?.dashboardEnabled, false);
    const approvedOnDisk = readFileSync(filePath, "utf8");

    blockStateRename();
    try {
      assert.throws(() => store.setStreamerRiotIdDashboardEnabled({
        requestId: request.id,
        dashboardEnabled: true,
        reviewer: "dashboard"
      }));
      const rolledBack = store.listStreamerRiotIdRequests()[0];
      assert.equal(rolledBack?.dashboardEnabled, false);
      assert.equal(rolledBack?.dashboardKey, undefined);
    } finally {
      restoreStateFile();
    }
    assert.equal(readFileSync(filePath, "utf8"), approvedOnDisk);
    assert.equal(failures.filter((failure) =>
      failure.scope === "streamer_riot_ids" && failure.operation === "save"
    ).length, 2);

    const restarted = new Store({ streamerRiotIdStatePath: filePath });
    const persisted = restarted.listStreamerRiotIdRequests()[0];
    assert.equal(persisted?.status, "approved");
    assert.equal(persisted?.dashboardEnabled, false);
    assert.equal(persisted?.dashboardKey, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 기존 승인 스트리머의 dashboard tenant key를 한 번만 발급해 즉시 영속화한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-dashboard-key-migration-"));
  const filePath = path.join(dir, "streamer-riot-ids.json");
  try {
    writeFileSync(filePath, JSON.stringify({
      version: 1,
      requests: [{
        id: "riotreq-legacy",
        twitchUserId: "twitch-legacy",
        twitchLogin: "legacy_streamer",
        twitchDisplayName: "Legacy Streamer",
        riotGameName: "Legacy",
        riotTagLine: "JP1",
        normalizedRiotId: "legacy#jp1",
        status: "approved",
        dashboardEnabled: true,
        requestedAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z"
      }]
    }));

    const firstStore = new Store({ streamerRiotIdStatePath: filePath });
    const first = firstStore.listApprovedStreamerRiotIds()[0];
    assert.equal(first.dashboardSlug, "legacy_streamer");
    assert.match(first.dashboardKey ?? "", /^sdk_/);

    const secondStore = new Store({ streamerRiotIdStatePath: filePath });
    const second = secondStore.listApprovedStreamerRiotIds()[0];
    assert.equal(second.dashboardKey, first.dashboardKey);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 follower snapshot 차이로 팔로우 취소를 추정한다", () => {
  const store = new Store();

  store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-a",
    followers: [
      { userId: "1", userLogin: "alpha", userName: "Alpha", profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/alpha.png", followedAt: "2026-01-01T00:00:00.000Z" },
      { userId: "2", userLogin: "bravo", userName: "Bravo", followedAt: "2026-01-02T00:00:00.000Z" }
    ],
    total: 2,
    truncated: false
  });
  store.recordFollowerActivity({ broadcasterUserId: "broadcaster-a", userId: "1", userName: "Alpha", kind: "chat", genre: "채팅 참여" });
  store.recordFollowerActivity({
    broadcasterUserId: "broadcaster-a",
    userId: "1",
    userName: "Alpha",
    kind: "participation",
    genre: "League of Legends 시참",
    riotGameName: "Seiga",
    riotTagLine: "JP1",
    riotPuuid: "puuid-1"
  });

  const state = store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-a",
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
    broadcasterUserId: "broadcaster-a",
    followers: [
      { userId: "1", userName: "Alpha" },
      { userId: "2", userName: "Bravo" }
    ],
    truncated: false
  });

  const state = store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-a",
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
      broadcasterUserId: "broadcaster-a",
      followers: [
        { userId: "1", userLogin: "alpha", userName: "Alpha", followedAt: "2026-01-01T00:00:00.000Z" },
        { userId: "2", userLogin: "bravo", userName: "Bravo", followedAt: "2026-01-02T00:00:00.000Z" }
      ],
      total: 2,
      truncated: false
    });

    const restartedStore = new Store({ followerStatePath: filePath });
    const state = restartedStore.reconcileFollowerSnapshot({
      broadcasterUserId: "broadcaster-a",
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

test("Store는 broadcaster별 follower와 활동 및 snapshot을 완전히 격리한다", () => {
  const store = new Store();

  store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-a",
    followers: [
      { userId: "shared-viewer", userName: "Alpha Viewer" },
      { userId: "a-only", userName: "A Only" }
    ],
    total: 2,
    truncated: false
  });
  store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-b",
    followers: [
      { userId: "shared-viewer", userName: "Bravo Viewer" },
      { userId: "b-only", userName: "B Only" }
    ],
    total: 2,
    truncated: false
  });

  store.recordFollowerActivity({
    broadcasterUserId: "broadcaster-a",
    userId: "shared-viewer",
    kind: "chat",
    genre: "채팅 참여"
  });
  const stateA = store.reconcileFollowerSnapshot({
    broadcasterUserId: "broadcaster-a",
    followers: [{ userId: "shared-viewer", userName: "Alpha Viewer" }],
    total: 1,
    truncated: false
  });
  const stateB = store.getFollowerManagementState("broadcaster-b");

  assert.equal(stateA.summary.unfollowed, 1);
  assert.equal(stateA.followers.find((follower) => follower.userId === "shared-viewer")?.activity.chatMessages, 1);
  assert.equal(stateB.summary.unfollowed, 0);
  assert.equal(stateB.followers.find((follower) => follower.userId === "shared-viewer")?.userName, "Bravo Viewer");
  assert.equal(stateB.followers.find((follower) => follower.userId === "shared-viewer")?.activity.chatMessages, 0);
  assert.equal(stateB.followers.find((follower) => follower.userId === "b-only")?.status, "following");
});

test("Store는 빈 broadcasterUserId로 follower scope를 만들지 않는다", () => {
  const store = new Store();

  assert.throws(() => store.recordFollower({
    broadcasterUserId: " ",
    userId: "viewer-1",
    userName: "Viewer 1",
    source: "eventsub"
  }), /broadcasterUserId/);
  assert.throws(() => store.getFollowerManagementState(""), /broadcasterUserId/);
});

test("Store는 v1 follower 상태를 owner에 자동 배정하지 않고 v2 unassignedLegacy로 보존한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-followers-v1-"));
  const filePath = path.join(dir, "followers.json");
  try {
    writeFileSync(filePath, `${JSON.stringify({
      version: 1,
      followers: [{
        userId: "legacy-viewer",
        userName: "Legacy Viewer",
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        status: "following",
        source: "snapshot",
        activity: { chatMessages: 0, participationEntries: 0, total: 0, genres: {} }
      }],
      lastFollowerSnapshotAt: "2026-01-01T00:00:00.000Z",
      lastFollowerSnapshotTotal: 1,
      lastFollowerSnapshotTruncated: false
    }, null, 2)}\n`, { mode: 0o600 });

    const store = new Store({ followerStatePath: filePath });
    assert.equal(store.getFollowerManagementState("broadcaster-a").summary.knownFollowers, 0);
    const persisted = JSON.parse(readFileSync(filePath, "utf8"));
    assert.equal(persisted.version, 2);
    assert.deepEqual(persisted.scopes, []);
    assert.equal(persisted.unassignedLegacy.sourceVersion, 1);
    assert.equal(persisted.unassignedLegacy.reason, "owner_unverified");
    assert.equal(persisted.unassignedLegacy.followers[0].userId, "legacy-viewer");
    assert.equal(persisted.unassignedLegacy.lastFollowerSnapshotTotal, 1);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 손상되거나 미래 버전인 follower 상태 파일을 덮어쓰지 않는다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-followers-invalid-"));
  try {
    const invalidStates = [
      "{ invalid json\n",
      `${JSON.stringify({ version: 99, sentinel: "preserve-me" }, null, 2)}\n`
    ];
    for (const [index, original] of invalidStates.entries()) {
      const filePath = path.join(dir, `followers-${index}.json`);
      writeFileSync(filePath, original, { mode: 0o600 });
      const failures = [];
      const store = new Store({
        followerStatePath: filePath,
        onPersistenceError(failure) {
          failures.push(failure);
        }
      });

      assert.throws(() => store.recordFollower({
        broadcasterUserId: "broadcaster-a",
        userId: "new-viewer",
        userName: "New Viewer",
        source: "eventsub"
      }), /STATE_UNAVAILABLE:followers:corrupted/u);
      store.close();

      assert.equal(readFileSync(filePath, "utf8"), original);
      assert.equal(failures[0]?.scope, "followers");
      assert.equal(failures[0]?.operation, "load");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 손상된 tenant·runtime 상태 파일을 후속 변경으로 덮어쓰지 않는다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-domain-state-invalid-"));
  const original = "{ invalid json\n";
  const paths = {
    streamer: path.join(dir, "streamer-riot-ids.json"),
    runtime: path.join(dir, "runtime-state.json")
  };
  try {
    for (const filePath of Object.values(paths)) {
      writeFileSync(filePath, original, { mode: 0o600 });
    }
    const failures = [];
    const store = new Store({
      streamerRiotIdStatePath: paths.streamer,
      runtimeStatePath: paths.runtime,
      onPersistenceError(failure) {
        failures.push(failure);
      }
    });

    assert.throws(() => store.upsertStreamerRiotIdRequest({
      twitchUserId: "1001",
      twitchLogin: "streamer",
      twitchDisplayName: "Streamer",
      riotGameName: "Streamer",
      riotTagLine: "JP1"
    }), /STATE_UNAVAILABLE:streamer_riot_ids:corrupted/u);
    assert.throws(() => store.setParticipationOpen(true, "1001"), /STATE_UNAVAILABLE:runtime:corrupted/u);
    await store.closeAsync();

    for (const filePath of Object.values(paths)) {
      assert.equal(readFileSync(filePath, "utf8"), original);
    }
    assert.deepEqual(
      failures.map((failure) => [failure.scope, failure.operation]).sort(),
      [
        ["runtime", "load"],
        ["streamer_riot_ids", "load"]
      ]
    );
    assert.equal(store.getReadiness().ok, false);
    assert.deepEqual(store.getReadiness().loadStates, {
      followers: "not_loaded",
      streamer_riot_ids: "corrupted",
      runtime: "corrupted"
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 빈 파일과 schema 불일치를 손상 상태로 구분하고 정상 domain은 계속 사용할 수 있다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-domain-state-schema-"));
  const streamerPath = path.join(dir, "streamer-riot-ids.json");
  const runtimePath = path.join(dir, "runtime-state.json");
  const emptyPath = path.join(dir, "empty-runtime.json");
  try {
    writeFileSync(emptyPath, "", { mode: 0o600 });
    const invalidRuntime = {
      version: 3,
      participation: { isOpen: false, revision: 0, queue: [{ id: "invalid-participant" }] },
      participationByStreamer: {},
      lolAutomationByStreamer: {}
    };
    writeFileSync(runtimePath, `${JSON.stringify(invalidRuntime)}\n`, { mode: 0o600 });
    const store = new Store({
      streamerRiotIdStatePath: streamerPath,
      runtimeStatePath: runtimePath
    });

    /* 빈 파일도 schema 불일치와 같은 "손상"으로 봅니다. */
    const emptyStore = new Store({ runtimeStatePath: emptyPath });
    assert.equal(emptyStore.getReadiness().loadStates.runtime, "corrupted");
    emptyStore.close();

    assert.equal(store.getReadiness().loadStates.runtime, "corrupted");
    assert.throws(() => store.setParticipationOpen(true), /STATE_UNAVAILABLE:runtime:corrupted/u);

    const request = store.upsertStreamerRiotIdRequest({
      twitchUserId: "1001",
      twitchLogin: "streamer",
      twitchDisplayName: "Streamer",
      riotGameName: "Streamer",
      riotTagLine: "JP1"
    });
    assert.equal(request.status, "pending");
    assert.equal(store.listStreamerRiotIdRequests().length, 1);
    assert.equal(readFileSync(emptyPath, "utf8"), "");
    assert.deepEqual(JSON.parse(readFileSync(runtimePath, "utf8")), invalidRuntime);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 읽을 수 없는 state 파일을 unreadable로 구분한다", { skip: process.platform === "win32" }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-domain-state-permission-"));
  const filePath = path.join(dir, "runtime-state.json");
  try {
    writeFileSync(filePath, `${JSON.stringify({ version: 3, participation: { isOpen: false, revision: 0, queue: [] } })}\n`, { mode: 0o600 });
    chmodSync(filePath, 0o000);
    const store = new Store({ runtimeStatePath: filePath });
    assert.equal(store.getReadiness().loadStates.runtime, "unreadable");
    assert.throws(() => store.setParticipationOpen(true), /STATE_UNAVAILABLE:runtime:unreadable/u);
    store.close();
  } finally {
    chmodSync(filePath, 0o600);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 서브 Riot 계정을 대표와 별개로 즉시 승인·대표 교체·삭제한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-sub-riot-accounts-"));
  const filePath = path.join(dir, "streamer-riot-ids.json");
  try {
    const store = new Store({ streamerRiotIdStatePath: filePath });
    const identity = {
      twitchUserId: "twitch-1",
      twitchLogin: "streamer",
      twitchDisplayName: "Streamer"
    };
    const selfService = { approvalMode: "owner_self_service" };

    const beforeMainApproval = store.addStreamerSubRiotIdRequest(
      { ...identity, riotGameName: "TooEarly", riotTagLine: "KR0" },
      selfService
    );
    assert.equal(beforeMainApproval.ok, false);
    assert.equal(beforeMainApproval.code, "streamer_approval_required");
    assert.equal(store.listStreamerRiotIdRequests().length, 0);

    // 대표 계정 승인 + 대시보드 접근 키 발급
    const mainRequest = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Main", riotTagLine: "KR1" });
    store.resolveStreamerRiotIdRequest({ requestId: mainRequest.id, decision: "approved", reviewer: "dashboard" });
    store.setStreamerRiotIdDashboardEnabled({ requestId: mainRequest.id, dashboardEnabled: true, reviewer: "dashboard" });
    const mainApproved = store.mainApprovedStreamerRiotId("twitch-1");
    assert.equal(mainApproved?.normalizedRiotId, "main#kr1");
    const mainDashboardKey = mainApproved?.dashboardKey;
    assert.match(mainDashboardKey ?? "", /^sdk_/);

    // 서브 추가: self-service 즉시 승인, 자기 중복·타 스트리머 선점 거부
    const sub = store.addStreamerSubRiotIdRequest(
      { ...identity, riotGameName: "Smurf", riotTagLine: "KR2" },
      selfService
    );
    assert.equal(sub.ok, true);
    assert.equal(sub.request.status, "approved");
    assert.equal(sub.request.accountRole, "sub");
    assert.equal(sub.request.reviewer, "streamer-self-service");
    assert.equal(sub.request.dashboardEnabled, false);
    assert.equal(sub.request.dashboardKey, undefined);
    assert.equal(store.addStreamerSubRiotIdRequest(
      { ...identity, riotGameName: "Main", riotTagLine: "KR1" },
      selfService
    ).code, "riot_id_duplicated");
    const otherIdentity = { twitchUserId: "twitch-2", twitchLogin: "other", twitchDisplayName: "Other" };
    const otherMain = store.upsertStreamerRiotIdRequest({ ...otherIdentity, riotGameName: "Other", riotTagLine: "JP1" });
    store.resolveStreamerRiotIdRequest({ requestId: otherMain.id, decision: "approved", reviewer: "dashboard" });
    assert.equal(store.addStreamerSubRiotIdRequest({
      ...otherIdentity,
      riotGameName: "Smurf", riotTagLine: "KR2"
    }, selfService).code, "riot_id_taken");

    // 서브 즉시 승인은 대표를 비활성화하지 않고, 대시보드 접근도 승계하지 않는다
    const approvedAll = store.listApprovedStreamerRiotIds().filter((request) => request.twitchUserId === "twitch-1");
    assert.equal(approvedAll.length, 2);
    assert.deepEqual(
      store.listApprovedMainStreamerRiotIds().filter((request) => request.twitchUserId === "twitch-1").map((request) => request.normalizedRiotId),
      ["main#kr1"]
    );
    const approvedSub = approvedAll.find((request) => request.accountRole === "sub");
    assert.equal(approvedSub?.dashboardEnabled, false);
    assert.equal(approvedSub?.dashboardKey, undefined);

    // 승인된 서브가 있어도 본계정 재신청 슬롯을 빼앗지 않는다
    const anotherSub = store.addStreamerSubRiotIdRequest(
      { ...identity, riotGameName: "Third", riotTagLine: "KR3" },
      selfService
    );
    assert.equal(anotherSub.ok, true);
    assert.equal(anotherSub.request.status, "approved");
    const reapply = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Renamed", riotTagLine: "KR9" });
    assert.notEqual(reapply.id, anotherSub.request.id);

    // 대표 삭제 금지 · 대표 교체 시 대시보드 접근 이관
    assert.equal(store.deleteStreamerRiotIdRequest({ twitchUserId: "twitch-1", requestId: mainRequest.id }).code, "cannot_delete_main");
    const swapped = store.setMainStreamerRiotId({ twitchUserId: "twitch-1", requestId: approvedSub.id });
    assert.equal(swapped.ok, true);
    assert.equal(swapped.request.normalizedRiotId, "smurf#kr2");
    assert.equal(swapped.request.dashboardKey, mainDashboardKey);
    assert.equal(swapped.request.dashboardEnabled, true);
    const demoted = store.listApprovedStreamerRiotIds().find((request) => request.id === mainRequest.id);
    assert.equal(demoted?.accountRole, "sub");
    assert.equal(demoted?.dashboardKey, undefined);
    assert.deepEqual(
      store.listApprovedMainStreamerRiotIds().filter((request) => request.twitchUserId === "twitch-1").map((request) => request.normalizedRiotId),
      ["smurf#kr2"]
    );

    // 대표에서 내려온 계정은 삭제 가능
    const removed = store.deleteStreamerRiotIdRequest({ twitchUserId: "twitch-1", requestId: mainRequest.id });
    assert.equal(removed.ok, true);

    // 개수 상한: 남은 서브 1개 + 추가 3개 = 4개까지, 5번째는 거부
    for (const tag of ["S4", "S5", "S6"]) {
      assert.equal(store.addStreamerSubRiotIdRequest(
        { ...identity, riotGameName: "Extra", riotTagLine: tag },
        selfService
      ).ok, true);
    }
    assert.equal(store.addStreamerSubRiotIdRequest(
      { ...identity, riotGameName: "Extra", riotTagLine: "S7" },
      selfService
    ).code, "limit_exceeded");

    // 재시작 후에도 역할이 유지된다
    const restarted = new Store({ streamerRiotIdStatePath: filePath });
    assert.deepEqual(
      restarted.listApprovedMainStreamerRiotIds().filter((request) => request.twitchUserId === "twitch-1").map((request) => request.normalizedRiotId),
      ["smurf#kr2"]
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Store는 관리자가 사후 거절한 서브 Riot 계정의 삭제·자동 재승인을 막는다", () => {
  const store = new Store();
  const identity = { twitchUserId: "twitch-1", twitchLogin: "streamer", twitchDisplayName: "Streamer" };
  const selfService = { approvalMode: "owner_self_service" };
  const main = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Main", riotTagLine: "KR1" });
  store.resolveStreamerRiotIdRequest({ requestId: main.id, decision: "approved", reviewer: "test" });

  const sub = store.addStreamerSubRiotIdRequest(
    { ...identity, riotGameName: "BlockedSub", riotTagLine: "KR2" },
    selfService
  );
  assert.equal(sub.ok, true);
  store.resolveStreamerRiotIdRequest({ requestId: sub.request.id, decision: "rejected", reviewer: "test" });

  const readded = store.addStreamerSubRiotIdRequest(
    { ...identity, riotGameName: "BlockedSub", riotTagLine: "KR2" },
    selfService
  );
  assert.equal(readded.ok, false);
  assert.equal(readded.code, "riot_id_rejected");
  assert.equal(
    store.deleteStreamerRiotIdRequest({ twitchUserId: identity.twitchUserId, requestId: sub.request.id }).code,
    "cannot_delete_rejected"
  );

  const restored = store.resolveStreamerRiotIdRequest({
    requestId: sub.request.id,
    decision: "approved",
    reviewer: "test"
  });
  assert.equal(restored?.status, "approved");
  assert.equal(store.deleteStreamerRiotIdRequest({ twitchUserId: identity.twitchUserId, requestId: sub.request.id }).ok, true);
});

test("Store는 서브 계정 row에 dashboard 접근을 켤 수 없다", () => {
  const store = new Store();
  const identity = { twitchUserId: "twitch-1", twitchLogin: "streamer", twitchDisplayName: "Streamer" };
  const main = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Main", riotTagLine: "KR1" });
  store.resolveStreamerRiotIdRequest({ requestId: main.id, decision: "approved", reviewer: "test" });
  const sub = store.addStreamerSubRiotIdRequest(
    { ...identity, riotGameName: "Smurf", riotTagLine: "KR2" },
    { approvalMode: "owner_self_service" }
  );

  assert.equal(store.setStreamerRiotIdDashboardEnabled({ requestId: sub.request.id, dashboardEnabled: true, reviewer: "test" }), undefined);
  assert.notEqual(store.setStreamerRiotIdDashboardEnabled({ requestId: main.id, dashboardEnabled: true, reviewer: "test" }), undefined);
});

test("Store는 자신의 서브 계정 ID로 본계정을 재신청해도 중복 row를 만들지 않는다", () => {
  const store = new Store();
  const identity = { twitchUserId: "twitch-1", twitchLogin: "streamer", twitchDisplayName: "Streamer" };
  const main = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Main", riotTagLine: "KR1" });
  store.resolveStreamerRiotIdRequest({ requestId: main.id, decision: "approved", reviewer: "test" });
  const sub = store.addStreamerSubRiotIdRequest(
    { ...identity, riotGameName: "Smurf", riotTagLine: "KR2" },
    { approvalMode: "owner_self_service" }
  );

  // 승인된 서브와 같은 ID로 재신청 → 새 row 없이 그 서브 row를 반환
  const reapplied = store.upsertStreamerRiotIdRequest({ ...identity, riotGameName: "Smurf", riotTagLine: "KR2" });
  assert.equal(reapplied.id, sub.request.id);
  assert.equal(
    store.listStreamerRiotIdRequests().filter((request) => request.normalizedRiotId === "smurf#kr2").length,
    1
  );
  // 대표는 그대로 유지된다
  assert.equal(store.mainApprovedStreamerRiotId("twitch-1")?.normalizedRiotId, "main#kr1");
});
