import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Palworld key volume은 기존 /run/secrets bind mount와 겹치지 않는다", () => {
  const composeFiles = [
    source("deploy/production/compose.yaml"),
    source("docker-compose.production.yml")
  ];

  for (const compose of composeFiles) {
    assert.doesNotMatch(compose, /palworld_credentials:\/run\/secrets(?:$|:)/mu);
    assert.match(compose, /palworld_credentials:\/run\/palworld-credentials(?:$|:)/mu);
  }

  const configSource = source(
    "apps/server/src/services/palworld-server-status-config.ts"
  );
  assert.match(
    configSource,
    /PALWORLD_SERVER_CREDENTIALS_SECRET_PATH = "\/run\/palworld-credentials\/palworld-server-credentials-encryption-key"/u
  );
});

test("Discord 내부 HMAC key는 수동 복사 없이 UID별 named volume 사본을 사용한다", () => {
  const composeFiles = [
    source("deploy/production/compose.yaml"),
    source("docker-compose.production.yml")
  ];
  for (const compose of composeFiles) {
    assert.match(compose, /discord-internal-auth-init:/u);
    assert.match(
      compose,
      /discord_internal_auth:\/run\/discord-internal-auth(?:$|:)/mu
    );
    assert.doesNotMatch(compose, /discord_internal_auth_key_(?:server|bot)/u);
    assert.doesNotMatch(
      compose,
      /discord_internal_auth_key:\/run\/secrets\/discord_internal_auth_key/u
    );
  }

  assert.match(
    source("apps/server/src/runtime-configuration.ts"),
    /discordInternalAuthKey: "\/run\/discord-internal-auth\/server_key"/u
  );
  assert.match(
    source("apps/discord-bot/src/runtime-files.ts"),
    /"\/run\/discord-internal-auth\/bot_key"/u
  );
});

test("Twitch Extension secret은 운영 server와 config-check에 읽기 전용으로 전달한다", () => {
  const extensionOverride = source("deploy/production/twitch-extension.override.example.yaml");
  const mount = "/etc/yoro/secrets/twitch_extension_secret:/run/secrets/twitch_extension_secret:ro";

  assert.match(extensionOverride, /config-check:/u);
  assert.match(extensionOverride, /server:/u);
  assert.equal(extensionOverride.split(mount).length - 1, 2);
  assert.match(
    source("apps/server/src/runtime-configuration.ts"),
    /twitchExtensionSecret: "\/run\/secrets\/twitch_extension_secret"/u
  );
});

test("Cloudflared는 기본 Palworld REST 배포를 막지 않는 선택 profile이다", () => {
  const standaloneCompose = source("deploy/production/compose.yaml");
  const productionOverlay = source("docker-compose.production.yml");

  for (const compose of [standaloneCompose, productionOverlay]) {
    const cloudflared = compose.slice(compose.indexOf("  cloudflared:"));
    assert.match(cloudflared, /profiles:\n\s+- edge/u);
  }
});
