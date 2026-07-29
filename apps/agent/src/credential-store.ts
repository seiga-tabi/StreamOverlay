import fs from "node:fs";
import path from "node:path";
import {
  parseAgentRegistrationResponse,
  YORO_AGENT_PAYLOAD_VERSION,
  type AgentRegistrationResponse
} from "@streamops/shared";
import {
  SafeFileError,
  assertSafeDirectory,
  atomicWriteNewJson,
  ensureSafeDirectory
} from "./safe-files.js";

export type AgentCredentialRecord = Readonly<{
  schemaVersion: 1;
  installationId: string;
  agentToken: string;
  payloadVersion: 1;
  serverOrigin: string;
  ingestionEndpoint: string;
  createdAt: string;
}>;

const MAX_CREDENTIAL_BYTES = 4_096;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,192}$/u;
const KEYS = [
  "schemaVersion",
  "installationId",
  "agentToken",
  "payloadVersion",
  "serverOrigin",
  "ingestionEndpoint",
  "createdAt"
] as const;

function parseCredential(value: unknown, expectedOrigin: string): AgentCredentialRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== KEYS.length
    || Object.keys(record).some((key) => !KEYS.includes(key as typeof KEYS[number]))
    || record.schemaVersion !== 1
    || typeof record.installationId !== "string"
    || !UUID_PATTERN.test(record.installationId)
    || typeof record.agentToken !== "string"
    || !TOKEN_PATTERN.test(record.agentToken)
    || record.payloadVersion !== YORO_AGENT_PAYLOAD_VERSION
    || record.serverOrigin !== expectedOrigin
    || typeof record.ingestionEndpoint !== "string"
    || typeof record.createdAt !== "string"
    || !Number.isFinite(Date.parse(record.createdAt))
  ) return undefined;
  let endpoint: URL;
  try {
    endpoint = new URL(record.ingestionEndpoint);
  } catch {
    return undefined;
  }
  if (
    endpoint.origin !== expectedOrigin
    || endpoint.pathname !== "/api/agent/v1/status"
    || endpoint.search
    || endpoint.hash
    || endpoint.username
    || endpoint.password
  ) return undefined;
  return Object.freeze({
    schemaVersion: 1,
    installationId: record.installationId,
    agentToken: record.agentToken,
    payloadVersion: YORO_AGENT_PAYLOAD_VERSION,
    serverOrigin: expectedOrigin,
    ingestionEndpoint: endpoint.href,
    createdAt: new Date(record.createdAt).toISOString()
  });
}

export class CredentialStore {
  constructor(
    private readonly filePath: string,
    private readonly serverOrigin: string,
    private readonly production: boolean
  ) {}

  load(): AgentCredentialRecord | undefined {
    ensureSafeDirectory(path.dirname(this.filePath), this.production);
    if (!fs.existsSync(this.filePath)) return undefined;
    try {
      const directory = path.dirname(this.filePath);
      assertSafeDirectory(directory, this.production);
      const stat = fs.lstatSync(this.filePath);
      if (
        !stat.isFile()
        || stat.isSymbolicLink()
        || stat.size < 2
        || stat.size > MAX_CREDENTIAL_BYTES
        || (stat.mode & 0o077) !== 0
      ) throw new Error("invalid");
      const parsed = parseCredential(
        JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown,
        this.serverOrigin
      );
      if (!parsed) throw new Error("schema");
      return parsed;
    } catch {
      throw new SafeFileError("credential_corrupted");
    }
  }

  save(response: AgentRegistrationResponse, now = new Date()): AgentCredentialRecord {
    const validated = parseAgentRegistrationResponse(response, this.serverOrigin);
    if (!validated) throw new SafeFileError("credential_response_invalid");
    const record: AgentCredentialRecord = Object.freeze({
      schemaVersion: 1,
      installationId: validated.installationId,
      agentToken: validated.agentToken,
      payloadVersion: validated.ingestion.payloadVersion,
      serverOrigin: this.serverOrigin,
      ingestionEndpoint: validated.ingestion.endpoint,
      createdAt: now.toISOString()
    });
    atomicWriteNewJson(this.filePath, record);
    const reloaded = this.load();
    if (!reloaded) throw new SafeFileError("credential_verify_failed");
    return reloaded;
  }
}
