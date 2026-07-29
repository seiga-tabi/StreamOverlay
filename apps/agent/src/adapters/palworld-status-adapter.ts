import { performance } from "node:perf_hooks";
import {
  validatePalworldRestInfoResponse,
  validatePalworldRestMetricsResponse,
  type PalworldAgentStatusPayload
} from "@streamops/shared";

export type PalworldCollectedStatus = Omit<PalworldAgentStatusPayload, "payloadVersion" | "observedAt">;

export interface PalworldStatusAdapter {
  collect(signal: AbortSignal): Promise<PalworldCollectedStatus>;
}

export type PalworldAdapterErrorCode =
  | "palworld_unavailable"
  | "palworld_auth_failed"
  | "palworld_timeout"
  | "palworld_invalid_response"
  | "palworld_redirect_blocked";

export class PalworldAdapterError extends Error {
  constructor(readonly code: PalworldAdapterErrorCode) {
    super(code);
    this.name = "PalworldAdapterError";
  }
}

type FetchLike = typeof fetch;

async function strictJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(length) && length > 64 * 1_024) {
    throw new PalworldAdapterError("palworld_invalid_response");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw new PalworldAdapterError("palworld_invalid_response");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 64 * 1_024) {
    throw new PalworldAdapterError("palworld_invalid_response");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PalworldAdapterError("palworld_invalid_response");
  }
}

export class PalworldRestStatusAdapter implements PalworldStatusAdapter {
  constructor(
    private readonly input: Readonly<{
      origin: string;
      adminPassword: string;
      timeoutMs: number;
    }>,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async collect(signal: AbortSignal): Promise<PalworldCollectedStatus> {
    const started = performance.now();
    const [info, metrics] = await Promise.all([
      this.endpoint("/v1/api/info", signal),
      this.endpoint("/v1/api/metrics", signal)
    ]);
    const validInfo = validatePalworldRestInfoResponse(info);
    const validMetrics = validatePalworldRestMetricsResponse(metrics);
    if (!validInfo.ok || !validMetrics.ok) {
      throw new PalworldAdapterError("palworld_invalid_response");
    }
    return Object.freeze({
      online: true,
      players: validMetrics.data.currentplayernum,
      maxPlayers: validMetrics.data.maxplayernum,
      gameVersion: validInfo.data.version,
      uptimeSeconds: validMetrics.data.uptime,
      latencyMs: Math.max(0, Math.round(performance.now() - started))
    });
  }

  private async endpoint(pathname: string, signal: AbortSignal): Promise<unknown> {
    const url = new URL(pathname, this.input.origin);
    if (url.origin !== this.input.origin) {
      throw new PalworldAdapterError("palworld_redirect_blocked");
    }
    const timeout = AbortSignal.timeout(this.input.timeoutMs);
    const combined = AbortSignal.any([signal, timeout]);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${Buffer.from(
            `admin:${this.input.adminPassword}`,
            "utf8"
          ).toString("base64")}`
        },
        redirect: "manual",
        signal: combined
      });
    } catch (error) {
      if (timeout.aborted) throw new PalworldAdapterError("palworld_timeout");
      if (signal.aborted) throw error;
      throw new PalworldAdapterError("palworld_unavailable");
    }
    if (response.status >= 300 && response.status < 400) {
      throw new PalworldAdapterError("palworld_redirect_blocked");
    }
    if (response.status === 401 || response.status === 403) {
      throw new PalworldAdapterError("palworld_auth_failed");
    }
    if (response.status !== 200) {
      throw new PalworldAdapterError("palworld_unavailable");
    }
    return strictJson(response);
  }
}
