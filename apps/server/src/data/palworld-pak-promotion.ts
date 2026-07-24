import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_ACTIVE_RUNTIME_FILE,
  assertPalworldActiveRuntimeManifest,
  deterministicPalworldActiveRuntimeManifestJson,
  finalizePalworldPakRuntimeForPublicActivation,
  loadPalworldActiveRuntime,
  type PalworldActiveRuntimeManifest
} from "./palworld-active-runtime.js";
import {
  PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
  validatePalworldPakCandidateStagingRoot
} from "./palworld-pak-runtime-manifest.js";
import {
  loadPalworldPakShadowRuntimeFromStagingRoot
} from "./palworld-pak-shadow-runtime.js";

export class PalworldPakPromotionError extends Error {
  readonly code = "PALWORLD_PAK_PROMOTION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakPromotionError";
  }
}

function fail(message: string): never {
  throw new PalworldPakPromotionError(message);
}

async function assertCanonicalDirectory(directory: string, pathName: string): Promise<string> {
  const resolved = path.resolve(directory);
  const info = await lstat(resolved);
  if (
    info.isSymbolicLink()
    || !info.isDirectory()
    || await realpath(resolved) !== resolved
  ) {
    fail(`${pathName}: symlink가 아닌 canonical directory여야 합니다.`);
  }
  return resolved;
}

async function writeAtomicFile(
  targetPath: string,
  bytes: Buffer | string
): Promise<void> {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(
    directory,
    `.active-${process.pid}-${randomBytes(8).toString("hex")}.tmp`
  );
  const handle = await open(
    temporaryPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function validatePointerWithoutActivation(input: {
  dataRoot: string;
  manifest: PalworldActiveRuntimeManifest;
}): Promise<void> {
  const runtimeRoot = path.join(input.dataRoot, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const temporaryPath = path.join(
    runtimeRoot,
    `.validate-${process.pid}-${randomBytes(8).toString("hex")}.json`
  );
  await writeAtomicFile(
    temporaryPath,
    deterministicPalworldActiveRuntimeManifestJson(input.manifest)
  );
  try {
    await loadPalworldActiveRuntime({
      dataRoot: input.dataRoot,
      activeManifestPath: temporaryPath
    });
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function activatePalworldRuntimeManifest(input: {
  dataRoot: string;
  manifest: unknown;
}): Promise<PalworldActiveRuntimeManifest> {
  const dataRoot = await assertCanonicalDirectory(input.dataRoot, "dataRoot");
  const runtimeRoot = path.join(dataRoot, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const lockPath = path.join(runtimeRoot, ".activation.lock");
  let lockHandle: FileHandle;
  try {
    lockHandle = await open(
      lockPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      fail("다른 Palworld release 활성화 작업이 진행 중입니다.");
    }
    throw error;
  }
  try {
    await lockHandle.writeFile(`${process.pid}\n`);
    await lockHandle.sync();
    const manifest = assertPalworldActiveRuntimeManifest(input.manifest);
    if (manifest.format === "operator_pak_v1") {
      const releaseRoot = path.resolve(
        dataRoot,
        ...manifest.releaseDirectory.split("/")
      );
      if (!releaseRoot.startsWith(`${dataRoot}${path.sep}`)) {
        fail("operator PAK release root가 data root 밖으로 벗어났습니다.");
      }
      const shadow = await loadPalworldPakShadowRuntimeFromStagingRoot({
        stagingRoot: releaseRoot
      });
      finalizePalworldPakRuntimeForPublicActivation(shadow.manifest);
    }
    await validatePointerWithoutActivation({ dataRoot, manifest });
    const activePath = path.join(
      runtimeRoot,
      PALWORLD_ACTIVE_RUNTIME_FILE
    );
    await writeAtomicFile(
      activePath,
      deterministicPalworldActiveRuntimeManifestJson(manifest)
    );
    const loaded = await loadPalworldActiveRuntime({
      dataRoot,
      activeManifestPath: activePath
    });
    return loaded.manifest;
  } finally {
    await lockHandle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

export async function promotePalworldPakRuntime(input: {
  stagingRoot: string;
  dataRoot: string;
}): Promise<{
  active: PalworldActiveRuntimeManifest;
  previous?: PalworldActiveRuntimeManifest;
  releaseRoot: string;
}> {
  const stagingRoot = await assertCanonicalDirectory(input.stagingRoot, "stagingRoot");
  const dataRoot = await assertCanonicalDirectory(input.dataRoot, "dataRoot");
  const validated = await validatePalworldPakCandidateStagingRoot({
    stagingRoot
  });
  const shadow = await loadPalworldPakShadowRuntimeFromStagingRoot({
    stagingRoot
  });
  finalizePalworldPakRuntimeForPublicActivation(shadow.manifest);

  const runtimeRoot = path.join(dataRoot, "runtime");
  const releasesRoot = path.join(dataRoot, "releases");
  await mkdir(releasesRoot, { recursive: true });
  await assertCanonicalDirectory(runtimeRoot, "runtimeRoot");
  await assertCanonicalDirectory(releasesRoot, "releasesRoot");

  const releaseDirectoryName = [
    validated.manifest.release,
    validated.manifest.source.archiveSha256.slice(0, 16)
  ].join("-");
  const releaseDirectory = `releases/${releaseDirectoryName}`;
  const finalRoot = path.join(releasesRoot, releaseDirectoryName);
  const temporaryRoot = await mkdtemp(path.join(releasesRoot, ".promote-"));
  let published = false;
  try {
    const files = [
      PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
      ...validated.verifiedArtifacts.map((artifact) => artifact.file)
    ];
    for (const file of files) {
      const source = path.resolve(stagingRoot, ...file.split("/"));
      const destination = path.resolve(temporaryRoot, ...file.split("/"));
      if (
        !source.startsWith(`${stagingRoot}${path.sep}`)
        || !destination.startsWith(`${temporaryRoot}${path.sep}`)
      ) {
        fail("runtime artifact 경로가 staging 또는 publish root 밖으로 벗어났습니다.");
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
    }
    await validatePalworldPakCandidateStagingRoot({
      stagingRoot: temporaryRoot,
      expectedRelease: validated.manifest.release,
      expectedGameVersion: validated.manifest.gameVersion,
      expectedSteamBuildId: validated.manifest.steamBuildId
    });
    try {
      await rename(temporaryRoot, finalRoot);
      published = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await validatePalworldPakCandidateStagingRoot({
        stagingRoot: finalRoot,
        expectedRelease: validated.manifest.release,
        expectedGameVersion: validated.manifest.gameVersion,
        expectedSteamBuildId: validated.manifest.steamBuildId
      });
      if (
        JSON.stringify(existing.manifest)
        !== JSON.stringify(validated.manifest)
      ) {
        fail("동일 release directory에 다른 runtime manifest가 이미 존재합니다.");
      }
    }

    const runtimeManifestBytes = await readFile(
      path.join(finalRoot, PALWORLD_PAK_RUNTIME_MANIFEST_FILE)
    );
    const active = assertPalworldActiveRuntimeManifest({
      schemaVersion: 1,
      format: "operator_pak_v1",
      release: validated.manifest.release,
      releaseDirectory,
      manifestFile: PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
      manifestSha256: createHash("sha256")
        .update(runtimeManifestBytes)
        .digest("hex")
    });
    let previous: PalworldActiveRuntimeManifest | undefined;
    try {
      previous = (
        await loadPalworldActiveRuntime({
          dataRoot,
          activeManifestPath: path.join(
            runtimeRoot,
            PALWORLD_ACTIVE_RUNTIME_FILE
          )
        })
      ).manifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await activatePalworldRuntimeManifest({ dataRoot, manifest: active });
    return {
      active,
      ...(previous === undefined ? {} : { previous }),
      releaseRoot: finalRoot
    };
  } finally {
    if (!published) await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function rollbackPalworldRuntime(input: {
  dataRoot: string;
  target: unknown;
}): Promise<PalworldActiveRuntimeManifest> {
  return activatePalworldRuntimeManifest({
    dataRoot: input.dataRoot,
    manifest: input.target
  });
}
