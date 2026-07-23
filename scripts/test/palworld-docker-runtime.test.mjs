import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dockerfilePath = path.join(repositoryRoot, "apps/server/Dockerfile");

test("server runtime image는 검증된 Palworld artifact와 mapping만 포함하고 smoke 검증을 실행한다", async () => {
  const dockerfile = await readFile(dockerfilePath, "utf8");
  assert.doesNotMatch(
    dockerfile,
    /COPY --from=build \/app\/apps\/server\/data\/palworld\/1\.0\.1 \.\/apps\/server\/data\/palworld\/1\.0\.1/u
  );
  for (const releaseFile of [
    "sources.lock.json",
    "paldex.json",
    "manifest.json",
    "images-manifest.json",
    "import-report.json",
    "image-use-policy.json",
    "catalog.json",
    "catalog-manifest.json",
    "item-images-manifest.json",
    "element-images-manifest.json",
    "breeding.json",
    "breeding-manifest.json",
    "breeding-import-report.json"
  ]) {
    assert.equal(
      dockerfile.includes(`/app/apps/server/data/palworld/1.0.1/${releaseFile}`),
      true,
      `${releaseFile} runtime COPY가 필요합니다.`
    );
  }
  for (const localeFile of ["manifest.json", "glossary.json", "ko.json", "ja.json", "reviewed-item-aliases.json"]) {
    assert.equal(
      dockerfile.includes(`/app/apps/server/data/palworld/1.0.1/locales/${localeFile}`),
      true,
      `${localeFile} 번역 runtime COPY가 필요합니다.`
    );
  }
  for (const buildOnlyLocalePath of ["corpus.json", "corpus-report.json", "source-batches", "translation-provenance.json"]) {
    assert.equal(dockerfile.includes(buildOnlyLocalePath), false, `${buildOnlyLocalePath}는 runtime에 복사하면 안 됩니다.`);
  }
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
    "apps/server/data/palworld/1.0.1/catalog.json",
    "apps/server/data/palworld/1.0.1/catalog-manifest.json",
    "apps/server/data/palworld/1.0.1/item-images-manifest.json",
    "apps/server/data/palworld/1.0.1/element-images-manifest.json",
    "apps/server/data/palworld/1.0.1/breeding.json",
    "apps/server/data/palworld/1.0.1/breeding-manifest.json",
    "apps/server/data/palworld/1.0.1/breeding-import-report.json",
    "apps/server/data/palworld/1.0.1/locales/manifest.json",
    "apps/server/data/palworld/1.0.1/locales/glossary.json",
    "apps/server/data/palworld/1.0.1/locales/ko.json",
    "apps/server/data/palworld/1.0.1/locales/ja.json",
    "apps/server/data/palworld/1.0.1/locales/reviewed-item-aliases.json",
    "apps/dashboard/public/images/palworld/1.0.1/items",
    "apps/dashboard/public/images/palworld/1.0.1/elements",
    "apps/server/src/data/palworld-mappings/public-id-map.json",
    "apps/server/src/data/palworld-mappings/elements.json",
    "apps/server/src/data/palworld-mappings/work-suitabilities.json",
    "apps/server/src/data/palworld-mappings/exclusions.json",
    "apps/server/src/data/palworld-mappings/image-overrides.json",
    "apps/server/src/data/palworld-mappings/image-source-map.json"
  ];
  await Promise.all(requiredFiles.map((filePath) => access(path.join(repositoryRoot, filePath))));
});
