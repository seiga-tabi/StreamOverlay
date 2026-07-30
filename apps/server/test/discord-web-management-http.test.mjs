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
          "management_value_abcdefghijklmnopqrstuvwxyz123456.csrf_management_abcdefghijklmnopqrstuvwxyz123456"
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

    const response = await request(handler, "GET", "/api/discord/management/connect/start");
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
