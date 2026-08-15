import {
  validateMinecraftPatchEntry,
  type MinecraftPatchEntry
} from "@streamops/shared";

/** 외부 입력으로 바꾸지 않는 Mojang 공식 Java 배포 manifest입니다. */
export const MINECRAFT_JAVA_VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/** manifest에 개별 패치 노트 URL이 없으므로 검증 가능한 공식 기사 허브를 사용합니다. */
export const MINECRAFT_JAVA_PATCH_NOTES_HUB_URL =
  "https://www.minecraft.net/en-us/articles";

export const MINECRAFT_PATCH_SOURCE_USER_AGENT =
  "YOROggMinecraftPatchNotes/1.0 (+https://yoro.gg)";
const SOURCE_TIMEOUT_MS = 10_000;
const SOURCE_MAX_ATTEMPTS = 3;
const SOURCE_RETRY_DELAY_MS = 250;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_MANIFEST_ENTRIES = 5_000;
const VERSION_PATTERN = /^[0-9][0-9a-zA-Z._-]{0,31}$/u;
const SHA1_PATTERN = /^[a-f0-9]{40}$/u;

export class MinecraftPatchNotesSourceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MinecraftPatchNotesSourceError";
  }
}

type FetchMinecraftPatchNotesDeps = {
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function isOfficialPistonMetadataUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "piston-meta.mojang.com"
      && url.username === ""
      && url.password === ""
      && url.port === "";
  } catch {
    return false;
  }
}

/**
 * Java manifest의 release/snapshot만 공개 계약으로 변환합니다.
 * old_alpha/old_beta와 현재 계약으로 표현할 수 없는 역사적 ID는 추정 변환하지 않습니다.
 */
export function minecraftJavaPatchEntriesFromManifest(value: unknown): MinecraftPatchEntry[] {
  if (!isRecord(value) || !Array.isArray(value.versions)) {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_INVALID");
  }
  if (value.versions.length < 1 || value.versions.length > MAX_MANIFEST_ENTRIES) {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_SIZE_INVALID");
  }

  const entries: MinecraftPatchEntry[] = [];
  const ids = new Set<string>();
  for (const candidate of value.versions) {
    if (!isRecord(candidate) || typeof candidate.type !== "string") {
      throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID");
    }
    if (candidate.type !== "release" && candidate.type !== "snapshot") continue;
    if (typeof candidate.id !== "string") {
      throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID");
    }
    /* 역사적 pre-release ID 중 공백이 있는 값은 API version 계약에 맞게 조작하지 않고 제외합니다. */
    if (!VERSION_PATTERN.test(candidate.id)) continue;

    const publishedAt = canonicalIsoDate(candidate.releaseTime);
    const observedAt = canonicalIsoDate(candidate.time);
    if (
      !publishedAt
      || !observedAt
      || !isOfficialPistonMetadataUrl(candidate.url)
      || typeof candidate.sha1 !== "string"
      || !SHA1_PATTERN.test(candidate.sha1)
      || !Number.isSafeInteger(candidate.complianceLevel)
      || (candidate.complianceLevel !== 0 && candidate.complianceLevel !== 1)
    ) throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID");

    const entry: MinecraftPatchEntry = {
      id: `java-${candidate.id.toLowerCase()}`,
      edition: "java",
      version: candidate.id,
      type: candidate.type,
      publishedAt,
      officialUrl: MINECRAFT_JAVA_PATCH_NOTES_HUB_URL
    };
    const validation = validateMinecraftPatchEntry(entry);
    if (!validation.ok || ids.has(entry.id)) {
      throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_ENTRY_INVALID");
    }
    ids.add(entry.id);
    entries.push(entry);
  }

  if (entries.length === 0) {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_EMPTY");
  }
  entries.sort((left, right) => (
    Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
    || left.id.localeCompare(right.id)
  ));
  return entries;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_MANIFEST_BYTES) {
      throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_TOO_LARGE");
    }
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_CONTENT_TYPE_INVALID");
  }
  if (!response.body) {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_EMPTY");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MANIFEST_BYTES) {
        throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_TOO_LARGE");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
    await response.body.cancel().catch(() => undefined);
  }
  chunks.push(decoder.decode());
  try {
    return JSON.parse(chunks.join("")) as unknown;
  } catch {
    throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_JSON_INVALID");
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchMinecraftJavaPatchEntries(
  deps: FetchMinecraftPatchNotesDeps = {}
): Promise<MinecraftPatchEntry[]> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleepImpl = deps.sleepImpl ?? defaultSleep;
  const timeoutMs = Math.min(Math.max(1, deps.timeoutMs ?? SOURCE_TIMEOUT_MS), SOURCE_TIMEOUT_MS);
  const maxAttempts = Math.min(Math.max(1, deps.maxAttempts ?? SOURCE_MAX_ATTEMPTS), SOURCE_MAX_ATTEMPTS);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(MINECRAFT_JAVA_VERSION_MANIFEST_URL, {
        method: "GET",
        redirect: "error",
        headers: {
          accept: "application/json",
          "user-agent": MINECRAFT_PATCH_SOURCE_USER_AGENT
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= maxAttempts) break;
      await sleepImpl(SOURCE_RETRY_DELAY_MS * (2 ** attempt));
      continue;
    }

    if (!response.ok) {
      lastError = new MinecraftPatchNotesSourceError(`MINECRAFT_JAVA_MANIFEST_STATUS_${response.status}`);
      await response.body?.cancel().catch(() => undefined);
      if (!retryableStatus(response.status) || attempt + 1 >= maxAttempts) throw lastError;
      await sleepImpl(SOURCE_RETRY_DELAY_MS * (2 ** attempt));
      continue;
    }

    return minecraftJavaPatchEntriesFromManifest(await readBoundedJson(response));
  }

  if (lastError instanceof MinecraftPatchNotesSourceError) throw lastError;
  throw new MinecraftPatchNotesSourceError("MINECRAFT_JAVA_MANIFEST_REQUEST_FAILED");
}
