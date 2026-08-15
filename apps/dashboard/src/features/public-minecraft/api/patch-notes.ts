import { runtimeConfig } from "../../../runtime-config";

/* Codex 수집기 계약 초안(docs/mockups/minecraft-patch-notes.html §05)을 프런트에서 선반영.
 * shared 스키마가 확정되면 이 검증을 shared validator 로 교체합니다.
 * 원문 본문은 계약에 없으며(권리 경계), 요약(title·highlights)은 자체 작성 큐레이션 값입니다. */

export const MINECRAFT_PATCH_EDITIONS = ["java", "bedrock"] as const;
export const MINECRAFT_PATCH_TYPES = ["release", "snapshot", "preview"] as const;

export type MinecraftPatchEdition = (typeof MINECRAFT_PATCH_EDITIONS)[number];
export type MinecraftPatchType = (typeof MINECRAFT_PATCH_TYPES)[number];

export type MinecraftPatchEntry = {
  id: string;
  edition: MinecraftPatchEdition;
  version: string;
  type: MinecraftPatchType;
  publishedAt: string;
  officialUrl: string;
  /** 자체 작성 요약 — 준비 전이면 서버가 필드를 내려주지 않습니다(기계 채움 금지). */
  title?: { ko: string; ja: string };
  highlights?: ReadonlyArray<{ ko: string; ja: string }>;
};

export type MinecraftPatchResponse =
  | { state: "data_unavailable" }
  | {
      state: "ready";
      entries: readonly MinecraftPatchEntry[];
      pagination: { page: number; totalPages: number; hasNextPage: boolean; total: number };
    };

export class MinecraftPatchApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MinecraftPatchApiError";
    this.status = status;
    this.code = code;
  }
}

/* 공식 링크는 Mojang 계열 도메인만 — 수집기 오염이 임의 URL 열기로 이어지지 않게 합니다. */
const OFFICIAL_URL_PATTERN = /^https:\/\/(?:[a-z0-9-]+\.)*(?:minecraft\.net|mojang\.com)(?:\/|$)/u;
const VERSION_PATTERN = /^[0-9][0-9a-zA-Z.\-_]{0,31}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9._\-]{0,127}$/u;

function localizedSummary(value: unknown): { ko: string; ja: string } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || typeof record.ko !== "string" || typeof record.ja !== "string") return undefined;
  if (!record.ko.trim() || !record.ja.trim() || record.ko.length > 300 || record.ja.length > 300) return undefined;
  return { ko: record.ko, ja: record.ja };
}

function parseEntry(value: unknown): MinecraftPatchEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" || !ID_PATTERN.test(record.id)
    || !MINECRAFT_PATCH_EDITIONS.includes(record.edition as MinecraftPatchEdition)
    || typeof record.version !== "string" || !VERSION_PATTERN.test(record.version)
    || !MINECRAFT_PATCH_TYPES.includes(record.type as MinecraftPatchType)
    || typeof record.publishedAt !== "string" || Number.isNaN(Date.parse(record.publishedAt))
    || typeof record.officialUrl !== "string" || !OFFICIAL_URL_PATTERN.test(record.officialUrl)
  ) return null;
  const title = record.title === undefined ? undefined : localizedSummary(record.title);
  if (record.title !== undefined && !title) return null;
  let highlights: MinecraftPatchEntry["highlights"];
  if (record.highlights !== undefined) {
    if (!Array.isArray(record.highlights) || record.highlights.length > 8) return null;
    const parsed = record.highlights.map(localizedSummary);
    if (parsed.some((entry) => !entry)) return null;
    highlights = parsed as Array<{ ko: string; ja: string }>;
  }
  return {
    id: record.id,
    edition: record.edition as MinecraftPatchEdition,
    version: record.version,
    type: record.type as MinecraftPatchType,
    publishedAt: record.publishedAt,
    officialUrl: record.officialUrl,
    ...(title ? { title } : {}),
    ...(highlights ? { highlights } : {}),
  };
}

function parseResponse(value: unknown): MinecraftPatchResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.state === "data_unavailable" && Object.keys(record).length === 1) {
    return { state: "data_unavailable" };
  }
  if (record.state !== "ready" || !Array.isArray(record.entries) || record.entries.length > 100) return null;
  const entries = record.entries.map(parseEntry);
  if (entries.some((entry) => entry === null)) return null;
  const pagination = record.pagination as Record<string, unknown> | undefined;
  if (
    !pagination
    || typeof pagination.page !== "number" || typeof pagination.totalPages !== "number"
    || typeof pagination.hasNextPage !== "boolean" || typeof pagination.total !== "number"
  ) return null;
  return {
    state: "ready",
    entries: entries as MinecraftPatchEntry[],
    pagination: {
      page: pagination.page,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      total: pagination.total,
    },
  };
}

export async function getMinecraftPatchNotes(
  query: { edition: MinecraftPatchEdition; type?: MinecraftPatchType; page?: number },
  signal?: AbortSignal,
): Promise<MinecraftPatchResponse> {
  const params = new URLSearchParams({ edition: query.edition });
  if (query.type) params.set("type", query.type);
  if (query.page !== undefined && query.page > 1) params.set("page", String(query.page));
  let response: Response;
  try {
    response = await fetch(`${runtimeConfig().apiBase}/api/minecraft/patch-notes?${params}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new MinecraftPatchApiError(0, "PATCH_NETWORK_ERROR", "네트워크 요청에 실패했습니다.");
  }
  /* 수집기 미배포(404)는 오류가 아니라 "수집 전" — 정직한 빈 상태로 그립니다. */
  if (response.status === 404) throw new MinecraftPatchApiError(404, "PATCH_NOT_COLLECTED", "수집 전");
  if (!response.ok) throw new MinecraftPatchApiError(response.status, "PATCH_HTTP_ERROR", `HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MinecraftPatchApiError(404, "PATCH_NOT_COLLECTED", "수집 전");
  }
  const parsed = parseResponse(payload);
  if (!parsed) throw new MinecraftPatchApiError(response.status, "PATCH_RESPONSE_INVALID", "응답 형식이 계약과 다릅니다.");
  return parsed;
}
