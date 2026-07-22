import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { performance } from "node:perf_hooks";
import {
  validatePalworldRestInfoResponse,
  validatePalworldRestMetricsResponse,
  type PalworldRestInfoResponse,
  type PalworldRestMetricsResponse,
  type PalworldServerDiagnostic,
  type PalworldServerDiagnosticKey,
  type PalworldServerErrorCode,
  type PalworldServerInfo,
  type PalworldServerMetrics
} from "@streamops/shared";

const PALWORLD_INFO_PATH = "/v1/api/info";
const PALWORLD_METRICS_PATH = "/v1/api/metrics";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1_024;
const DEFAULT_MAX_URL_LENGTH = 2_048;
const MAX_PASSWORD_LENGTH = 256;
const MAX_DNS_ADDRESSES = 32;

const DIAGNOSTIC_KEYS = [
  "url_policy",
  "dns_tcp",
  "tls",
  "basic_auth",
  "info",
  "metrics",
  "schema"
] as const satisfies readonly PalworldServerDiagnosticKey[];

type IpFamily = 4 | 6;

export type PalworldResolvedAddress = {
  address: string;
  family: IpFamily;
};

export type PalworldServerClientConfig = {
  allowedOrigins: readonly string[];
  allowedCidrs?: readonly string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxUrlLength?: number;
};

export type PalworldPinnedRequest = {
  url: URL;
  pinnedAddress: PalworldResolvedAddress;
  timeoutMs: number;
  maxResponseBytes: number;
  authorization: string;
};

export type PalworldPinnedResponse = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

export type PalworldServerClientDependencies = {
  resolveHostname?: (hostname: string) => Promise<readonly PalworldResolvedAddress[]>;
  requestPinned?: (request: PalworldPinnedRequest) => Promise<PalworldPinnedResponse>;
  now?: () => Date;
  monotonicNow?: () => number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
};

export type PalworldServerProbeInput = {
  baseUrl: string;
  adminPassword: string;
};

export type PalworldServerProbeResult = {
  baseUrl: string;
  checkedAt: string;
  latencyMs: number;
  state: "online" | "degraded";
  errorCode?: PalworldServerErrorCode;
  info: PalworldServerInfo;
  metrics?: PalworldServerMetrics;
  diagnostics: PalworldServerDiagnostic[];
};

const SAFE_ERROR_MESSAGES: Record<PalworldServerErrorCode, string> = {
  disabled: "Palworld 서버 상태 기능이 비활성화되어 있습니다.",
  not_configured: "Palworld 서버가 등록되어 있지 않습니다.",
  config_missing: "Palworld 서버 상태 설정이 준비되지 않았습니다.",
  config_invalid: "Palworld 서버 상태 설정이 올바르지 않습니다.",
  key_missing: "Palworld 서버 자격 증명 암호화 키가 준비되지 않았습니다.",
  key_invalid: "Palworld 서버 자격 증명 암호화 키가 올바르지 않습니다.",
  policy_missing: "Palworld 서버 네트워크 허용 정책이 준비되지 않았습니다.",
  invalid_request: "Palworld 서버 상태 확인 요청이 올바르지 않습니다.",
  invalid_url: "올바른 Palworld REST API URL이 아닙니다.",
  password_required: "AdminPassword가 필요합니다.",
  origin_not_allowed: "운영자가 허용한 Palworld REST API origin이 아닙니다.",
  address_blocked: "보안 정책상 연결할 수 없는 네트워크 주소입니다.",
  dns_failed: "Palworld 서버 주소를 확인하지 못했습니다.",
  connection_failed: "Palworld 서버에 연결하지 못했습니다.",
  request_timeout: "Palworld 서버 상태 확인 시간이 초과되었습니다.",
  tls_failed: "Palworld 서버의 TLS 연결을 검증하지 못했습니다.",
  auth_failed: "Palworld 서버 인증에 실패했습니다.",
  redirect_blocked: "Palworld 서버의 redirect 응답은 허용되지 않습니다.",
  unexpected_status: "Palworld 서버가 예상하지 못한 HTTP 상태를 반환했습니다.",
  invalid_content_type: "Palworld 서버가 JSON이 아닌 응답을 반환했습니다.",
  response_too_large: "Palworld 서버 응답이 허용 크기를 초과했습니다.",
  invalid_json: "Palworld 서버 응답을 JSON으로 해석할 수 없습니다.",
  invalid_schema: "Palworld 서버 응답 형식이 올바르지 않습니다.",
  rate_limited: "Palworld 서버 상태 확인 요청이 너무 많습니다.",
  internal_error: "Palworld 서버 상태 확인 중 내부 오류가 발생했습니다."
};

export class PalworldServerClientError extends Error {
  constructor(
    readonly code: PalworldServerErrorCode,
    readonly stage: PalworldServerDiagnosticKey,
    readonly diagnostics: PalworldServerDiagnostic[]
  ) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "PalworldServerClientError";
  }
}

type ParsedIpAddress = {
  family: IpFamily;
  value: bigint;
  bits: 32 | 128;
  mappedIpv4?: ParsedIpAddress;
};

type ParsedCidr = {
  family: IpFamily;
  network: bigint;
  prefix: number;
  bits: 32 | 128;
};

type PreparedTarget = {
  baseUrl: string;
  protocol: "http:" | "https:";
  pinnedAddress: PalworldResolvedAddress;
};

export type PalworldPinnedTransportErrorCode =
  | "connection_failed"
  | "request_timeout"
  | "tls_failed"
  | "response_too_large";

export class PalworldPinnedTransportError extends Error {
  constructor(readonly code: PalworldPinnedTransportErrorCode) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "PalworldPinnedTransportError";
  }
}

function createDiagnostics(): PalworldServerDiagnostic[] {
  return DIAGNOSTIC_KEYS.map((key) => ({ key, state: "pending" }));
}

function copyDiagnostics(diagnostics: readonly PalworldServerDiagnostic[]): PalworldServerDiagnostic[] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic }));
}

function updateDiagnostic(
  diagnostics: PalworldServerDiagnostic[],
  key: PalworldServerDiagnosticKey,
  state: PalworldServerDiagnostic["state"],
  errorCode?: PalworldServerErrorCode
): void {
  const diagnostic = diagnostics.find((entry) => entry.key === key);
  if (!diagnostic) return;
  diagnostic.state = state;
  if (errorCode === undefined) {
    delete diagnostic.errorCode;
  } else {
    diagnostic.errorCode = errorCode;
  }
}

function skipPendingDiagnostics(diagnostics: PalworldServerDiagnostic[]): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic.state === "pending") diagnostic.state = "skipped";
  }
}

function clientError(
  code: PalworldServerErrorCode,
  stage: PalworldServerDiagnosticKey,
  diagnostics: PalworldServerDiagnostic[]
): PalworldServerClientError {
  updateDiagnostic(diagnostics, stage, "failed", code);
  skipPendingDiagnostics(diagnostics);
  return new PalworldServerClientError(code, stage, copyDiagnostics(diagnostics));
}

function isFiniteIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function parseIpv4(address: string): ParsedIpAddress | undefined {
  if (isIP(address) !== 4) return undefined;
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !isFiniteIntegerInRange(octet, 0, 255))) {
    return undefined;
  }
  const value = octets.reduce((result, octet) => (result << 8n) | BigInt(octet), 0n);
  return { family: 4, value, bits: 32 };
}

function parseIpv6(address: string): ParsedIpAddress | undefined {
  if (isIP(address) !== 6 || address.includes("%")) return undefined;
  let source = address.toLowerCase();
  const ipv4Separator = source.lastIndexOf(":");
  const ipv4Tail = ipv4Separator >= 0 ? source.slice(ipv4Separator + 1) : "";
  if (ipv4Tail.includes(".")) {
    const parsedIpv4 = parseIpv4(ipv4Tail);
    if (!parsedIpv4) return undefined;
    const upper = Number((parsedIpv4.value >> 16n) & 0xffffn).toString(16);
    const lower = Number(parsedIpv4.value & 0xffffn).toString(16);
    source = `${source.slice(0, ipv4Separator)}:${upper}:${lower}`;
  }

  const compressedParts = source.split("::");
  if (compressedParts.length > 2) return undefined;
  const head = compressedParts[0] ? compressedParts[0].split(":") : [];
  const tail = compressedParts.length === 2 && compressedParts[1] ? compressedParts[1].split(":") : [];
  let words: string[];
  if (compressedParts.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return undefined;
    words = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else {
    if (head.length !== 8) return undefined;
    words = head;
  }
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/i.test(word))) return undefined;

  const value = words.reduce((result, word) => (result << 16n) | BigInt(`0x${word}`), 0n);
  const mappedIpv4 = value >> 32n === 0xffffn
    ? { family: 4 as const, value: value & 0xffff_ffffn, bits: 32 as const }
    : undefined;
  return { family: 6, value, bits: 128, mappedIpv4 };
}

function parseIpAddress(address: string): ParsedIpAddress | undefined {
  return parseIpv4(address) ?? parseIpv6(address);
}

function maskValue(value: bigint, bits: number, prefix: number): bigint {
  if (prefix === 0) return 0n;
  return (value >> BigInt(bits - prefix)) << BigInt(bits - prefix);
}

function parseCidr(value: string): ParsedCidr | undefined {
  const parts = value.trim().split("/");
  if (parts.length !== 2) return undefined;
  const addressText = parts[0];
  const prefixText = parts[1];
  if (!addressText || !prefixText || !/^\d{1,3}$/.test(prefixText)) return undefined;
  const address = parseIpAddress(addressText);
  const prefix = Number(prefixText);
  if (!address || !isFiniteIntegerInRange(prefix, 0, address.bits)) return undefined;
  return {
    family: address.family,
    network: maskValue(address.value, address.bits, prefix),
    prefix,
    bits: address.bits
  };
}

function addressMatchesCidr(address: ParsedIpAddress, cidr: ParsedCidr): boolean {
  if (address.family !== cidr.family || address.bits !== cidr.bits) return false;
  return maskValue(address.value, address.bits, cidr.prefix) === cidr.network;
}

function addressMatchesAnyCidr(address: ParsedIpAddress, cidrs: readonly ParsedCidr[]): boolean {
  if (cidrs.some((cidr) => addressMatchesCidr(address, cidr))) return true;
  return address.mappedIpv4 !== undefined
    ? cidrs.some((cidr) => addressMatchesCidr(address.mappedIpv4 as ParsedIpAddress, cidr))
    : false;
}

function inRange(address: ParsedIpAddress, network: string, prefix: number): boolean {
  const parsedNetwork = parseIpAddress(network);
  if (!parsedNetwork || parsedNetwork.family !== address.family) return false;
  return maskValue(address.value, address.bits, prefix) === maskValue(parsedNetwork.value, parsedNetwork.bits, prefix);
}

function isAlwaysBlockedIpv4(address: ParsedIpAddress): boolean {
  return inRange(address, "0.0.0.0", 8)
    || inRange(address, "127.0.0.0", 8)
    || inRange(address, "169.254.0.0", 16)
    || inRange(address, "192.0.0.0", 24)
    || inRange(address, "192.0.2.0", 24)
    || inRange(address, "192.31.196.0", 24)
    || inRange(address, "192.52.193.0", 24)
    || inRange(address, "192.88.99.0", 24)
    || inRange(address, "192.175.48.0", 24)
    || inRange(address, "198.18.0.0", 15)
    || inRange(address, "198.51.100.0", 24)
    || inRange(address, "203.0.113.0", 24)
    || inRange(address, "224.0.0.0", 4)
    || inRange(address, "240.0.0.0", 4)
    || address.value === parseIpv4("100.100.100.200")?.value
    || address.value === parseIpv4("168.63.129.16")?.value;
}

function isPrivateIpv4(address: ParsedIpAddress): boolean {
  return inRange(address, "10.0.0.0", 8)
    || inRange(address, "100.64.0.0", 10)
    || inRange(address, "172.16.0.0", 12)
    || inRange(address, "192.168.0.0", 16);
}

function isAlwaysBlockedIpv6(address: ParsedIpAddress): boolean {
  if (address.mappedIpv4) return isAlwaysBlockedIpv4(address.mappedIpv4);
  return inRange(address, "::", 8)
    || inRange(address, "64:ff9b::", 96)
    || inRange(address, "64:ff9b:1::", 48)
    || inRange(address, "100::", 64)
    || inRange(address, "2001::", 23)
    || inRange(address, "2001:db8::", 32)
    || inRange(address, "2002::", 16)
    || inRange(address, "3fff::", 20)
    || inRange(address, "5f00::", 16)
    || inRange(address, "fe80::", 10)
    || inRange(address, "ff00::", 8)
    || !inRange(address, "2000::", 3) && !inRange(address, "fc00::", 7);
}

function isPrivateIpv6(address: ParsedIpAddress): boolean {
  if (address.mappedIpv4) return isPrivateIpv4(address.mappedIpv4);
  return inRange(address, "fc00::", 7);
}

function isAlwaysBlockedAddress(address: ParsedIpAddress): boolean {
  return address.family === 4 ? isAlwaysBlockedIpv4(address) : isAlwaysBlockedIpv6(address);
}

function isPrivateAddress(address: ParsedIpAddress): boolean {
  return address.family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function rawHostname(input: string): string | undefined {
  const schemeEnd = input.indexOf("://");
  if (schemeEnd < 0) return undefined;
  const authority = input.slice(schemeEnd + 3).split(/[/?#]/, 1)[0];
  if (!authority) return undefined;
  const withoutUserInfo = authority.slice(authority.lastIndexOf("@") + 1);
  if (withoutUserInfo.startsWith("[")) {
    const closingBracket = withoutUserInfo.indexOf("]");
    return closingBracket > 0 ? withoutUserInfo.slice(1, closingBracket) : undefined;
  }
  const lastColon = withoutUserInfo.lastIndexOf(":");
  return lastColon >= 0 ? withoutUserInfo.slice(0, lastColon) : withoutUserInfo;
}

function normalizeConfiguredOrigin(input: string): string | undefined {
  try {
    const parsed = new URL(input);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
      || parsed.username.length > 0
      || parsed.password.length > 0
      || parsed.pathname !== "/"
      || parsed.search.length > 0
      || parsed.hash.length > 0) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function isJsonContentType(value: string | string[] | undefined): boolean {
  if (typeof value !== "string") return false;
  return /^\s*application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)\s*(?:;|$)/i.test(value);
}

function isTlsError(error: NodeJS.ErrnoException): boolean {
  return new Set([
    "CERT_HAS_EXPIRED",
    "CERT_NOT_YET_VALID",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
    "ERR_TLS_INVALID_PROTOCOL_VERSION",
    "ERR_TLS_PROTOCOL_VERSION_CONFLICT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ]).has(error.code ?? "");
}

async function defaultResolveHostname(hostname: string): Promise<readonly PalworldResolvedAddress[]> {
  const directFamily = isIP(hostname);
  if (directFamily === 4 || directFamily === 6) {
    return [{ address: hostname, family: directFamily }];
  }
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.flatMap((record) => record.family === 4 || record.family === 6
    ? [{ address: record.address, family: record.family }]
    : []);
}

async function defaultRequestPinned(request: PalworldPinnedRequest): Promise<PalworldPinnedResponse> {
  return await new Promise<PalworldPinnedResponse>((resolve, reject) => {
    let settled = false;
    const finishReject = (failure: PalworldPinnedTransportError): void => {
      if (settled) return;
      settled = true;
      reject(failure);
    };
    const options: RequestOptions = {
      method: "GET",
      agent: false,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        Authorization: request.authorization,
        Connection: "close"
      },
      lookup: (_hostname, _options, callback) => {
        if (_options.all === true) {
          callback(null, [{
            address: request.pinnedAddress.address,
            family: request.pinnedAddress.family
          }]);
          return;
        }
        callback(null, request.pinnedAddress.address, request.pinnedAddress.family);
      }
    };
    const requestFunction = request.url.protocol === "https:" ? httpsRequest : httpRequest;
    const clientRequest = requestFunction(request.url, options, (response) => {
      const contentLength = Number(response.headers["content-length"] ?? "");
      if (Number.isFinite(contentLength) && contentLength > request.maxResponseBytes) {
        response.destroy();
        finishReject(new PalworldPinnedTransportError("response_too_large"));
        return;
      }
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;
        if (receivedBytes > request.maxResponseBytes) {
          response.destroy();
          clientRequest.destroy();
          finishReject(new PalworldPinnedTransportError("response_too_large"));
          return;
        }
        chunks.push(buffer);
      });
      response.once("aborted", () => finishReject(new PalworldPinnedTransportError("connection_failed")));
      response.once("error", () => finishReject(new PalworldPinnedTransportError("connection_failed")));
      response.once("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks, receivedBytes)
        });
      });
    });

    const timeout = setTimeout(() => {
      clientRequest.destroy();
      finishReject(new PalworldPinnedTransportError("request_timeout"));
    }, request.timeoutMs);
    timeout.unref();
    clientRequest.once("error", (error: NodeJS.ErrnoException) => {
      finishReject(new PalworldPinnedTransportError(isTlsError(error) ? "tls_failed" : "connection_failed"));
    });
    clientRequest.once("close", () => clearTimeout(timeout));
    clientRequest.end();
  });
}

export class PalworldServerClient {
  readonly #allowedOrigins: ReadonlySet<string>;
  readonly #allowedCidrs: readonly ParsedCidr[];
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxUrlLength: number;
  readonly #resolveHostname: NonNullable<PalworldServerClientDependencies["resolveHostname"]>;
  readonly #requestPinned: NonNullable<PalworldServerClientDependencies["requestPinned"]>;
  readonly #now: NonNullable<PalworldServerClientDependencies["now"]>;
  readonly #monotonicNow: NonNullable<PalworldServerClientDependencies["monotonicNow"]>;
  readonly #setTimeoutFn: NonNullable<PalworldServerClientDependencies["setTimeoutFn"]>;
  readonly #clearTimeoutFn: NonNullable<PalworldServerClientDependencies["clearTimeoutFn"]>;

  constructor(config: PalworldServerClientConfig, dependencies: PalworldServerClientDependencies = {}) {
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    const maxUrlLength = config.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH;
    if (!isFiniteIntegerInRange(timeoutMs, 100, 30_000)) {
      throw new TypeError("Palworld REST timeout은 100~30000ms 범위여야 합니다.");
    }
    if (!isFiniteIntegerInRange(maxResponseBytes, 1_024, DEFAULT_MAX_RESPONSE_BYTES)) {
      throw new TypeError("Palworld REST 최대 응답 크기는 1024~65536바이트 범위여야 합니다.");
    }
    if (!isFiniteIntegerInRange(maxUrlLength, 128, DEFAULT_MAX_URL_LENGTH)) {
      throw new TypeError("Palworld REST URL 최대 길이는 128~2048자 범위여야 합니다.");
    }

    const allowedOrigins = config.allowedOrigins.map(normalizeConfiguredOrigin);
    if (allowedOrigins.some((origin) => origin === undefined)) {
      throw new TypeError("Palworld REST origin allowlist 설정이 올바르지 않습니다.");
    }
    const allowedCidrs = (config.allowedCidrs ?? []).map(parseCidr);
    if (allowedCidrs.some((cidr) => cidr === undefined)) {
      throw new TypeError("Palworld REST CIDR allowlist 설정이 올바르지 않습니다.");
    }

    this.#allowedOrigins = new Set(allowedOrigins as string[]);
    this.#allowedCidrs = allowedCidrs as ParsedCidr[];
    this.#timeoutMs = timeoutMs;
    this.#maxResponseBytes = maxResponseBytes;
    this.#maxUrlLength = maxUrlLength;
    this.#resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname;
    this.#requestPinned = dependencies.requestPinned ?? defaultRequestPinned;
    this.#now = dependencies.now ?? (() => new Date());
    this.#monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
    this.#setTimeoutFn = dependencies.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = dependencies.clearTimeoutFn ?? clearTimeout;
  }

  normalizeBaseUrl(input: string): string {
    const diagnostics = createDiagnostics();
    return this.#normalizeBaseUrl(input, diagnostics);
  }

  async probe(input: PalworldServerProbeInput): Promise<PalworldServerProbeResult> {
    const diagnostics = createDiagnostics();
    const start = this.#monotonicNow();
    const deadline = start + this.#timeoutMs;
    const checkedAt = this.#now().toISOString();
    const baseUrl = this.#normalizeBaseUrl(input.baseUrl, diagnostics);
    if (typeof input.adminPassword !== "string"
      || input.adminPassword.trim().length === 0
      || input.adminPassword.length > MAX_PASSWORD_LENGTH) {
      throw clientError("password_required", "basic_auth", diagnostics);
    }

    const target = await this.#prepareTarget(baseUrl, diagnostics, deadline);
    const authorization = `Basic ${Buffer.from(`admin:${input.adminPassword}`, "utf8").toString("base64")}`;
    const infoResponse = await this.#requestEndpoint(
      target,
      PALWORLD_INFO_PATH,
      authorization,
      "info",
      diagnostics,
      deadline,
      validatePalworldRestInfoResponse
    );
    const info: PalworldServerInfo = {
      serverName: infoResponse.servername,
      version: infoResponse.version
    };

    try {
      const metricsResponse = await this.#requestEndpoint(
        target,
        PALWORLD_METRICS_PATH,
        authorization,
        "metrics",
        diagnostics,
        deadline,
        validatePalworldRestMetricsResponse
      );
      const metrics: PalworldServerMetrics = {
        serverFps: metricsResponse.serverfps,
        currentPlayers: metricsResponse.currentplayernum,
        maxPlayers: metricsResponse.maxplayernum,
        frameTimeMs: metricsResponse.serverframetime,
        uptimeSeconds: metricsResponse.uptime,
        baseCampCount: metricsResponse.basecampnum,
        gameDays: metricsResponse.days
      };
      skipPendingDiagnostics(diagnostics);
      return {
        baseUrl,
        checkedAt,
        latencyMs: this.#elapsedMs(start),
        state: "online",
        info,
        metrics,
        diagnostics: copyDiagnostics(diagnostics)
      };
    } catch (error) {
      if (!(error instanceof PalworldServerClientError)) {
        throw clientError("internal_error", "metrics", diagnostics);
      }
      if (error.code === "auth_failed" || error.code === "tls_failed") throw error;
      return {
        baseUrl,
        checkedAt,
        latencyMs: this.#elapsedMs(start),
        state: "degraded",
        errorCode: error.code,
        info,
        diagnostics: copyDiagnostics(error.diagnostics)
      };
    }
  }

  #normalizeBaseUrl(input: string, diagnostics: PalworldServerDiagnostic[]): string {
    if (typeof input !== "string"
      || input.length === 0
      || input.length > this.#maxUrlLength
      || input !== input.trim()
      || /[\u0000-\u001f\u007f]/.test(input)) {
      throw clientError("invalid_url", "url_policy", diagnostics);
    }

    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      throw clientError("invalid_url", "url_policy", diagnostics);
    }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
      || parsed.username.length > 0
      || parsed.password.length > 0
      || parsed.pathname !== "/"
      || parsed.search.length > 0
      || parsed.hash.length > 0) {
      throw clientError("invalid_url", "url_policy", diagnostics);
    }

    const normalizedHostname = stripIpv6Brackets(parsed.hostname);
    const originalHostname = rawHostname(input);
    if (!originalHostname) throw clientError("invalid_url", "url_policy", diagnostics);
    if (isIP(normalizedHostname) === 4 && originalHostname.toLowerCase() !== normalizedHostname.toLowerCase()) {
      throw clientError("invalid_url", "url_policy", diagnostics);
    }
    if (!this.#allowedOrigins.has(parsed.origin)) {
      throw clientError("origin_not_allowed", "url_policy", diagnostics);
    }
    updateDiagnostic(diagnostics, "url_policy", "passed");
    return parsed.origin;
  }

  async #prepareTarget(
    baseUrl: string,
    diagnostics: PalworldServerDiagnostic[],
    deadline: number
  ): Promise<PreparedTarget> {
    const parsed = new URL(baseUrl);
    const hostname = stripIpv6Brackets(parsed.hostname);
    let resolved: readonly PalworldResolvedAddress[];
    try {
      resolved = await this.#runWithinDeadline(deadline, () => this.#resolveHostname(hostname));
    } catch (error) {
      if (error instanceof PalworldPinnedTransportError && error.code === "request_timeout") {
        throw clientError("request_timeout", "dns_tcp", diagnostics);
      }
      throw clientError("dns_failed", "dns_tcp", diagnostics);
    }
    if (resolved.length === 0 || resolved.length > MAX_DNS_ADDRESSES) {
      throw clientError("dns_failed", "dns_tcp", diagnostics);
    }

    const uniqueAddresses = new Map<string, PalworldResolvedAddress>();
    let allPrivate = true;
    for (const record of resolved) {
      const address = parseIpAddress(record.address);
      if (!address || address.family !== record.family) {
        throw clientError("dns_failed", "dns_tcp", diagnostics);
      }
      if (isAlwaysBlockedAddress(address)) {
        throw clientError("address_blocked", "dns_tcp", diagnostics);
      }
      const isPrivate = isPrivateAddress(address);
      allPrivate &&= isPrivate;
      if (isPrivate && !addressMatchesAnyCidr(address, this.#allowedCidrs)) {
        throw clientError("address_blocked", "dns_tcp", diagnostics);
      }
      uniqueAddresses.set(`${record.family}:${record.address}`, {
        address: record.address,
        family: record.family
      });
    }

    if (parsed.protocol === "http:" && !allPrivate) {
      throw clientError("address_blocked", "dns_tcp", diagnostics);
    }
    const pinnedAddress = uniqueAddresses.values().next().value as PalworldResolvedAddress | undefined;
    if (!pinnedAddress) throw clientError("dns_failed", "dns_tcp", diagnostics);
    if (this.#remainingMs(deadline) <= 0) {
      throw clientError("request_timeout", "dns_tcp", diagnostics);
    }
    return {
      baseUrl,
      protocol: parsed.protocol as "http:" | "https:",
      pinnedAddress
    };
  }

  async #requestEndpoint<T extends PalworldRestInfoResponse | PalworldRestMetricsResponse>(
    target: PreparedTarget,
    path: typeof PALWORLD_INFO_PATH | typeof PALWORLD_METRICS_PATH,
    authorization: string,
    stage: "info" | "metrics",
    diagnostics: PalworldServerDiagnostic[],
    deadline: number,
    validate: (value: unknown) => { ok: true; data: T } | { ok: false; error: string }
  ): Promise<T> {
    const url = new URL(path, `${target.baseUrl}/`);
    let response: PalworldPinnedResponse;
    try {
      response = await this.#runWithinDeadline(deadline, () => this.#requestPinned({
        url,
        pinnedAddress: target.pinnedAddress,
        timeoutMs: Math.max(1, Math.ceil(this.#remainingMs(deadline))),
        maxResponseBytes: this.#maxResponseBytes,
        authorization
      }));
    } catch (error) {
      const code = error instanceof PalworldPinnedTransportError ? error.code : "connection_failed";
      if (code === "tls_failed") {
        updateDiagnostic(diagnostics, "dns_tcp", "passed");
        updateDiagnostic(diagnostics, stage, "failed", code);
        throw clientError(code, "tls", diagnostics);
      }
      if (code === "connection_failed" || code === "request_timeout") {
        updateDiagnostic(diagnostics, stage, "failed", code);
        throw clientError(code, "dns_tcp", diagnostics);
      }
      throw clientError(code, stage, diagnostics);
    }

    updateDiagnostic(diagnostics, "dns_tcp", "passed");
    updateDiagnostic(diagnostics, "tls", target.protocol === "https:" ? "passed" : "skipped");
    if (response.body.length > this.#maxResponseBytes) {
      throw clientError("response_too_large", stage, diagnostics);
    }
    if (response.statusCode === 401) {
      updateDiagnostic(diagnostics, stage, "failed", "auth_failed");
      throw clientError("auth_failed", "basic_auth", diagnostics);
    }
    updateDiagnostic(diagnostics, "basic_auth", "passed");
    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw clientError("redirect_blocked", stage, diagnostics);
    }
    if (response.statusCode !== 200) {
      throw clientError("unexpected_status", stage, diagnostics);
    }
    if (!isJsonContentType(response.headers["content-type"])) {
      throw clientError("invalid_content_type", stage, diagnostics);
    }

    let value: unknown;
    try {
      const text = response.body.toString("utf8").replace(/^\uFEFF/, "");
      value = JSON.parse(text);
    } catch {
      updateDiagnostic(diagnostics, stage, "failed", "invalid_json");
      throw clientError("invalid_json", "schema", diagnostics);
    }
    const result = validate(value);
    if (!result.ok) {
      updateDiagnostic(diagnostics, stage, "failed", "invalid_schema");
      throw clientError("invalid_schema", "schema", diagnostics);
    }
    if (this.#remainingMs(deadline) <= 0) {
      updateDiagnostic(diagnostics, stage, "failed", "request_timeout");
      throw clientError("request_timeout", "dns_tcp", diagnostics);
    }
    updateDiagnostic(diagnostics, stage, "passed");
    updateDiagnostic(diagnostics, "schema", "passed");
    return result.data;
  }

  #elapsedMs(start: number): number {
    const elapsed = this.#monotonicNow() - start;
    return Math.max(0, Math.round(elapsed * 100) / 100);
  }

  #remainingMs(deadline: number): number {
    const remaining = deadline - this.#monotonicNow();
    return Number.isFinite(remaining) ? remaining : 0;
  }

  #runWithinDeadline<T>(deadline: number, operation: () => Promise<T>): Promise<T> {
    const remaining = this.#remainingMs(deadline);
    if (remaining <= 0) return Promise.reject(new PalworldPinnedTransportError("request_timeout"));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = this.#setTimeoutFn(() => {
        if (settled) return;
        settled = true;
        reject(new PalworldPinnedTransportError("request_timeout"));
      }, Math.max(1, Math.ceil(remaining)));
      timer.unref();

      let pending: Promise<T>;
      try {
        pending = operation();
      } catch (error) {
        settled = true;
        this.#clearTimeoutFn(timer);
        reject(error);
        return;
      }
      pending.then(
        (value) => {
          if (settled) return;
          settled = true;
          this.#clearTimeoutFn(timer);
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          this.#clearTimeoutFn(timer);
          reject(error);
        }
      );
    });
  }
}
