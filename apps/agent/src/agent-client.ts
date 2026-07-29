import crypto from "node:crypto";
import {
  parseAgentIngestionResponse,
  parseAgentRegistrationResponse,
  parsePalworldAgentStatusPayload,
  YORO_AGENT_PAYLOAD_VERSION,
  type AgentIngestionResponse,
  type AgentRegistrationResponse,
  type PalworldAgentStatusPayload
} from "@streamops/shared";
import type { AgentCredentialRecord } from "./credential-store.js";
import { retryDelay, waitForRetry } from "./retry-policy.js";

const MAX_RESPONSE_BYTES = 16 * 1_024;

export type AgentClientErrorCode =
  | "registration_rejected"
  | "credential_rejected"
  | "payload_conflict"
  | "rate_limited"
  | "server_unavailable"
  | "network_error"
  | "request_timeout"
  | "redirect_blocked"
  | "invalid_response"
  | "payload_invalid";

export class AgentClientError extends Error {
  constructor(
    readonly code: AgentClientErrorCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number
  ) {
    super(code);
    this.name = "AgentClientError";
  }
}

type FetchLike = typeof fetch;

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw new AgentClientError("invalid_response", false);
  }
  const contentLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new AgentClientError("invalid_response", false);
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new AgentClientError("invalid_response", false);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AgentClientError("invalid_response", false);
  }
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(0, seconds * 1_000), 60_000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.min(Math.max(0, at - Date.now()), 60_000) : undefined;
}

function statusError(response: Response, registration: boolean): AgentClientError {
  if (response.status === 401 || response.status === 403) {
    return new AgentClientError(
      registration ? "registration_rejected" : "credential_rejected",
      false
    );
  }
  if (response.status === 409) return new AgentClientError("payload_conflict", false);
  if (response.status === 429) {
    return new AgentClientError("rate_limited", true, retryAfter(response));
  }
  if (response.status >= 500) return new AgentClientError("server_unavailable", true);
  return new AgentClientError(registration ? "registration_rejected" : "invalid_response", false);
}

export class AgentClient {
  constructor(
    private readonly input: Readonly<{
      serverOrigin: string;
      timeoutMs: number;
      maximumRetryAttempts: number;
      agentVersion?: string;
    }>,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async register(
    bootstrapToken: string,
    signal: AbortSignal,
    random: () => number = Math.random
  ): Promise<AgentRegistrationResponse> {
    const architecture = process.arch === "arm64" ? "arm64" : "x64";
    const body = JSON.stringify({
      bootstrapToken,
      agentVersion: this.input.agentVersion ?? process.env.APP_VERSION ?? "0.1.0-dev",
      platform: "linux",
      architecture
    });
    return this.withRetry(async (attemptSignal) => {
      const response = await this.request(
        new URL("/api/agent/v1/register", this.input.serverOrigin),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          redirect: "manual",
          signal: attemptSignal
        }
      );
      if (response.status >= 300 && response.status < 400) {
        throw new AgentClientError("redirect_blocked", false);
      }
      if (response.status !== 201) throw statusError(response, true);
      const parsed = parseAgentRegistrationResponse(
        await readJsonResponse(response),
        this.input.serverOrigin
      );
      if (!parsed) throw new AgentClientError("invalid_response", false);
      return parsed;
    }, signal, random);
  }

  async sendStatus(
    credential: AgentCredentialRecord,
    payloadInput: PalworldAgentStatusPayload,
    signal: AbortSignal,
    random: () => number = Math.random
  ): Promise<AgentIngestionResponse> {
    const payload = parsePalworldAgentStatusPayload(payloadInput);
    if (!payload) throw new AgentClientError("payload_invalid", false);
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body, "utf8") > 16 * 1_024) {
      throw new AgentClientError("payload_invalid", false);
    }
    return this.withRetry(async (attemptSignal) => {
      const timestamp = Math.floor(Date.now() / 1_000);
      const nonce = crypto.randomBytes(24).toString("base64url");
      const response = await this.request(new URL(credential.ingestionEndpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credential.agentToken}`,
          "X-Yoro-Agent-Timestamp": String(timestamp),
          "X-Yoro-Agent-Nonce": nonce,
          "X-Yoro-Payload-Version": String(YORO_AGENT_PAYLOAD_VERSION)
        },
        body,
        redirect: "manual",
        signal: attemptSignal
      });
      if (response.status >= 300 && response.status < 400) {
        throw new AgentClientError("redirect_blocked", false);
      }
      if (response.status !== 202) throw statusError(response, false);
      const parsed = parseAgentIngestionResponse(await readJsonResponse(response));
      if (!parsed) throw new AgentClientError("invalid_response", false);
      return parsed;
    }, signal, random);
  }

  private async withRetry<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    random: () => number
  ): Promise<T> {
    let attempt = 1;
    while (true) {
      try {
        return await operation(signal);
      } catch (error) {
        if (signal.aborted) throw error;
        const safe = error instanceof AgentClientError
          ? error
          : new AgentClientError("network_error", true);
        const decision = retryDelay({
          attempt,
          maximumAttempts: this.input.maximumRetryAttempts,
          retryable: safe.retryable,
          ...(safe.retryAfterMs === undefined ? {} : { retryAfterMs: safe.retryAfterMs }),
          random
        });
        if (!decision.retry) throw safe;
        await waitForRetry(decision.delayMs, signal);
        attempt += 1;
      }
    }
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    if (url.origin !== this.input.serverOrigin) {
      throw new AgentClientError("redirect_blocked", false);
    }
    const timeout = AbortSignal.timeout(this.input.timeoutMs);
    const combined = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    try {
      return await this.fetchImpl(url, { ...init, signal: combined });
    } catch (error) {
      if (timeout.aborted) throw new AgentClientError("request_timeout", true);
      if (combined.aborted) throw error;
      throw new AgentClientError("network_error", true);
    }
  }
}
