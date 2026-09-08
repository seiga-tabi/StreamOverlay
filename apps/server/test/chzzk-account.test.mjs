import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { appConfig } from "../dist/config.js";
import { publicYoroIdentity, YoroAccountService } from "../dist/services/yoro-account-service.js";

const userId = "22222222-2222-4222-8222-222222222222";
const oauthId = "33333333-3333-4333-8333-333333333333";
const csrf = "c".repeat(40);
const cookie = `${"s".repeat(40)}.${csrf}`;
const hash = (value) => crypto.createHash("sha256").update(value).digest();
const token = { accessToken: "access-value", refreshToken: "refresh-value", tokenType: "Bearer", expiresIn: 86400 };
const profile = { channelId: "opaque-채널:AbC_123", channelName: "치지직 사용자" };
const response = (content) => new Response(JSON.stringify({ code: 200, message: null, content }));
function fixture({ conflict = false, message = null } = {}) {
  const queries = [];
  const calls = [];
  let oauth;
  let identities = [];
  const pool = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.includes("INSERT INTO yoro_oauth_sessions")) oauth = { provider: values[1], purpose: values[2], target_user_id: values[3], state: values[4], binding: values[5], return_path: values[7], id: oauthId, pkce_verifier_encrypted: null };
      if (text.includes("SET status = 'consumed'")) {
        if (!oauth || !oauth.state.equals(values[1]) || !oauth.binding.equals(values[2]) || oauth.provider !== values[0]) return { rows: [] };
        const row = oauth; oauth = undefined; return { rows: [row] };
      }
      if (text.includes("UPDATE yoro_sessions session")) return { rows: [{ id: oauthId, user_id: userId, csrf_token_hash: hash(csrf), authentication_provider: "chzzk", authenticated_at: new Date() }] };
      if (conflict && text.includes("SELECT user_id, revoked_at")) return { rows: [{ user_id: "44444444-4444-4444-8444-444444444444", revoked_at: null }] };
      if (text.includes("INSERT INTO external_identities")) identities.push({ provider: values[2] });
      if (text.includes("SELECT provider\n")) return { rows: identities };
      if (text.includes("SET revoked_at = NOW()") && text.includes("external_identities")) identities = identities.filter((i) => i.provider !== values[1]);
      return { rows: [], rowCount: 1 };
    },
    async connect() { return { query: pool.query, release() {} }; }
  };
  const service = new YoroAccountService(pool, undefined, async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ code: 200, ...(message === "생략" ? {} : { message }), content: url.endsWith("/token") ? token : profile }));
  });
  return { service, queries, calls, setIdentities(value) { identities = value; } };
}
async function configured(run) {
  const previous = { ...appConfig.chzzk };
  Object.assign(appConfig.chzzk, { clientId: "test-client", clientSecret: "test-secret", redirectUri: "https://yoro.gg/api/account/oauth/chzzk/callback" });
  try { await run(); } finally { Object.assign(appConfig.chzzk, previous); }
}
async function begin(f, purpose = "login") {
  const started = await f.service.beginOAuth({ provider: "chzzk", purpose, sessionCookie: cookie, returnPath: "/dashboard/account" });
  const url = new URL(started.authorizationUrl);
  assert.equal(url.origin + url.pathname, "https://chzzk.naver.com/account-interlock");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["clientId", "redirectUri", "state"]);
  assert.equal(url.searchParams.get("clientId"), "test-client");
  assert.equal(url.searchParams.get("redirectUri"), appConfig.chzzk.redirectUri);
  return { provider: "chzzk", state: url.searchParams.get("state"), code: "test-code", oauthCookie: started.cookieValue };
}
test("CHZZK 시작과 콜백은 단독 계정을 만들고 legacy 및 토큰 저장을 하지 않는다", async () => configured(async () => {
  const f = fixture(); const input = await begin(f);
  const completed = await f.service.completeOAuth(input);
  assert.equal(completed.returnPath, "/dashboard/account");
  assert.deepEqual(f.queries.find((q) => q.text.includes("INSERT INTO users")).values.slice(1), [null, null]);
  assert.equal(f.queries.find((q) => q.text.includes("INSERT INTO yoro_sessions")).values[4], "chzzk");
  assert.equal(f.queries.some((q) => /WHERE (discord|twitch)_user_id|UPDATE users|viewer_credentials/.test(q.text)), false);
  assert.equal(JSON.stringify(f.queries).includes(token.accessToken), false);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { grantType: "authorization_code", code: input.code, state: input.state, clientId: "test-client", clientSecret: "test-secret" });
  assert.equal(f.calls[1].init.headers.Authorization, `Bearer ${token.accessToken}`);
  assert.equal(f.calls[1].init.headers["Content-Type"], "application/json");
  assert.ok(f.calls.every((c) => c.init.signal instanceof AbortSignal));
  await assert.rejects(f.service.completeOAuth(input), { code: "oauth_failed" });
}));
test("CHZZK 연결·해제 왕복과 CSRF 및 마지막 로그인 수단 보호", async () => configured(async () => {
  const f = fixture(); f.setIdentities([{ provider: "twitch" }]);
  await f.service.completeOAuth(await begin(f, "link_identity"));
  await assert.rejects(f.service.unlinkIdentity({ provider: "chzzk", sessionCookie: cookie, csrfToken: "bad" }), { code: "csrf_required" });
  await f.service.unlinkIdentity({ provider: "chzzk", sessionCookie: cookie, csrfToken: csrf });
  assert.equal(f.queries.some((q) => q.text.includes("UPDATE users")), false);
  f.setIdentities([{ provider: "chzzk" }, { provider: "riot" }]);
  await assert.rejects(f.service.unlinkIdentity({ provider: "chzzk", sessionCookie: cookie, csrfToken: csrf }), { code: "last_identity_required" });
}));
test("CHZZK state와 cookie 변조는 외부 호출 전에 차단한다", async () => configured(async () => {
  for (const key of ["state", "oauthCookie"]) {
    const f = fixture(); const input = await begin(f);
    await assert.rejects(f.service.completeOAuth({ ...input, [key]: "x".repeat(40) }), { code: "oauth_failed" });
    assert.equal(f.calls.length, 0);
  }
}));
test("CHZZK 갱신 규격과 잘못된 HTTP·래퍼·토큰·프로필을 검증한다", async () => configured(async () => {
  const f = fixture(); assert.deepEqual(await f.service.refreshChzzkToken("refresh-value"), token);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { grantType: "refresh_token", refreshToken: "refresh-value", clientId: "test-client", clientSecret: "test-secret" });
  // 치지직 공식 문서는 expiresIn 타입을 String("86400")으로 명시한다. 숫자 문자열도 허용해야 한다.
  const stringExpiresService = new YoroAccountService({}, undefined, async () => response({ ...token, expiresIn: "86400" }));
  assert.deepEqual(await stringExpiresService.refreshChzzkToken("refresh-value"), token);
  const invalid = [null, [], { code: 400, message: "실패" }, { code: "200", message: null, content: token }, ...[undefined, null, [], "invalid", 42].map((content) => ({ code: 200, content })),
    ...[{ ...token, accessToken: "a\r\nb" }, { ...token, refreshToken: "" }, { ...token, accessToken: " " }, { ...token, tokenType: "Other" }, { ...token, expiresIn: 0 }, { ...token, expiresIn: 86401 },
      { ...token, expiresIn: "0" }, { ...token, expiresIn: "86401" }, { ...token, expiresIn: "abc" }, { ...token, expiresIn: " 86400" }, { ...token, expiresIn: "-1" }, { ...token, expiresIn: null },
      { ...token, expiresIn: "1.5" }, { ...token, expiresIn: "1e3" }, { ...token, expiresIn: "86400\n" }, { ...token, expiresIn: "99999999999999999999" }].map((content) => ({ code: 200, message: null, content }))];
  for (const value of invalid) {
    const service = new YoroAccountService({}, undefined, async () => new Response(JSON.stringify(value)));
    await assert.rejects(service.refreshChzzkToken("refresh"), { code: "oauth_failed" });
  }
  for (const bad of [{ ...profile, channelId: "" }, { ...profile, channelId: "a".repeat(257) }, { ...profile, channelId: "a\u0085b" }, { ...profile, channelId: " trailing " }, { ...profile, channelName: 3 }]) {
    const service = new YoroAccountService({}, undefined, async () => response(bad));
    await assert.rejects(service.fetchChzzkProfile("access"), { code: "oauth_failed" });
  }
  for (const fetcher of [async () => new Response("{}", { status: 500 }), async () => new Response("{"), async () => { throw new Error("네트워크 실패"); }]) {
    await assert.rejects(new YoroAccountService({}, undefined, fetcher).refreshChzzkToken("refresh"), { code: "oauth_failed" });
  }
}));
test("CHZZK 미설정 시작은 DB 기록 전에 실패한다", async () => {
  const previous = appConfig.chzzk.clientId;
  appConfig.chzzk.clientId = "";
  try {
    const f = fixture();
    await assert.rejects(f.service.beginOAuth({ provider: "chzzk", purpose: "login" }), { code: "feature_unavailable" });
    assert.equal(f.queries.length, 0);
  } finally { appConfig.chzzk.clientId = previous; }
});


test("CHZZK 공개 identity에는 식별자·프로필 사진·토큰이 노출되지 않는다", () => {
  const identity = publicYoroIdentity({ provider: "chzzk", providerSubject: "1234",
    displayName: "치지직", avatarReference: "abcdef", connectedAt: "2026-09-08", lastAuthenticatedAt: "2026-09-08" });
  assert.deepEqual(identity, { provider: "chzzk", displayName: "치지직", connectedAt: "2026-09-08", lastAuthenticatedAt: "2026-09-08" });
});

test("CHZZK 긴 채널명은 이모지를 훼손하지 않고 저장소의 80자 제한에 맞춘다", async () => {
  // 1단계에서 외부 토큰을 보관하지 않으므로 갱신·프로필 계약은 dist의 내부 메서드로 검증합니다.
  const service = new YoroAccountService({}, undefined, async () => response({
    ...profile, channelName: `${"a".repeat(79)}😀채널`
  }));
  const result = await service.fetchChzzkProfile("access");
  assert.equal(result.displayName, "a".repeat(79));
  const emojiService = new YoroAccountService({}, undefined, async () => response({
    ...profile, channelName: "😀".repeat(80)
  }));
  assert.equal((await emojiService.fetchChzzkProfile("access")).displayName, "😀".repeat(40));
});

for (const message of ["생략", "", "성공 안내"]) {
  test(`CHZZK message가 ${message || "빈 문자열"}이어도 발급·프로필·갱신이 성공한다`, async () => configured(async () => {
    const f = fixture({ message });
    const completed = await f.service.completeOAuth(await begin(f));
    assert.equal(completed.returnPath, "/dashboard/account");
    assert.deepEqual(await f.service.refreshChzzkToken("refresh-value"), token);
    assert.equal(f.calls.length, 3);
  }));
}

test("CHZZK 신원 충돌은 쓰기 없는 트랜잭션 종료 후 정확히 409를 반환한다", async () => configured(async () => {
  const f = fixture({ conflict: true });
  await assert.rejects(f.service.completeOAuth(await begin(f, "link_identity")), {
    code: "identity_conflict", status: 409
  });
  const transaction = f.queries.slice(f.queries.findIndex((q) => q.text === "BEGIN"));
  const end = transaction.findIndex((q) => q.text === "COMMIT");
  assert.ok(end > 0);
  assert.equal(transaction.slice(0, end).some((q) => /^\s*(INSERT|UPDATE|DELETE)\b/u.test(q.text)), false);
  assert.equal(transaction.some((q) => q.text.includes("INSERT INTO yoro_sessions")), false);
  assert.ok(transaction.some((q) => q.text.includes("SET status = 'security_failed'")));
}));
