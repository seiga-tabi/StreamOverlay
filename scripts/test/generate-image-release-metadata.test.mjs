import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(projectRoot, "scripts", "generate-image-release-metadata.mjs");

function runGenerator(options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "yoro-release-metadata-"));
  const gitDirectory = path.join(directory, ".git");
  const outputPath = path.join(directory, "release.json");
  mkdirSync(path.join(gitDirectory, "refs", "heads"), { recursive: true });
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ version: "1.6.0" }),
    "utf8"
  );
  writeFileSync(path.join(gitDirectory, "HEAD"), options.head ?? "ref: refs/heads/main\n", "utf8");
  if (options.looseReference !== false) {
    writeFileSync(
      path.join(gitDirectory, "refs", "heads", "main"),
      `${options.sha ?? "0123456789abcdef0123456789abcdef01234567"}\n`,
      "utf8"
    );
  }
  if (options.packedReferences) {
    writeFileSync(
      path.join(gitDirectory, "packed-refs"),
      options.packedReferences,
      "utf8"
    );
  }

  const environment = { ...process.env };
  delete environment.APP_VERSION;
  delete environment.GIT_SHA;
  delete environment.BUILD_TIME;
  const result = spawnSync(
    process.execPath,
    [scriptPath, outputPath, gitDirectory],
    {
      cwd: directory,
      env: environment,
      encoding: "utf8"
    }
  );
  return {
    directory,
    outputPath,
    result,
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

test("loose Git ref에서 실제 release metadata를 생성한다", () => {
  const execution = runGenerator();
  try {
    assert.equal(execution.result.status, 0, execution.result.stderr);
    const metadata = JSON.parse(readFileSync(execution.outputPath, "utf8"));
    assert.equal(metadata.version, "1.6.0");
    assert.equal(metadata.gitSha, "0123456789abcdef0123456789abcdef01234567");
    assert.match(metadata.builtAt, /^\d{4}-\d{2}-\d{2}T/u);
    assert.ok(Number.isFinite(Date.parse(metadata.builtAt)));
  } finally {
    execution.cleanup();
  }
});

test("packed ref와 detached HEAD를 지원한다", () => {
  const packed = runGenerator({
    looseReference: false,
    packedReferences: "89abcdef0123456789abcdef0123456789abcdef refs/heads/main\n"
  });
  try {
    assert.equal(packed.result.status, 0, packed.result.stderr);
    assert.equal(
      JSON.parse(readFileSync(packed.outputPath, "utf8")).gitSha,
      "89abcdef0123456789abcdef0123456789abcdef"
    );
  } finally {
    packed.cleanup();
  }

  const detached = runGenerator({
    head: "fedcba9876543210fedcba9876543210fedcba98\n",
    looseReference: false
  });
  try {
    assert.equal(detached.result.status, 0, detached.result.stderr);
    assert.equal(
      JSON.parse(readFileSync(detached.outputPath, "utf8")).gitSha,
      "fedcba9876543210fedcba9876543210fedcba98"
    );
  } finally {
    detached.cleanup();
  }
});

test("유효한 Git commit을 확인할 수 없으면 fail-closed 처리한다", () => {
  const execution = runGenerator({ sha: "invalid" });
  try {
    assert.notEqual(execution.result.status, 0);
    assert.equal(
      (() => {
        try {
          readFileSync(execution.outputPath, "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  } finally {
    execution.cleanup();
  }
});

test("로컬 Compose는 release identity가 없을 때 Git metadata 자동 감지를 사용한다", () => {
  const compose = readFileSync(path.join(projectRoot, "docker-compose.yml"), "utf8");

  assert.doesNotMatch(compose, /GIT_SHA: \$\{GIT_SHA:-0{40}\}/u);
  assert.doesNotMatch(compose, /BUILD_TIME: \$\{BUILD_TIME:-1970-01-01T00:00:00\.000Z\}/u);
  assert.match(compose, /GIT_SHA: \$\{GIT_SHA:-\}/u);
  assert.match(compose, /BUILD_TIME: \$\{BUILD_TIME:-\}/u);
});
