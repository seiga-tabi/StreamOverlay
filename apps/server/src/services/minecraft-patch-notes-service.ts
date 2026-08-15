import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MINECRAFT_PATCH_EDITIONS,
  MINECRAFT_PATCH_TYPES,
  validateMinecraftPatchEntry,
  type MinecraftPatchEdition,
  type MinecraftPatchEntry,
  type MinecraftPatchLocalizedSummary,
  type MinecraftPatchNotesResponse,
  type MinecraftPatchType
} from "@streamops/shared";
import {
  MINECRAFT_JAVA_VERSION_MANIFEST_URL,
  MinecraftPatchNotesSourceError,
  fetchMinecraftJavaPatchEntries
} from "./minecraft-patch-notes-source.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DEFAULT_CURATION_PATH = path.resolve(
  PROJECT_ROOT,
  "apps/server/data/minecraft/patch-note-curation.json"
);
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const FAILURE_BACKOFF_MS = 5 * 60 * 1_000;
const PAGE_SIZE = 20;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_CURATION_BYTES = 256 * 1024;
const MAX_SNAPSHOT_ENTRIES = 2_000;
const VERSION_PATTERN = /^[0-9][0-9a-zA-Z._-]{0,31}$/u;

type MinecraftPatchCurationEntry = Readonly<{
  title?: MinecraftPatchLocalizedSummary;
  highlights?: readonly MinecraftPatchLocalizedSummary[];
}>;

export type MinecraftPatchCuration = Readonly<Record<
  MinecraftPatchEdition,
  Readonly<Record<string, MinecraftPatchCurationEntry>>
>>;

export type MinecraftPatchSnapshot = Readonly<{
  schemaVersion: 1;
  edition: MinecraftPatchEdition;
  fetchedAt: string;
  entries: readonly MinecraftPatchEntry[];
}>;

export interface MinecraftPatchSnapshotStore {
  load(edition: MinecraftPatchEdition): Promise<MinecraftPatchSnapshot | undefined>;
  save(snapshot: MinecraftPatchSnapshot): Promise<void>;
}

type MinecraftPatchNotesLogger = {
  event?(payload: Record<string, unknown>): void;
  error?(payload: Record<string, unknown>): void;
};

export type MinecraftPatchNotesServiceDeps = {
  store?: MinecraftPatchSnapshotStore;
  curation?: MinecraftPatchCuration;
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
  now?: () => number;
  refreshIntervalMs?: number;
  logger?: MinecraftPatchNotesLogger;
};

type EditionState = {
  snapshot?: MinecraftPatchSnapshot;
  refreshedAt?: number;
  lastFailureAt?: number;
  inFlight?: Promise<void>;
};

export class MinecraftPatchNotesQueryError extends Error {
  readonly code = "MINECRAFT_PATCH_NOTES_QUERY_INVALID";

  constructor(readonly publicMessage: string) {
    super(publicMessage);
    this.name = "MinecraftPatchNotesQueryError";
  }
}

export class MinecraftPatchCurationError extends Error {
  readonly code = "MINECRAFT_PATCH_CURATION_INVALID";

  constructor() {
    super("마인크래프트 패치 노트 큐레이션 파일이 올바르지 않습니다.");
    this.name = "MinecraftPatchCurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function canonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateCurationEntry(
  edition: MinecraftPatchEdition,
  version: string,
  value: unknown
): MinecraftPatchCurationEntry | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["title", "highlights"])) return undefined;
  if (value.title === undefined && value.highlights === undefined) return undefined;
  const candidate: MinecraftPatchEntry = {
    id: `${edition}-${version.toLowerCase()}`,
    edition,
    version,
    type: edition === "java" ? "release" : "preview",
    publishedAt: "2000-01-01T00:00:00.000Z",
    officialUrl: "https://www.minecraft.net/en-us/articles",
    ...(value.title === undefined ? {} : { title: value.title as MinecraftPatchLocalizedSummary }),
    ...(value.highlights === undefined
      ? {}
      : { highlights: value.highlights as readonly MinecraftPatchLocalizedSummary[] })
  };
  return validateMinecraftPatchEntry(candidate).ok
    ? value as MinecraftPatchCurationEntry
    : undefined;
}

export function parseMinecraftPatchCuration(value: unknown): MinecraftPatchCuration {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["schemaVersion", "java", "bedrock"])
    || Object.keys(value).length !== 3
    || value.schemaVersion !== 1
  ) throw new MinecraftPatchCurationError();

  const parsed = {} as Record<MinecraftPatchEdition, Record<string, MinecraftPatchCurationEntry>>;
  for (const edition of MINECRAFT_PATCH_EDITIONS) {
    const editionEntries = value[edition];
    if (!isRecord(editionEntries) || Object.keys(editionEntries).length > MAX_SNAPSHOT_ENTRIES) {
      throw new MinecraftPatchCurationError();
    }
    const entries: Record<string, MinecraftPatchCurationEntry> = {};
    for (const [version, candidate] of Object.entries(editionEntries)) {
      if (!VERSION_PATTERN.test(version)) throw new MinecraftPatchCurationError();
      const entry = validateCurationEntry(edition, version, candidate);
      if (!entry) throw new MinecraftPatchCurationError();
      entries[version] = entry;
    }
    parsed[edition] = Object.freeze(entries);
  }
  return Object.freeze(parsed);
}

export function loadMinecraftPatchCuration(filePath = DEFAULT_CURATION_PATH): MinecraftPatchCuration {
  try {
    const stat = fsSync.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_CURATION_BYTES) {
      throw new MinecraftPatchCurationError();
    }
    return parseMinecraftPatchCuration(JSON.parse(fsSync.readFileSync(filePath, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof MinecraftPatchCurationError) throw error;
    throw new MinecraftPatchCurationError();
  }
}

export function mergeMinecraftPatchCuration(
  entries: readonly MinecraftPatchEntry[],
  curation: MinecraftPatchCuration
): MinecraftPatchEntry[] {
  return entries.map((entry) => {
    const overlay = curation[entry.edition][entry.version];
    return overlay ? { ...entry, ...overlay } : entry;
  });
}

function parseSnapshot(value: unknown, edition: MinecraftPatchEdition): MinecraftPatchSnapshot | undefined {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["schemaVersion", "edition", "fetchedAt", "entries"])
    || Object.keys(value).length !== 4
    || value.schemaVersion !== 1
    || value.edition !== edition
    || !canonicalIsoDate(value.fetchedAt)
    || !Array.isArray(value.entries)
    || value.entries.length < 1
    || value.entries.length > MAX_SNAPSHOT_ENTRIES
  ) return undefined;

  const ids = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  for (const [index, candidate] of value.entries.entries()) {
    const entry = validateMinecraftPatchEntry(candidate, `snapshot_entries_${index}`);
    if (!entry.ok || entry.data.edition !== edition || ids.has(entry.data.id)) return undefined;
    const publishedAt = Date.parse(entry.data.publishedAt);
    if (publishedAt > previous) return undefined;
    previous = publishedAt;
    ids.add(entry.data.id);
  }
  return value as MinecraftPatchSnapshot;
}

export class LocalMinecraftPatchSnapshotStore implements MinecraftPatchSnapshotStore {
  constructor(private readonly directory: string) {}

  private filePath(edition: MinecraftPatchEdition): string {
    return path.join(this.directory, `${edition}.json`);
  }

  async load(edition: MinecraftPatchEdition): Promise<MinecraftPatchSnapshot | undefined> {
    try {
      const filePath = this.filePath(edition);
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_SNAPSHOT_BYTES) return undefined;
      return parseSnapshot(JSON.parse(await fs.readFile(filePath, "utf8")) as unknown, edition);
    } catch {
      return undefined;
    }
  }

  async save(snapshot: MinecraftPatchSnapshot): Promise<void> {
    const filePath = this.filePath(snapshot.edition);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(snapshot), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
    await fs.chmod(filePath, 0o600);
  }
}

type MinecraftPatchQuery = {
  edition: MinecraftPatchEdition;
  type?: MinecraftPatchType;
  page: number;
};

export function parseMinecraftPatchNotesQuery(params: URLSearchParams): MinecraftPatchQuery {
  const allowed = new Set(["edition", "type", "page"]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      throw new MinecraftPatchNotesQueryError(`지원하지 않는 query parameter입니다: ${key}`);
    }
    if (params.getAll(key).length !== 1) {
      throw new MinecraftPatchNotesQueryError(`query parameter는 한 번만 지정할 수 있습니다: ${key}`);
    }
  }

  const edition = params.get("edition");
  if (!MINECRAFT_PATCH_EDITIONS.includes(edition as MinecraftPatchEdition)) {
    throw new MinecraftPatchNotesQueryError("edition 값이 허용 목록에 없습니다.");
  }
  const type = params.get("type");
  if (type !== null && !MINECRAFT_PATCH_TYPES.includes(type as MinecraftPatchType)) {
    throw new MinecraftPatchNotesQueryError("type 값이 허용 목록에 없습니다.");
  }
  const rawPage = params.get("page");
  if (rawPage !== null && !/^[1-9]\d{0,4}$/u.test(rawPage)) {
    throw new MinecraftPatchNotesQueryError("page 값은 양의 정수여야 합니다.");
  }
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page > 10_000) {
    throw new MinecraftPatchNotesQueryError("page 값이 허용 범위를 벗어났습니다.");
  }
  return {
    edition: edition as MinecraftPatchEdition,
    ...(type === null ? {} : { type: type as MinecraftPatchType }),
    page
  };
}

const EMPTY_CURATION: MinecraftPatchCuration = Object.freeze({
  java: Object.freeze({}),
  bedrock: Object.freeze({})
});

export class MinecraftPatchNotesService {
  private readonly states = new Map<MinecraftPatchEdition, EditionState>();
  private readonly curation: MinecraftPatchCuration;
  private readonly now: () => number;
  private readonly refreshIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(private readonly deps: MinecraftPatchNotesServiceDeps = {}) {
    this.curation = deps.curation ?? EMPTY_CURATION;
    this.now = deps.now ?? Date.now;
    this.refreshIntervalMs = deps.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
  }

  private stateFor(edition: MinecraftPatchEdition): EditionState {
    const existing = this.states.get(edition);
    if (existing) return existing;
    const created: EditionState = {};
    this.states.set(edition, created);
    return created;
  }

  private async hydrate(edition: MinecraftPatchEdition): Promise<void> {
    const state = this.stateFor(edition);
    if (state.snapshot || !this.deps.store) return;
    const stored = await this.deps.store.load(edition);
    if (stored && !state.snapshot) state.snapshot = stored;
  }

  private async refreshJavaOnce(): Promise<void> {
    const entries = await fetchMinecraftJavaPatchEntries({
      fetchImpl: this.deps.fetchImpl,
      sleepImpl: this.deps.sleepImpl
    });
    const snapshot: MinecraftPatchSnapshot = Object.freeze({
      schemaVersion: 1,
      edition: "java",
      fetchedAt: new Date(this.now()).toISOString(),
      entries: Object.freeze(entries)
    });
    const state = this.stateFor("java");
    state.snapshot = snapshot;
    state.refreshedAt = this.now();
    state.lastFailureAt = undefined;
    try {
      await this.deps.store?.save(snapshot);
    } catch {
      this.deps.logger?.error?.({
        type: "minecraft.patch_notes_snapshot_save_failed",
        edition: "java",
        errorCode: "snapshot_save_failed"
      });
    }
    this.deps.logger?.event?.({
      type: "minecraft.patch_notes_refreshed",
      edition: "java",
      source: MINECRAFT_JAVA_VERSION_MANIFEST_URL,
      entries: entries.length
    });
  }

  private refreshJava(): Promise<void> {
    const state = this.stateFor("java");
    if (state.inFlight) return state.inFlight;
    const running = this.refreshJavaOnce()
      .catch((error: unknown) => {
        state.lastFailureAt = this.now();
        this.deps.logger?.error?.({
          type: "minecraft.patch_notes_refresh_failed",
          edition: "java",
          errorCode: error instanceof MinecraftPatchNotesSourceError
            ? error.code
            : "refresh_failed"
        });
        throw error;
      })
      .finally(() => {
        state.inFlight = undefined;
      });
    state.inFlight = running;
    return running;
  }

  private async ensureJavaCurrent(): Promise<void> {
    await this.hydrate("java");
    const state = this.stateFor("java");
    const fresh = state.refreshedAt !== undefined
      && this.now() - state.refreshedAt < this.refreshIntervalMs;
    if (fresh) return;
    const backingOff = state.lastFailureAt !== undefined
      && this.now() - state.lastFailureAt < FAILURE_BACKOFF_MS;
    if (backingOff) return;
    try {
      await this.refreshJava();
    } catch {
      /* 마지막 정상 snapshot은 유지하고, 없으면 API가 data_unavailable을 반환합니다. */
    }
  }

  hasReadyData(): boolean {
    return Boolean(this.stateFor("java").snapshot?.entries.length);
  }

  async page(params: URLSearchParams): Promise<MinecraftPatchNotesResponse> {
    const query = parseMinecraftPatchNotesQuery(params);
    if (query.edition === "bedrock") return { state: "data_unavailable" };

    await this.ensureJavaCurrent();
    const snapshot = this.stateFor("java").snapshot;
    if (!snapshot) return { state: "data_unavailable" };
    const curated = mergeMinecraftPatchCuration(snapshot.entries, this.curation);
    const filtered = query.type === undefined
      ? curated
      : curated.filter((entry) => entry.type === query.type);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(query.page, totalPages);
    const offset = (page - 1) * PAGE_SIZE;
    return {
      state: "ready",
      entries: filtered.slice(offset, offset + PAGE_SIZE),
      pagination: {
        page,
        totalPages,
        hasNextPage: page < totalPages,
        total: filtered.length
      }
    };
  }

  start(): void {
    if (this.timer) return;
    void this.ensureJavaCurrent();
    this.timer = setInterval(() => {
      void this.ensureJavaCurrent();
    }, this.refreshIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
