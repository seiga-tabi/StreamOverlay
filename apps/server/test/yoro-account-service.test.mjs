import assert from "node:assert/strict";
import test from "node:test";
import { publicYoroIdentity } from "../dist/services/yoro-account-service.js";

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
