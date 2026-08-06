import { lstat, readdir, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLEANUP_ALLOWLIST = Object.freeze([
  "apps/agent/dist",
  "apps/dashboard/dist",
  "apps/discord-bot/dist",
  "apps/email-worker/dist",
  "apps/server/dist",
  "packages/shared/dist",
  "playwright-report",
  "qa/visual-regression/results",
  "test-results"
]);

async function pathSize(target) {
  const metadata = await lstat(target);
  if (metadata.isSymbolicLink()) return metadata.size;
  if (!metadata.isDirectory()) return metadata.size;
  let total = 0;
  for (const entry of await readdir(target)) {
    total += await pathSize(path.join(target, entry));
  }
  return total;
}

async function workspaceRootFromArgument(value) {
  const root = path.resolve(value ?? process.cwd());
  const resolved = await realpath(root);
  await stat(path.join(resolved, "package.json"));
  await stat(path.join(resolved, "AGENTS.md"));
  return resolved;
}

export async function cleanupGeneratedArtifacts({
  apply = false,
  workspaceRoot = process.cwd()
} = {}) {
  const root = await workspaceRootFromArgument(workspaceRoot);
  const results = [];
  for (const relativePath of CLEANUP_ALLOWLIST) {
    const target = path.resolve(root, relativePath);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`cleanup_target_outside_workspace:${relativePath}`);
    }
    let metadata;
    try {
      metadata = await lstat(target);
    } catch (error) {
      if (error?.code === "ENOENT") {
        results.push({ path: relativePath, bytes: 0, action: "absent" });
        continue;
      }
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      results.push({ path: relativePath, bytes: metadata.size, action: "skipped_symlink" });
      continue;
    }
    const bytes = await pathSize(target);
    if (apply) await rm(target, { recursive: true, force: false });
    results.push({ path: relativePath, bytes, action: apply ? "deleted" : "would_delete" });
  }
  return Object.freeze({ mode: apply ? "apply" : "dry-run", results });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((arg) => arg !== "--apply" && arg !== "--dry-run");
  if (unknown.length > 0 || (args.has("--apply") && args.has("--dry-run"))) {
    throw new Error("usage: node scripts/cleanup-generated-artifacts.mjs [--dry-run|--apply]");
  }
  const report = await cleanupGeneratedArtifacts({ apply: args.has("--apply") });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`[cleanup] ${error instanceof Error ? error.message : "unexpected"}\n`);
    process.exitCode = 1;
  });
}
