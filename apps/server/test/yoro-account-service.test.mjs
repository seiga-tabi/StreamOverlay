import assert from "node:assert/strict";
import test from "node:test";
import { appConfig } from "../dist/config.js";
import {
  publicYoroIdentity,
  YoroAccountService
} from "../dist/services/yoro-account-service.js";

const connectedAt = "2026-07-30T00:00:00.000Z";
const lastAuthenticatedAt = "2026-07-30T01:00:00.000Z";

test("Discord 계정 공개 정보는 안전한 CDN avatar URL만 노출한다", () => {
  const identity = publicYoroIdentity({
    provider: "discord",
    providerSubject: "987654321098765432",
    displayName: "Discord 사용자",
    avatarReference: "a_0123456789abcdef",
    connectedAt,
    lastAuthenticatedAt
  });

  assert.deepEqual(identity, {
    provider: "discord",
    displayName: "Discord 사용자",
    avatarUrl:
      "https://cdn.discordapp.com/avatars/987654321098765432/a_0123456789abcdef.png?size=64",
    connectedAt,
    lastAuthenticatedAt
  });
  assert.equal("providerSubject" in identity, false);
  assert.equal("avatarReference" in identity, false);
});

test("계정 공개 정보는 변조된 Discord reference와 외부 Twitch avatar를 차단한다", () => {
  const discord = publicYoroIdentity({
    provider: "discord",
    providerSubject: "987654321098765432",
    displayName: "Discord 사용자",
    avatarReference: "../secret",
    connectedAt,
    lastAuthenticatedAt
  });
  const twitch = publicYoroIdentity({
    provider: "twitch",
    providerSubject: "12345678",
    displayName: "Twitch 사용자",
    avatarReference: "https://example.com/avatar.png",
    connectedAt,
    lastAuthenticatedAt
  });

  assert.equal(discord.avatarUrl, undefined);
  assert.equal(twitch.avatarUrl, undefined);
});

test("Riot 계정 공개 정보는 PUUID를 숨기고 Riot ID만 표시한다", () => {
  const identity = publicYoroIdentity({
    provider: "riot",
    providerSubject: "riot-puuid-value_abcdefghijklmnopqrstuvwxyz1234567890",
    displayName: "YORO Player#KR1",
    connectedAt,
    lastAuthenticatedAt,
    valorantRecordConsent: false
  });

  assert.deepEqual(identity, {
    provider: "riot",
    displayName: "YORO Player#KR1",
    connectedAt,
    lastAuthenticatedAt,
    valorantRecordConsent: false
  });
  assert.equal("providerSubject" in identity, false);
});

async function withRiotRsoConfig(run) {
  const previous = {
    enabled: appConfig.riot.rsoEnabled,
    clientId: appConfig.riot.rsoClientId,
    clientSecret: appConfig.riot.rsoClientSecret,
    redirectUri: appConfig.riot.rsoRedirectUri,
    accountRegion: appConfig.riot.accountRegion
  };
  appConfig.riot.rsoEnabled = true;
  appConfig.riot.rsoClientId = "riot-rso-client-id";
  appConfig.riot.rsoClientSecret = "riot-rso-client-secret-value-1234567890";
  appConfig.riot.rsoRedirectUri = "https://yoro.gg/api/account/oauth/riot/callback";
  appConfig.riot.accountRegion = "asia";
  try {
    await run();
  } finally {
    appConfig.riot.rsoEnabled = previous.enabled;
    appConfig.riot.rsoClientId = previous.clientId;
    appConfig.riot.rsoClientSecret = previous.clientSecret;
    appConfig.riot.rsoRedirectUri = previous.redirectUri;
    appConfig.riot.accountRegion = previous.accountRegion;
  }
}

test("Riot RSO 시작은 최근 Twitch 인증 session만 허용하고 최소 scope를 요청한다", async () => {
  await withRiotRsoConfig(async () => {
    let authenticationProvider = "discord";
    const queries = [];
    const sessionToken = "session_value_abcdefghijklmnopqrstuvwxyz123456";
    const csrfToken = "csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const crypto = await import("node:crypto");
    const csrfHash = crypto.createHash("sha256").update(csrfToken).digest();
    const pool = {
      async query(text, values) {
        queries.push({ text, values });
        if (text.includes("UPDATE yoro_sessions session")) {
          return {
            rows: [{
              id: "11111111-1111-4111-8111-111111111111",
              user_id: "22222222-2222-4222-8222-222222222222",
              csrf_token_hash: csrfHash,
              authentication_provider: authenticationProvider,
              authenticated_at: new Date()
            }]
          };
        }
        if (text.includes("INSERT INTO yoro_oauth_sessions")) {
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unexpected query: ${text}`);
      }
    };
    const service = new YoroAccountService(pool);

    await assert.rejects(
      service.beginOAuth({
        provider: "riot",
        purpose: "link_identity",
        returnPath: "/dashboard/account",
        sessionCookie: `${sessionToken}.${csrfToken}`
      }),
      (error) => error?.code === "twitch_authentication_required"
    );

    authenticationProvider = "twitch";
    const started = await service.beginOAuth({
      provider: "riot",
      purpose: "link_identity",
      returnPath: "/dashboard/account",
      sessionCookie: `${sessionToken}.${csrfToken}`
    });
    const authorization = new URL(started.authorizationUrl);
    assert.equal(authorization.origin, "https://auth.riotgames.com");
    assert.equal(authorization.pathname, "/authorize");
    assert.equal(authorization.searchParams.get("client_id"), "riot-rso-client-id");
    assert.equal(authorization.searchParams.get("scope"), "openid");
    assert.equal(
      authorization.searchParams.get("redirect_uri"),
      "https://yoro.gg/api/account/oauth/riot/callback"
    );
    assert.equal(started.authorizationUrl.includes(appConfig.riot.rsoClientSecret), false);
    assert.equal(
      queries.some((query) => query.text.includes("INSERT INTO yoro_oauth_sessions")),
      true
    );
  });
});

test("Riot RSO 연결 가능 상태는 오래된 Twitch 인증에도 재인증을 요구한다", async () => {
  await withRiotRsoConfig(async () => {
    const sessionToken = "session_value_abcdefghijklmnopqrstuvwxyz123456";
    const csrfToken = "csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const crypto = await import("node:crypto");
    const csrfHash = crypto.createHash("sha256").update(csrfToken).digest();
    const pool = {
      async query(text) {
        if (text.includes("UPDATE yoro_sessions session")) {
          return {
            rows: [{
              id: "11111111-1111-4111-8111-111111111111",
              user_id: "22222222-2222-4222-8222-222222222222",
              csrf_token_hash: csrfHash,
              authentication_provider: "twitch",
              authenticated_at: new Date(Date.now() - 16 * 60 * 1_000)
            }]
          };
        }
        if (text.includes("FROM external_identities")) return { rows: [] };
        if (text.includes("FROM yoro_user_preferences")) return { rows: [] };
        throw new Error(`unexpected query: ${text}`);
      }
    };
    const service = new YoroAccountService(pool);

    const session = await service.session(`${sessionToken}.${csrfToken}`);

    assert.equal(session?.connectionCapabilities.riotRsoAvailable, true);
    assert.equal(
      session?.connectionCapabilities.riotRsoRequiresTwitchAuthentication,
      true
    );
  });
});

test("Riot RSO callback은 동일 Twitch session과 /accounts/me를 확인한 뒤 token을 폐기한다", async () => {
  await withRiotRsoConfig(async () => {
    const userId = "22222222-2222-4222-8222-222222222222";
    const oauthId = "33333333-3333-4333-8333-333333333333";
    const sessionToken = "session_value_abcdefghijklmnopqrstuvwxyz123456";
    const csrfToken = "csrf_value_abcdefghijklmnopqrstuvwxyz123456";
    const oauthCookie = "oauth_binding_abcdefghijklmnopqrstuvwxyz123456";
    const state = "oauth_state_abcdefghijklmnopqrstuvwxyz123456";
    const accessToken = "riot-access-token-value";
    const puuid = `riot-puuid_${"a".repeat(50)}`;
    const crypto = await import("node:crypto");
    const csrfHash = crypto.createHash("sha256").update(csrfToken).digest();
    const transactionQueries = [];
    const client = {
      async query(text, values = []) {
        transactionQueries.push({ text, values });
        if (
          text.includes("SELECT provider_subject")
          || text.includes("SELECT user_id, revoked_at")
        ) return { rows: [] };
        return { rows: [], rowCount: 1 };
      },
      release() {}
    };
    const pool = {
      async query(text) {
        if (text.includes("UPDATE yoro_oauth_sessions")) {
          return {
            rows: [{
              id: oauthId,
              provider: "riot",
              purpose: "link_identity",
              target_user_id: userId,
              pkce_verifier_encrypted: null,
              return_path: "/dashboard/account"
            }]
          };
        }
        if (text.includes("UPDATE yoro_sessions session")) {
          return {
            rows: [{
              id: "11111111-1111-4111-8111-111111111111",
              user_id: userId,
              csrf_token_hash: csrfHash,
              authentication_provider: "twitch",
              authenticated_at: new Date()
            }]
          };
        }
        throw new Error(`unexpected query: ${text}`);
      },
      async connect() {
        return client;
      }
    };
    const fetchCalls = [];
    const service = new YoroAccountService(pool, undefined, async (url, init = {}) => {
      fetchCalls.push({ url: String(url), init });
      if (String(url) === "https://auth.riotgames.com/token") {
        assert.equal(init.method, "POST");
        assert.equal(init.body.get("grant_type"), "authorization_code");
        assert.equal(init.body.get("redirect_uri"), appConfig.riot.rsoRedirectUri);
        assert.equal(
          init.headers.Authorization,
          `Basic ${Buffer.from(`${appConfig.riot.rsoClientId}:${appConfig.riot.rsoClientSecret}`).toString("base64")}`
        );
        return new Response(JSON.stringify({ access_token: accessToken }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      assert.equal(
        String(url),
        "https://asia.api.riotgames.com/riot/account/v1/accounts/me"
      );
      assert.equal(init.headers.Authorization, `Bearer ${accessToken}`);
      return new Response(JSON.stringify({
        puuid,
        gameName: "YORO Player",
        tagLine: "KR1"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    const completed = await service.completeOAuth({
      provider: "riot",
      state,
      code: "riot-authorization-code",
      oauthCookie,
      sessionCookie: `${sessionToken}.${csrfToken}`
    });
    assert.equal(completed.returnPath, "/dashboard/account");
    assert.equal(completed.sessionToken.split(".").length, 2);
    assert.equal(fetchCalls.length, 2);
    const identityInsert = transactionQueries.find(
      (query) => query.text.includes("INSERT INTO external_identities")
    );
    assert.equal(identityInsert?.values[2], "riot");
    assert.equal(identityInsert?.values[3], puuid);
    assert.equal(identityInsert?.values[4], "YORO Player#KR1");
    assert.equal(JSON.stringify(transactionQueries).includes(accessToken), false);
    const sessionInsert = transactionQueries.find(
      (query) => query.text.includes("INSERT INTO yoro_sessions")
    );
    assert.equal(sessionInsert?.values[4], "twitch");
  });
});

test("발로란트 전적 공개 동의는 최근 Twitch 인증·CSRF를 요구하고 cache를 무효화한다", async () => {
  const userId = "22222222-2222-4222-8222-222222222222";
  const riotIdentityId = "33333333-3333-4333-8333-333333333333";
  const sessionToken = "session_value_abcdefghijklmnopqrstuvwxyz123456";
  const csrfToken = "csrf_value_abcdefghijklmnopqrstuvwxyz123456";
  const crypto = await import("node:crypto");
  const csrfHash = crypto.createHash("sha256").update(csrfToken).digest();
  const transactionQueries = [];
  const client = {
    async query(text, values = []) {
      transactionQueries.push({ text, values });
      if (text.includes("SELECT id") && text.includes("provider = 'riot'")) {
        return { rows: [{ id: riotIdentityId }], rowCount: 1 };
      }
      if (text.includes("INSERT INTO yoro_valorant_record_consents")) {
        return {
          rows: [{ enabled: true, consented_at: new Date("2026-08-11T00:00:00.000Z") }],
          rowCount: 1
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const pool = {
    async query(text) {
      if (text.includes("UPDATE yoro_sessions session")) {
        return { rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          user_id: userId,
          csrf_token_hash: csrfHash,
          authentication_provider: "twitch",
          authenticated_at: new Date()
        }] };
      }
      if (text.includes("FROM external_identities identity")) {
        return { rows: [{
          user_id: userId,
          provider: "riot",
          provider_subject: `riot-puuid_${"a".repeat(50)}`,
          display_name: "YORO Player#KR1",
          avatar_reference: null,
          connected_at: new Date("2026-08-10T00:00:00.000Z"),
          last_authenticated_at: new Date("2026-08-10T00:00:00.000Z"),
          valorant_record_consent: false
        }] };
      }
      throw new Error(`unexpected query: ${text}`);
    },
    async connect() { return client; }
  };
  let invalidatedUserId;
  const service = new YoroAccountService(pool);
  service.setValorantVisibilityInvalidator((candidate) => { invalidatedUserId = candidate; });

  const result = await service.updateValorantRecordConsent({
    enabled: true,
    sessionCookie: `${sessionToken}.${csrfToken}`,
    csrfToken
  });

  assert.deepEqual(result, {
    enabled: true,
    consentedAt: "2026-08-11T00:00:00.000Z"
  });
  assert.equal(invalidatedUserId, userId);
  assert.equal(
    transactionQueries.some((query) => query.text.includes("INSERT INTO yoro_valorant_record_consents")),
    true
  );
  assert.equal(JSON.stringify(transactionQueries).includes("riot-puuid"), false);
});
