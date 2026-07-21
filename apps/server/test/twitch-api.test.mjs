import test from "node:test";
import assert from "node:assert/strict";

const { TwitchApiClient } = await import("../dist/services/twitch-api.js");
const { appConfig } = await import("../dist/config.js");

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

test("TwitchApiClient는 응답이 없는 외부 요청을 timeout으로 중단한다", async () => {
  const previousTimeout = appConfig.twitch.apiTimeoutMs;
  const keepAlive = setTimeout(() => undefined, 1_000);
  appConfig.twitch.apiTimeoutMs = 10;
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  try {
    const client = new TwitchApiClient(createAuth());
    await assert.rejects(() => client.getUserProfile("123"), /timed out|timeout/i);
  } finally {
    clearTimeout(keepAlive);
    appConfig.twitch.apiTimeoutMs = previousTimeout;
  }
});

test("TwitchApiClient는 channel followers를 pagination으로 조회한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    const target = new URL(String(url));
    if (target.pathname === "/helix/users") {
      return jsonResponse({
        data: [
          { id: "1", login: "alpha", display_name: "Alpha", profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/alpha.png" },
          { id: "2", login: "bravo", display_name: "Bravo", profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/bravo.png" }
        ]
      });
    }
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
  assert.deepEqual(result.followers.map((follower) => follower.profileImageUrl), [
    "https://static-cdn.jtvnw.net/jtv_user_pictures/alpha.png",
    "https://static-cdn.jtvnw.net/jtv_user_pictures/bravo.png"
  ]);
  assert.equal(calls.length, 3);
  assert.ok(calls.filter((call) => call.url.pathname === "/helix/channels/followers").every((call) => call.url.searchParams.get("broadcaster_id") === "broadcaster-1"));
  assert.deepEqual(calls.find((call) => call.url.pathname === "/helix/users")?.url.searchParams.getAll("id"), ["1", "2"]);
  assert.ok(calls.every((call) => call.authorization === "Bearer access-token"));
});

test("TwitchApiClient는 broadcaster별 follower 조회에서 명시적 context만 사용한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const target = new URL(String(url));
    calls.push({ url: target, authorization: init?.headers?.Authorization });
    if (target.pathname === "/helix/users") {
      return jsonResponse({
        data: [{
          id: "900",
          login: "viewer900",
          display_name: "Viewer 900",
          profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer900.png"
        }]
      });
    }
    return jsonResponse({
      total: 1,
      data: [{ user_id: "900", user_login: "viewer900", user_name: "Viewer 900", followed_at: "2026-07-01T00:00:00Z" }],
      pagination: {}
    });
  };
  const client = new TwitchApiClient({
    async getAccessContext() {
      throw new Error("전역 Twitch auth를 사용하면 안 됩니다.");
    }
  });

  const result = await client.getChannelFollowersForBroadcaster({
    clientId: "scoped-client-id",
    accessToken: "scoped-access-token",
    scopes: ["moderator:read:followers"],
    broadcasterId: "101"
  }, "101", 100);

  assert.equal(result.followers[0]?.profileImageUrl, "https://static-cdn.jtvnw.net/jtv_user_pictures/viewer900.png");
  assert.equal(calls[0]?.url.searchParams.get("broadcaster_id"), "101");
  assert.ok(calls.every((call) => call.authorization === "Bearer scoped-access-token"));
});

test("TwitchApiClient는 scoped context owner 불일치와 scope 부족을 외부 요청 전에 거부한다", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({ data: [] });
  };
  const client = new TwitchApiClient();
  const context = {
    clientId: "scoped-client-id",
    accessToken: "scoped-access-token",
    scopes: ["moderator:read:followers"],
    broadcasterId: "101"
  };

  await assert.rejects(
    () => client.getChannelFollowersForBroadcaster(context, "202"),
    /소유자/
  );
  await assert.rejects(
    () => client.getChannelFollowersForBroadcaster({ ...context, scopes: [] }, "101"),
    /moderator:read:followers/
  );
  assert.equal(fetchCalls, 0);
});

test("TwitchApiClient는 로그인 사용자가 팔로우 중인 채널을 조회한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    const target = new URL(String(url));
    if (target.pathname === "/helix/users") {
      return jsonResponse({
        data: [{
          id: "55",
          login: "streamer",
          display_name: "Streamer",
          profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/streamer.png"
        }]
      });
    }
    return jsonResponse({
      total: 1,
      data: [{ broadcaster_id: "55", broadcaster_login: "streamer", broadcaster_name: "Streamer", followed_at: "2026-06-26T00:00:00Z" }],
      pagination: {}
    });
  };

  const client = new TwitchApiClient(createAuth());
  const result = await client.getFollowedChannels({
    clientId: "client-id",
    accessToken: "viewer-access-token",
    scopes: ["user:read:follows"],
    userId: "999"
  });

  assert.equal(result.total, 1);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.channels.map((channel) => channel.broadcasterName), ["Streamer"]);
  assert.equal(result.channels[0]?.profileImageUrl, "https://static-cdn.jtvnw.net/jtv_user_pictures/streamer.png");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.pathname, "/helix/channels/followed");
  assert.equal(calls[0].url.searchParams.get("user_id"), "999");
  assert.equal(calls[0].authorization, "Bearer viewer-access-token");
  assert.equal(calls[1].url.pathname, "/helix/users");
  assert.deepEqual(calls[1].url.searchParams.getAll("id"), ["55"]);
  assert.equal(calls[1].authorization, "Bearer viewer-access-token");
});

test("TwitchApiClient는 로그인 사용자의 구독 중인 팔로우 채널을 확인한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    const target = new URL(String(url));
    if (target.searchParams.get("broadcaster_id") === "55") {
      return jsonResponse({
        data: [{
          broadcaster_id: "55",
          broadcaster_login: "streamer",
          broadcaster_name: "Streamer",
          tier: "1000",
          is_gift: false
        }]
      });
    }
    return jsonResponse({ data: [] }, 404);
  };

  const client = new TwitchApiClient(createAuth());
  const result = await client.checkUserSubscriptions({
    clientId: "client-id",
    accessToken: "viewer-access-token",
    scopes: ["user:read:subscriptions"],
    userId: "999"
  }, ["55", "66"]);

  assert.equal(result.size, 1);
  assert.equal(result.get("55")?.broadcasterLogin, "streamer");
  assert.equal(result.get("55")?.tier, "1000");
  assert.equal(result.get("55")?.isGift, false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.url.pathname), ["/helix/subscriptions/user", "/helix/subscriptions/user"]);
  assert.deepEqual(calls.map((call) => call.url.searchParams.get("user_id")), ["999", "999"]);
  assert.deepEqual(calls.map((call) => call.authorization), ["Bearer viewer-access-token", "Bearer viewer-access-token"]);
});

test("TwitchApiClient는 팔로우 조회 scope가 없으면 followed channel 조회를 거부한다", async () => {
  const client = new TwitchApiClient(createAuth());

  await assert.rejects(
    () => client.getFollowedChannels({
      clientId: "client-id",
      accessToken: "viewer-access-token",
      scopes: ["user:read:chat"],
      userId: "999"
    }),
    /user:read:follows/
  );
});

test("TwitchApiClient는 followers scope가 없으면 조회를 거부한다", async () => {
  const client = new TwitchApiClient(createAuth(["user:read:chat"]));

  await assert.rejects(
    () => client.getChannelFollowers(),
    /moderator:read:followers/
  );
});

test("TwitchApiClient는 user id로 현재 방송 상태를 조회하고 짧게 캐시한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    return jsonResponse({
      data: [{
        user_id: "1234",
        user_login: "hideonbush",
        user_name: "Hide on bush",
        game_id: "21779",
        game_name: "League of Legends",
        title: "랭크 방송",
        viewer_count: 321,
        started_at: "2026-06-26T01:00:00Z",
        thumbnail_url: "https://static-cdn.jtvnw.net/previews-ttv/live_user_hideonbush-{width}x{height}.jpg"
      }]
    });
  };

  const client = new TwitchApiClient(createAuth());
  const first = await client.getStreamByUserId("1234");
  const second = await client.getStreamByUserId("1234");

  assert.equal(first?.userName, "Hide on bush");
  assert.equal(first?.viewerCount, 321);
  assert.deepEqual(second, first);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/helix/streams");
  assert.equal(calls[0].url.searchParams.get("user_id"), "1234");
  assert.equal(calls[0].authorization, "Bearer access-token");
});

test("TwitchApiClient는 사용자 OAuth 없이 app access token으로 방송 상태를 조회한다", async () => {
  const previousClientId = appConfig.twitch.clientId;
  const previousClientSecret = appConfig.twitch.clientSecret;
  appConfig.twitch.clientId = "client-id";
  appConfig.twitch.clientSecret = "client-secret";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const target = new URL(String(url));
    calls.push({ url: target, authorization: init?.headers?.Authorization, body: String(init?.body ?? "") });
    if (target.host === "id.twitch.tv") {
      return jsonResponse({ access_token: "app-access-token", expires_in: 3600, token_type: "bearer" });
    }
    return jsonResponse({
      data: [{
        user_id: "1234",
        user_login: "hideonbush",
        user_name: "Hide on bush",
        game_name: "League of Legends",
        viewer_count: 321
      }]
    });
  };

  try {
    const client = new TwitchApiClient();
    const result = await client.getStreamByUserId("1234");

    assert.equal(result?.userName, "Hide on bush");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.host, "id.twitch.tv");
    assert.match(calls[0].body, /grant_type=client_credentials/);
    assert.equal(calls[1].url.pathname, "/helix/streams");
    assert.equal(calls[1].authorization, "Bearer app-access-token");
  } finally {
    appConfig.twitch.clientId = previousClientId;
    appConfig.twitch.clientSecret = previousClientSecret;
  }
});

test("TwitchApiClient는 방송 상태 캐시를 user id 단위로 무효화한다", async () => {
  const calls = [];
  let isLive = true;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), authorization: init?.headers?.Authorization });
    return jsonResponse({
      data: isLive
        ? [{
            user_id: "1234",
            user_login: "hideonbush",
            user_name: "Hide on bush",
            game_id: "21779",
            game_name: "League of Legends",
            title: "랭크 방송",
            viewer_count: 321,
            started_at: "2026-06-26T01:00:00Z"
          }]
        : []
    });
  };

  const client = new TwitchApiClient(createAuth());
  const live = await client.getStreamByUserId("1234");
  isLive = false;
  const cachedLive = await client.getStreamByUserId("1234");
  client.clearStreamStatusCache("1234");
  const offline = await client.getStreamByUserId("1234");

  assert.equal(live?.userName, "Hide on bush");
  assert.deepEqual(cachedLive, live);
  assert.equal(offline, undefined);
  assert.equal(calls.length, 2);
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
      now += ms;
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
  assert.equal(calls.length, 3);
});
