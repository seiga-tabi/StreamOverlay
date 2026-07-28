import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const publicRoot = path.join(repositoryRoot, "apps/dashboard/public");
const manifestPath = path.join(publicRoot, "images/public-home/manifest.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("공개 홈 Hero manifest는 검증된 원본 식별자와 권리 미확인 상태를 보존한다", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.rightsVerified, false);
  assert.equal(manifest.usageBasis, "operator_reference_use");
  assert.equal(
    manifest.games.lol.sourceSha256,
    "b4232dc123c790947b01935fc326ef3c2aa026ca7c5b67c3a198ea1a9b26cdc1",
  );
  assert.equal(
    manifest.games.palworld.sourceSha256,
    "398f2b4ef1a0e3c35ca40ebc17efb014e20a09d4fa45ba3919136c8ee4825e08",
  );
});

test("공개 홈 Hero 결과는 content hash, 크기, 형식과 원본 이하 해상도를 검증한다", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const game of Object.values(manifest.games)) {
    for (const variant of Object.values(game.variants)) {
      for (const asset of Object.values(variant)) {
        assert.match(asset.url, /^\/images\/public-home\/(?:lol|palworld)\/[a-z]+\.[a-f0-9]{16}\.(?:avif|webp|jpg)$/u);
        assert.ok(!asset.url.startsWith("http"));
        const absolutePath = path.join(publicRoot, asset.url.slice(1));
        const buffer = await readFile(absolutePath);
        const metadata = await sharp(buffer).metadata();
        assert.equal(sha256(buffer), asset.outputSha256);
        assert.equal(metadata.width, asset.width);
        assert.equal(metadata.height, asset.height);
        assert.ok(asset.width <= game.sourceWidth);
        assert.ok(asset.height <= game.sourceHeight);
      }
    }
  }
});
