import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_MAX_BYTES = 1_000_000;
const SNAPSHOT_MAX_FILES = 500;

type PersistedPublicLolSnapshot = {
  schemaVersion: 1;
  key: string;
  puuid: string;
  fetchedAt: string;
  payloadSha256: string;
  payload: unknown;
};

export type PublicLolSnapshot = {
  puuid: string;
  fetchedAt: string;
  payload: unknown;
};

export interface PublicLolSnapshotStore {
  load(key: string): Promise<PublicLolSnapshot | undefined>;
  save(input: PublicLolSnapshot & { key: string }): Promise<void>;
}

function safeKey(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized;
}

function fileNameForKey(key: string): string {
  return `${crypto.createHash("sha256").update(key).digest("hex")}.json`;
}

function payloadHash(serializedPayload: string): string {
  return crypto.createHash("sha256").update(serializedPayload).digest("hex");
}

function parsedSnapshot(value: unknown): PersistedPublicLolSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = ["fetchedAt", "key", "payload", "payloadSha256", "puuid", "schemaVersion"].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return undefined;
  if (record.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return undefined;
  if (typeof record.key !== "string" || typeof record.puuid !== "string" || typeof record.fetchedAt !== "string") return undefined;
  if (typeof record.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(record.payloadSha256)) return undefined;
  if (!Number.isFinite(Date.parse(record.fetchedAt))) return undefined;
  const serializedPayload = JSON.stringify(record.payload);
  if (payloadHash(serializedPayload) !== record.payloadSha256) return undefined;
  return record as PersistedPublicLolSnapshot;
}

export class LocalPublicLolSnapshotStore implements PublicLolSnapshotStore {
  constructor(private readonly directory: string) {}

  async load(key: string): Promise<PublicLolSnapshot | undefined> {
    const normalizedKey = safeKey(key);
    if (!normalizedKey) return undefined;
    const filePath = path.join(this.directory, fileNameForKey(normalizedKey));
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > SNAPSHOT_MAX_BYTES) return undefined;
      const parsed = parsedSnapshot(JSON.parse(await fs.readFile(filePath, "utf8")) as unknown);
      if (!parsed || parsed.key !== normalizedKey) return undefined;
      return { puuid: parsed.puuid, fetchedAt: parsed.fetchedAt, payload: parsed.payload };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return undefined;
    }
  }

  async save(input: PublicLolSnapshot & { key: string }): Promise<void> {
    const normalizedKey = safeKey(input.key);
    if (!normalizedKey || !input.puuid.trim() || !Number.isFinite(Date.parse(input.fetchedAt))) return;
    const serializedPayload = JSON.stringify(input.payload);
    const snapshot: PersistedPublicLolSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      key: normalizedKey,
      puuid: input.puuid,
      fetchedAt: input.fetchedAt,
      payloadSha256: payloadHash(serializedPayload),
      payload: input.payload
    };
    const serializedSnapshot = JSON.stringify(snapshot);
    if (Buffer.byteLength(serializedSnapshot, "utf8") > SNAPSHOT_MAX_BYTES) return;

    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const destination = path.join(this.directory, fileNameForKey(normalizedKey));
    const temporary = path.join(this.directory, `.${fileNameForKey(normalizedKey)}.${process.pid}.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, serializedSnapshot, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      await fs.rename(temporary, destination);
    } catch (error) {
      await fs.unlink(temporary).catch(() => undefined);
      throw error;
    }
    await this.prune();
  }

  private async prune(): Promise<void> {
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && /^[a-f0-9]{64}\.json$/u.test(entry.name));
    if (files.length <= SNAPSHOT_MAX_FILES) return;
    const stats = await Promise.all(files.map(async (entry) => ({
      name: entry.name,
      mtimeMs: (await fs.stat(path.join(this.directory, entry.name))).mtimeMs
    })));
    const expired = stats.sort((a, b) => a.mtimeMs - b.mtimeMs).slice(0, stats.length - SNAPSHOT_MAX_FILES);
    await Promise.all(expired.map((entry) => fs.unlink(path.join(this.directory, entry.name)).catch(() => undefined)));
  }
}
