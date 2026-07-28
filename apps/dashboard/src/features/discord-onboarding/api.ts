import { apiBase } from "../../api/client";

export type DiscordSetupGuild = {
  id: string;
  name: string;
  iconUrl?: string;
  manageable: true;
};

export type DiscordSetupOrganization = {
  id: string;
  displayName: string;
};

export type DiscordSetupSession =
  | { authenticated: false }
  | {
      authenticated: true;
      csrfToken: string;
      guilds: DiscordSetupGuild[];
      organizations: DiscordSetupOrganization[];
    };

export class DiscordSetupApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super(code ?? `http_${status}`);
  }
}

async function errorFor(response: Response): Promise<DiscordSetupApiError> {
  try {
    const body = await response.json() as { code?: unknown };
    return new DiscordSetupApiError(
      response.status,
      typeof body.code === "string" ? body.code : undefined
    );
  } catch {
    return new DiscordSetupApiError(response.status);
  }
}

export function discordOAuthStartUrl(setupToken: string): string {
  const query = new URLSearchParams({ setup: setupToken });
  return `${apiBase}/api/discord/oauth/start?${query.toString()}`;
}

export async function getDiscordSetupSession(signal?: AbortSignal): Promise<DiscordSetupSession> {
  const response = await fetch(`${apiBase}/api/discord/session`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw await errorFor(response);
  return await response.json() as DiscordSetupSession;
}

export async function connectDiscordGuild(input: {
  csrfToken: string;
  guildId: string;
  organizationId?: string;
}): Promise<{
  completed: true;
  guild: { id: string; name: string };
  organization: { id: string; displayName: string };
}> {
  const response = await fetch(`${apiBase}/api/discord/onboarding/guild`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Discord-CSRF": input.csrfToken
    },
    body: JSON.stringify({
      guildId: input.guildId,
      ...(input.organizationId ? { organizationId: input.organizationId } : {})
    })
  });
  if (!response.ok) throw await errorFor(response);
  return await response.json() as {
    completed: true;
    guild: { id: string; name: string };
    organization: { id: string; displayName: string };
  };
}

