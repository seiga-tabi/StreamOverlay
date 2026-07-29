import fs from "node:fs";
import path from "node:path";

const [outputPath, gitDirectory = ".git"] = process.argv.slice(2);

if (!outputPath) {
  throw new Error("release metadata 출력 경로가 필요합니다.");
}

function readCommitSha(directory) {
  const head = fs.readFileSync(path.join(directory, "HEAD"), "utf8").trim();
  if (/^[a-f0-9]{40}$/iu.test(head)) return head;

  const matched = /^ref:\s+(.+)$/u.exec(head);
  if (!matched) throw new Error("Git HEAD 형식이 올바르지 않습니다.");

  const reference = matched[1];
  const looseReferencePath = path.join(directory, reference);
  if (fs.existsSync(looseReferencePath)) {
    const value = fs.readFileSync(looseReferencePath, "utf8").trim();
    if (/^[a-f0-9]{40}$/iu.test(value)) return value;
  }

  const packedReferencesPath = path.join(directory, "packed-refs");
  if (fs.existsSync(packedReferencesPath)) {
    for (const line of fs.readFileSync(packedReferencesPath, "utf8").split(/\r?\n/u)) {
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const [value, name] = line.split(" ");
      if (name === reference && /^[a-f0-9]{40}$/iu.test(value)) return value;
    }
  }

  throw new Error("현재 Git commit SHA를 확인할 수 없습니다.");
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requestedVersion = process.env.APP_VERSION?.trim();
const requestedGitSha = process.env.GIT_SHA?.trim();
const requestedBuildTime = process.env.BUILD_TIME?.trim();

const version = requestedVersion || packageJson.version;
const gitSha = requestedGitSha || readCommitSha(gitDirectory);
const builtAt = requestedBuildTime || new Date().toISOString();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error("APP_VERSION이 semantic version 형식이 아닙니다.");
}
if (!/^[a-f0-9]{40}$/iu.test(gitSha) || /^0+$/u.test(gitSha)) {
  throw new Error("GIT_SHA가 실제 40자리 commit SHA가 아닙니다.");
}
if (!/^\d{4}-\d{2}-\d{2}T/u.test(builtAt) || !Number.isFinite(Date.parse(builtAt))) {
  throw new Error("BUILD_TIME이 ISO-8601 형식이 아닙니다.");
}

const metadata = Object.freeze({ version, gitSha, builtAt });
fs.writeFileSync(outputPath, `${JSON.stringify(metadata)}\n`, {
  encoding: "utf8",
  mode: 0o444
});
