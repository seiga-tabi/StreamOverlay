import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  DISCORD_INTERNAL_AUTH_VERSION,
  discordInternalCanonicalRequest
} from "@streamops/shared";
import { DiscordInternalAuthVerifier } from "../dist/security/discord-internal-auth.js";

const key = "k".repeat(64);
const now = 1_800_000_000_000;
const path = "/internal/discord/setup-sessions";

function signed(body, overrides = {}) {
  const timestamp = overrides.timestamp ?? String(Math.trunc(now / 1000));
  const nonce = overrides.nonce ?? Buffer.alloc(24, 3).toString("base64url");
  const bodySha256 = crypto.createHash("sha256").update(body).digest("hex");
  const canonical = discordInternalCanonicalRequest({
    bodySha256,
    method: overrides.method ?? "POST",
    nonce,
    path: overrides.path ?? path,
    timestamp
  });
  const signature = crypto.createHmac("sha256", key).update(canonical).digest("hex");
  return {
    "x-yoro-auth-version": DISCORD_INTERNAL_AUTH_VERSION,
    "x-yoro-auth-timestamp": timestamp,
    "x-yoro-auth-nonce": nonce,
    "x-yoro-auth-signature": signature
  };
}

test("Discord 내부 인증은 정상 HMAC을 허용하고 nonce 재사용을 차단한다", () => {
  const body = Buffer.from('{"guildId":"1"}');
  const headers = signed(body);
  const verifier = new DiscordInternalAuthVerifier(key, 60, () => now);
  assert.deepEqual(verifier.verify({ body, headers, method: "POST", path }), { ok: true });
  assert.deepEqual(
    verifier.verify({ body, headers, method: "POST", path }),
    { ok: false, code: "INTERNAL_AUTH_REPLAY" }
  );
});

test("Discord 내부 인증은 body·method·path 변조와 오래된 timestamp를 차단한다", () => {
  const body = Buffer.from('{"guildId":"1"}');
  for (const candidate of [
    { body: Buffer.from('{"guildId":"2"}'), method: "POST", path, headers: signed(body) },
    { body, method: "GET", path, headers: signed(body) },
    {
      body,
      method: "POST",
      path: "/internal/discord/installations/upsert",
      headers: signed(body)
    },
    {
      body,
      method: "POST",
      path,
      headers: signed(body, { timestamp: String(Math.trunc(now / 1000) - 120), nonce: Buffer.alloc(24, 4).toString("base64url") })
    }
  ]) {
    const verifier = new DiscordInternalAuthVerifier(key, 60, () => now);
    assert.equal(verifier.verify(candidate).ok, false);
  }
});
