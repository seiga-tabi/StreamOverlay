import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultAramAugmentCatalogPath, loadAramAugmentCatalog } from "../dist/services/aram-augment-catalog.js";

test("커밋된 증강 칼바람 카탈로그는 준비 상태로 안전하게 로드된다", () => {
  const catalog = loadAramAugmentCatalog();
  assert.equal(catalog.mode, "aram_augments");
  assert.equal(catalog.status, "preparing");
  assert.equal(catalog.augments.length, 0);
  assert.match(defaultAramAugmentCatalogPath(), /data\/lol\/aram\/augment-catalog\.json$/u);
});

test("손상되거나 unknown field가 있는 증강 카탈로그는 fail-closed 처리한다", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "streamops-aram-catalog-"));
  try {
    const invalidJsonPath = path.join(directory, "invalid.json");
    writeFileSync(invalidJsonPath, "{ invalid json\n");
    assert.throws(() => loadAramAugmentCatalog(invalidJsonPath));

    const invalidSchemaPath = path.join(directory, "invalid-schema.json");
    writeFileSync(invalidSchemaPath, JSON.stringify({
      schemaVersion: 1,
      mode: "aram_augments",
      status: "preparing",
      dataVersion: "candidate",
      sourceRevision: "not_imported",
      augments: [],
      unexpected: true
    }));
    assert.throws(() => loadAramAugmentCatalog(invalidSchemaPath), /ARAM_AUGMENT_CATALOG_INVALID/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
