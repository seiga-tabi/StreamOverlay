import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  TwitchExtensionJwtError,
  TwitchExtensionJwtVerifier,
  twitchExtensionBearerToken
} from "../dist/security/twitch-extension-jwt.js";

const secret = crypto.randomBytes(32);
const verifier = new TwitchExtensionJwtVerifier(secret.toString("base64"));

function token(payload, header = { alg: "HS256", typ: "JWT" }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function validPayload(overrides = {}) {
  return {
    channel_id: "123456789",
    opaque_user_id: "Uabcdef123456789",
    user_id: "987654321",
    role: "viewer",
    exp: 10_600,
    iat: 9_990,
    ...overrides
  };
}

test("Twitch Extension JWT는 HS256 서명과 채널·연결 사용자 claim을 검증한다", () => {
  assert.deepEqual(verifier.verify(token(validPayload()), 10_000), {
    channelId: "123456789",
    opaqueUserId: "Uabcdef123456789",
    role: "viewer",
    userId: "987654321",
    expiresAt: 10_600
  });
  const anonymous = verifier.verify(token(validPayload({
    opaque_user_id: "Aabcdef123456789",
    user_id: undefined
  })), 10_000);
  assert.equal(anonymous.userId, undefined);
});

test("Twitch Extension JWT는 변조·만료·external role·익명 user_id를 fail-closed 처리한다", () => {
  const signed = token(validPayload());
  assert.throws(
    () => verifier.verify(`${signed.slice(0, -1)}x`, 10_000),
    (error) => error instanceof TwitchExtensionJwtError && error.code === "invalid"
  );
  assert.throws(
    () => verifier.verify(token(validPayload({ exp: 9_000 })), 10_000),
    (error) => error instanceof TwitchExtensionJwtError && error.code === "expired"
  );
  assert.throws(() => verifier.verify(token(validPayload({ role: "external" })), 10_000));
  assert.throws(() => verifier.verify(token(validPayload({ opaque_user_id: "Aabcdef", user_id: "1" })), 10_000));
  assert.throws(() => verifier.verify(token(validPayload({ exp: 100_000 })), 10_000));
});

test("Authorization parser는 단일 Bearer token만 허용한다", () => {
  assert.equal(twitchExtensionBearerToken({ headers: { authorization: "Bearer a.b.c" } }), "a.b.c");
  assert.throws(
    () => twitchExtensionBearerToken({ headers: { authorization: "Basic abc" } }),
    (error) => error instanceof TwitchExtensionJwtError && error.code === "missing"
  );
  assert.throws(() => twitchExtensionBearerToken({ headers: { authorization: "Bearer a b" } }));
});
