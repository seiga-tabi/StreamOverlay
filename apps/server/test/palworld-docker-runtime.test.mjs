import assert from "node:assert/strict";
import { cp, copyFile, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const {
  assertRepresentativeRuntimeImages,
  smokePalworldRuntimeArtifacts
} = await import("../dist/scripts/smoke-palworld-runtime-artifacts.js");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const releaseFiles = [
  "sources.lock.json",
  "paldex.json",
  "manifest.json",
  "images-manifest.json",
  "import-report.json",
  "image-use-policy.json",
  "catalog.json",
  "catalog-manifest.json",
  "item-images-manifest.json",
  "element-images-manifest.json"
];
const mappingFiles = [
  "public-id-map.json",
  "elements.json",
  "work-suitabilities.json",
  "exclusions.json",
  "image-overrides.json",
  "image-source-map.json"
];

test("Docker runtime은 검증 release·mapping·dashboard dist와 smoke를 포함한다", async () => {
  const dockerfile = await readFile(path.join(repositoryRoot, "apps/server/Dockerfile"), "utf8");
  for (const requiredPath of [
    "/app/apps/server/data/palworld/1.0.1",
    "public-id-map.json",
    "elements.json",
    "work-suitabilities.json",
    "exclusions.json",
    "image-overrides.json",
    "image-source-map.json",
    "/app/apps/dashboard/dist"
  ]) {
    assert.equal(dockerfile.includes(requiredPath), true, `${requiredPath} COPY가 필요합니다.`);
  }
  assert.match(dockerfile, /RUN node apps\/server\/dist\/scripts\/smoke-palworld-runtime-artifacts\.js/u);
  assert.equal(dockerfile.includes("image-source-map.example.json"), false);
  assert.equal(dockerfile.includes("streamoverlay-palworld-paldex"), false);
  assert.equal(dockerfile.includes("palworld-assets"), false);
});

test("container 형태에서 release JSON·mapping·운영 dist 이미지를 검증한다", async () => {
  const runtimeRoot = await mkdtemp(path.join(await realpath(tmpdir()), "palworld-docker-runtime-"));
  const releaseTarget = path.join(runtimeRoot, "apps/server/data/palworld/1.0.1");
  const mappingTarget = path.join(runtimeRoot, "apps/server/src/data/palworld-mappings");
  const imageTarget = path.join(runtimeRoot, "apps/dashboard/dist/images/palworld/1.0.1/pals");
  const itemImageTarget = path.join(runtimeRoot, "apps/dashboard/dist/images/palworld/1.0.1/items");
  const elementImageTarget = path.join(runtimeRoot, "apps/dashboard/dist/images/palworld/1.0.1/elements");
  await mkdir(releaseTarget, { recursive: true });
  await mkdir(mappingTarget, { recursive: true });
  await Promise.all(releaseFiles.map((fileName) => copyFile(
    path.join(repositoryRoot, "apps/server/data/palworld/1.0.1", fileName),
    path.join(releaseTarget, fileName)
  )));
  await Promise.all(mappingFiles.map((fileName) => copyFile(
    path.join(repositoryRoot, "apps/server/src/data/palworld-mappings", fileName),
    path.join(mappingTarget, fileName)
  )));
  try {
    await Promise.all([
      cp(path.join(repositoryRoot, "apps/dashboard/public/images/palworld/1.0.1/pals"), imageTarget, { recursive: true }),
      cp(path.join(repositoryRoot, "apps/dashboard/public/images/palworld/1.0.1/items"), itemImageTarget, { recursive: true }),
      cp(path.join(repositoryRoot, "apps/dashboard/public/images/palworld/1.0.1/elements"), elementImageTarget, { recursive: true })
    ]);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await smokePalworldRuntimeArtifacts({ repositoryRoot: runtimeRoot });

  await mkdir(itemImageTarget, { recursive: true });
  await writeFile(path.join(itemImageTarget, "operator-source.png"), "runtime에 포함되면 안 되는 source 원본");
  await assert.rejects(
    smokePalworldRuntimeArtifacts({ repositoryRoot: runtimeRoot }),
    /manifest에 없는 파일|허용되지 않은 형식/u
  );
});

test("활성 이미지가 있으면 first·middle·last content-hash WebP가 모두 필요하다", async () => {
  const imageRoot = await mkdtemp(path.join(await realpath(tmpdir()), "palworld-docker-images-"));
  const activeImages = ["a", "b", "c"].map((character) => ({
    outputFileName: `${character.repeat(64)}.webp`
  }));
  await Promise.all(activeImages.map((entry) => writeFile(path.join(imageRoot, entry.outputFileName), "fixture")));
  await assertRepresentativeRuntimeImages({ imageRoot, activeImages });

  const missingMiddle = activeImages.map((entry, index) => ({
    outputFileName: index === 1 ? `${"d".repeat(64)}.webp` : entry.outputFileName
  }));
  await assert.rejects(
    assertRepresentativeRuntimeImages({ imageRoot, activeImages: missingMiddle }),
    /ENOENT/u
  );
});
