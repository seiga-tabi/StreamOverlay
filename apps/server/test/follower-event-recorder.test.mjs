import test from "node:test";
import assert from "node:assert/strict";

const { recordFollowerManagementEvent } = await import("../dist/services/follower-event-recorder.js");

function baseEvent(type, input = {}) {
  return {
    type,
    id: `${type}-1`,
    createdAt: "2026-07-21T00:00:00.000Z",
    ...input
  };
}

test("팔로워 관련 이벤트는 검증된 broadcaster scope를 Store에 전달한다", async () => {
  const followers = [];
  const activities = [];
  let changed = 0;
  const store = {
    recordFollower(input) {
      followers.push(input);
      return input;
    },
    recordFollowerActivity(input) {
      activities.push(input);
      return input;
    }
  };

  recordFollowerManagementEvent(baseEvent("twitch.follow", {
    broadcasterUserId: "1001",
    userId: "9001",
    userName: "Follower"
  }), {
    store,
    async getProfileImageUrl() {
      return "https://static-cdn.jtvnw.net/profile.png";
    },
    onStateChanged() {
      changed += 1;
    }
  });
  recordFollowerManagementEvent(baseEvent("twitch.chatMessage", {
    broadcasterUserId: "1002",
    chatterUserId: "9001",
    chatterUserName: "Follower",
    message: "안녕하세요"
  }), { store });
  recordFollowerManagementEvent(baseEvent("participation.entryCreated", {
    entryId: "entry-1",
    streamerId: "1003",
    twitchUserId: "9001",
    twitchUserName: "Follower",
    riotGameName: "Player",
    riotTagLine: "JP1"
  }), { store });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(followers.length, 2);
  assert.equal(followers[0].broadcasterUserId, "1001");
  assert.equal(followers[1].broadcasterUserId, "1001");
  assert.equal(followers[1].profileImageUrl, "https://static-cdn.jtvnw.net/profile.png");
  assert.equal(activities[0].broadcasterUserId, "1002");
  assert.equal(activities[0].kind, "chat");
  assert.equal(activities[1].broadcasterUserId, "1003");
  assert.equal(activities[1].kind, "participation");
  assert.equal(changed, 1);
});

test("broadcaster ID가 없는 이벤트는 전역 follower 상태로 저장하지 않는다", () => {
  const calls = [];
  const failures = [];
  const dependencies = {
    store: {
      recordFollower(input) {
        calls.push(input);
      },
      recordFollowerActivity(input) {
        calls.push(input);
      }
    },
    onFailure(failure) {
      failures.push(failure);
    }
  };

  recordFollowerManagementEvent(baseEvent("twitch.follow", {
    broadcasterUserId: "",
    userId: "9001",
    userName: "Follower"
  }), dependencies);
  recordFollowerManagementEvent(baseEvent("twitch.chatMessage", {
    broadcasterUserId: "not-a-twitch-id",
    chatterUserId: "9001",
    chatterUserName: "Follower",
    message: "안녕하세요"
  }), dependencies);
  recordFollowerManagementEvent(baseEvent("participation.entryCreated", {
    entryId: "entry-1",
    twitchUserId: "9001",
    twitchUserName: "Follower",
    riotGameName: "Player",
    riotTagLine: "JP1"
  }), dependencies);

  assert.equal(calls.length, 0);
  assert.deepEqual(failures.map((failure) => failure.type), ["scope_missing", "scope_missing", "scope_missing"]);
});
