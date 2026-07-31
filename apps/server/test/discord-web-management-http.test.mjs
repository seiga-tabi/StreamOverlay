import assert from "node:assert/strict";
import test from "node:test";

const { appConfig } = await import("../dist/config.js");
const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const DASHBOARD_ORIGIN = "http://127.0.0.1:4173";
const APPLICATION_ID = "987654321098765432";

function createRequest(method, url, body, headers = {}) {
  const serialized = body === undefined
    ? undefined
    : typeof body === "string"
      ? body
      : JSON.stringify(body);
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (serialized !== undefined) yield Buffer.from(serialized);
    }
  };
}

function createResponse() {
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

function createDiscordHandler(overrides = {}) {
  const calls = [];
  const discordOnboarding = {
    async beginWebManagementOAuth() {
      calls.push({ type: "start" });
      return {
        authorizationUrl: "https://discord.com/oauth2/authorize?client_id=987654321098765432&scope=identify%20guilds",
        cookieValue: "binding_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      };
    },
    async webManagementSession(cookieValue) {
      calls.push({ type: "session", cookieValue });
      return {
        authenticated: true,
        csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
        installedGuilds: [],
        missingBotGuilds: [],
        organizations: []
      };
    },
    async connectGuild(input) {
      calls.push({ type: "claim", input });
      return {
        guild: { id: input.guildId, name: "검증 Guild" },
        organization: {
          id: "11111111-1111-4111-8111-111111111111",
          displayName: "검증 Organization"
        },
        managementSessionToken:
          "management_value_abcdefghijklmnopqrstuvwxyz123456.csrf_management_abcdefghijklmnopqrstuvwxyz123456",
        yoroSessionToken:
          "yoro_value_abcdefghijklmnopqrstuvwxyz123456.csrf_yoro_abcdefghijklmnopqrstuvwxyz123456"
      };
    },
    ...overrides.discordOnboarding
  };
  return {
    calls,
    handler: createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      discordDatabaseReady: () => true,
      discordOnboarding,
      discordManagement: {},
      yoroAccounts: {
        async authenticateForManagement(cookieValue) {
          return cookieValue
            ? {
                userId: "22222222-2222-4222-8222-222222222222",
                csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
                csrfTokenHash: Buffer.alloc(32)
              }
            : undefined;
        }
      },
      ...overrides.handlerInput
    })
  };
}

async function request(handler, method, url, body, headers = {}) {
  const req = createRequest(method, url, body, headers);
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function withDiscordConfig(run) {
  const previous = {
    databaseEnabled: appConfig.database.enabled,
    discordSaasEnabled: appConfig.discordSaas.enabled,
    botInternalEnabled: appConfig.discordBotInternal.enabled,
    botManagementEnabled: appConfig.discordBotManagement.enabled,
    applicationId: appConfig.discordBotInternal.applicationId,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv
  };
  resetSecurityRateLimiters();
  appConfig.database.enabled = true;
  appConfig.discordSaas.enabled = true;
  appConfig.discordBotInternal.enabled = true;
  appConfig.discordBotManagement.enabled = true;
  appConfig.discordBotInternal.applicationId = APPLICATION_ID;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  try {
    await run();
  } finally {
    appConfig.database.enabled = previous.databaseEnabled;
    appConfig.discordSaas.enabled = previous.discordSaasEnabled;
    appConfig.discordBotInternal.enabled = previous.botInternalEnabled;
    appConfig.discordBotManagement.enabled = previous.botManagementEnabled;
    appConfig.discordBotInternal.applicationId = previous.applicationId;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    resetSecurityRateLimiters();
  }
}

test("서명된 Bot 내부 상태 API는 Guild 귀속 요청만 상태 서비스에 전달한다", async () => {
  await withDiscordConfig(async () => {
    const statusCalls = [];
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordInternalAuth: {
          verify() {
            return { ok: true };
          }
        },
        gameServerStatusRead: {
          async read(input) {
            statusCalls.push(input);
            return {
              connected: true,
              server: {
                displayName: "Palworld",
                status: "online",
                source: "rest",
                players: { current: 1, max: 32 }
              }
            };
          }
        }
      }
    });
    const response = await request(
      handler,
      "POST",
      "/internal/discord/game-server-status",
      {
        applicationId: APPLICATION_ID,
        guildId: "123456789012345678"
      },
      { "content-type": "application/json" }
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(statusCalls, [{
      applicationId: APPLICATION_ID,
      guildId: "123456789012345678"
    }]);
    assert.deepEqual(JSON.parse(response.body), {
      connected: true,
      server: {
        displayName: "Palworld",
        status: "online",
        source: "rest",
        players: { current: 1, max: 32 }
      }
    });
  });
});

test("서명된 Bot 내부 플레이어 API는 닉네임 검색만 상태 서비스에 전달한다", async () => {
  await withDiscordConfig(async () => {
    const playerCalls = [];
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordInternalAuth: {
          verify() {
            return { ok: true };
          }
        },
        gameServerStatusRead: {
          async readPlayers(input) {
            playerCalls.push(input);
            return {
              connected: true,
              serverConfigured: true,
              displayName: "Palworld",
              result: {
                kind: "profile",
                player: {
                  nickname: "세이가",
                  level: 42,
                  buildingCount: 7
                }
              }
            };
          }
        }
      }
    });
    const response = await request(
      handler,
      "POST",
      "/internal/discord/palworld-players",
      {
        applicationId: APPLICATION_ID,
        guildId: "123456789012345678",
        nickname: "세이가"
      },
      { "content-type": "application/json" }
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(playerCalls, [{
      applicationId: APPLICATION_ID,
      guildId: "123456789012345678",
      nickname: "세이가"
    }]);

    const forged = await request(
      handler,
      "POST",
      "/internal/discord/palworld-players",
      {
        applicationId: APPLICATION_ID,
        guildId: "123456789012345678",
        nickname: "세이가",
        userId: "999999999999999999"
      },
      { "content-type": "application/json" }
    );
    assert.equal(forged.statusCode, 400);
    assert.equal(playerCalls.length, 1);
  });
});

test("서명된 Bot 내부 명령 정책 API는 exact Guild·command만 전달한다", async () => {
  await withDiscordConfig(async () => {
    const policyCalls = [];
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordInternalAuth: {
          verify() {
            return { ok: true };
          }
        },
        discordBotCommandPolicy: {
          async resolve(input) {
            policyCalls.push(input);
            return {
              allowed: true,
              commands: {
                help: true,
                status: true,
                player: true,
                guide: true
              },
              preferredLocale: "auto",
              statusFields: {
                players: true,
                version: true,
                latency: false,
                observedAt: true
              },
              revision: 2
            };
          }
        }
      }
    });
    const response = await request(
      handler,
      "POST",
      "/internal/discord/command-policy",
      {
        applicationId: APPLICATION_ID,
        guildId: "123456789012345678",
        command: "status"
      },
      { "content-type": "application/json" }
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(policyCalls, [{
      applicationId: APPLICATION_ID,
      guildId: "123456789012345678",
      command: "status"
    }]);

    const forged = await request(
      handler,
      "POST",
      "/internal/discord/command-policy",
      {
        applicationId: APPLICATION_ID,
        guildId: "123456789012345678",
        command: "ban",
        organizationId: "forged"
      },
      { "content-type": "application/json" }
    );
    assert.equal(forged.statusCode, 400);
    assert.equal(policyCalls.length, 1);
  });
});

test("Organization Bot 제어 API는 session·Origin·CSRF와 strict body를 유지한다", async () => {
  await withDiscordConfig(async () => {
    const calls = [];
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const settings = {
      publicCommandsEnabled: true,
      palworldStatusEnabled: true,
      statusCommandEnabled: true,
      playerCommandEnabled: true,
      guideCommandEnabled: true,
      preferredLocale: "auto",
      statusFields: {
        players: true,
        version: true,
        latency: true,
        observedAt: true
      },
      revision: 0
    };
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordManagement: {
          async botControl(input) {
            calls.push({ type: "read", input });
            return {
              organizationId,
              role: "owner",
              globalPrefixCommandsEnabled: true,
              modules: [{ id: "palworld.status", version: 1, enabled: true }],
              settings
            };
          },
          async updateBotControl(input) {
            calls.push({ type: "update", input });
            return {
              organizationId,
              role: "owner",
              globalPrefixCommandsEnabled: true,
              modules: [{ id: "palworld.status", version: 1, enabled: true }],
              settings: { ...settings, revision: 1 }
            };
          }
        }
      }
    });
    const path =
      `/api/discord/management/organizations/${organizationId}/bot-control`;
    const read = await request(handler, "GET", path, undefined, {
      cookie: "yoro_session=session.csrf"
    });
    assert.equal(read.statusCode, 200);
    assert.equal(calls[0].input.organizationId, organizationId);

    const value = {
      ...settings,
      expectedRevision: settings.revision
    };
    delete value.revision;
    const denied = await request(handler, "PATCH", path, value, {
      "content-type": "application/json",
      cookie: "yoro_session=session.csrf",
      "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      origin: "https://evil.example"
    });
    assert.equal(denied.statusCode, 403);

    const updated = await request(handler, "PATCH", path, value, {
      "content-type": "application/json",
      cookie: "yoro_session=session.csrf",
      "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      origin: DASHBOARD_ORIGIN
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(calls[1].type, "update");
    assert.equal(calls[1].input.csrfToken, "csrf_value_abcdefghijklmnopqrstuvwxyz123456");

    const forged = await request(handler, "PATCH", path, {
      ...value,
      userId: "forged"
    }, {
      "content-type": "application/json",
      cookie: "yoro_session=session.csrf",
      "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      origin: DASHBOARD_ORIGIN
    });
    assert.equal(forged.statusCode, 400);
    assert.equal(calls.length, 2);
  });
});

test("Bot 설치 route는 고정 Discord origin·scope·permission과 no-store만 반환한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    const response = await request(handler, "GET", "/api/discord/bot/install");
    assert.equal(response.statusCode, 302);
    const location = new URL(response.headers.Location);
    assert.equal(location.origin, "https://discord.com");
    assert.equal(location.pathname, "/oauth2/authorize");
    assert.equal(location.searchParams.get("client_id"), APPLICATION_ID);
    assert.deepEqual(
      new Set((location.searchParams.get("scope") ?? "").split(" ")),
      new Set(["bot", "applications.commands"])
    );
    assert.equal(location.searchParams.get("permissions"), "0");
    assert.equal(location.searchParams.has("redirect_uri"), false);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.headers["Referrer-Policy"], "no-referrer");

    const head = await request(handler, "HEAD", "/api/discord/bot/install");
    assert.equal(head.statusCode, 302);
    assert.equal(new URL(head.headers.Location).origin, "https://discord.com");
    assert.equal(head.body, "");

    const query = await request(
      handler,
      "GET",
      "/api/discord/bot/install?client_id=111&permissions=8"
    );
    assert.equal(query.statusCode, 404);
    assert.doesNotMatch(query.body, /987654321098765432|permissions/u);
  });
});

test("기존 Discord 설정·관리 URL은 별도 화면 없이 통합 Dashboard로만 이동한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    const setupToken = "abcdefghijklmnopqrstuvwxyzABCDEFGH";
    const setup = await request(
      handler,
      "GET",
      `/setup/discord?setup=${setupToken}&returnTo=https://evil.example`
    );
    assert.equal(setup.statusCode, 302);
    assert.equal(
      setup.headers.Location,
      `/dashboard/organizations?setup=${setupToken}`
    );
    assert.equal(setup.headers["Cache-Control"], "no-store");
    assert.equal(setup.headers["Referrer-Policy"], "no-referrer");

    const management = await request(
      handler,
      "GET",
      "/bot/manage?connect=select&organizationId=secret"
    );
    assert.equal(management.statusCode, 302);
    assert.equal(
      management.headers.Location,
      "/dashboard/organizations?connect=select"
    );
    assert.doesNotMatch(management.headers.Location, /organizationId|secret/u);
  });
});

test("기존 스트리머 전용 URL은 key를 제거하고 통합 Dashboard로 이동한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    const legacyBase = await request(
      handler,
      "GET",
      "/dashboard/legacy-streamer/sdk_abcdefghijklmnopqrstuvwxyz?token=unsafe"
    );
    assert.equal(legacyBase.statusCode, 302);
    assert.equal(legacyBase.headers.Location, "/dashboard/streaming");
    assert.doesNotMatch(legacyBase.headers.Location, /private|token|key/iu);
    assert.equal(legacyBase.headers["Cache-Control"], "no-store");
    assert.equal(legacyBase.headers["Referrer-Policy"], "no-referrer");

    const legacyFollowers = await request(
      handler,
      "GET",
      "/dashboard/legacy-streamer/sdk_abcdefghijklmnopqrstuvwxyz/followers"
    );
    assert.equal(
      legacyFollowers.headers.Location,
      "/dashboard/streaming/followers"
    );

    const canonicalFollowers = await request(
      handler,
      "GET",
      "/dashboard/streaming/followers"
    );
    assert.notEqual(canonicalFollowers.statusCode, 302);

    const dashboardScript = await request(
      handler,
      "GET",
      "/dashboard/assets/index-deadbeef.js"
    );
    assert.notEqual(dashboardScript.statusCode, 302);

    const dashboardStylesheet = await request(
      handler,
      "GET",
      "/dashboard/assets/index-deadbeef.css"
    );
    assert.notEqual(dashboardStylesheet.statusCode, 302);
  });
});

test("Discord 공개 상태는 secret 없이 설치·OAuth·관리 준비 상태를 구분한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    const response = await request(handler, "GET", "/api/discord/status");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      installAvailable: true,
      oauthAvailable: true,
      managementAvailable: true,
      gatewayConfigured: true
    });
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(
      response.body,
      /secret|token|databaseUrl|clientId|applicationId|host/u
    );
    const head = await request(handler, "HEAD", "/api/discord/status");
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");

    appConfig.database.enabled = false;
    const unavailable = await request(handler, "GET", "/api/discord/status");
    assert.deepEqual(JSON.parse(unavailable.body), {
      installAvailable: true,
      oauthAvailable: false,
      managementAvailable: false,
      gatewayConfigured: true
    });
  });
});

test("YORO 계정 route는 통합 OAuth cookie·Origin·CSRF 경계를 유지한다", async () => {
  await withDiscordConfig(async () => {
    const calls = [];
    const yoroAccounts = {
      async beginOAuth(input) {
        calls.push({ type: "oauth", input });
        return {
          authorizationUrl:
            "https://discord.com/oauth2/authorize?client_id=987654321098765432&scope=identify",
          cookieValue: "oauth_binding_abcdefghijklmnopqrstuvwxyz123456"
        };
      },
      async session(cookieValue) {
        calls.push({ type: "session", cookieValue });
        return {
          authenticated: true,
          csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
          authenticationProvider: "discord",
          identities: [{
            provider: "discord",
            displayName: "검증 사용자",
            connectedAt: "2026-07-29T00:00:00.000Z",
            lastAuthenticatedAt: "2026-07-29T00:00:00.000Z"
          }],
          preferences: {
            locale: "ko",
            defaultDashboardPage: "overview",
            reducedMotion: false
          }
        };
      },
      async updatePreferences(input) {
        calls.push({ type: "preferences", input });
        return input.preferences;
      },
      async logout(cookieValue) {
        calls.push({ type: "logout", cookieValue });
      },
      async unlinkIdentity(input) {
        calls.push({ type: "unlink", input });
      },
      async completeOAuth(input) {
        calls.push({ type: "oauth_complete", input });
        return {
          returnPath: "/palworld",
          sessionToken:
            "session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456"
        };
      }
    };
    const { handler } = createDiscordHandler({
      handlerInput: { yoroAccounts }
    });

    const invalid = await request(
      handler,
      "GET",
      "/api/account/oauth/discord/start?redirect=https://evil.example"
    );
    assert.equal(invalid.statusCode, 400);

    const started = await request(
      handler,
      "GET",
      "/api/account/oauth/discord/start?purpose=login&return_to=%2Fbot%2Fmanage"
    );
    assert.equal(started.statusCode, 302);
    assert.equal(new URL(started.headers.Location).origin, "https://discord.com");
    assert.match(String(started.headers["Set-Cookie"]), /HttpOnly/u);
    assert.doesNotMatch(String(started.headers["Set-Cookie"]), /return_to|bot\/manage/u);

    const cookie =
      "yoro_session=session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const session = await request(
      handler,
      "GET",
      "/api/account/session",
      undefined,
      { cookie }
    );
    assert.equal(session.statusCode, 200);
    assert.equal(JSON.parse(session.body).authenticated, true);
    assert.doesNotMatch(session.body, /providerSubject|987654321098765432/u);

    const preferences = await request(
      handler,
      "PATCH",
      "/api/account/preferences",
      {
        locale: "ja",
        defaultDashboardPage: "organizations",
        reducedMotion: true
      },
      {
        cookie,
        origin: DASHBOARD_ORIGIN,
        "content-type": "application/json",
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(preferences.statusCode, 200);
    assert.deepEqual(JSON.parse(preferences.body), {
      preferences: {
        locale: "ja",
        defaultDashboardPage: "organizations",
        reducedMotion: true
      }
    });
    assert.equal(preferences.headers["Cache-Control"], "no-store");
    assert.deepEqual(
      calls.find((call) => call.type === "preferences")?.input,
      {
        sessionCookie:
          "session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456",
        csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
        preferences: {
          locale: "ja",
          defaultDashboardPage: "organizations",
          reducedMotion: true
        }
      }
    );

    const invalidPreferences = await request(
      handler,
      "PATCH",
      "/api/account/preferences",
      {
        locale: "ko",
        defaultDashboardPage: "overview",
        reducedMotion: false,
        userId: "11111111-1111-4111-8111-111111111111"
      },
      {
        cookie,
        origin: DASHBOARD_ORIGIN,
        "content-type": "application/json",
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(invalidPreferences.statusCode, 400);
    assert.equal(JSON.parse(invalidPreferences.body).code, "invalid_input");

    const untrustedPreferences = await request(
      handler,
      "PATCH",
      "/api/account/preferences",
      {
        locale: "ko",
        defaultDashboardPage: "overview",
        reducedMotion: false
      },
      {
        cookie,
        origin: "https://evil.example",
        "content-type": "application/json",
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(untrustedPreferences.statusCode, 403);
    assert.equal(JSON.parse(untrustedPreferences.body).code, "origin_denied");

    const denied = await request(
      handler,
      "POST",
      "/api/account/logout",
      undefined,
      {
        cookie,
        origin: "https://evil.example",
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(denied.statusCode, 403);

    const logout = await request(
      handler,
      "POST",
      "/api/account/logout",
      undefined,
      {
        cookie,
        origin: DASHBOARD_ORIGIN,
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(logout.statusCode, 204);
    assert.match(String(logout.headers["Set-Cookie"]), /Max-Age=0/u);

    const unlink = await request(
      handler,
      "DELETE",
      "/api/account/connections/twitch",
      undefined,
      {
        cookie,
        origin: DASHBOARD_ORIGIN,
        "x-yoro-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(unlink.statusCode, 204);
    assert.equal(calls.some((call) => call.type === "logout"), true);
    assert.equal(calls.some((call) => call.type === "unlink"), true);

    const callback = await request(
      handler,
      "GET",
      "/api/public/twitch/auth/callback?code=oauth-code&state=abcdefghijklmnopqrstuvwxyzABCDEFGH",
      undefined,
      { cookie: "yoro_oauth=oauth_binding_abcdefghijklmnopqrstuvwxyz123456" }
    );
    assert.equal(callback.statusCode, 302);
    const callbackLocation = new URL(callback.headers.Location);
    assert.equal(callbackLocation.pathname, "/palworld");
    assert.equal(callbackLocation.searchParams.get("account"), "twitch_connected");
    assert.match(String(callback.headers["Set-Cookie"]), /yoro_session=/u);
  });
});

test("웹 management OAuth 시작은 query를 거부하고 setup·Organization 정보를 URL에 노출하지 않는다", async () => {
  await withDiscordConfig(async () => {
    const { handler, calls } = createDiscordHandler();
    const invalid = await request(
      handler,
      "GET",
      "/api/discord/management/connect/start?returnTo=https://example.test"
    );
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls.length, 0);

    const unauthenticated = await request(
      handler,
      "GET",
      "/api/discord/management/connect/start"
    );
    assert.equal(unauthenticated.statusCode, 401);

    const response = await request(
      handler,
      "GET",
      "/api/discord/management/connect/start",
      undefined,
      {
        cookie:
          "yoro_session=session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(response.statusCode, 302);
    const location = new URL(response.headers.Location);
    assert.equal(location.origin, "https://discord.com");
    assert.equal(location.searchParams.has("setup"), false);
    assert.equal(location.searchParams.has("organizationId"), false);
    assert.equal(location.searchParams.has("returnTo"), false);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.match(String(response.headers["Set-Cookie"]), /HttpOnly/u);
    assert.doesNotMatch(String(response.headers["Set-Cookie"]), /setup|organization/u);
  });
});

test("웹 management session과 claim은 cookie·Origin·CSRF·strict body 경계를 유지한다", async () => {
  await withDiscordConfig(async () => {
    const { handler, calls } = createDiscordHandler();
    const cookie =
      "yoro_discord_onboarding=binding_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const session = await request(
      handler,
      "GET",
      "/api/discord/management/connect/session",
      undefined,
      { cookie }
    );
    assert.equal(session.statusCode, 200);
    assert.equal(session.headers["Cache-Control"], "no-store");
    assert.equal(JSON.parse(session.body).authenticated, true);

    const untrusted = await request(
      handler,
      "POST",
      "/api/discord/management/guilds/claim",
      { guildId: "123456789012345678" },
      { "content-type": "application/json", origin: "https://evil.example", cookie }
    );
    assert.equal(untrusted.statusCode, 403);
    assert.equal(JSON.parse(untrusted.body).code, "origin_denied");

    const wrongType = await request(
      handler,
      "POST",
      "/api/discord/management/guilds/claim",
      { guildId: "123456789012345678" },
      { "content-type": "text/plain", origin: DASHBOARD_ORIGIN, cookie }
    );
    assert.equal(wrongType.statusCode, 415);

    const unknown = await request(
      handler,
      "POST",
      "/api/discord/management/guilds/claim",
      { guildId: "123456789012345678", owner: true },
      { "content-type": "application/json", origin: DASHBOARD_ORIGIN, cookie }
    );
    assert.equal(unknown.statusCode, 400);
    assert.equal(JSON.parse(unknown.body).code, "invalid_input");

    const success = await request(
      handler,
      "POST",
      "/api/discord/management/guilds/claim",
      { guildId: "123456789012345678" },
      {
        "content-type": "application/json",
        origin: DASHBOARD_ORIGIN,
        cookie,
        "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(success.statusCode, 200);
    assert.equal(success.headers["Cache-Control"], "no-store");
    const body = JSON.parse(success.body);
    assert.equal(body.completed, true);
    assert.doesNotMatch(success.body, /management_value|csrf_value|cookie|token/u);
    const claim = calls.find((call) => call.type === "claim");
    assert.deepEqual(claim?.input, {
      cookieValue:
        "binding_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      guildId: "123456789012345678"
    });
    assert.equal(Array.isArray(success.headers["Set-Cookie"]), true);
    assert.match(String(success.headers["Set-Cookie"]), /yoro_session=/u);
  });
});

test("Discord feature·Database·Gateway 비활성 상태는 다른 상태로 fail-closed 응답한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    appConfig.discordSaas.enabled = false;
    const featureDisabled = await request(handler, "GET", "/api/discord/bot/install");
    assert.equal(featureDisabled.statusCode, 302);

    appConfig.discordSaas.enabled = true;
    appConfig.database.enabled = false;
    const databaseDisabled = await request(
      handler,
      "GET",
      "/api/discord/management/connect/session"
    );
    assert.equal(databaseDisabled.statusCode, 503);
    assert.equal(JSON.parse(databaseDisabled.body).code, "database_unavailable");

    appConfig.database.enabled = true;
    appConfig.discordBotInternal.enabled = false;
    const gatewayDisabled = await request(
      handler,
      "GET",
      "/api/discord/management/connect/session"
    );
    assert.equal(gatewayDisabled.statusCode, 503);
    assert.equal(JSON.parse(gatewayDisabled.body).code, "bot_gateway_unavailable");
    assert.equal(gatewayDisabled.headers["Cache-Control"], "no-store");
  });
});

test("Guild claim은 oversized JSON과 지원하지 않는 method를 안전하게 거부한다", async () => {
  await withDiscordConfig(async () => {
    const { handler } = createDiscordHandler();
    const cookie =
      "yoro_discord_onboarding=binding_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const oversized = JSON.stringify({
      guildId: "123456789012345678",
      padding: "x".repeat(1_000_000)
    });
    const largeResponse = await request(
      handler,
      "POST",
      "/api/discord/management/guilds/claim",
      oversized,
      {
        "content-type": "application/json",
        origin: DASHBOARD_ORIGIN,
        cookie,
        "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(largeResponse.statusCode, 413);
    assert.doesNotMatch(largeResponse.body, /padding|xxxx/u);

    const wrongMethod = await request(
      handler,
      "PUT",
      "/api/discord/management/guilds/claim",
      undefined,
      { origin: DASHBOARD_ORIGIN }
    );
    assert.equal(wrongMethod.statusCode, 404);
  });
});

test("Organization Palworld REST 연결은 tenant 권한 검증 후에만 비밀번호를 전달한다", async () => {
  await withDiscordConfig(async () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const gameServerId = "33333333-3333-4333-8333-333333333333";
    const ownerId = `organization:${organizationId}:server:${gameServerId}`;
    const calls = [];
    const diagnostics = [
      "url_policy",
      "dns_tcp",
      "tls",
      "basic_auth",
      "info",
      "metrics",
      "schema"
    ].map((key) => ({ key, state: "passed" }));
    const dashboardResponse = {
      enabled: true,
      pollIntervalSeconds: 30,
      registrationPolicy: {
        publicHttpsSelfService: true,
        publicHttpsPort: 443,
        privateNetworkRequiresOperatorApproval: true
      },
      connection: {
        configured: true,
        baseUrl: "https://pal.example.com",
        passwordConfigured: true,
        updatedAt: "2026-07-30T00:00:00.000Z"
      },
      status: {
        state: "online",
        checkedAt: "2026-07-30T00:00:00.000Z",
        lastSuccessAt: "2026-07-30T00:00:00.000Z",
        latencyMs: 20,
        consecutiveFailures: 0,
        info: { serverName: "테스트 서버", version: "v0.6.6" },
        metrics: {
          serverFps: 60,
          currentPlayers: 2,
          maxPlayers: 32,
          frameTimeMs: 16.67,
          uptimeSeconds: 3600,
          baseCampCount: 3,
          gameDays: 40
        },
        diagnostics
      }
    };
    const discordManagement = {
      async authorizeGameServerRestConnection(input) {
        calls.push({ type: "authorize", input });
        return ownerId;
      }
    };
    const palworldServerMonitor = {
      getDashboardResponse(receivedOwnerId) {
        calls.push({ type: "get", ownerId: receivedOwnerId });
        return dashboardResponse;
      },
      async saveConnection(receivedOwnerId, value) {
        calls.push({ type: "save", ownerId: receivedOwnerId, value });
        return dashboardResponse;
      }
    };
    const { handler } = createDiscordHandler({
      handlerInput: { discordManagement, palworldServerMonitor }
    });
    const path =
      `/api/discord/management/organizations/${organizationId}/game-servers/${gameServerId}/palworld-rest`;
    const cookie =
      "yoro_session=session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456";

    const status = await request(handler, "GET", path, undefined, { cookie });
    assert.equal(status.statusCode, 200, status.body);
    assert.equal(status.headers["Cache-Control"], "no-store");
    assert.equal(JSON.parse(status.body).status.state, "online");

    const saved = await request(
      handler,
      "POST",
      `${path}/save`,
      {
        baseUrl: "https://pal.example.com",
        adminPassword: "palworld-admin-password"
      },
      {
        "content-type": "application/json",
        origin: DASHBOARD_ORIGIN,
        cookie,
        "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(saved.body, /palworld-admin-password/u);
    const saveCall = calls.find((call) => call.type === "save");
    assert.deepEqual(saveCall, {
      type: "save",
      ownerId,
      value: {
        baseUrl: "https://pal.example.com",
        adminPassword: "palworld-admin-password"
      }
    });
    assert.equal(
      calls.filter((call) => call.type === "authorize").every((call) =>
        call.input.organizationId === organizationId
        && call.input.gameServerId === gameServerId
      ),
      true
    );
    assert.equal(
      calls.find((call) => call.type === "authorize" && call.input.mutation === true)
        ?.input.csrfToken,
      "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
    );
  });
});

test("Organization Palworld REST 변경 요청은 신뢰할 수 없는 Origin을 먼저 거부한다", async () => {
  await withDiscordConfig(async () => {
    let authorized = false;
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const gameServerId = "33333333-3333-4333-8333-333333333333";
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordManagement: {
          async authorizeGameServerRestConnection() {
            authorized = true;
            return "unreachable";
          }
        },
        palworldServerMonitor: {}
      }
    });
    const response = await request(
      handler,
      "POST",
      `/api/discord/management/organizations/${organizationId}/game-servers/${gameServerId}/palworld-rest/save`,
      { baseUrl: "https://pal.example.com", adminPassword: "secret" },
      {
        "content-type": "application/json",
        origin: "https://evil.example",
        cookie:
          "yoro_session=session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456",
        "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).code, "origin_denied");
    assert.equal(authorized, false);
    assert.doesNotMatch(response.body, /secret|pal\\.example/u);
  });
});

test("Organization 소유자의 게임 서버 삭제는 REST 자격 증명 제거와 DB 삭제를 한 요청으로 연결한다", async () => {
  await withDiscordConfig(async () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    const gameServerId = "33333333-3333-4333-8333-333333333333";
    const ownerId = `organization:${organizationId}:server:${gameServerId}`;
    const calls = [];
    const { handler } = createDiscordHandler({
      handlerInput: {
        discordManagement: {
          async deleteGameServer(input) {
            calls.push({ type: "delete", input });
            await input.beforeDelete(ownerId);
          }
        },
        palworldServerMonitor: {
          async removeConnection(receivedOwnerId) {
            calls.push({ type: "remove", ownerId: receivedOwnerId });
          }
        }
      }
    });
    const response = await request(
      handler,
      "DELETE",
      `/api/discord/management/organizations/${organizationId}/game-servers/${gameServerId}`,
      undefined,
      {
        origin: DASHBOARD_ORIGIN,
        cookie:
          "yoro_session=session_value_abcdefghijklmnopqrstuvwxyz123456.csrf_value_abcdefghijklmnopqrstuvwxyz123456",
        "x-discord-csrf": "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
      }
    );
    assert.equal(response.statusCode, 204);
    assert.equal(calls[0]?.type, "delete");
    assert.deepEqual(calls[1], { type: "remove", ownerId });
    assert.equal(
      calls[0]?.input.csrfToken,
      "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
    );
    assert.equal(calls[0]?.input.organizationId, organizationId);
    assert.equal(calls[0]?.input.gameServerId, gameServerId);
  });
});
