import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dockerfilePath = path.join(repositoryRoot, "apps/server/Dockerfile");

test("server runtime image는 검증된 Palworld artifact와 mapping만 포함하고 smoke 검증을 실행한다", async () => {
  const dockerfile = await readFile(dockerfilePath, "utf8");
  assert.match(
    dockerfile,
    /COPY --from=build \/app\/apps\/server\/data\/palworld\/1\.0\.1 \.\/apps\/server\/data\/palworld\/1\.0\.1/u
  );
  for (const mappingFile of [
    "public-id-map.json",
    "elements.json",
    "work-suitabilities.json",
    "exclusions.json",
    "image-overrides.json",
    "image-source-map.json"
  ]) {
    assert.equal(
      dockerfile.includes(`/app/apps/server/src/data/palworld-mappings/${mappingFile}`),
      true,
      `${mappingFile}만 runtime mapping으로 복사해야 합니다.`
    );
  }
  assert.doesNotMatch(
    dockerfile,
    /COPY --from=build \/app\/apps\/server\/src\/data\/palworld-mappings \.\/apps\/server\/src\/data\/palworld-mappings/u
  );
  assert.doesNotMatch(dockerfile, /image-source-map\.example\.json/u);
  assert.match(dockerfile, /RUN node apps\/server\/dist\/scripts\/smoke-palworld-runtime-artifacts\.js/u);
  assert.doesNotMatch(dockerfile, /COPY[^\n]*(?:source-cache|streamoverlay-palworld-paldex)/u);

  const requiredFiles = [
    "apps/server/data/palworld/1.0.1/sources.lock.json",
    "apps/server/data/palworld/1.0.1/paldex.json",
    "apps/server/data/palworld/1.0.1/manifest.json",
    "apps/server/data/palworld/1.0.1/images-manifest.json",
    "apps/server/data/palworld/1.0.1/import-report.json",
    "apps/server/data/palworld/1.0.1/image-use-policy.json",
    "apps/server/src/data/palworld-mappings/public-id-map.json",
    "apps/server/src/data/palworld-mappings/elements.json",
    "apps/server/src/data/palworld-mappings/work-suitabilities.json",
    "apps/server/src/data/palworld-mappings/exclusions.json",
    "apps/server/src/data/palworld-mappings/image-overrides.json",
    "apps/server/src/data/palworld-mappings/image-source-map.json"
  ];
  await Promise.all(requiredFiles.map((filePath) => access(path.join(repositoryRoot, filePath))));
});
