import crypto from "node:crypto";
import {
  PALWORLD_SERVER_DIAGNOSTIC_KEYS,
  PALWORLD_SERVER_DIAGNOSTIC_STATES,
  PALWORLD_SERVER_ERROR_CODES,
  PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
  validatePalworldServerConnectionInput,
  validatePalworldServerStatus,
  type PalworldServerConnectionInput,
  type PalworldServerConnectionSummary,
  type PalworldServerDashboardResponse,
  type PalworldServerDiagnostic,
  type PalworldServerDiagnosticKey,
  type PalworldServerErrorCode,
  type PalworldServerInfo,
  type PalworldServerMetrics,
  type PalworldServerRegistrationPolicy,
  type PalworldServerStatus,
  type PalworldServerTestResponse
} from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type {
  PalworldServerConnectionStore,
  StoredPalworldServerConnection
} from "./palworld-server-connection-store.js";

export type PalworldServerClientProbeResult = {
  baseUrl: string;
  checkedAt: string;
  latencyMs: number;
  info: PalworldServerInfo;
  metrics?: PalworldServerMetrics;
  state: "online" | "degraded";
  errorCode?: PalworldServerErrorCode;
  diagnostics: PalworldServerDiagnostic[];
};

export type PalworldServerMonitorClient = {
  normalizeBaseUrl(input: string): string;
  probe(input: {
    baseUrl: string;
    adminPassword: string;
  }): Promise<PalworldServerClientProbeResult>;
};

export type PalworldServerMonitorStore = Pick<
  PalworldServerConnectionStore,
  "get" | "listOwnerIds" | "set" | "remove"
>;

export type PalworldServerMonitorOptions = {
  store: PalworldServerMonitorStore;
  client: PalworldServerMonitorClient;
  enabled?: boolean;
  pollIntervalMs?: number;
  manualRefreshCooldownMs?: number;
  candidateProbeLimit?: number;
  candidateProbeWindowMs?: number;
  candidateProbeConcurrencyLimit?: number;
  registrationPolicy?: PalworldServerRegistrationPolicy;
  maxBackoffMs?: number;
  staleAfterMs?: number;
  jitterRatio?: number;
  logger?: Pick<JsonlLogger, "event" | "error">;
  now?: () => number;
  random?: () => number;
  setTimeoutFn?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
};

type InFlightProbe = {
  fingerprint: string;
  ownerEpoch: number;
  updatesCache: boolean;
  promise: Promise<PalworldServerStatus>;
};

type ProbeOptions = {
  updateCache: boolean;
  candidate?: boolean;
  previousStatus?: PalworldServerStatus;
};

type ClientErrorShape = {
  code?: unknown;
  stage?: unknown;
  diagnostics?: unknown;
};

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_MANUAL_REFRESH_COOLDOWN_MS = 10_000;
const DEFAULT_CANDIDATE_PROBE_LIMIT = 5;
const DEFAULT_CANDIDATE_PROBE_WINDOW_MS = 60_000;
const DEFAULT_CANDIDATE_PROBE_CONCURRENCY_LIMIT = 8;
const DEFAULT_MAX_BACKOFF_MS = 5 * 60_000;
const DEFAULT_JITTER_RATIO = 0.1;
const MAX_OWNER_ID_LENGTH = 128;

export class PalworldServerMonitorRateLimitError extends Error {
  readonly name = "PalworldServerMonitorRateLimitError";

  constructor(public readonly retryAfterSeconds: number) {
    super("Palworld 서버 상태 확인 요청이 너무 많습니다.");
  }
}

export class PalworldServerMonitorInputError extends Error {
  readonly name = "PalworldServerMonitorInputError";

  constructor(
    public readonly code: PalworldServerErrorCode,
    public readonly publicMessage: string
  ) {
    super(publicMessage);
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizedOwnerId(value: string): string {
  const ownerId = typeof value === "string" ? value.trim() : "";
  if (!ownerId || ownerId.length > MAX_OWNER_ID_LENGTH) {
    throw new PalworldServerMonitorInputError("invalid_request", "인증된 스트리머 정보가 올바르지 않습니다.");
  }
  return ownerId;
}

function cloneDiagnostics(diagnostics: PalworldServerDiagnostic[]): PalworldServerDiagnostic[] {
  return diagnostics.map((entry) => ({ ...entry }));
}

function cloneStatus(status: PalworldServerStatus): PalworldServerStatus {
  return {
    state: status.state,
    ...(status.errorCode === undefined ? {} : { errorCode: status.errorCode }),
    ...(status.checkedAt === undefined ? {} : { checkedAt: status.checkedAt }),
    ...(status.lastSuccessAt === undefined ? {} : { lastSuccessAt: status.lastSuccessAt }),
    ...(status.latencyMs === undefined ? {} : { latencyMs: status.latencyMs }),
    consecutiveFailures: status.consecutiveFailures,
    ...(status.info === undefined ? {} : { info: { ...status.info } }),
    ...(status.metrics === undefined ? {} : { metrics: { ...status.metrics } }),
    diagnostics: cloneDiagnostics(status.diagnostics)
  };
}

function pendingDiagnostics(state: "pending" | "skipped"): PalworldServerDiagnostic[] {
  return PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state }));
}

function errorCodeFrom(error: unknown): PalworldServerErrorCode {
  if (!error || typeof error !== "object" || Array.isArray(error)) return "internal_error";
  const code = (error as ClientErrorShape).code;
  return typeof code === "string" && (PALWORLD_SERVER_ERROR_CODES as readonly string[]).includes(code)
    ? code as PalworldServerErrorCode
    : "internal_error";
}

function diagnosticKeyFrom(value: unknown): PalworldServerDiagnosticKey | undefined {
  return typeof value === "string" && (PALWORLD_SERVER_DIAGNOSTIC_KEYS as readonly string[]).includes(value)
    ? value as PalworldServerDiagnosticKey
    : undefined;
}

function fallbackDiagnosticKey(errorCode: PalworldServerErrorCode): PalworldServerDiagnosticKey {
  if (["disabled", "invalid_request", "invalid_url", "origin_not_allowed", "address_blocked"].includes(errorCode)) {
    return "url_policy";
  }
  if (["dns_failed", "connection_failed", "request_timeout"].includes(errorCode)) return "dns_tcp";
  if (errorCode === "tls_failed") return "tls";
  if (errorCode === "auth_failed") return "basic_auth";
  if (errorCode === "invalid_schema") return "schema";
  return "info";
}

function fallbackDiagnostics(errorCode: PalworldServerErrorCode, stage?: unknown): PalworldServerDiagnostic[] {
  const failedKey = diagnosticKeyFrom(stage) ?? fallbackDiagnosticKey(errorCode);
  const failedIndex = PALWORLD_SERVER_DIAGNOSTIC_KEYS.indexOf(failedKey);
  return PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key, index) => ({
    key,
    state: index < failedIndex ? "passed" : index === failedIndex ? "failed" : "skipped",
    ...(index === failedIndex ? { errorCode } : {})
  }));
}

function sanitizedDiagnostics(value: unknown, errorCode?: PalworldServerErrorCode, stage?: unknown): PalworldServerDiagnostic[] {
  if (!Array.isArray(value) || value.length !== PALWORLD_SERVER_DIAGNOSTIC_KEYS.length) {
    return errorCode ? fallbackDiagnostics(errorCode, stage) : pendingDiagnostics("pending");
  }
  const seen = new Set<PalworldServerDiagnosticKey>();
  const result: PalworldServerDiagnostic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return errorCode ? fallbackDiagnostics(errorCode, stage) : pendingDiagnostics("pending");
    }
    const record = entry as Record<string, unknown>;
    if (!Object.keys(record).every((key) => ["key", "state", "errorCode"].includes(key))) {
      return errorCode ? fallbackDiagnostics(errorCode, stage) : pendingDiagnostics("pending");
    }
    const key = diagnosticKeyFrom(record.key);
    const state = typeof record.state === "string"
      && (PALWORLD_SERVER_DIAGNOSTIC_STATES as readonly string[]).includes(record.state)
      ? record.state as PalworldServerDiagnostic["state"]
      : undefined;
    const entryErrorCode = record.errorCode === undefined
      ? undefined
      : typeof record.errorCode === "string"
        && (PALWORLD_SERVER_ERROR_CODES as readonly string[]).includes(record.errorCode)
        ? record.errorCode as PalworldServerErrorCode
        : null;
    if (!key || !state || entryErrorCode === null || seen.has(key)) {
      return errorCode ? fallbackDiagnostics(errorCode, stage) : pendingDiagnostics("pending");
    }
    seen.add(key);
    result.push({ key, state, ...(entryErrorCode === undefined ? {} : { errorCode: entryErrorCode }) });
  }
  return seen.size === PALWORLD_SERVER_DIAGNOSTIC_KEYS.length
    ? result
    : errorCode
      ? fallbackDiagnostics(errorCode, stage)
      : pendingDiagnostics("pending");
}

function mappedFailureState(
  errorCode: PalworldServerErrorCode,
  consecutiveFailures: number
): PalworldServerStatus["state"] {
  if (["invalid_request", "invalid_url", "origin_not_allowed", "address_blocked", "disabled"].includes(errorCode)) {
    return "blocked_by_policy";
  }
  if (errorCode === "auth_failed") return "auth_failed";
  if (errorCode === "tls_failed") return "tls_failed";
  if (["dns_failed", "connection_failed", "request_timeout"].includes(errorCode)) {
    return consecutiveFailures >= 3 ? "unreachable" : "degraded";
  }
  return "invalid_response";
}

function candidateFingerprint(baseUrl: string, adminPassword: string): string {
  return crypto.createHash("sha256").update(baseUrl).update("\0").update(adminPassword).digest("hex");
}

export class PalworldServerMonitor {
  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly manualRefreshCooldownMs: number;
  private readonly candidateProbeLimit: number;
  private readonly candidateProbeWindowMs: number;
  private readonly candidateProbeConcurrencyLimit: number;
  private readonly registrationPolicy: PalworldServerRegistrationPolicy;
  private readonly maxBackoffMs: number;
  private readonly staleAfterMs: number;
  private readonly jitterRatio: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly setTimeoutFn: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimeoutFn: (handle: ReturnType<typeof setTimeout>) => void;
  private readonly cache = new Map<string, PalworldServerStatus>();
  private readonly inFlight = new Map<string, InFlightProbe>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastManualRefreshAt = new Map<string, number>();
  private readonly candidateProbeTimestamps = new Map<string, number[]>();
  private readonly ownerEpochs = new Map<string, number>();
  private activeCandidateProbes = 0;
  private running = false;

  constructor(private readonly options: PalworldServerMonitorOptions) {
    this.enabled = options.enabled ?? true;
    this.pollIntervalMs = positiveInteger(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
    this.manualRefreshCooldownMs = positiveInteger(
      options.manualRefreshCooldownMs,
      DEFAULT_MANUAL_REFRESH_COOLDOWN_MS
    );
    this.candidateProbeLimit = positiveInteger(options.candidateProbeLimit, DEFAULT_CANDIDATE_PROBE_LIMIT);
    this.candidateProbeWindowMs = positiveInteger(
      options.candidateProbeWindowMs,
      DEFAULT_CANDIDATE_PROBE_WINDOW_MS
    );
    this.candidateProbeConcurrencyLimit = positiveInteger(
      options.candidateProbeConcurrencyLimit,
      DEFAULT_CANDIDATE_PROBE_CONCURRENCY_LIMIT
    );
    this.registrationPolicy = {
      ...(options.registrationPolicy ?? PALWORLD_SERVER_SAFE_REGISTRATION_POLICY)
    };
    this.maxBackoffMs = Math.max(
      this.pollIntervalMs,
      positiveInteger(options.maxBackoffMs, DEFAULT_MAX_BACKOFF_MS)
    );
    this.staleAfterMs = positiveInteger(
      options.staleAfterMs,
      Math.max(this.pollIntervalMs * 3, 90_000)
    );
    this.jitterRatio = typeof options.jitterRatio === "number" && Number.isFinite(options.jitterRatio)
      ? Math.min(0.5, Math.max(0, options.jitterRatio))
      : DEFAULT_JITTER_RATIO;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  private connectionSummary(connection?: StoredPalworldServerConnection): PalworldServerConnectionSummary {
    return connection
      ? {
          configured: true,
          baseUrl: connection.baseUrl,
          passwordConfigured: true,
          updatedAt: connection.updatedAt
        }
      : {
          configured: false,
          passwordConfigured: false
        };
  }

  private candidateSummary(
    baseUrl: string,
    existing: StoredPalworldServerConnection | undefined
  ): PalworldServerConnectionSummary {
    let matchesStoredConnection = false;
    if (existing) {
      try {
        matchesStoredConnection = this.options.client.normalizeBaseUrl(existing.baseUrl) === baseUrl;
      } catch {
        matchesStoredConnection = false;
      }
    }
    return matchesStoredConnection && existing
      ? this.connectionSummary(existing)
      : {
          configured: false,
          baseUrl,
          passwordConfigured: true
        };
  }

  private defaultStatus(kind: "disabled" | "not_configured" | "checking"): PalworldServerStatus {
    if (kind === "disabled") {
      return {
        state: "not_configured",
        errorCode: "disabled",
        consecutiveFailures: 0,
        diagnostics: pendingDiagnostics("skipped")
      };
    }
    if (kind === "not_configured") {
      return {
        state: "not_configured",
        errorCode: "not_configured",
        consecutiveFailures: 0,
        diagnostics: pendingDiagnostics("skipped")
      };
    }
    return {
      state: "checking",
      consecutiveFailures: 0,
      diagnostics: pendingDiagnostics("pending")
    };
  }

  private currentStatus(ownerId: string, connection?: StoredPalworldServerConnection): PalworldServerStatus {
    if (!this.enabled) return this.defaultStatus("disabled");
    if (!connection) return this.defaultStatus("not_configured");
    const cached = this.cache.get(ownerId);
    if (!cached) return this.defaultStatus("checking");
    const result = cloneStatus(cached);
    if ((result.state === "online" || result.state === "degraded") && result.checkedAt !== undefined) {
      const checkedAt = Date.parse(result.checkedAt);
      if (Number.isFinite(checkedAt) && this.now() - checkedAt > this.staleAfterMs) {
        result.state = "stale";
      }
    }
    return result;
  }

  getDashboardResponse(ownerIdInput: string): PalworldServerDashboardResponse {
    const ownerId = normalizedOwnerId(ownerIdInput);
    const connection = this.options.store.get(ownerId);
    return {
      enabled: this.enabled,
      pollIntervalSeconds: Math.max(5, Math.round(this.pollIntervalMs / 1_000)),
      registrationPolicy: { ...this.registrationPolicy },
      connection: this.connectionSummary(connection),
      status: this.currentStatus(ownerId, connection)
    };
  }

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new PalworldServerMonitorInputError("disabled", "Palworld 서버 상태 기능이 비활성화되어 있습니다.");
    }
  }

  private consumeCandidateProbe(ownerId: string): void {
    const now = this.now();
    const cutoff = now - this.candidateProbeWindowMs;
    const recent = (this.candidateProbeTimestamps.get(ownerId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.candidateProbeLimit) {
      const retryAt = (recent[0] ?? now) + this.candidateProbeWindowMs;
      throw new PalworldServerMonitorRateLimitError(Math.max(1, Math.ceil((retryAt - now) / 1_000)));
    }
    recent.push(now);
    this.candidateProbeTimestamps.set(ownerId, recent);
  }

  private consumeManualRefresh(ownerId: string): void {
    const now = this.now();
    const previous = this.lastManualRefreshAt.get(ownerId);
    if (previous !== undefined && now - previous < this.manualRefreshCooldownMs) {
      throw new PalworldServerMonitorRateLimitError(
        Math.max(1, Math.ceil((previous + this.manualRefreshCooldownMs - now) / 1_000))
      );
    }
    this.lastManualRefreshAt.set(ownerId, now);
  }

  private resolveCandidate(
    ownerId: string,
    input: PalworldServerConnectionInput
  ): {
    baseUrl: string;
    adminPassword: string;
    existing?: StoredPalworldServerConnection;
  } {
    const validation = validatePalworldServerConnectionInput(input);
    if (!validation.ok) {
      const code: PalworldServerErrorCode = validation.error.includes("adminPassword")
        ? "password_required"
        : "invalid_url";
      throw new PalworldServerMonitorInputError(code, "Palworld 서버 연결 입력이 올바르지 않습니다.");
    }
    let baseUrl: string;
    try {
      baseUrl = this.options.client.normalizeBaseUrl(validation.data.baseUrl);
    } catch (error) {
      const code = errorCodeFrom(error);
      const safeCode = ["origin_not_allowed", "address_blocked", "invalid_url"].includes(code)
        ? code
        : "invalid_url";
      throw new PalworldServerMonitorInputError(
        safeCode,
        "허용된 Palworld REST API URL을 입력해야 합니다."
      );
    }
    const existing = this.options.store.get(ownerId);
    let adminPassword = validation.data.adminPassword;
    if (adminPassword === undefined) {
      let sameBaseUrl = false;
      if (existing) {
        try {
          sameBaseUrl = this.options.client.normalizeBaseUrl(existing.baseUrl) === baseUrl;
        } catch {
          sameBaseUrl = false;
        }
      }
      if (!existing || !sameBaseUrl) {
        throw new PalworldServerMonitorInputError(
          "password_required",
          "새 Palworld 서버 URL에는 AdminPassword가 필요합니다."
        );
      }
      adminPassword = existing.adminPassword;
    }
    return { baseUrl, adminPassword, ...(existing === undefined ? {} : { existing }) };
  }

  private checkingStatus(previous?: PalworldServerStatus): PalworldServerStatus {
    return {
      state: "checking",
      ...(previous?.checkedAt === undefined ? {} : { checkedAt: previous.checkedAt }),
      ...(previous?.lastSuccessAt === undefined ? {} : { lastSuccessAt: previous.lastSuccessAt }),
      ...(previous?.latencyMs === undefined ? {} : { latencyMs: previous.latencyMs }),
      consecutiveFailures: previous?.consecutiveFailures ?? 0,
      ...(previous?.info === undefined ? {} : { info: { ...previous.info } }),
      ...(previous?.metrics === undefined ? {} : { metrics: { ...previous.metrics } }),
      diagnostics: pendingDiagnostics("pending")
    };
  }

  private logStatusTransition(
    ownerId: string,
    previous: PalworldServerStatus | undefined,
    status: PalworldServerStatus
  ): void {
    if (previous?.state === status.state && previous.errorCode === status.errorCode) return;
    this.options.logger?.event({
      type: "palworld_server.status_changed",
      ownerId,
      previousState: previous?.state,
      state: status.state,
      errorCode: status.errorCode,
      checkedAt: status.checkedAt
    });
  }

  private commitStatus(
    ownerId: string,
    status: PalworldServerStatus,
    previous?: PalworldServerStatus
  ): PalworldServerStatus {
    const cloned = cloneStatus(status);
    this.cache.set(ownerId, cloned);
    this.logStatusTransition(ownerId, previous, cloned);
    return cloneStatus(cloned);
  }

  private failureStatus(error: unknown, previous?: PalworldServerStatus): PalworldServerStatus {
    const errorCode = errorCodeFrom(error);
    const consecutiveFailures = Math.min(1_000_000, (previous?.consecutiveFailures ?? 0) + 1);
    const shape = error && typeof error === "object" && !Array.isArray(error)
      ? error as ClientErrorShape
      : undefined;
    return {
      state: mappedFailureState(errorCode, consecutiveFailures),
      errorCode,
      checkedAt: new Date(this.now()).toISOString(),
      ...(previous?.lastSuccessAt === undefined ? {} : { lastSuccessAt: previous.lastSuccessAt }),
      consecutiveFailures,
      ...(previous?.info === undefined ? {} : { info: { ...previous.info } }),
      ...(previous?.metrics === undefined ? {} : { metrics: { ...previous.metrics } }),
      diagnostics: sanitizedDiagnostics(shape?.diagnostics, errorCode, shape?.stage)
    };
  }

  private statusFromProbe(
    result: PalworldServerClientProbeResult,
    previous?: PalworldServerStatus
  ): PalworldServerStatus {
    const checkedAt = typeof result.checkedAt === "string" && Number.isFinite(Date.parse(result.checkedAt))
      ? result.checkedAt
      : new Date(this.now()).toISOString();
    const consecutiveFailures = result.state === "online"
      ? 0
      : Math.min(1_000_000, (previous?.consecutiveFailures ?? 0) + 1);
    const status: PalworldServerStatus = {
      state: result.state,
      ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
      checkedAt,
      ...(result.state === "online"
        ? { lastSuccessAt: checkedAt }
        : previous?.lastSuccessAt === undefined
          ? {}
          : { lastSuccessAt: previous.lastSuccessAt }),
      latencyMs: result.latencyMs,
      consecutiveFailures,
      info: { ...result.info },
      ...(result.metrics === undefined
        ? previous?.metrics === undefined
          ? {}
          : { metrics: { ...previous.metrics } }
        : { metrics: { ...result.metrics } }),
      diagnostics: sanitizedDiagnostics(result.diagnostics, result.errorCode)
    };
    const validation = validatePalworldServerStatus(status);
    return validation.ok ? validation.data : this.failureStatus({ code: "invalid_schema", stage: "schema" }, previous);
  }

  private probeConnection(
    ownerId: string,
    credentials: { baseUrl: string; adminPassword: string },
    probeOptions: ProbeOptions
  ): Promise<PalworldServerStatus> {
    const fingerprint = candidateFingerprint(credentials.baseUrl, credentials.adminPassword);
    const existing = this.inFlight.get(ownerId);
    if (existing) {
      if (existing.fingerprint === fingerprint) {
        return existing.promise.then((status) => {
          if (
            probeOptions.updateCache
            && !existing.updatesCache
            && existing.ownerEpoch === (this.ownerEpochs.get(ownerId) ?? 0)
            && this.options.store.get(ownerId) !== undefined
          ) {
            const previous = this.cache.get(ownerId);
            return this.commitStatus(ownerId, status, previous);
          }
          return cloneStatus(status);
        });
      }
      if (!probeOptions.candidate) {
        return existing.promise.then(
          () => this.probeConnection(ownerId, credentials, probeOptions),
          () => this.probeConnection(ownerId, credentials, probeOptions)
        );
      }
      return Promise.reject(new PalworldServerMonitorRateLimitError(1));
    }

    const previous = probeOptions.previousStatus ?? this.cache.get(ownerId);
    const ownerEpoch = this.ownerEpochs.get(ownerId) ?? 0;
    const usesCandidateSlot = probeOptions.candidate === true;
    if (usesCandidateSlot && this.activeCandidateProbes >= this.candidateProbeConcurrencyLimit) {
      return Promise.reject(new PalworldServerMonitorRateLimitError(1));
    }
    if (usesCandidateSlot) this.activeCandidateProbes += 1;
    if (probeOptions.updateCache) this.cache.set(ownerId, this.checkingStatus(previous));
    let clientProbe: Promise<PalworldServerClientProbeResult>;
    try {
      clientProbe = this.options.client.probe(credentials);
    } catch (error) {
      clientProbe = Promise.reject(error);
    }
    const promise = clientProbe
      .then((result) => this.statusFromProbe(result, previous))
      .catch((error: unknown) => this.failureStatus(error, previous))
      .then((status) => probeOptions.updateCache
        && ownerEpoch === (this.ownerEpochs.get(ownerId) ?? 0)
        && this.options.store.get(ownerId) !== undefined
        ? this.commitStatus(ownerId, status, previous)
        : cloneStatus(status))
      .finally(() => {
        if (usesCandidateSlot) this.activeCandidateProbes -= 1;
        const current = this.inFlight.get(ownerId);
        if (current?.promise === promise) this.inFlight.delete(ownerId);
      });
    this.inFlight.set(ownerId, {
      fingerprint,
      ownerEpoch,
      updatesCache: probeOptions.updateCache,
      promise
    });
    return promise;
  }

  async testConnection(
    ownerIdInput: string,
    input: PalworldServerConnectionInput
  ): Promise<PalworldServerTestResponse> {
    const ownerId = normalizedOwnerId(ownerIdInput);
    this.ensureEnabled();
    this.consumeCandidateProbe(ownerId);
    const candidate = this.resolveCandidate(ownerId, input);
    const previous = candidate.existing
      && this.options.client.normalizeBaseUrl(candidate.existing.baseUrl) === candidate.baseUrl
      ? this.cache.get(ownerId)
      : undefined;
    const status = await this.probeConnection(ownerId, candidate, {
      updateCache: false,
      candidate: true,
      ...(previous === undefined ? {} : { previousStatus: previous })
    });
    return {
      connection: this.candidateSummary(candidate.baseUrl, candidate.existing),
      status
    };
  }

  async saveConnection(
    ownerIdInput: string,
    input: PalworldServerConnectionInput
  ): Promise<PalworldServerDashboardResponse> {
    const ownerId = normalizedOwnerId(ownerIdInput);
    this.ensureEnabled();
    this.consumeCandidateProbe(ownerId);
    const ownerEpoch = this.ownerEpochs.get(ownerId) ?? 0;
    const candidate = this.resolveCandidate(ownerId, input);
    const previous = candidate.existing
      && this.options.client.normalizeBaseUrl(candidate.existing.baseUrl) === candidate.baseUrl
      ? this.cache.get(ownerId)
      : undefined;
    const status = await this.probeConnection(ownerId, candidate, {
      updateCache: false,
      candidate: true,
      ...(previous === undefined ? {} : { previousStatus: previous })
    });
    if (ownerEpoch !== (this.ownerEpochs.get(ownerId) ?? 0)) {
      return this.getDashboardResponse(ownerId);
    }
    if (status.state !== "online") {
      this.options.logger?.event({
        type: "palworld_server.connection_save_rejected",
        ownerId,
        state: status.state,
        errorCode: status.errorCode,
        checkedAt: status.checkedAt
      });
      return {
        enabled: true,
        pollIntervalSeconds: Math.max(5, Math.round(this.pollIntervalMs / 1_000)),
        registrationPolicy: { ...this.registrationPolicy },
        connection: this.connectionSummary(candidate.existing),
        status
      };
    }
    let saved: StoredPalworldServerConnection;
    try {
      saved = await this.options.store.set({
        ownerId,
        baseUrl: candidate.baseUrl,
        adminPassword: candidate.adminPassword
      });
    } catch {
      this.options.logger?.error({
        type: "palworld_server.connection_save_failed",
        ownerId,
        errorCode: "internal_error"
      });
      throw new Error("Palworld 서버 연결 설정을 저장할 수 없습니다.");
    }
    this.commitStatus(ownerId, status, this.cache.get(ownerId));
    this.options.logger?.event({
      type: "palworld_server.connection_saved",
      ownerId,
      checkedAt: status.checkedAt
    });
    if (this.running) this.schedule(ownerId, status);
    return {
      enabled: true,
      pollIntervalSeconds: Math.max(5, Math.round(this.pollIntervalMs / 1_000)),
      registrationPolicy: { ...this.registrationPolicy },
      connection: this.connectionSummary(saved),
      status: cloneStatus(status)
    };
  }

  async refresh(ownerIdInput: string): Promise<PalworldServerDashboardResponse> {
    const ownerId = normalizedOwnerId(ownerIdInput);
    if (!this.enabled) return this.getDashboardResponse(ownerId);
    const connection = this.options.store.get(ownerId);
    if (!connection) return this.getDashboardResponse(ownerId);
    this.consumeManualRefresh(ownerId);
    const status = await this.probeConnection(ownerId, connection, { updateCache: true });
    if (this.running) this.schedule(ownerId, status);
    return this.getDashboardResponse(ownerId);
  }

  async removeConnection(ownerIdInput: string): Promise<PalworldServerDashboardResponse> {
    const ownerId = normalizedOwnerId(ownerIdInput);
    this.ownerEpochs.set(ownerId, (this.ownerEpochs.get(ownerId) ?? 0) + 1);
    const timer = this.timers.get(ownerId);
    if (timer !== undefined) this.clearTimeoutFn(timer);
    this.timers.delete(ownerId);
    await this.options.store.remove(ownerId);
    this.cache.delete(ownerId);
    this.lastManualRefreshAt.delete(ownerId);
    this.options.logger?.event({
      type: "palworld_server.connection_removed",
      ownerId
    });
    return this.getDashboardResponse(ownerId);
  }

  private jitteredDelay(baseDelayMs: number): number {
    const random = Math.min(1, Math.max(0, this.random()));
    const factor = 1 - this.jitterRatio + (2 * this.jitterRatio * random);
    return Math.max(1, Math.min(this.maxBackoffMs, Math.round(baseDelayMs * factor)));
  }

  private nextDelay(status?: PalworldServerStatus): number {
    const failures = status?.consecutiveFailures ?? 0;
    const exponent = Math.min(20, failures);
    const baseDelay = failures > 0
      ? Math.min(this.maxBackoffMs, this.pollIntervalMs * (2 ** exponent))
      : this.pollIntervalMs;
    return this.jitteredDelay(baseDelay);
  }

  private schedule(ownerId: string, status?: PalworldServerStatus): void {
    const existing = this.timers.get(ownerId);
    if (existing) this.clearTimeoutFn(existing);
    if (!this.running || !this.enabled || !this.options.store.get(ownerId)) {
      this.timers.delete(ownerId);
      return;
    }
    const timer = this.setTimeoutFn(() => {
      this.timers.delete(ownerId);
      const connection = this.options.store.get(ownerId);
      if (!this.running || !connection) return;
      void this.probeConnection(ownerId, connection, { updateCache: true })
        .then((nextStatus) => {
          if (this.running) this.schedule(ownerId, nextStatus);
        });
    }, this.nextDelay(status));
    const timerWithUnref = timer as ReturnType<typeof setTimeout> & { unref?: () => void };
    timerWithUnref.unref?.();
    this.timers.set(ownerId, timer);
  }

  start(): void {
    if (this.running || !this.enabled) return;
    this.running = true;
    for (const ownerId of this.options.store.listOwnerIds()) {
      this.schedule(ownerId, this.cache.get(ownerId));
    }
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) this.clearTimeoutFn(timer);
    this.timers.clear();
  }
}
