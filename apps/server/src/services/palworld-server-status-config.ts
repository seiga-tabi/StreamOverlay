import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export const PALWORLD_SERVER_STATUS_CONFIG_FILE = "palworld-server-status.json";
export const PALWORLD_SERVER_CONNECTIONS_STATE_FILE = "palworld-server-connections.json.enc";
export const PALWORLD_SERVER_CREDENTIALS_SECRET_PATH = "/run/secrets/palworld-server-credentials-encryption-key";

export type PalworldServerStatusFileConfig = {
  version: 1 | 2;
  enabled: boolean;
  publicHttpsSelfService: boolean;
  allowedOrigins: string[];
  allowedCidrs: string[];
  timeoutMs: number;
  pollIntervalMs: number;
};

export type PalworldServerStatusRuntimeConfig = PalworldServerStatusFileConfig & {
  configPath: string;
  statePath: string;
  secretPath: typeof PALWORLD_SERVER_CREDENTIALS_SECRET_PATH;
  encryptionKey?: string;
};

export type PalworldServerStatusConfigErrorCode =
  | "config_missing"
  | "config_invalid_file"
  | "config_invalid_json"
  | "config_invalid_schema"
  | "config_version_unsupported"
  | "policy_missing"
  | "policy_invalid"
  | "key_missing"
  | "key_invalid_file"
  | "key_permission_denied"
  | "key_invalid_encoding"
  | "key_weak"
  | "key_reused"
  | "state_invalid";

export class PalworldServerStatusConfigError extends Error {
  readonly name = "PalworldServerStatusConfigError";

  constructor(public readonly code: PalworldServerStatusConfigErrorCode) {
    super(`Palworld 서버 상태 설정을 불러올 수 없습니다. (${code})`);
  }
}

export type PalworldServerStatusAvailabilityCode =
  | "config_missing"
  | "config_invalid"
  | "policy_missing"
  | "key_missing"
  | "key_invalid"
  | "key_permission_denied";

export function palworldServerStatusAvailabilityCode(error: unknown): PalworldServerStatusAvailabilityCode {
  if (!(error instanceof PalworldServerStatusConfigError)) return "config_invalid";
  if (error.code === "config_missing") return "config_missing";
  if (error.code === "policy_missing" || error.code === "policy_invalid") return "policy_missing";
  if (error.code === "key_missing") return "key_missing";
  if (error.code === "key_permission_denied") return "key_permission_denied";
  if (error.code.startsWith("key_")) return "key_invalid";
  return "config_invalid";
}

export type PalworldServerStatusConfigLoadOptions = {
  configDir: string;
  stateDir: string;
  reusedSecrets?: readonly string[];
};

export type PalworldServerStatusConfigDependencies = {
  /** 고정 runtime 경로를 테스트 fixture로만 치환합니다. production 호출에서는 주입하지 않습니다. */
  resolvePath?: (requestedPath: string) => string;
};

type ParsedIpAddress = {
  family: 4 | 6;
  value: bigint;
  bits: 32 | 128;
};

type ParsedCidr = ParsedIpAddress & {
  prefix: number;
  source: string;
};

const CONFIG_V1_KEYS = [
  "version",
  "enabled",
  "allowedOrigins",
  "allowedCidrs",
  "timeoutMs",
  "pollIntervalMs"
] as const;
const CONFIG_V2_KEYS = [
  "version",
  "enabled",
  "publicHttpsSelfService",
  "allowedOrigins",
  "allowedCidrs",
  "timeoutMs",
  "pollIntervalMs"
] as const;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_SECRET_BYTES = 1024;
const MAX_POLICY_ENTRIES = 128;
const MAX_URL_LENGTH = 2048;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;
const MIN_POLL_INTERVAL_MS = 5_000;
const MAX_POLL_INTERVAL_MS = 5 * 60_000;
const WEAK_SECRET_PATTERNS = [
  "changeme",
  "change-me",
  "change_me",
  "replace",
  "default",
  "secret",
  "password",
  "streamops",
  "development",
  "example",
  "test-only"
] as const;
const STREAMOPS_STATE_DIRECTORY_NAME = /^(?:\.streamops(?:[-_][a-z0-9._-]+)?|streamops(?:[-_][a-z0-9._-]+)?)$/iu;

function configError(code: PalworldServerStatusConfigErrorCode): never {
  throw new PalworldServerStatusConfigError(code);
}

function readRegularFile(
  requestedPath: string,
  kind: "config" | "key",
  maxBytes: number,
  dependencies: PalworldServerStatusConfigDependencies
): string {
  const filePath = dependencies.resolvePath?.(requestedPath) ?? requestedPath;
  let descriptor: number;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return configError(kind === "config" ? "config_missing" : "key_missing");
    if (kind === "key" && (code === "EACCES" || code === "EPERM")) {
      return configError("key_permission_denied");
    }
    return configError(kind === "config" ? "config_invalid_file" : "key_invalid_file");
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maxBytes) {
      return configError(kind === "config" ? "config_invalid_file" : "key_invalid_file");
    }
    const mode = stat.mode & 0o777;
    if (kind === "key" && ![0o400, 0o600].includes(mode)) configError("key_permission_denied");
    if (kind === "config" && (mode & 0o022) !== 0) configError("config_invalid_file");
    const raw = fs.readFileSync(descriptor, "utf8");
    if (Buffer.byteLength(raw, "utf8") > maxBytes) {
      return configError(kind === "config" ? "config_invalid_file" : "key_invalid_file");
    }
    return raw;
  } catch (error) {
    if (error instanceof PalworldServerStatusConfigError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (kind === "key" && (code === "EACCES" || code === "EPERM")) {
      return configError("key_permission_denied");
    }
    return configError(kind === "config" ? "config_invalid_file" : "key_invalid_file");
  } finally {
    fs.closeSync(descriptor);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactConfigRecord(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length
    && keys.every((key) => expectedKeys.includes(key))
    && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= MAX_POLICY_ENTRIES
    && value.every((entry) => typeof entry === "string" && entry.length > 0 && entry.length <= MAX_URL_LENGTH);
}

function parseIpv4(address: string): ParsedIpAddress | undefined {
  if (net.isIP(address) !== 4) return undefined;
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }
  return {
    family: 4,
    bits: 32,
    value: octets.reduce((result, octet) => (result << 8n) | BigInt(octet), 0n)
  };
}

function parseIpv6(address: string): ParsedIpAddress | undefined {
  if (net.isIP(address) !== 6 || address.includes("%")) return undefined;
  let source = address.toLowerCase();
  const ipv4Separator = source.lastIndexOf(":");
  const ipv4Tail = ipv4Separator >= 0 ? source.slice(ipv4Separator + 1) : "";
  if (ipv4Tail.includes(".")) {
    const ipv4 = parseIpv4(ipv4Tail);
    if (!ipv4) return undefined;
    const upper = Number((ipv4.value >> 16n) & 0xffffn).toString(16);
    const lower = Number(ipv4.value & 0xffffn).toString(16);
    source = `${source.slice(0, ipv4Separator)}:${upper}:${lower}`;
  }
  const compressed = source.split("::");
  if (compressed.length > 2) return undefined;
  const head = compressed[0] ? compressed[0].split(":") : [];
  const tail = compressed.length === 2 && compressed[1] ? compressed[1].split(":") : [];
  const words = compressed.length === 2
    ? [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail]
    : head;
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/u.test(word))) return undefined;
  return {
    family: 6,
    bits: 128,
    value: words.reduce((result, word) => (result << 16n) | BigInt(`0x${word}`), 0n)
  };
}

function parseIpAddress(address: string): ParsedIpAddress | undefined {
  return parseIpv4(address) ?? parseIpv6(address);
}

function maskValue(value: bigint, bits: number, prefix: number): bigint {
  if (prefix === 0) return 0n;
  return (value >> BigInt(bits - prefix)) << BigInt(bits - prefix);
}

function inRange(address: ParsedIpAddress, network: string, prefix: number): boolean {
  const parsedNetwork = parseIpAddress(network);
  return parsedNetwork?.family === address.family
    && maskValue(address.value, address.bits, prefix) === maskValue(parsedNetwork.value, parsedNetwork.bits, prefix);
}

function mappedIpv4(address: ParsedIpAddress): ParsedIpAddress | undefined {
  return address.family === 6 && address.value >> 32n === 0xffffn
    ? { family: 4, bits: 32, value: address.value & 0xffff_ffffn }
    : undefined;
}

function isPrivateAddress(address: ParsedIpAddress): boolean {
  const mapped = mappedIpv4(address);
  if (mapped) return isPrivateAddress(mapped);
  return address.family === 4
    ? inRange(address, "10.0.0.0", 8)
      || inRange(address, "100.64.0.0", 10)
      || inRange(address, "172.16.0.0", 12)
      || inRange(address, "192.168.0.0", 16)
    : inRange(address, "fc00::", 7);
}

function isBlockedAddress(address: ParsedIpAddress): boolean {
  const mapped = mappedIpv4(address);
  if (mapped) return isBlockedAddress(mapped);
  if (address.family === 4) {
    return inRange(address, "0.0.0.0", 8)
      || inRange(address, "127.0.0.0", 8)
      || inRange(address, "169.254.0.0", 16)
      || inRange(address, "192.0.2.0", 24)
      || inRange(address, "198.18.0.0", 15)
      || inRange(address, "198.51.100.0", 24)
      || inRange(address, "203.0.113.0", 24)
      || inRange(address, "224.0.0.0", 4)
      || inRange(address, "240.0.0.0", 4);
  }
  return address.value === 0n
    || address.value === 1n
    || inRange(address, "100::", 64)
    || inRange(address, "2001:db8::", 32)
    || inRange(address, "fe80::", 10)
    || inRange(address, "ff00::", 8);
}

function parsePrivateCidr(source: string): ParsedCidr | undefined {
  if (source.trim() !== source || source.includes("*")) return undefined;
  const parts = source.split("/");
  if (parts.length !== 2 || !/^\d{1,3}$/u.test(parts[1] ?? "")) return undefined;
  const address = parseIpAddress(parts[0] ?? "");
  const prefix = Number(parts[1]);
  if (!address || !Number.isSafeInteger(prefix) || prefix < 0 || prefix > address.bits) return undefined;
  if (maskValue(address.value, address.bits, prefix) !== address.value) return undefined;
  const privateRange = address.family === 4
    ? [
        ["10.0.0.0", 8],
        ["100.64.0.0", 10],
        ["172.16.0.0", 12],
        ["192.168.0.0", 16]
      ].find(([network, networkPrefix]) => prefix >= Number(networkPrefix) && inRange(address, String(network), Number(networkPrefix)))
    : prefix >= 7 && inRange(address, "fc00::", 7)
      ? ["fc00::", 7]
      : undefined;
  if (!privateRange) return undefined;
  return {
    ...address,
    prefix,
    value: maskValue(address.value, address.bits, prefix),
    source
  };
}

function addressMatchesCidr(address: ParsedIpAddress, cidr: ParsedCidr): boolean {
  const candidate = mappedIpv4(address) ?? address;
  return candidate.family === cidr.family
    && maskValue(candidate.value, candidate.bits, cidr.prefix) === cidr.value;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function normalizePolicies(
  origins: string[],
  cidrSources: string[],
  enabled: boolean,
  publicHttpsSelfService: boolean
): { allowedOrigins: string[]; allowedCidrs: string[] } {
  if (enabled && !publicHttpsSelfService && origins.length === 0) configError("policy_missing");
  const cidrs = cidrSources.map(parsePrivateCidr);
  if (cidrs.some((cidr) => cidr === undefined)) configError("policy_invalid");
  if (new Set(cidrSources).size !== cidrSources.length) configError("policy_invalid");

  const normalizedOrigins: string[] = [];
  for (const source of origins) {
    if (source.trim() !== source || source.includes("*")) configError("policy_invalid");
    let parsed: URL;
    try {
      parsed = new URL(source);
    } catch {
      return configError("policy_invalid");
    }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
      || parsed.username.length > 0
      || parsed.password.length > 0
      || parsed.pathname !== "/"
      || parsed.search.length > 0
      || parsed.hash.length > 0
      || parsed.hostname.length === 0) {
      configError("policy_invalid");
    }
    if (source !== parsed.origin && source !== `${parsed.origin}/`) configError("policy_invalid");
    const hostname = stripIpv6Brackets(parsed.hostname).toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) configError("policy_invalid");
    const directAddress = parseIpAddress(hostname);
    if (directAddress) {
      if (isBlockedAddress(directAddress)) configError("policy_invalid");
      if (isPrivateAddress(directAddress)
        && !(cidrs as ParsedCidr[]).some((cidr) => addressMatchesCidr(directAddress, cidr))) {
        configError("policy_invalid");
      }
      if (parsed.protocol === "http:" && !isPrivateAddress(directAddress)) configError("policy_invalid");
    }
    if (parsed.protocol === "http:" && cidrs.length === 0) configError("policy_invalid");
    normalizedOrigins.push(parsed.origin);
  }
  if (new Set(normalizedOrigins).size !== normalizedOrigins.length) configError("policy_invalid");
  return {
    allowedOrigins: normalizedOrigins,
    allowedCidrs: cidrSources.slice()
  };
}

function parseFileConfig(raw: string): PalworldServerStatusFileConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return configError("config_invalid_json");
  }
  if (!isRecord(parsed)) configError("config_invalid_schema");
  if (!Object.hasOwn(parsed, "version")
    || typeof parsed.version !== "number"
    || !Number.isSafeInteger(parsed.version)) {
    configError("config_invalid_schema");
  }
  if (parsed.version !== 1 && parsed.version !== 2) configError("config_version_unsupported");
  const expectedKeys = parsed.version === 1 ? CONFIG_V1_KEYS : CONFIG_V2_KEYS;
  if (!exactConfigRecord(parsed, expectedKeys)) configError("config_invalid_schema");
  if (typeof parsed.enabled !== "boolean"
    || parsed.version === 2 && typeof parsed.publicHttpsSelfService !== "boolean"
    || !stringArray(parsed.allowedOrigins)
    || !stringArray(parsed.allowedCidrs)
    || !integerInRange(parsed.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
    || !integerInRange(parsed.pollIntervalMs, MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS)) {
    configError("config_invalid_schema");
  }
  const publicHttpsSelfService = parsed.version === 2 ? parsed.publicHttpsSelfService as boolean : false;
  const policies = normalizePolicies(
    parsed.allowedOrigins,
    parsed.allowedCidrs,
    parsed.enabled,
    publicHttpsSelfService
  );
  return {
    version: parsed.version,
    enabled: parsed.enabled,
    publicHttpsSelfService,
    ...policies,
    timeoutMs: parsed.timeoutMs,
    pollIntervalMs: parsed.pollIntervalMs
  };
}

function secretText(raw: string): string {
  const withoutNewline = raw.endsWith("\r\n")
    ? raw.slice(0, -2)
    : raw.endsWith("\n")
      ? raw.slice(0, -1)
      : raw;
  if (withoutNewline.length === 0 || raw !== withoutNewline && raw !== `${withoutNewline}\n` && raw !== `${withoutNewline}\r\n`) {
    return configError("key_invalid_encoding");
  }
  return withoutNewline;
}

function decodeExactKey(value: string): Buffer | undefined {
  if (/^[a-f0-9]{64}$/iu.test(value)) return Buffer.from(value, "hex");
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(value)) return undefined;
  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength === 32 && decoded.toString("base64") === value ? decoded : undefined;
}

function decodedSecretMaterial(value: string): Buffer {
  const normalized = value.trim();
  return decodeExactKey(normalized) ?? Buffer.from(normalized, "utf8");
}

function validateEncryptionKey(raw: string, reusedSecrets: readonly string[]): string {
  const value = secretText(raw);
  const material = decodeExactKey(value);
  if (!material) configError("key_invalid_encoding");
  try {
    const rawLower = value.toLowerCase();
    const decodedLower = material.toString("utf8").toLowerCase();
    const weakPattern = WEAK_SECRET_PATTERNS.some((pattern) => rawLower.includes(pattern) || decodedLower.includes(pattern));
    const uniqueBytes = new Set(material).size;
    if (weakPattern || uniqueBytes < 8) configError("key_weak");
    for (const reusedSecret of reusedSecrets) {
      const other = decodedSecretMaterial(reusedSecret);
      try {
        if (other.byteLength === material.byteLength && crypto.timingSafeEqual(other, material)) {
          configError("key_reused");
        }
      } finally {
        other.fill(0);
      }
    }
    return value;
  } finally {
    material.fill(0);
  }
}

export function isPalworldServerStateDirectoryLocationAllowed(stateDir: string): boolean {
  const resolved = path.resolve(stateDir);
  const root = path.parse(resolved).root;
  const forbidden = new Set([
    root,
    path.resolve(os.tmpdir()),
    path.resolve(os.homedir()),
    path.resolve(process.cwd()),
    path.resolve("/app"),
    path.resolve("/home"),
    path.resolve("/opt"),
    path.resolve("/srv"),
    path.resolve("/tmp"),
    path.resolve("/usr"),
    path.resolve("/var"),
    path.resolve("/var/lib"),
    path.resolve("/var/tmp")
  ]);
  return stateDir === resolved
    && !forbidden.has(resolved)
    && STREAMOPS_STATE_DIRECTORY_NAME.test(path.basename(resolved));
}

function validateStateDirectoryLocation(stateDir: string): void {
  if (!isPalworldServerStateDirectoryLocationAllowed(stateDir)) configError("state_invalid");
}

export function loadPalworldServerStatusConfig(
  options: PalworldServerStatusConfigLoadOptions,
  dependencies: PalworldServerStatusConfigDependencies = {}
): PalworldServerStatusRuntimeConfig {
  if (!path.isAbsolute(options.configDir) || !path.isAbsolute(options.stateDir)) {
    configError("config_invalid_file");
  }
  const configPath = path.join(options.configDir, PALWORLD_SERVER_STATUS_CONFIG_FILE);
  const statePath = path.join(options.stateDir, PALWORLD_SERVER_CONNECTIONS_STATE_FILE);
  const config = loadPalworldServerStatusFileConfig(options.configDir, dependencies);
  if (!config.enabled) {
    return {
      ...config,
      configPath,
      statePath,
      secretPath: PALWORLD_SERVER_CREDENTIALS_SECRET_PATH
    };
  }
  validateStateDirectoryLocation(options.stateDir);
  const rawKey = readRegularFile(
    PALWORLD_SERVER_CREDENTIALS_SECRET_PATH,
    "key",
    MAX_SECRET_BYTES,
    dependencies
  );
  return {
    ...config,
    configPath,
    statePath,
    secretPath: PALWORLD_SERVER_CREDENTIALS_SECRET_PATH,
    encryptionKey: validateEncryptionKey(rawKey, options.reusedSecrets ?? [])
  };
}

export function loadPalworldServerStatusFileConfig(
  configDir: string,
  dependencies: PalworldServerStatusConfigDependencies = {}
): PalworldServerStatusFileConfig {
  if (!path.isAbsolute(configDir)) configError("config_invalid_file");
  const configPath = path.join(configDir, PALWORLD_SERVER_STATUS_CONFIG_FILE);
  const rawConfig = readRegularFile(configPath, "config", MAX_CONFIG_BYTES, dependencies);
  return parseFileConfig(rawConfig);
}
