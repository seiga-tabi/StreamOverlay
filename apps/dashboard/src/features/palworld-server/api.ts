import type {
  PalworldServerConnectionInput,
  PalworldServerDashboardResponse,
  PalworldServerTestResponse
} from "@streamops/shared";
import { apiGet, apiPost } from "../../api/client";

const PALWORLD_SERVER_API = "/api/dashboard/palworld-server";

export function getPalworldServerDashboard(): Promise<PalworldServerDashboardResponse> {
  return apiGet<PalworldServerDashboardResponse>(PALWORLD_SERVER_API);
}

export function testPalworldServerConnection(
  input: PalworldServerConnectionInput
): Promise<PalworldServerTestResponse> {
  return apiPost<PalworldServerTestResponse>(`${PALWORLD_SERVER_API}/test`, input);
}

export function savePalworldServerConnection(
  input: PalworldServerConnectionInput
): Promise<PalworldServerDashboardResponse> {
  return apiPost<PalworldServerDashboardResponse>(`${PALWORLD_SERVER_API}/save`, input);
}

export function refreshPalworldServerStatus(): Promise<PalworldServerDashboardResponse> {
  return apiPost<PalworldServerDashboardResponse>(`${PALWORLD_SERVER_API}/refresh`, {});
}

export function removePalworldServerConnection(): Promise<PalworldServerDashboardResponse> {
  return apiPost<PalworldServerDashboardResponse>(`${PALWORLD_SERVER_API}/remove`, {});
}
