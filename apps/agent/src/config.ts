import path from "node:path";
import { safeSecret } from "./safe-files.js";

export type AgentAdapterKind = "rest" | "mock";

export type AgentConfig = Readonly<{
  nodeEnv: string;
  production: boolean;
  enabled: boolean;
  serverOrigin: string;
  stateDirectory: string;
  credentialFile: string;
  bootstrapToken?: string;
  pushIntervalSeconds: number;
  requestTimeoutMs: number;
  maxRetryAttempts: number;
  healthHost: "127.0.0.1" | "::1";
  healthPort: number;
  adapter: AgentAdapterKind;
  palworldOrigin: string;
  adminPassword?: string;
  palworldTimeoutMs: number;
  mockState: "online" | "offline" | "invalid" | "timeout";
  release: Readonly<{ version: string; gitSha: string; builtAt: string }>;
}>;

function boolValue(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function integerValue(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name}_invalid`);
  }
  return parsed;
}

function normalizeServerOrigin(value: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("server_origin_invalid");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (
    url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || (url.protocol !== "https:" && !(url.protocol === "http:" && !production && loopback))
  ) throw new Error("server_origin_invalid");
  return url.origin;
}

function normalizePalworldOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("palworld_origin_invalid");
  }
  if (
    url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || (url.protocol !== "http:" && url.protocol !== "https:")
    || (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]")
  ) throw new Error("palworld_origin_not_loopback");
  return url.origin;
}

function releaseIdentity(environment: NodeJS.ProcessEnv, production: boolean) {
  const version = environment.APP_VERSION ?? "0.1.0-dev";
  const gitSha = environment.GIT_SHA ?? "unknown";
  const builtAt = environment.BUILD_TIME ?? "unknown";
  if (production && (
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)
    || !/^[a-f0-9]{7,40}$/iu.test(gitSha)
    || !/^\d{4}-\d{2}-\d{2}T/u.test(builtAt)
    || !Number.isFinite(Date.parse(builtAt))
  )) throw new Error("release_identity_invalid");
  return Object.freeze({ version, gitSha, builtAt });
}

export function loadAgentConfig(
  environment: NodeJS.ProcessEnv = process.env
): AgentConfig {
  const nodeEnv = environment.NODE_ENV ?? "development";
  const production = nodeEnv === "production";
  const enabled = boolValue(environment.YORO_AGENT_ENABLED, false);
  const stateDirectory = path.resolve(environment.YORO_AGENT_STATE_DIR ?? "./state/agent");
  const credentialFile = path.resolve(
    environment.YORO_AGENT_CREDENTIAL_FILE ?? path.join(stateDirectory, "credential.json")
  );
  const adapter = (environment.PALWORLD_STATUS_ADAPTER ?? "rest") as AgentAdapterKind;
  if (adapter !== "rest" && adapter !== "mock") throw new Error("adapter_invalid");
  if (production && adapter === "mock") throw new Error("mock_adapter_production_forbidden");
  const mockState = (environment.YORO_AGENT_MOCK_STATE ?? "online") as AgentConfig["mockState"];
  if (!["online", "offline", "invalid", "timeout"].includes(mockState)) {
    throw new Error("mock_state_invalid");
  }
  const bootstrapToken = enabled
    ? safeSecret({
        name: "bootstrap_token",
        direct: environment.YORO_AGENT_BOOTSTRAP_TOKEN,
        file: environment.YORO_AGENT_BOOTSTRAP_TOKEN_FILE,
        production
      })
    : undefined;
  const adminPassword = enabled && adapter === "rest"
    ? safeSecret({
        name: "palworld_admin_password",
        direct: environment.PALWORLD_ADMIN_PASSWORD,
        file: environment.PALWORLD_ADMIN_PASSWORD_FILE,
        production,
        required: true
      })
    : undefined;
  const healthHost = environment.YORO_AGENT_HEALTH_HOST ?? "127.0.0.1";
  if (healthHost !== "127.0.0.1" && healthHost !== "::1") {
    throw new Error("health_host_not_loopback");
  }
  return Object.freeze({
    nodeEnv,
    production,
    enabled,
    serverOrigin: normalizeServerOrigin(
      environment.YORO_AGENT_SERVER_ORIGIN ?? "http://127.0.0.1:3000",
      production && enabled
    ),
    stateDirectory,
    credentialFile,
    ...(bootstrapToken ? { bootstrapToken } : {}),
    pushIntervalSeconds: integerValue(
      environment.YORO_AGENT_PUSH_INTERVAL_SECONDS, 300, 60, 3_600, "push_interval"
    ),
    requestTimeoutMs: integerValue(
      environment.YORO_AGENT_REQUEST_TIMEOUT_MS, 10_000, 500, 30_000, "request_timeout"
    ),
    maxRetryAttempts: integerValue(
      environment.YORO_AGENT_MAX_RETRY_ATTEMPTS, 5, 0, 5, "retry_attempts"
    ),
    healthHost,
    healthPort: integerValue(
      environment.YORO_AGENT_HEALTH_PORT, 3_200, 0, 65_535, "health_port"
    ),
    adapter,
    palworldOrigin: normalizePalworldOrigin(
      environment.PALWORLD_REST_ORIGIN ?? "http://127.0.0.1:8212"
    ),
    ...(adminPassword ? { adminPassword } : {}),
    palworldTimeoutMs: integerValue(
      environment.PALWORLD_REQUEST_TIMEOUT_MS, 5_000, 500, 30_000, "palworld_timeout"
    ),
    mockState,
    release: releaseIdentity(environment, production)
  });
}
