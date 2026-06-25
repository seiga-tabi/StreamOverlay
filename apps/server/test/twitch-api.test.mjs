import test from "node:test";
import assert from "node:assert/strict";

const { TwitchApiClient } = await import("../dist/services/twitch-api.js");

const originalFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function createAuth(scopes = ["moderator:read:followers"]) {
  return {
    async getAccessContext() {
      return {
        clientId: "client-id",
        accessToken: "access-token",
        broadcasterId: "broadcaster-1",
        senderId: "broadcaster-1",
        scopes,
        source: "oauth"
      };
    },
    async refreshAfterUnauthorized() {
      return false;
    }
  };
}

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("TwitchApiClient는 channel followers를 pagination으로 조회한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    const target = new URL(String(url));
    if (!target.searchParams.get("after")) {
      return jsonResponse({
        total: 2,
        data: [{ user_id: "1", user_login: "alpha", user_name: "Alpha", followed_at: "2026-01-01T00:00:00Z" }],
        pagination: { cursor: "next" }
      });
    }
    return jsonResponse({
      total: 2,
      data: [{ user_id: "2", user_login: "bravo", user_name: "Bravo", followed_at: "2026-01-02T00:00:00Z" }],
      pagination: {}
    });
  };

  const client = new TwitchApiClient(createAuth());
  const result = await client.getChannelFollowers(200);

  assert.equal(result.total, 2);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.followers.map((follower) => follower.userName), ["Alpha", "Bravo"]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.searchParams.get("broadcaster_id") === "broadcaster-1"));
  assert.ok(calls.every((call) => call.authorization === "Bearer access-token"));
});

test("TwitchApiClient는 followers scope가 없으면 조회를 거부한다", async () => {
  const client = new TwitchApiClient(createAuth(["user:read:chat"]));

  await assert.rejects(
    () => client.getChannelFollowers(),
    /moderator:read:followers/
  );
});

test("TwitchApiClient는 429 이후 Ratelimit-Reset까지 다음 요청을 지연한다", async () => {
  const sleeps = [];
  const calls = [];
  let now = 1000;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "Ratelimit-Reset": "3",
          "Ratelimit-Remaining": "0"
        }
      });
    }
    return jsonResponse({
      total: 1,
      data: [{ user_id: "1", user_login: "alpha", user_name: "Alpha", followed_at: "2026-01-01T00:00:00Z" }],
      pagination: {}
    });
  };

  const client = new TwitchApiClient(createAuth(), {
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
    }
  });

  await assert.rejects(
    () => client.getChannelFollowers(1),
    /429/
  );

  now = 1500;
  const result = await client.getChannelFollowers(1);

  assert.deepEqual(sleeps, [1500]);
  assert.equal(result.followers[0]?.userName, "Alpha");
  assert.equal(calls.length, 2);
});
