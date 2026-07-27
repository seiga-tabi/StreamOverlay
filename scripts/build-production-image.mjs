import { spawnSync } from "node:child_process";

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Git release preflight에 실패했습니다.");
  return result.stdout.trim();
}

const status = git("status", "--porcelain");
if (status) throw new Error("dirty worktree에서는 production image를 만들 수 없습니다.");

const gitSha = git("rev-parse", "HEAD");
if (!/^[a-f0-9]{40}$/u.test(gitSha)) throw new Error("release commit SHA를 확인할 수 없습니다.");

const versionIndex = process.argv.indexOf("--version");
const version = versionIndex >= 0 ? process.argv[versionIndex + 1]?.trim() : "";
if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error("--version에 semantic version이 필요합니다.");
}

const imageIndex = process.argv.indexOf("--image");
const image = imageIndex >= 0 ? process.argv[imageIndex + 1]?.trim() : "";
if (!image || image.endsWith(":latest")) throw new Error("--image에 immutable tag가 필요합니다.");

const builtAt = new Date().toISOString();
const result = spawnSync("docker", [
  "build",
  "--target", "runtime",
  "--build-arg", `APP_VERSION=${version}`,
  "--build-arg", `GIT_SHA=${gitSha}`,
  "--build-arg", `BUILD_TIME=${builtAt}`,
  "--label", `org.opencontainers.image.version=${version}`,
  "--label", `org.opencontainers.image.revision=${gitSha}`,
  "--label", `org.opencontainers.image.created=${builtAt}`,
  "-f", "apps/server/Dockerfile",
  "-t", image,
  "."
], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
