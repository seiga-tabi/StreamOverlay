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
