import type {
  PalworldServerConnectionInput,
  PalworldServerDashboardResponse,
  PalworldServerTestResponse
} from "@streamops/shared";
import {
  validatePalworldServerDashboardResponse,
  validatePalworldServerTestResponse
} from "@streamops/shared";
import { apiGet, apiPost } from "../../api/client";

const PALWORLD_SERVER_API = "/api/dashboard/palworld-server";

function requireDashboardResponse(value: unknown): PalworldServerDashboardResponse {
  const result = validatePalworldServerDashboardResponse(value);
  if (!result.ok) throw new Error("Palworld Dashboard 응답 검증에 실패했습니다.");
  return result.data;
}

function requireTestResponse(value: unknown): PalworldServerTestResponse {
  const result = validatePalworldServerTestResponse(value);
  if (!result.ok) throw new Error("Palworld 연결 테스트 응답 검증에 실패했습니다.");
  return result.data;
}

export async function getPalworldServerDashboard(): Promise<PalworldServerDashboardResponse> {
  return requireDashboardResponse(await apiGet<unknown>(PALWORLD_SERVER_API));
}

export async function testPalworldServerConnection(
  input: PalworldServerConnectionInput
): Promise<PalworldServerTestResponse> {
  return requireTestResponse(await apiPost<unknown>(`${PALWORLD_SERVER_API}/test`, input));
}

export async function savePalworldServerConnection(
  input: PalworldServerConnectionInput
): Promise<PalworldServerDashboardResponse> {
  return requireDashboardResponse(await apiPost<unknown>(`${PALWORLD_SERVER_API}/save`, input));
}

export async function refreshPalworldServerStatus(): Promise<PalworldServerDashboardResponse> {
  return requireDashboardResponse(await apiPost<unknown>(`${PALWORLD_SERVER_API}/refresh`, {}));
}

export async function removePalworldServerConnection(): Promise<PalworldServerDashboardResponse> {
  return requireDashboardResponse(await apiPost<unknown>(`${PALWORLD_SERVER_API}/remove`, {}));
}
