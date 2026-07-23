import type {
  PalworldBreedingParentsResponse,
  PalworldBreedingResultResponse,
  PalworldBreedingGender,
  PalworldItemDetail,
  PalworldItemSummary,
  PalworldMetaResponse,
  PalworldPaginatedResponse,
  PalworldPalDetail,
  PalworldPalSummary,
  PalworldSearchResult,
  PalworldSkillDetail,
  PalworldSkillSummary,
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
  validatePalworldSkillDetail,
  validatePalworldSkillSummary,
} from "@streamops/shared";
import { runtimeConfig } from "../../../runtime-config";

export const PALWORLD_VERSION_MISMATCH_EVENT = "palworldversionmismatch";
const PALWORLD_REQUEST_TIMEOUT_MS = 10_000;
let observedGameVersion: string | undefined;

export class PalworldApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PalworldApiError";
    this.status = status;
    this.code = code;
  }
}

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

async function readError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    const code = typeof body.error === "string" && /^[A-Z0-9_]{1,128}$/u.test(body.error)
      ? body.error
      : `PALWORLD_HTTP_${response.status}`;
    const message = typeof body.message === "string" && body.message.length <= 512
      ? body.message
      : `Palworld API 요청 실패: ${response.status}`;
    return { code, message };
  } catch {
    // JSON 오류 본문이 아니면 아래의 안정적인 상태 메시지를 사용합니다.
  }
  return {
    code: `PALWORLD_HTTP_${response.status}`,
    message: `Palworld API 요청 실패: ${response.status}`,
  };
}

function observeResponseGameVersion(response: Response, value: unknown): void {
  const headerVersion = response.headers.get("X-Palworld-Data-Version")?.trim();
  const metadata = value && typeof value === "object"
    ? (value as { metadata?: { gameVersion?: unknown } }).metadata
    : undefined;
  const bodyVersion = typeof metadata?.gameVersion === "string" ? metadata.gameVersion : undefined;
  if (headerVersion && bodyVersion && headerVersion !== bodyVersion) {
    window.dispatchEvent(new CustomEvent(PALWORLD_VERSION_MISMATCH_EVENT, {
      detail: { expected: headerVersion, received: bodyVersion },
    }));
  }
  observeGameVersion(value);
}

function requestSignal(externalSignal?: AbortSignal): {
  cleanup: () => void;
  signal: AbortSignal;
  timedOut: () => boolean;
} {
  const controller = new AbortController();
  let timeoutReached = false;
  const handleExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) handleExternalAbort();
  else externalSignal?.addEventListener("abort", handleExternalAbort, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timeoutReached = true;
    controller.abort();
  }, PALWORLD_REQUEST_TIMEOUT_MS);
  return {
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", handleExternalAbort);
    },
    signal: controller.signal,
    timedOut: () => timeoutReached,
  };
}

async function publicGet<T>(
  path: string,
  signal: AbortSignal | undefined,
  validate: PalworldValidator<T>,
  observeActivePalVersion = true,
): Promise<T> {
  const configuredBase = typeof window === "undefined" ? undefined : runtimeConfig().apiBase;
  const apiBase = configuredBase ?? import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";
  const request = requestSignal(signal);
  try {
    let response: Response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: request.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (request.timedOut()) {
        throw new PalworldApiError(504, "PALWORLD_REQUEST_TIMEOUT", "Palworld API 요청 시간이 초과되었습니다.");
      }
      throw new PalworldApiError(0, "PALWORLD_NETWORK_ERROR", "Palworld API에 연결할 수 없습니다.");
    }
    if (!response.ok) {
      const error = await readError(response);
      throw new PalworldApiError(response.status, error.code, error.message);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PalworldApiError(502, "PALWORLD_RESPONSE_INVALID", "Palworld API 응답을 해석할 수 없습니다.");
    }
    const validated = validate(body);
    if (!validated.ok) {
      throw new PalworldApiError(502, "PALWORLD_RESPONSE_INVALID", `Palworld API 응답 검증 실패: ${validated.error}`);
    }
    // active Pal release와 분리된 일부 보조 domain만 명시적으로 버전 관찰을 생략합니다.
    if (observeActivePalVersion) observeResponseGameVersion(response, validated.data);
    return validated.data;
  } finally {
    request.cleanup();
  }
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

export function getPalworldSkills(params: URLSearchParams, signal?: AbortSignal): Promise<PalworldPaginatedResponse<PalworldSkillSummary>> {
  return publicGet(queryPath("/api/palworld/skills", params), signal, (value) => validatePalworldPaginatedResponse(value, validatePalworldSkillSummary), false);
}

export function getPalworldSkill(id: string, signal?: AbortSignal): Promise<PalworldSkillDetail> {
  return publicGet(`/api/palworld/skills/${encodeURIComponent(id)}`, signal, validatePalworldSkillDetail, false);
}

export type PalworldBreedingRequestOptions = {
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
};

export function getPalworldBreeding(
  parentA: string,
  parentB: string,
  options: PalworldBreedingRequestOptions = {},
  signal?: AbortSignal,
): Promise<PalworldBreedingResultResponse> {
  const params = new URLSearchParams({ parentA, parentB });
  if (options.parentAGender) params.set("parentAGender", options.parentAGender);
  if (options.parentBGender) params.set("parentBGender", options.parentBGender);
  return publicGet(queryPath("/api/palworld/breeding", params), signal, validatePalworldBreedingResultResponse);
}

export function getPalworldBreedingParents(child: string, page = 1, pageSize = 12, signal?: AbortSignal): Promise<PalworldBreedingParentsResponse> {
  const params = new URLSearchParams({ child, page: String(page), limit: String(pageSize) });
  return publicGet(queryPath("/api/palworld/breeding/parents", params), signal, validatePalworldBreedingParentsResponse);
}
