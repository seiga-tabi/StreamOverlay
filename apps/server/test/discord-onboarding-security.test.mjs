import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  decryptDiscordSecret,
  discordPkceChallenge,
  discordSecretHash,
  encryptDiscordSecret
} from "../dist/services/discord-oauth-crypto.js";
import { parseDiscordManageableGuild } from "../dist/services/discord-onboarding-service.js";
import { requiredHttpPrincipal } from "../dist/security/auth.js";
import { DiscordOnboardingRepository } from "../dist/database/repositories/discord-onboarding-repository.js";
import { SafeDatabaseError } from "../dist/database/errors.js";

const key = crypto.randomBytes(32).toString("base64");
const otherKey = crypto.randomBytes(32).toString("base64");
const context = Object.freeze({
  sessionId: crypto.randomUUID(),
  discordUserId: "123456789012345678",
  purpose: "oauth_token"
});

test("Discord OAuth token은 AES-256-GCM과 분리된 AAD로 보호된다", () => {
  const sentinel = "discord_access_token_SENTINEL_value";
  const first = encryptDiscordSecret(sentinel, key, 1, context);
  const second = encryptDiscordSecret(sentinel, key, 1, context);

  assert.notDeepEqual(first, second);
  assert.doesNotMatch(first.toString("utf8"), /SENTINEL/u);
  assert.equal(decryptDiscordSecret(first, key, context), sentinel);
  assert.equal(discordSecretHash(sentinel).byteLength, 32);
  assert.equal(discordPkceChallenge("verifier").includes("="), false);

  assert.throws(
    () => decryptDiscordSecret(first, otherKey, context),
    /DISCORD_DECRYPTION_FAILED/u
  );
  assert.throws(
    () => decryptDiscordSecret(first, key, {
      ...context,
      discordUserId: "999999999999999999"
    }),
    /DISCORD_DECRYPTION_FAILED/u
  );
  assert.throws(
    () => decryptDiscordSecret(first, key, {
      ...context,
      sessionId: crypto.randomUUID()
    }),
    /DISCORD_DECRYPTION_FAILED/u
  );
  assert.throws(
    () => decryptDiscordSecret(first, key, {
      ...context,
      purpose: "pkce_verifier"
    }),
    /DISCORD_DECRYPTION_FAILED/u
  );

  const tampered = Buffer.from(first);
  tampered[tampered.length - 2] ^= 1;
  assert.throws(
    () => decryptDiscordSecret(tampered, key, context),
    /DISCORD_(CIPHERTEXT_INVALID|DECRYPTION_FAILED)/u
  );
});

test("Discord Guild 관리 권한은 BigInt bitfield와 owner만 허용한다", () => {
  const owner = parseDiscordManageableGuild({
    id: "123456789012345678",
    name: "Owner Guild",
    owner: true,
    permissions: "0"
  });
  assert.equal(owner?.manageable, true);

  const administrator = parseDiscordManageableGuild({
    id: "223456789012345678",
    name: "Administrator Guild",
    owner: false,
    permissions: String(1n << 3n)
  });
  assert.equal(administrator?.manageable, true);

  const manageGuild = parseDiscordManageableGuild({
    id: "323456789012345678",
    name: "Manage Guild",
    owner: false,
    permissions: String((1n << 70n) | (1n << 5n)),
    icon: "a_abcdef0123456789"
  });
  assert.equal(manageGuild?.manageable, true);
  assert.match(manageGuild?.iconUrl ?? "", /^https:\/\/cdn\.discordapp\.com\/icons\//u);

  assert.equal(parseDiscordManageableGuild({
    id: "423456789012345678",
    name: "Member Guild",
    owner: false,
    permissions: "1024"
  }), undefined);
  assert.equal(parseDiscordManageableGuild({
    id: "523456789012345678",
    name: "Malformed",
    owner: false,
    permissions: "not-a-number"
  }), undefined);
  assert.equal(parseDiscordManageableGuild({
    id: "unsafe-id",
    name: "Invalid ID",
    owner: true,
    permissions: "0"
  }), undefined);
});

test("Discord onboarding route는 OAuth callback과 자체 session 보안을 분리한다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/discord/oauth/start"), "OAUTH_CALLBACK");
  assert.equal(requiredHttpPrincipal("GET", "/api/discord/oauth/callback"), "OAUTH_CALLBACK");
  assert.equal(requiredHttpPrincipal("GET", "/api/discord/session"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/discord/onboarding/guild"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/discord/oauth/logout"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/discord/unknown"), "DASHBOARD_ADMIN");
});

test("만료된 setup session은 OAuth token 저장 transaction을 fail-closed 처리한다", async () => {
  const repository = new DiscordOnboardingRepository({
    async query() {
      return { rows: [], rowCount: 0 };
    }
  });
  await assert.rejects(
    repository.authenticateOAuthSession({
      oauthSessionId: crypto.randomUUID(),
      setupSessionId: crypto.randomUUID(),
      identityId: crypto.randomUUID(),
      encryptedTokenRecord: crypto.randomBytes(64),
      tokenExpiresAt: new Date(Date.now() + 60_000)
    }),
    (error) => error instanceof SafeDatabaseError
      && error.code === "DATABASE_CONFLICT"
  );
});
