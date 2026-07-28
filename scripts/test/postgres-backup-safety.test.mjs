import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  readBackupManifest,
  readDatabaseUrlFile
} from "../postgres-backup-common.mjs";

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "streamops-postgres-backup-"));
  const backupFile = "fixture.dump";
  const backupPath = path.join(directory, backupFile);
  writeFileSync(backupPath, "backup-fixture", { mode: 0o600 });
  const manifestPath = `${backupPath}.manifest.json`;
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    createdAt: "2026-07-28T00:00:00.000Z",
    backupFile,
    backupSha256: crypto.createHash("sha256").update("backup-fixture").digest("hex"),
    sourceIdentitySha256: "a".repeat(64),
    migrations: [{
      id: "0001_database_foundation",
      checksumSha256: "b".repeat(64)
    }]
  })}\n`, { mode: 0o600 });
  return { directory, backupPath, manifestPath };
}

test("Database URL secret 파일은 0600 일반 파일만 허용한다", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "streamops-postgres-secret-"));
  try {
    const valid = path.join(directory, "database_url");
    writeFileSync(valid, "postgresql://app:strong-password@localhost/streamops_test\n", {
      mode: 0o600
    });
    assert.equal((await readDatabaseUrlFile(valid)).hostname, "localhost");

    const open = path.join(directory, "open_url");
    writeFileSync(open, readFileSync(valid), { mode: 0o644 });
    await assert.rejects(readDatabaseUrlFile(open), /0600/u);

    const linked = path.join(directory, "linked_url");
    symlinkSync(valid, linked);
    await assert.rejects(readDatabaseUrlFile(linked), /symlink/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Backup manifest는 exact schema와 archive checksum을 검증한다", async () => {
  const fixture = createFixture();
  try {
    const valid = await readBackupManifest(fixture.manifestPath);
    assert.equal(valid.backupPath, fixture.backupPath);

    writeFileSync(fixture.backupPath, "tampered", { mode: 0o600 });
    await assert.rejects(readBackupManifest(fixture.manifestPath), /checksum/u);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Restore 기본 실행은 verify-only이고 적용 확인 flag를 요구한다", () => {
  const fixture = createFixture();
  try {
    const dryRun = spawnSync(
      process.execPath,
      ["scripts/restore-postgres.mjs", `--manifest=${fixture.manifestPath}`],
      { encoding: "utf8" }
    );
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(JSON.parse(dryRun.stdout).mode, "verify_only");

    const unsafeApply = spawnSync(
      process.execPath,
      [
        "scripts/restore-postgres.mjs",
        "--apply",
        `--manifest=${fixture.manifestPath}`
      ],
      { encoding: "utf8" }
    );
    assert.equal(unsafeApply.status, 1);
    assert.equal(JSON.parse(unsafeApply.stderr).code, "POSTGRES_BACKUP_OPERATION_FAILED");
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});
