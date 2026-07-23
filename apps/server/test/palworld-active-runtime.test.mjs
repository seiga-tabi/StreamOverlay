import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PalworldActiveRuntimeError,
  PalworldPakPublicActivationError,
  PALWORLD_OPERATOR_ACTIVE_REQUIRED_DOMAINS,
  assertPalworldActiveRuntimeManifest,
  deterministicPalworldActiveRuntimeManifestJson,
  finalizePalworldPakRuntimeForPublicActivation,
  loadPalworldActiveRuntime
} from "../dist/data/palworld-active-runtime.js";
import {
  activatePalworldRuntimeManifest,
  promotePalworldPakRuntime,
  rollbackPalworldRuntime
} from "../dist/data/palworld-pak-promotion.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const legacyManifestPath = path.join(
  repositoryRoot,
  "apps/server/data/palworld/1.0.1/manifest.json"
);

test("operator active gate는 promotion과 동일한 전체 공개 domain을 요구한다", () => {
  assert.deepEqual(PALWORLD_OPERATOR_ACTIVE_REQUIRED_DOMAINS, [
    "pals",
    "items",
    "skills",
    "breeding",
    "localizationKo",
    "localizationJa",
    "localizationEn",
    "palImages",
    "itemImages",
    "elementImages",
    "workImages",
    "skillImages",
    "map"
  ]);
});

test("operator PAK public finalizer는 기술 gate와 권리 gate를 분리해 fail-closed 처리한다", () => {
  const manifest = {
    activation: Object.fromEntries(
      PALWORLD_OPERATOR_ACTIVE_REQUIRED_DOMAINS.map((domain) => [domain, "ready"])
    )
  };
  assert.throws(
    () => finalizePalworldPakRuntimeForPublicActivation(manifest),
    (error) =>
      error instanceof PalworldPakPublicActivationError
      && error.code === "PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE"
      && /PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE/u.test(error.message)
  );

  manifest.activation.itemImages = "blocked";
  assert.throws(
    () => finalizePalworldPakRuntimeForPublicActivation(manifest),
    (error) =>
      error instanceof PalworldPakPublicActivationError
      && error.code === "PALWORLD_PAK_RUNTIME_NOT_READY"
      && /itemImages/u.test(error.message)
  );
});

async function fixture() {
  const root = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-active-runtime-")
  );
  const releaseRoot = path.join(root, "1.0.1");
  const runtimeRoot = path.join(root, "runtime");
  await mkdir(releaseRoot, { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });
  const releaseManifest = await readFile(legacyManifestPath);
  await writeFile(path.join(releaseRoot, "manifest.json"), releaseManifest);
  const active = {
    schemaVersion: 1,
    format: "legacy_release_v1",
    release: "1.0.1",
    releaseDirectory: "1.0.1",
    manifestFile: "manifest.json",
    manifestSha256: createHash("sha256").update(releaseManifest).digest("hex")
  };
  const activeManifestPath = path.join(runtimeRoot, "active-manifest.json");
  await writeFile(
    activeManifestPath,
    deterministicPalworldActiveRuntimeManifestJson(active)
  );
  return { root, active, activeManifestPath };
}

test("active manifest exact schema와 결정적 JSON을 검증한다", () => {
  const input = {
    schemaVersion: 1,
    format: "legacy_release_v1",
    release: "1.0.1",
    releaseDirectory: "1.0.1",
    manifestFile: "manifest.json",
    manifestSha256: "a".repeat(64)
  };
  assert.deepEqual(assertPalworldActiveRuntimeManifest(input), input);
  assert.equal(
    deterministicPalworldActiveRuntimeManifestJson(input),
    `${JSON.stringify(input, null, 2)}\n`
  );
  assert.throws(
    () => assertPalworldActiveRuntimeManifest({ ...input, unknown: true }),
    /허용되지 않은 필드/
  );
  assert.throws(
    () => assertPalworldActiveRuntimeManifest({
      ...input,
      releaseDirectory: "runtime/release"
    }),
    /runtime selector와 분리/
  );
});

test("active pointer가 가리키는 기존 검증 release를 checksum과 함께 로드한다", async () => {
  const current = await fixture();
  try {
    const loaded = await loadPalworldActiveRuntime({
      dataRoot: current.root,
      activeManifestPath: current.activeManifestPath
    });
    assert.equal(loaded.manifest.release, "1.0.1");
    assert.equal(loaded.manifest.format, "legacy_release_v1");
    assert.equal(loaded.releaseRoot, path.join(current.root, "1.0.1"));
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("release traversal과 manifest checksum 변조를 fail-closed로 차단한다", async () => {
  const current = await fixture();
  try {
    assert.throws(
      () => assertPalworldActiveRuntimeManifest({
        ...current.active,
        releaseDirectory: "../1.0.1"
      }),
      /안전한 상대 디렉터리/
    );
    await writeFile(
      current.activeManifestPath,
      deterministicPalworldActiveRuntimeManifestJson({
        ...current.active,
        manifestSha256: "0".repeat(64)
      })
    );
    await assert.rejects(
      loadPalworldActiveRuntime({
        dataRoot: current.root,
        activeManifestPath: current.activeManifestPath
      }),
      (error) =>
        error instanceof PalworldActiveRuntimeError
        && /checksum/.test(error.message)
    );
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("검증 실패한 PAK promotion은 기존 active pointer를 변경하지 않는다", async () => {
  const current = await fixture();
  const stagingRoot = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-promotion-invalid-")
  );
  try {
    const before = await readFile(current.activeManifestPath, "utf8");
    await assert.rejects(
      promotePalworldPakRuntime({
        stagingRoot,
        dataRoot: current.root
      })
    );
    assert.equal(await readFile(current.activeManifestPath, "utf8"), before);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
    await rm(current.root, { recursive: true, force: true });
  }
});

test("검증되지 않았거나 누락된 operator release는 저수준 활성화에서도 차단한다", async () => {
  const current = await fixture();
  try {
    const before = await readFile(current.activeManifestPath, "utf8");
    await assert.rejects(
      activatePalworldRuntimeManifest({
        dataRoot: current.root,
        manifest: {
          schemaVersion: 1,
          format: "operator_pak_v1",
          release: "2.0.0",
          releaseDirectory: "releases/operator-pak",
          manifestFile: "runtime-manifest.json",
          manifestSha256: "a".repeat(64)
        }
      }),
      /ENOENT|shadow|staging|runtime manifest/u
    );
    assert.equal(await readFile(current.activeManifestPath, "utf8"), before);
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});

test("검증된 이전 pointer로 원자적 rollback할 수 있다", async () => {
  const current = await fixture();
  try {
    const copiedReleaseRoot = path.join(current.root, "releases/legacy-copy");
    await mkdir(copiedReleaseRoot, { recursive: true });
    await copyFile(
      path.join(current.root, "1.0.1/manifest.json"),
      path.join(copiedReleaseRoot, "manifest.json")
    );
    const alternate = {
      ...current.active,
      releaseDirectory: "releases/legacy-copy"
    };
    await activatePalworldRuntimeManifest({
      dataRoot: current.root,
      manifest: alternate
    });
    assert.equal(
      (await loadPalworldActiveRuntime({ dataRoot: current.root })).manifest
        .releaseDirectory,
      "releases/legacy-copy"
    );
    await rollbackPalworldRuntime({
      dataRoot: current.root,
      target: current.active
    });
    assert.equal(
      (await loadPalworldActiveRuntime({ dataRoot: current.root })).manifest
        .releaseDirectory,
      "1.0.1"
    );
  } finally {
    await rm(current.root, { recursive: true, force: true });
  }
});
