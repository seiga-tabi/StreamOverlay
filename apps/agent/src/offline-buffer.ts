import fs from "node:fs";
import path from "node:path";
import {
  parsePalworldAgentStatusPayload,
  type PalworldAgentStatusPayload
} from "@streamops/shared";
import {
  SafeFileError,
  atomicReplaceJson,
  ensureSafeDirectory
} from "./safe-files.js";

type BufferedStatus = Readonly<{
  schemaVersion: 1;
  createdAt: string;
  payload: PalworldAgentStatusPayload;
}>;

const MAX_BUFFER_BYTES = 4_096;
const MAX_BUFFER_AGE_MS = 24 * 60 * 60 * 1_000;

export class OfflineBuffer {
  private loaded = false;
  private current?: BufferedStatus;

  constructor(
    private readonly filePath: string,
    private readonly production: boolean
  ) {}

  load(now = Date.now()): PalworldAgentStatusPayload | undefined {
    ensureSafeDirectory(path.dirname(this.filePath), this.production);
    if (!fs.existsSync(this.filePath)) {
      this.loaded = true;
      this.current = undefined;
      return undefined;
    }
    try {
      const stat = fs.lstatSync(this.filePath);
      if (
        !stat.isFile()
        || stat.isSymbolicLink()
        || stat.size < 2
        || stat.size > MAX_BUFFER_BYTES
        || (stat.mode & 0o077) !== 0
      ) throw new Error("invalid");
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("schema");
      const record = raw as Record<string, unknown>;
      if (
        Object.keys(record).length !== 3
        || record.schemaVersion !== 1
        || typeof record.createdAt !== "string"
      ) throw new Error("schema");
      const createdAt = Date.parse(record.createdAt);
      const payload = parsePalworldAgentStatusPayload(record.payload, {
        now,
        maximumPastMs: MAX_BUFFER_AGE_MS,
        maximumFutureMs: 5 * 60_000
      });
      if (!Number.isFinite(createdAt) || !payload || now - createdAt > MAX_BUFFER_AGE_MS) {
        throw new Error("expired");
      }
      this.current = Object.freeze({
        schemaVersion: 1,
        createdAt: new Date(createdAt).toISOString(),
        payload
      });
      this.loaded = true;
      return payload;
    } catch {
      throw new SafeFileError("offline_buffer_corrupted");
    }
  }

  save(payload: PalworldAgentStatusPayload, now = new Date()): void {
    if (!this.loaded) throw new SafeFileError("offline_buffer_not_loaded");
    const validated = parsePalworldAgentStatusPayload(payload, {
      now: now.getTime(),
      maximumPastMs: MAX_BUFFER_AGE_MS,
      maximumFutureMs: 5 * 60_000
    });
    if (!validated) throw new SafeFileError("offline_buffer_payload_invalid");
    const record: BufferedStatus = Object.freeze({
      schemaVersion: 1,
      createdAt: now.toISOString(),
      payload: validated
    });
    atomicReplaceJson(this.filePath, record);
    this.current = record;
  }

  clear(): void {
    if (!this.loaded) throw new SafeFileError("offline_buffer_not_loaded");
    if (fs.existsSync(this.filePath)) {
      const stat = fs.lstatSync(this.filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new SafeFileError("offline_buffer_corrupted");
      }
      fs.unlinkSync(this.filePath);
    }
    this.current = undefined;
  }
}
