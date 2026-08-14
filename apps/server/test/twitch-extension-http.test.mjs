import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { appConfig } from "../dist/config.js";
import { createHttpHandler } from "../dist/routes/http-api.js";
import { resetSecurityRateLimiters } from "../dist/security/rate-limit.js";
import { TwitchExtensionJwtVerifier } from "../dist/security/twitch-extension-jwt.js";
import { Store } from "../dist/services/store.js";

const secret = crypto.randomBytes(32);

function signedToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function authToken(channelId, linked = true) {
  return signedToken({
    channel_id: channelId,
    opaque_user_id: `${linked ? "U" : "A"}abcdef123456789`,
    ...(linked ? { user_id: "987654321" } : {}),
    role: "viewer",
    exp: Math.floor(Date.now() / 1_000) + 600
  });
}

function request(method, url, token, body) {
  return {
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    }
  };
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

function settingsRepository() {
  return {
    async readForStreamer() {
      return {
        display: {
          joinButton: true,
          game: true,
          waitingCount: true,
          myPosition: true,
          cancelButton: true,
          nextState: true
        },
        inactiveBehavior: "hide",
        extensionType: "panel",
        configured: true,
        connectionState: "connected",
        revision: 1
      };
    }
  };
}

test("Twitch Extension EBS는 JWT channel에 상태·참가·취소를 바인딩한다", async () => {
  const previousEnabled = appConfig.twitchExtension.enabled;
  appConfig.twitchExtension.enabled = true;
  resetSecurityRateLimiters();
  try {
    const channelId = "123456789";
    const store = new Store();
    store.startParticipationSession(channelId, {
      riotGameName: "Streamer",
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    }, { game: "lol" });
    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      twitchExtensionJwt: new TwitchExtensionJwtVerifier(secret.toString("base64")),
      twitchExtensionSettings: settingsRepository()
    });
    const token = authToken(channelId);

    const stateResponse = response();
    await handler(request("GET", "/api/twitch-extension/viewer", token), stateResponse);
    assert.equal(stateResponse.statusCode, 200, stateResponse.body);
    assert.equal(JSON.parse(stateResponse.body).viewer.status, "active");

    const joinResponse = response();
    await handler(request("POST", "/api/twitch-extension/join", token, {
      riotId: "Viewer#JP1",
      role: "fill"
    }), joinResponse);
    assert.equal(joinResponse.statusCode, 200, joinResponse.body);
    assert.equal(JSON.parse(joinResponse.body).viewer.viewer.myPosition, 1);
    assert.equal(store.getActiveParticipationQueue(channelId)[0].joinedFrom, "twitch_extension");

    const otherChannelResponse = response();
    await handler(request("GET", "/api/twitch-extension/viewer", authToken("222222222")), otherChannelResponse);
    assert.equal(JSON.parse(otherChannelResponse.body).viewer.status, "no_session");

    const cancelResponse = response();
    await handler(request("POST", "/api/twitch-extension/cancel", token, {}), cancelResponse);
    assert.equal(cancelResponse.statusCode, 200, cancelResponse.body);
    assert.equal(store.getActiveParticipationQueue(channelId).length, 0);
  } finally {
    appConfig.twitchExtension.enabled = previousEnabled;
    resetSecurityRateLimiters();
  }
});

test("Twitch Extension EBS는 익명 JWT의 mutation을 거부한다", async () => {
  const previousEnabled = appConfig.twitchExtension.enabled;
  appConfig.twitchExtension.enabled = true;
  try {
    const handler = createHttpHandler({
      store: new Store(),
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      twitchExtensionJwt: new TwitchExtensionJwtVerifier(secret.toString("base64")),
      twitchExtensionSettings: settingsRepository()
    });
    const denied = response();
    await handler(request("POST", "/api/twitch-extension/join", authToken("123456789", false), {
      riotId: "Viewer#JP1"
    }), denied);
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(JSON.parse(denied.body).code, "IDENTITY_REQUIRED");
  } finally {
    appConfig.twitchExtension.enabled = previousEnabled;
  }
});
