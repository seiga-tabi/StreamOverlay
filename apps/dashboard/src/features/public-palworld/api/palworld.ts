import type {
  PalworldBreedingParentsResponse,
  PalworldBreedingResultResponse,
  PalworldItemDetail,
  PalworldItemSummary,
  PalworldMetaResponse,
  PalworldPaginatedResponse,
  PalworldPalDetail,
  PalworldPalSummary,
  PalworldSearchResult,
  PalworldValidator,
} from "@streamops/shared";
import {
  validatePalworldBreedingParentsResponse,
  validatePalworldBreedingResultResponse,
  validatePalworldItemDetail,
  validatePalworldItemSummary,
  validatePalworldMetaResponse,
  validatePalworldPaginatedResponse,
  validatePalworldPalDetail,
  validatePalworldPalSummary,
  validatePalworldSearchResult,
} from "@streamops/shared";
import { runtimeConfig } from "../../../runtime-config";

export const PALWORLD_VERSION_MISMATCH_EVENT = "palworldversionmismatch";
let observedGameVersion: string | undefined;

function observeGameVersion(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return;
  const version = (metadata as { gameVersion?: unknown }).gameVersion;
  if (typeof version !== "string" || !version) return;
  if (observedGameVersion && observedGameVersion !== version) {
    window.dispatchEvent(new CustomEvent(PALWORLD_VERSION_MISMATCH_EVENT, { detail: { expected: observedGameVersion, received: version } }));
    return;
  }
  observedGameVersion = version;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
  } catch {
    // JSON 오류 본문이 아니면 아래의 안정적인 상태 메시지를 사용합니다.
  }
  return `Palworld API 요청 실패: ${response.status}`;
}

async function publicGet<T>(
  path: string,
  signal: AbortSignal | undefined,
  validate: PalworldValidator<T>,
  observeActivePalVersion = true,
): Promise<T> {
  const configuredBase = typeof window === "undefined" ? undefined : runtimeConfig().apiBase;
  const apiBase = configuredBase ?? import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  const body: unknown = await response.json();
  const validated = validate(body);
  if (!validated.ok) throw new Error(`Palworld API 응답 검증 실패: ${validated.error}`);
  // 아이템·교배는 Pal 도감과 별도의 샘플 출처를 유지하므로 의도적인 버전 차이를 오류로 취급하지 않습니다.
  if (observeActivePalVersion) observeGameVersion(validated.data);
  return validated.data;
}

function queryPath(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function getPalworldMeta(signal?: AbortSignal): Promise<PalworldMetaResponse> {
  return publicGet("/api/palworld/meta", signal, validatePalworldMetaResponse);
}

export function searchPalworld(query: string, signal?: AbortSignal): Promise<PalworldSearchResult> {
  const normalized = query.trim();
  if (!normalized) return Promise.reject(new Error("검색어를 입력해 주세요."));
  const params = new URLSearchParams({ q: normalized });
  return publicGet(queryPath("/api/palworld/search", params), signal, validatePalworldSearchResult);
}

export function getPalworldPals(params: URLSearchParams, signal?: AbortSignal): Promise<PalworldPaginatedResponse<PalworldPalSummary>> {
  return publicGet(queryPath("/api/palworld/pals", params), signal, (value) => validatePalworldPaginatedResponse(value, validatePalworldPalSummary));
}

export function getPalworldPal(id: string, signal?: AbortSignal): Promise<PalworldPalDetail> {
  return publicGet(`/api/palworld/pals/${encodeURIComponent(id)}`, signal, validatePalworldPalDetail);
}

export function getPalworldItems(params: URLSearchParams, signal?: AbortSignal): Promise<PalworldPaginatedResponse<PalworldItemSummary>> {
  return publicGet(queryPath("/api/palworld/items", params), signal, (value) => validatePalworldPaginatedResponse(value, validatePalworldItemSummary), false);
}

export function getPalworldItem(id: string, signal?: AbortSignal): Promise<PalworldItemDetail> {
  return publicGet(`/api/palworld/items/${encodeURIComponent(id)}`, signal, validatePalworldItemDetail, false);
}

export function getPalworldBreeding(parentA: string, parentB: string, signal?: AbortSignal): Promise<PalworldBreedingResultResponse> {
  const params = new URLSearchParams({ parentA, parentB });
  return publicGet(queryPath("/api/palworld/breeding", params), signal, validatePalworldBreedingResultResponse, false);
}

export function getPalworldBreedingParents(child: string, page = 1, pageSize = 12, signal?: AbortSignal): Promise<PalworldBreedingParentsResponse> {
  const params = new URLSearchParams({ child, page: String(page), limit: String(pageSize) });
  return publicGet(queryPath("/api/palworld/breeding/parents", params), signal, validatePalworldBreedingParentsResponse, false);
}
