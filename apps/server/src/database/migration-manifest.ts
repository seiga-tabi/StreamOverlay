import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { serverRoot } from "../config.js";
import { SafeDatabaseError } from "./errors.js";

export type MigrationDefinition = Readonly<{
  id: string;
  file: string;
  description: string;
  checksumSha256: string;
  destructive: boolean;
  transaction: true;
  sql: string;
}>;

export type MigrationManifest = Readonly<{
  schemaVersion: 1;
  root: string;
  migrations: readonly MigrationDefinition[];
}>;

const MANIFEST_KEYS = new Set(["schemaVersion", "migrations"]);
const MIGRATION_KEYS = new Set([
  "id",
  "file",
  "description",
  "checksumSha256",
  "destructive",
  "transaction"
]);
const ID_PATTERN = /^\d{4}_[a-z0-9_]{1,80}$/;
const FILE_PATTERN = /^\d{4}_[a-z0-9_]{1,80}\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(record).every((key) => allowed.has(key));
}

function fail(): never {
  throw new SafeDatabaseError("DATABASE_MIGRATION_MISMATCH", false);
}

export async function loadMigrationManifest(
  root = path.resolve(serverRoot, "migrations")
): Promise<MigrationManifest> {
  const resolvedRoot = path.resolve(root);
  const manifestPath = path.resolve(resolvedRoot, "manifest.json");
  if (path.dirname(manifestPath) !== resolvedRoot) fail();
  let parsed: unknown;
  try {
    const [realRoot, manifestStat] = await Promise.all([
      fs.realpath(resolvedRoot),
      fs.lstat(manifestPath)
    ]);
    if (
      realRoot !== resolvedRoot
      || !manifestStat.isFile()
      || manifestStat.isSymbolicLink()
      || manifestStat.size > 1024 * 1024
    ) fail();
    parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    fail();
  }
  if (
    !isRecord(parsed)
    || !exactKeys(parsed, MANIFEST_KEYS)
    || parsed.schemaVersion !== 1
    || !Array.isArray(parsed.migrations)
    || parsed.migrations.length === 0
    || parsed.migrations.length > 1000
  ) fail();

  const seenIds = new Set<string>();
  const seenFiles = new Set<string>();
  const migrations: MigrationDefinition[] = [];
  for (const raw of parsed.migrations) {
    if (
      !isRecord(raw)
      || !exactKeys(raw, MIGRATION_KEYS)
      || typeof raw.id !== "string"
      || !ID_PATTERN.test(raw.id)
      || typeof raw.file !== "string"
      || !FILE_PATTERN.test(raw.file)
      || !raw.file.startsWith(raw.id)
      || typeof raw.description !== "string"
      || raw.description.length < 1
      || raw.description.length > 200
      || typeof raw.checksumSha256 !== "string"
      || !SHA256_PATTERN.test(raw.checksumSha256)
      || typeof raw.destructive !== "boolean"
      || raw.transaction !== true
      || seenIds.has(raw.id)
      || seenFiles.has(raw.file)
    ) fail();
    seenIds.add(raw.id);
    seenFiles.add(raw.file);
    const sqlPath = path.resolve(resolvedRoot, raw.file);
    if (path.dirname(sqlPath) !== resolvedRoot) fail();
    let sql: string;
    try {
      const stat = await fs.lstat(sqlPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) fail();
      sql = await fs.readFile(sqlPath, "utf8");
    } catch {
      fail();
    }
    if (!sql.trim()) fail();
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    if (checksum !== raw.checksumSha256) fail();
    migrations.push(Object.freeze({
      id: raw.id,
      file: raw.file,
      description: raw.description,
      checksumSha256: raw.checksumSha256,
      destructive: raw.destructive,
      transaction: true,
      sql
    }));
  }
  const sorted = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
  if (sorted.some((migration, index) => migration !== migrations[index])) fail();
  return Object.freeze({
    schemaVersion: 1,
    root: resolvedRoot,
    migrations: Object.freeze(migrations)
  });
}
