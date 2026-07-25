import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PALWORLD_WORK_SUITABILITY_TYPES } from "@streamops/shared";
import {
  assertPalworldWorkImageManifest,
  loadPalworldWorkImageManifest
} from "../dist/data/palworld-work-image-manifest.js";

function sha(index) {
  return index.toString(16).padStart(64, "0");
}

function validManifest() {
  return {
    schemaVersion: 1,
    release: "1.0.1",
    kind: "work",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sourceArchiveSha256: "a".repeat(64),
    mappingSha256: "b".repeat(64),
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries: [...PALWORLD_WORK_SUITABILITY_TYPES]
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((id, index) => {
        const outputSha256 = sha(index + 1);
        return {
          id,
          sourceMember: `Pal/Texture/UI/InGame/T_icon_palwork_${String(index).padStart(2, "0")}.png`,
          sourceSha256: sha(index + 101),
          outputSha256,
          outputFileName: `${outputSha256}.webp`,
          outputWidth: 64,
          outputHeight: 64,
          outputBytes: 1000 + index,
          imageUrl: `/images/palworld/1.0.1/work/${outputSha256}.webp`
        };
      })
  };
}

test("work image manifest는 release·권리 상태·12종 content-hash URL을 exact 검증한다", () => {
  const manifest = validManifest();
  const validated = assertPalworldWorkImageManifest(manifest, "1.0.1");
  assert.equal(validated.entries.length, PALWORLD_WORK_SUITABILITY_TYPES.length);
  assert.equal(validated.status, "operator_acknowledged");
  assert.equal(validated.rightsVerified, false);

  assert.throws(
    () => assertPalworldWorkImageManifest(
      { ...manifest, unknown: true },
      "1.0.1"
    ),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldWorkImageManifest(
      { ...manifest, rightsVerified: true },
      "1.0.1"
    ),
    /rightsVerified=false/u
  );
  assert.throws(
    () => assertPalworldWorkImageManifest(manifest, "2.0.0"),
    /active release/u
  );
  assert.throws(
    () => assertPalworldWorkImageManifest({
      ...manifest,
      entries: manifest.entries.slice(1)
    }, "1.0.1"),
    /12종/u
  );
});

test("work image manifest는 중복 ID·비버전 URL·traversal source를 차단한다", () => {
  const manifest = validManifest();
  assert.throws(
    () => assertPalworldWorkImageManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 1 ? { ...entry, id: manifest.entries[0].id } : entry
      )
    }, "1.0.1"),
    /중복/u
  );
  assert.throws(
    () => assertPalworldWorkImageManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 0
          ? { ...entry, imageUrl: `/images/palworld/work/${entry.outputFileName}` }
          : entry
      )
    }, "1.0.1"),
    /active release/u
  );
  assert.throws(
    () => assertPalworldWorkImageManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 0 ? { ...entry, sourceMember: "../icon.png" } : entry
      )
    }, "1.0.1"),
    /안전한 PNG/u
  );
});

test("work image manifest loader는 canonical regular JSON만 읽는다", async (context) => {
  const root = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-work-images-")
  );
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "work-images-manifest.json"),
    `${JSON.stringify(validManifest(), null, 2)}\n`
  );
  const loaded = await loadPalworldWorkImageManifest(root, "1.0.1");
  assert.equal(loaded.entries.length, 12);
});
