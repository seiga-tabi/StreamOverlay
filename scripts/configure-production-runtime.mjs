import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const weakSecretPatterns = [
  "changeme",
  "change-me",
  "change_me",
  "replace",
  "default",
  "secret",
  "password",
  "streamops",
  "dev-secret",
  "test-secret"
];
const baseSecretNames = ["DASHBOARD_AUTH_TOKEN", "OVERLAY_ACCESS_TOKEN", "BRIDGE_SHARED_SECRET"];
const sanitizedRuntimePrefixes = [
  "ALLOW_",
  "CORS_",
  "DASHBOARD_",
  "LEGAL_",
  "NODE_ENV",
  "OVERLAY_",
  "PUBLIC_BASE_URL",
  "STREAMOPS_LOCAL_NO_AUTH",
  "SUPPORT_MAILBOX_",
  "TRUST_PROXY",
  "TWITCH_PUBLIC_REDIRECT_URI",
  "TWITCH_REDIRECT_URI"
];

function usage() {
  console.log(`사용법:
  npm run configure:production -- --domain yoro.gg [--env-file .env] [--write]

기본 동작은 dry-run입니다. --write는 전체 production 검증이 통과할 때만 파일을 교체합니다.
법적 운영정보와 외부 서비스 자격 증명은 운영자가 먼저 입력해야 합니다.`);
}

function parseArguments(argv) {
  const options = {
    domain: "yoro.gg",
    envFile: path.resolve(projectRoot, ".env"),
    write: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") {
      options.write = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    }
    const [name, inlineValue] = argument.split("=", 2);
    if (name !== "--domain" && name !== "--env-file") {
      throw new Error(`알 수 없는 인자입니다: ${argument}`);
    }
    const value = inlineValue ?? argv[++index];
    if (!value) throw new Error(`${name} 값이 필요합니다.`);
    if (name === "--domain") options.domain = value;
    else options.envFile = path.resolve(projectRoot, value);
  }
  return options;
}

function normalizeDomain(input) {
  const value = input.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    throw new Error("--domain에는 localhost나 경로가 아닌 실제 공개 도메인을 입력해야 합니다.");
  }
  return value;
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (value.length >= 2 && value[0] === "\"" && value.at(-1) === "\"") {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value[0] === "'" && value.at(-1) === "'") {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

function envMapFromText(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) values.set(match[1], parseEnvValue(match[2]));
  }
  return values;
}

function setEnvValue(text, name, value) {
  const serialized = `${name}=${JSON.stringify(value)}`;
  const lines = text ? text.split(/\r?\n/) : [];
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index >= 0) lines[index] = serialized;
  else lines.push(serialized);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function isStrongSecret(value) {
  if (!value || value.length < 32) return false;
  const normalized = value.toLowerCase();
  return !weakSecretPatterns.some((pattern) => normalized.includes(pattern));
}

function generateStrongSecret(existingValues) {
  for (;;) {
    const value = randomBytes(32).toString("base64url");
    if (isStrongSecret(value) && !existingValues.has(value)) return value;
  }
}

function validMailboxEncryptionKey(value) {
  if (/^[a-f0-9]{64}$/i.test(value)) return true;
  try {
    return Buffer.from(value, "base64").byteLength === 32;
  } catch {
    return false;
  }
}

function sanitizedChildEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (sanitizedRuntimePrefixes.some((prefix) => name === prefix || name.startsWith(prefix))) {
      delete environment[name];
    }
  }
  return environment;
}

function validateCandidate(candidatePath) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "apps/server/src/scripts/validate-runtime-config.ts"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...sanitizedChildEnvironment(),
        DOTENV_CONFIG_PATH: candidatePath
      }
    }
  );
  return {
    ok: result.status === 0,
    output: [result.stdout, result.stderr].filter(Boolean).join("").trim()
  };
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const domain = normalizeDomain(options.domain);
  const publicBaseUrl = `https://${domain}`;
  const originalText = await readOptionalFile(options.envFile);
  let candidateText = originalText;

  const fixedValues = new Map([
    ["NODE_ENV", "production"],
    ["STREAMOPS_LOCAL_NO_AUTH", "false"],
    ["ALLOW_INSECURE_DEV", "false"],
    ["ALLOW_LEGACY_WS_QUERY_AUTH", "false"],
    ["TRUST_PROXY", "true"],
    ["PUBLIC_BASE_URL", publicBaseUrl],
    ["DASHBOARD_BASE_URL", `${publicBaseUrl}/dashboard`],
    ["OVERLAY_BASE_URL", `${publicBaseUrl}/overlay`],
    ["TWITCH_REDIRECT_URI", `${publicBaseUrl}/api/twitch/auth/callback`],
    ["TWITCH_PUBLIC_REDIRECT_URI", `${publicBaseUrl}/api/public/twitch/auth/callback`],
    ["CORS_ORIGINS", publicBaseUrl]
  ]);
  for (const [name, value] of fixedValues) candidateText = setEnvValue(candidateText, name, value);

  let values = envMapFromText(candidateText);
  const generatedNames = [];
  const secretNames = [...baseSecretNames];
  if (values.get("SUPPORT_MAILBOX_ENABLED")?.toLowerCase() === "true") {
    secretNames.push("SUPPORT_MAILBOX_WEBHOOK_SECRET");
  }

  const usedSecrets = new Set();
  for (const name of secretNames) {
    const fileValue = values.get(`${name}_FILE`);
    if (fileValue) continue;
    const currentValue = values.get(name) ?? "";
    if (!isStrongSecret(currentValue) || usedSecrets.has(currentValue)) {
      const generatedValue = generateStrongSecret(usedSecrets);
      candidateText = setEnvValue(candidateText, name, generatedValue);
      usedSecrets.add(generatedValue);
      generatedNames.push(name);
    } else {
      usedSecrets.add(currentValue);
    }
  }

  values = envMapFromText(candidateText);
  if (values.get("SUPPORT_MAILBOX_ENABLED")?.toLowerCase() === "true") {
    const encryptionFile = values.get("SUPPORT_MAILBOX_ENCRYPTION_KEY_FILE");
    const encryptionKey = values.get("SUPPORT_MAILBOX_ENCRYPTION_KEY") ?? "";
    if (!encryptionFile && !validMailboxEncryptionKey(encryptionKey)) {
      candidateText = setEnvValue(
        candidateText,
        "SUPPORT_MAILBOX_ENCRYPTION_KEY",
        randomBytes(32).toString("base64")
      );
      generatedNames.push("SUPPORT_MAILBOX_ENCRYPTION_KEY");
    }
  }

  await mkdir(path.dirname(options.envFile), { recursive: true });
  const candidatePath = path.join(
    path.dirname(options.envFile),
    `.${path.basename(options.envFile)}.${process.pid}.candidate`
  );
  await writeFile(candidatePath, candidateText, { encoding: "utf8", mode: 0o600 });
  await chmod(candidatePath, 0o600);

  try {
    console.log(`[runtime] 공개 도메인: ${domain}`);
    console.log(`[runtime] 보정 대상 secret: ${generatedNames.length ? generatedNames.join(", ") : "없음"}`);
    const validation = validateCandidate(candidatePath);
    if (!validation.ok) {
      console.error("[runtime] 전체 production 검증이 통과하지 않아 원본 파일을 변경하지 않았습니다.");
      if (validation.output) console.error(validation.output);
      process.exitCode = 1;
      return;
    }

    if (!options.write) {
      console.log("[runtime] dry-run PASS: --write를 지정하면 검증된 설정을 원자적으로 반영합니다.");
      return;
    }

    await rename(candidatePath, options.envFile);
    await chmod(options.envFile, 0o600);
    console.log(`[runtime] production 설정 반영 PASS: ${path.relative(projectRoot, options.envFile) || ".env"}`);
  } finally {
    await rm(candidatePath, { force: true });
  }
}

main().catch((error) => {
  console.error(`[runtime] 설정 준비 실패: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
