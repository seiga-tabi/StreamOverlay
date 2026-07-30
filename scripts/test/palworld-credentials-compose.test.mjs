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
