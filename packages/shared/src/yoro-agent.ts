export const YORO_AGENT_PAYLOAD_VERSION = 1 as const;

export type AgentRegistrationInput = Readonly<{
  bootstrapToken: string;
  agentVersion: string;
  platform: "linux";
  architecture: "x64" | "arm64";
}>;

export type AgentRegistrationResponse = Readonly<{
  installationId: string;
  agentToken: string;
  gameServer: Readonly<{
    id: string;
    gameType: "palworld";
  }>;
  ingestion: Readonly<{
    endpoint: string;
    payloadVersion: typeof YORO_AGENT_PAYLOAD_VERSION;
  }>;
}>;

export type PalworldAgentStatusPayload = Readonly<{
  payloadVersion: typeof YORO_AGENT_PAYLOAD_VERSION;
  observedAt: string;
  online: boolean;
  players: number;
  maxPlayers: number;
  gameVersion?: string;
  uptimeSeconds?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  latencyMs?: number;
}>;

export type AgentIngestionResponse = Readonly<{
  accepted: true;
  currentUpdated: boolean;
  duplicate: boolean;
}>;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,192}$/u;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key))
    && Object.keys(value).length === allowed.length;
}

function optionalNumber(value: unknown, minimum: number, maximum: number): value is number | undefined {
  return value === undefined
    || (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum);
}

export function parseAgentRegistrationInput(value: unknown): AgentRegistrationInput | undefined {
  if (
    !record(value)
    || !exactKeys(value, ["bootstrapToken", "agentVersion", "platform", "architecture"])
    || typeof value.bootstrapToken !== "string"
    || !TOKEN_PATTERN.test(value.bootstrapToken)
    || typeof value.agentVersion !== "string"
    || !VERSION_PATTERN.test(value.agentVersion)
    || value.platform !== "linux"
    || (value.architecture !== "x64" && value.architecture !== "arm64")
  ) return undefined;
  return Object.freeze({
    bootstrapToken: value.bootstrapToken,
    agentVersion: value.agentVersion,
    platform: value.platform,
    architecture: value.architecture
  });
}

export function parsePalworldAgentStatusPayload(
  value: unknown,
  options: Readonly<{
    now?: number;
    maximumPastMs?: number;
    maximumFutureMs?: number;
  }> = {}
): PalworldAgentStatusPayload | undefined {
  const required = ["payloadVersion", "observedAt", "online", "players", "maxPlayers"];
  const optional = [
    "gameVersion", "uptimeSeconds", "cpuPercent", "memoryPercent", "diskPercent", "latencyMs"
  ];
  if (!record(value) || Object.keys(value).some((key) => ![...required, ...optional].includes(key))) {
    return undefined;
  }
  if (required.some((key) => !(key in value))) return undefined;
  const observedAt = typeof value.observedAt === "string"
    && ISO_TIMESTAMP_PATTERN.test(value.observedAt)
    ? Date.parse(value.observedAt)
    : Number.NaN;
  const now = options.now ?? Date.now();
  if (
    value.payloadVersion !== YORO_AGENT_PAYLOAD_VERSION
    || typeof value.online !== "boolean"
    || !Number.isInteger(value.players)
    || !Number.isInteger(value.maxPlayers)
    || (value.players as number) < 0
    || (value.maxPlayers as number) < 0
    || (value.players as number) > (value.maxPlayers as number)
    || !Number.isFinite(observedAt)
    || observedAt < now - (options.maximumPastMs ?? 24 * 60 * 60 * 1_000)
    || observedAt > now + (options.maximumFutureMs ?? 5 * 60 * 1_000)
  ) return undefined;
  if (
    (value.gameVersion !== undefined && (
      typeof value.gameVersion !== "string"
      || value.gameVersion.length < 1
      || value.gameVersion.length > 80
      || /[\u0000-\u001f\u007f]/u.test(value.gameVersion)
    ))
    || !optionalNumber(value.uptimeSeconds, 0, Number.MAX_SAFE_INTEGER)
    || !optionalNumber(value.cpuPercent, 0, 100)
    || !optionalNumber(value.memoryPercent, 0, 100)
    || !optionalNumber(value.diskPercent, 0, 100)
    || !optionalNumber(value.latencyMs, 0, 86_400_000)
  ) return undefined;
  return Object.freeze({
    payloadVersion: YORO_AGENT_PAYLOAD_VERSION,
    observedAt: new Date(observedAt).toISOString(),
    online: value.online,
    players: value.players as number,
    maxPlayers: value.maxPlayers as number,
    ...(value.gameVersion === undefined ? {} : { gameVersion: value.gameVersion }),
    ...(value.uptimeSeconds === undefined ? {} : { uptimeSeconds: value.uptimeSeconds }),
    ...(value.cpuPercent === undefined ? {} : { cpuPercent: value.cpuPercent }),
    ...(value.memoryPercent === undefined ? {} : { memoryPercent: value.memoryPercent }),
    ...(value.diskPercent === undefined ? {} : { diskPercent: value.diskPercent }),
    ...(value.latencyMs === undefined ? {} : { latencyMs: value.latencyMs })
  });
}
