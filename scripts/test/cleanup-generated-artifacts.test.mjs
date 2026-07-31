import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CLEANUP_ALLOWLIST,
  cleanupGeneratedArtifacts
} from "../cleanup-generated-artifacts.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "yoro-cleanup-"));
  await writeFile(path.join(root, "package.json"), "{}\n");
  await writeFile(path.join(root, "AGENTS.md"), "test\n");
  await mkdir(path.join(root, "apps/server/dist"), { recursive: true });
  await writeFile(path.join(root, "apps/server/dist/output.js"), "generated\n");
  await writeFile(path.join(root, "keep.txt"), "keep\n");
  return root;
}

test("cleanup은 기본 dry-run이며 allowlist 파일을 삭제하지 않는다", async () => {
  const root = await fixture();
  await mkdir(path.join(root, "qa", "visual-regression", "results"), { recursive: true });
  await writeFile(path.join(root, "qa", "visual-regression", "results", "trace.zip"), "trace\n");
  const report = await cleanupGeneratedArtifacts({ workspaceRoot: root });
  assert.equal(report.mode, "dry-run");
  assert.equal(report.results.find((entry) => entry.path === "apps/server/dist")?.action, "would_delete");
  assert.equal(report.results.find((entry) => entry.path === "qa/visual-regression/results")?.action, "would_delete");
  assert.equal(await readFile(path.join(root, "qa", "visual-regression", "results", "trace.zip"), "utf8"), "trace\n");
  assert.equal(await readFile(path.join(root, "apps/server/dist/output.js"), "utf8"), "generated\n");
  assert.equal(await readFile(path.join(root, "keep.txt"), "utf8"), "keep\n");
});

test("cleanup --apply는 exact allowlist만 삭제하고 symlink를 따라가지 않는다", async () => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(tmpdir(), "yoro-cleanup-outside-"));
  await writeFile(path.join(outside, "keep.txt"), "outside\n");
  await mkdir(path.join(root, "apps/dashboard"), { recursive: true });
  await symlink(outside, path.join(root, "apps/dashboard/dist"));
  const report = await cleanupGeneratedArtifacts({ apply: true, workspaceRoot: root });
  assert.equal(report.results.find((entry) => entry.path === "apps/dashboard/dist")?.action, "skipped_symlink");
  assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "outside\n");
  assert.equal(await readFile(path.join(root, "keep.txt"), "utf8"), "keep\n");
  assert.deepEqual(CLEANUP_ALLOWLIST.includes("logs"), false);
});
