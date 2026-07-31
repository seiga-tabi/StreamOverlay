import type {
  BotManagementGameServer,
  BotManagementOrganization,
  CreatePalworldGameServerInput,
  DiscordBotControlOverview,
  UpdateDiscordBotControlInput,
  PalworldServerConnectionInput,
  PalworldServerDashboardResponse,
  PalworldServerTestResponse
} from "@streamops/shared";
import {
  parseDiscordBotControlOverview,
  validatePalworldServerDashboardResponse,
  validatePalworldServerTestResponse
} from "@streamops/shared";
import { apiBase } from "../../api/client";

export type BotManagementSession =
  | { authenticated: false }
  | {
      authenticated: true;
      csrfToken: string;
      organizations: BotManagementOrganization[];
    };

export type BotManagementGuild = {
  id: string;
  name: string;
  iconUrl?: string;
  manageable: true;
  botInstalled: boolean;
};

export type BotManagementConnectSession =
  | { authenticated: false }
  | {
      authenticated: true;
      csrfToken: string;
      installedGuilds: Array<BotManagementGuild & { botInstalled: true }>;
      missingBotGuilds: Array<BotManagementGuild & { botInstalled: false }>;
      organizations: Array<{ id: string; displayName: string }>;
    };

export class BotManagementApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(code ?? `http_${status}`);
  }
}

async function apiError(response: Response): Promise<BotManagementApiError> {
  try {
    const body = await response.json() as { code?: unknown };
    return new BotManagementApiError(
      response.status,
      typeof body.code === "string" ? body.code : undefined
    );
  } catch {
    return new BotManagementApiError(response.status);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init
  });
  if (!response.ok) throw await apiError(response);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function managementLoginUrl(): string {
  return "/login?return_to=/dashboard/organizations";
}

export function managementConnectUrl(): string {
  return `${apiBase}/api/discord/management/connect/start`;
}

export function botInstallUrl(): string {
  return "/api/discord/bot/install";
}

export function getManagementConnectSession(
  signal?: AbortSignal
): Promise<BotManagementConnectSession> {
  return request("/api/discord/management/connect/session", { signal });
}

export function claimManagementGuild(input: {
  guildId: string;
  organizationId?: string;
  csrfToken: string;
}): Promise<{
  completed: true;
  guild: { id: string; name: string };
  organization: { id: string; displayName: string };
}> {
  return request("/api/discord/management/guilds/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Discord-CSRF": input.csrfToken
    },
    body: JSON.stringify({
      guildId: input.guildId,
      ...(input.organizationId ? { organizationId: input.organizationId } : {})
    })
  });
}

export function getManagementSession(signal?: AbortSignal): Promise<BotManagementSession> {
  return request("/api/discord/management/session", { signal });
}

export function managementSessionNeedsGuildConnection(
  session: BotManagementSession
): boolean {
  return session.authenticated && session.organizations.length === 0;
}

export async function listManagementGameServers(
  organizationId: string,
  signal?: AbortSignal
): Promise<readonly BotManagementGameServer[]> {
  const body = await request<{ items: BotManagementGameServer[] }>(
    `/api/discord/management/organizations/${encodeURIComponent(organizationId)}/game-servers`,
    { signal }
  );
  return body.items;
}

export async function createManagementGameServer(input: {
  organizationId: string;
  csrfToken: string;
  value: CreatePalworldGameServerInput;
}): Promise<BotManagementGameServer> {
  const body = await request<{ server: BotManagementGameServer }>(
    `/api/discord/management/organizations/${encodeURIComponent(input.organizationId)}/game-servers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Discord-CSRF": input.csrfToken
      },
      body: JSON.stringify(input.value)
    }
  );
  return body.server;
}

function botControlPath(organizationId: string): string {
  return `/api/discord/management/organizations/${encodeURIComponent(organizationId)}/bot-control`;
}

export function getManagementBotControl(
  organizationId: string,
  signal?: AbortSignal
): Promise<DiscordBotControlOverview> {
  return request<unknown>(botControlPath(organizationId), { signal })
    .then(validatedBotControlOverview);
}

export function updateManagementBotControl(input: {
  organizationId: string;
  csrfToken: string;
  value: UpdateDiscordBotControlInput;
}): Promise<DiscordBotControlOverview> {
  return request<unknown>(botControlPath(input.organizationId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Discord-CSRF": input.csrfToken
    },
    body: JSON.stringify(input.value)
  }).then(validatedBotControlOverview);
}

function validatedBotControlOverview(value: unknown): DiscordBotControlOverview {
  const parsed = parseDiscordBotControlOverview(value);
  if (!parsed) throw new BotManagementApiError(502, "invalid_response");
  return parsed;
}

export function deleteManagementGameServer(input: {
  organizationId: string;
  gameServerId: string;
  csrfToken: string;
}): Promise<void> {
  return request(
    `/api/discord/management/organizations/${encodeURIComponent(input.organizationId)}/game-servers/${encodeURIComponent(input.gameServerId)}`,
    { method: "DELETE", headers: { "X-Discord-CSRF": input.csrfToken } }
  );
}

function restConnectionPath(organizationId: string, gameServerId: string): string {
  return `/api/discord/management/organizations/${encodeURIComponent(organizationId)}/game-servers/${encodeURIComponent(gameServerId)}/palworld-rest`;
}

function validatedDashboardResponse(value: unknown): PalworldServerDashboardResponse {
  const result = validatePalworldServerDashboardResponse(value);
  if (!result.ok) throw new BotManagementApiError(502, "invalid_response");
  return result.data;
}

function validatedTestResponse(value: unknown): PalworldServerTestResponse {
  const result = validatePalworldServerTestResponse(value);
  if (!result.ok) throw new BotManagementApiError(502, "invalid_response");
  return result.data;
}

export async function getManagementPalworldRestConnection(
  organizationId: string,
  gameServerId: string,
  signal?: AbortSignal
): Promise<PalworldServerDashboardResponse> {
  return validatedDashboardResponse(await request(
    restConnectionPath(organizationId, gameServerId),
    { signal }
  ));
}

export async function testManagementPalworldRestConnection(input: {
  organizationId: string;
  gameServerId: string;
  csrfToken: string;
  value: PalworldServerConnectionInput;
}): Promise<PalworldServerTestResponse> {
  return validatedTestResponse(await request(
    `${restConnectionPath(input.organizationId, input.gameServerId)}/test`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Discord-CSRF": input.csrfToken
      },
      body: JSON.stringify(input.value)
    }
  ));
}

export async function saveManagementPalworldRestConnection(input: {
  organizationId: string;
  gameServerId: string;
  csrfToken: string;
  value: PalworldServerConnectionInput;
}): Promise<PalworldServerDashboardResponse> {
  return validatedDashboardResponse(await request(
    `${restConnectionPath(input.organizationId, input.gameServerId)}/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Discord-CSRF": input.csrfToken
      },
      body: JSON.stringify(input.value)
    }
  ));
}

export async function refreshManagementPalworldRestConnection(input: {
  organizationId: string;
  gameServerId: string;
  csrfToken: string;
}): Promise<PalworldServerDashboardResponse> {
  return validatedDashboardResponse(await request(
    `${restConnectionPath(input.organizationId, input.gameServerId)}/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Discord-CSRF": input.csrfToken
      },
      body: "{}"
    }
  ));
}

export async function removeManagementPalworldRestConnection(input: {
  organizationId: string;
  gameServerId: string;
  csrfToken: string;
}): Promise<PalworldServerDashboardResponse> {
  return validatedDashboardResponse(await request(
    `${restConnectionPath(input.organizationId, input.gameServerId)}/remove`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Discord-CSRF": input.csrfToken
      },
      body: "{}"
    }
  ));
}
