import assert from "node:assert/strict";
import test from "node:test";

const {
  decryptPublicLolProfileLink,
  encryptPublicLolProfileLink,
} = await import("../dist/services/public-lol-profile-link.js");

const KEY = Buffer.alloc(32, 7).toString("base64");

test("전적 공유 token은 Riot ID를 노출하지 않고 동일 입력에 결정적이다", () => {
  const input = { riotId: "Hide on bush#KR1", lolPlatform: "kr" };
  const first = encryptPublicLolProfileLink(input, KEY, "test");
  const second = encryptPublicLolProfileLink(input, KEY, "test");

  assert.equal(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/u);
  assert.doesNotMatch(first, /Hide|bush|KR1/u);
  assert.deepEqual(decryptPublicLolProfileLink(first, KEY, "test"), input);
});

test("전적 공유 token 변조와 서버 불일치를 거부한다", () => {
  const token = encryptPublicLolProfileLink({ riotId: "Faker#KR1", lolPlatform: "kr" }, KEY, "test");
  const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  const otherKey = Buffer.alloc(32, 8).toString("base64");

  assert.throws(() => decryptPublicLolProfileLink(tampered, KEY, "test"), /PUBLIC_LOL_PROFILE_LINK_INVALID/u);
  assert.throws(() => decryptPublicLolProfileLink(token, otherKey, "test"), /PUBLIC_LOL_PROFILE_LINK_INVALID/u);
  assert.throws(() => decryptPublicLolProfileLink("../Faker-KR1", KEY, "test"), /PUBLIC_LOL_PROFILE_LINK_INVALID/u);
});
