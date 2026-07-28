import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export function readArgument(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

export function requireAbsolutePath(value, label) {
  if (!value || !path.isAbsolute(value) || value.includes("\u0000")) {
    throw new Error(`${label}에는 명시적인 절대 경로가 필요합니다.`);
  }
  return path.normalize(value);
}

export async function readDatabaseUrlFile(value) {
  const filePath = requireAbsolutePath(value, "--database-url-file");
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error("Database URL 파일은 symlink가 아닌 0600 이하 일반 파일이어야 합니다.");
  }
  const parsed = new URL((await fs.readFile(filePath, "utf8")).trim());
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Database URL 파일에는 PostgreSQL URL만 허용합니다.");
  }
  if (!parsed.hostname || !parsed.username || !parsed.password || !parsed.pathname.slice(1)) {
    throw new Error("Database URL에 host, user, password, database가 필요합니다.");
  }
  if (parsed.searchParams.has("sslmode")) {
    throw new Error("Database URL의 sslmode 대신 DATABASE_SSL_MODE을 사용해야 합니다.");
  }
  return parsed;
}

export function nodePostgresSsl() {
  return process.env.DATABASE_SSL_MODE === "disable" || !process.env.DATABASE_SSL_MODE
    ? false
    : { rejectUnauthorized: true };
}

export function postgresEnvironment(parsed, databaseName) {
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: databaseName ?? decodeURIComponent(parsed.pathname.slice(1)),
    PGSSLMODE: process.env.DATABASE_SSL_MODE === "verify-full"
      ? "verify-full"
      : process.env.DATABASE_SSL_MODE === "require"
        ? "require"
        : "disable"
  };
}

export async function runProgram(command, args, env, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"]
    });
    if (options.capture) {
      child.stdout.resume();
      child.stderr.resume();
    }
    child.once("error", () => reject(new Error(`${command} 실행에 실패했습니다.`)));
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command}가 안전하게 완료되지 않았습니다.`));
    });
  });
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

export async function readBackupManifest(manifestPathValue) {
  const manifestPath = requireAbsolutePath(manifestPathValue, "--manifest");
  const stat = await fs.lstat(manifestPath);
  if (
    !stat.isFile()
    || stat.isSymbolicLink()
    || stat.size > 1024 * 1024
    || (stat.mode & 0o077) !== 0
  ) {
    throw new Error("Backup manifest가 올바르지 않습니다.");
  }
  const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const keys = new Set([
    "schemaVersion",
    "createdAt",
    "backupFile",
    "backupSha256",
    "sourceIdentitySha256",
    "migrations"
  ]);
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || Object.keys(parsed).some((key) => !keys.has(key))
    || parsed.schemaVersion !== 1
    || typeof parsed.createdAt !== "string"
    || !Number.isFinite(Date.parse(parsed.createdAt))
    || typeof parsed.backupFile !== "string"
    || path.basename(parsed.backupFile) !== parsed.backupFile
    || !/^[a-f0-9]{64}$/u.test(parsed.backupSha256)
    || !/^[a-f0-9]{64}$/u.test(parsed.sourceIdentitySha256)
    || !Array.isArray(parsed.migrations)
    || parsed.migrations.some((migration) => (
      !migration
      || typeof migration !== "object"
      || Array.isArray(migration)
      || Object.keys(migration).some((key) => !["id", "checksumSha256"].includes(key))
      || typeof migration.id !== "string"
      || !/^\d{4}_[a-z0-9_]{1,80}$/u.test(migration.id)
      || typeof migration.checksumSha256 !== "string"
      || !/^[a-f0-9]{64}$/u.test(migration.checksumSha256)
    ))
    || new Set(parsed.migrations.map((migration) => migration.id)).size !== parsed.migrations.length
  ) {
    throw new Error("Backup manifest schema가 올바르지 않습니다.");
  }
  const backupPath = path.resolve(path.dirname(manifestPath), parsed.backupFile);
  if (path.dirname(backupPath) !== path.dirname(manifestPath)) {
    throw new Error("Backup 파일 경로가 manifest 경계를 벗어났습니다.");
  }
  if (await sha256File(backupPath) !== parsed.backupSha256) {
    throw new Error("Backup checksum이 일치하지 않습니다.");
  }
  return { manifestPath, backupPath, manifest: parsed };
}

export function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "";
  if (/checksum/u.test(message)) return "POSTGRES_BACKUP_CHECKSUM_MISMATCH";
  if (/manifest|schema/u.test(message)) return "POSTGRES_BACKUP_MANIFEST_INVALID";
  if (/0600|symlink|절대 경로/u.test(message)) return "POSTGRES_BACKUP_PATH_UNSAFE";
  return "POSTGRES_BACKUP_OPERATION_FAILED";
}
