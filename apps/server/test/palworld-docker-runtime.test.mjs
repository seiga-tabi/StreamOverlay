import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const {
  assertRepresentativeRuntimeImages,
  preparePalworldRuntimeBundle,
  resolvePalworldRuntimeLayout,
  smokePalworldRuntimeArtifacts
} = await import("../dist/scripts/smoke-palworld-runtime-artifacts.js");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function collectRelativeFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  await visit(root);
  return files.sort();
}

test("Docker runtime은 active manifest로 선별한 bundle만 복사하고 smoke를 실행한다", async () => {
  const dockerfile = await readFile(path.join(repositoryRoot, "apps/server/Dockerfile"), "utf8");
  assert.match(
    dockerfile,
    /--prepare-runtime-bundle \/app\/\.palworld-runtime-bundle/u
  );
  assert.match(
    dockerfile,
    /\/app\/\.palworld-runtime-bundle\/apps\/server\/data\/palworld/u
  );
  assert.match(
    dockerfile,
    /\/app\/\.palworld-runtime-bundle\/apps\/server\/src\/data\/palworld-mappings/u
  );
  assert.match(
    dockerfile,
    /RUN node apps\/server\/dist\/scripts\/smoke-palworld-runtime-artifacts\.js/u
  );
  assert.doesNotMatch(dockerfile, /palworld\/1\.0\.1/u);
  assert.doesNotMatch(dockerfile, /Atlas|pyPal/u);
  assert.doesNotMatch(
    dockerfile,
    /COPY --from=build \/app\/apps\/server\/data\/palworld/u
  );
  for (const forbidden of [
    "runtime-manifest.candidate.json",
    "Content.zip",
    "source-cache",
    "streamoverlay-palworld-paldex",
    "image-source-map.example.json"
  ]) {
    assert.equal(dockerfile.includes(forbidden), false, `${forbidden}는 runtime COPY 대상이면 안 됩니다.`);
  }
});

test("active selector가 가리키는 release만 bundle에 포함하고 raw source를 fail-closed 거부한다", async (context) => {
  const parent = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-docker-runtime-")
  );
  context.after(() => rm(parent, { recursive: true, force: true }));
  const runtimeRoot = path.join(parent, "bundle");
  const sourceLayout = await resolvePalworldRuntimeLayout(repositoryRoot);
  const prepared = await preparePalworldRuntimeBundle({
    repositoryRoot,
    outputRoot: runtimeRoot
  });
  assert.deepEqual(prepared, {
    kind: sourceLayout.kind,
    release: sourceLayout.release
  });

  const dataRoot = path.join(runtimeRoot, "apps/server/data/palworld");
  const files = await collectRelativeFiles(dataRoot);
  assert.equal(files.includes("runtime/active-manifest.json"), true);
  assert.equal(
    files.some((file) =>
      file.includes("_imports/")
      || file.includes("candidate")
      || /\.(?:zip|png|uasset|uexp|ubulk|usmap)$/u.test(file)
    ),
    false
  );

  const sourceImages = path.join(
    repositoryRoot,
    "apps/dashboard/public/images/palworld",
    sourceLayout.release
  );
  const runtimeImages = path.join(
    runtimeRoot,
    "apps/dashboard/dist/images/palworld",
    sourceLayout.release
  );
  await mkdir(path.dirname(runtimeImages), { recursive: true });
  await cp(sourceImages, runtimeImages, { recursive: true });
  await smokePalworldRuntimeArtifacts({ repositoryRoot: runtimeRoot });

  const rawArchive = path.join(
    dataRoot,
    ...sourceLayout.releaseDirectory.split("/"),
    "Content.zip"
  );
  await writeFile(rawArchive, "runtime에 포함되면 안 되는 raw archive");
  await assert.rejects(
    smokePalworldRuntimeArtifacts({ repositoryRoot: runtimeRoot }),
    /manifest allowlist|raw source/u
  );
  await rm(rawArchive);

  await assert.rejects(
    preparePalworldRuntimeBundle({ repositoryRoot, outputRoot: runtimeRoot }),
    /기존 경로를 덮어쓸 수 없습니다/u
  );
});

test("활성 이미지가 있으면 first·middle·last content-hash WebP가 모두 필요하다", async (context) => {
  const imageRoot = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-docker-images-")
  );
  context.after(() => rm(imageRoot, { recursive: true, force: true }));
  const activeImages = ["a", "b", "c"].map((character) => ({
    outputFileName: `${character.repeat(64)}.webp`
  }));
  await Promise.all(
    activeImages.map((entry) =>
      writeFile(path.join(imageRoot, entry.outputFileName), "fixture")
    )
  );
  await assertRepresentativeRuntimeImages({ imageRoot, activeImages });

  const missingMiddle = activeImages.map((entry, index) => ({
    outputFileName: index === 1 ? `${"d".repeat(64)}.webp` : entry.outputFileName
  }));
  await assert.rejects(
    assertRepresentativeRuntimeImages({ imageRoot, activeImages: missingMiddle }),
    /ENOENT/u
  );
});
