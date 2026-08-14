import type {
  MinecraftCatalogResponse,
  MinecraftEnchant,
  MinecraftItem,
  MinecraftRecipe,
  MinecraftRecipeType,
  MinecraftValidationResult,
} from "@streamops/shared";
import {
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
  validateMinecraftRecipeCatalogResponse,
} from "@streamops/shared";
import { runtimeConfig } from "../../../runtime-config";

const MINECRAFT_REQUEST_TIMEOUT_MS = 10_000;
export const MINECRAFT_SEARCH_MAX_LENGTH = 80;

export class MinecraftApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MinecraftApiError";
    this.status = status;
    this.code = code;
  }
}

export type MinecraftCatalogQuery = {
  q?: string;
  page?: number;
  limit?: number;
};

function queryString(query: MinecraftCatalogQuery, type?: MinecraftRecipeType | "all"): string {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (type && type !== "all") params.set("type", type);
  if (query.page !== undefined && query.page > 1) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function catalogGet<T>(
  path: string,
  validate: (value: unknown) => MinecraftValidationResult<MinecraftCatalogResponse<T>>,
  signal?: AbortSignal,
): Promise<MinecraftCatalogResponse<T>> {
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(
    () => timeoutController.abort(),
    MINECRAFT_REQUEST_TIMEOUT_MS,
  );
  const abort = () => timeoutController.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    let response: Response;
    try {
      response = await fetch(`${runtimeConfig().apiBase}${path}`, {
        headers: { Accept: "application/json" },
        signal: timeoutController.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new MinecraftApiError(0, "MINECRAFT_REQUEST_TIMEOUT", "요청 시간이 초과되었습니다.");
      }
      throw new MinecraftApiError(0, "MINECRAFT_NETWORK_ERROR", "네트워크 요청에 실패했습니다.");
    }
    if (!response.ok) {
      throw new MinecraftApiError(response.status, "MINECRAFT_HTTP_ERROR", `HTTP ${response.status}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MinecraftApiError(response.status, "MINECRAFT_RESPONSE_INVALID", "응답 본문이 JSON이 아닙니다.");
    }
    const validation = validate(payload);
    if (!validation.ok) {
      throw new MinecraftApiError(response.status, "MINECRAFT_RESPONSE_INVALID", validation.error);
    }
    return validation.data;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function getMinecraftItems(
  query: MinecraftCatalogQuery,
  signal?: AbortSignal,
): Promise<MinecraftCatalogResponse<MinecraftItem>> {
  return catalogGet(`/api/minecraft/items${queryString(query)}`, validateMinecraftItemCatalogResponse, signal);
}

export function getMinecraftRecipes(
  query: MinecraftCatalogQuery & { type?: MinecraftRecipeType | "all" },
  signal?: AbortSignal,
): Promise<MinecraftCatalogResponse<MinecraftRecipe>> {
  return catalogGet(
    `/api/minecraft/recipes${queryString(query, query.type)}`,
    validateMinecraftRecipeCatalogResponse,
    signal,
  );
}

export function getMinecraftEnchants(
  query: MinecraftCatalogQuery,
  signal?: AbortSignal,
): Promise<MinecraftCatalogResponse<MinecraftEnchant>> {
  return catalogGet(`/api/minecraft/enchants${queryString(query)}`, validateMinecraftEnchantCatalogResponse, signal);
}
