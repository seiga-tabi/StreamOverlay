import crypto from "node:crypto";
import {
  DISCORD_INTERNAL_AUTH_VERSION,
  discordInternalCanonicalRequest,
  parseDiscordBotCommandPolicyResponse,
  parseDiscordGameServerStatusResponse,
  type DiscordBotCommandPolicyRequest,
  type DiscordBotCommandPolicyResponse,
  type DiscordGameServerStatusRequest,
  type DiscordGameServerStatusResponse,
  type DiscordInstallationObservationRequest,
  type DiscordSetupSessionRequest
} from "@streamops/shared";

export class DiscordInternalApiError extends Error {
  constructor(readonly code: "unavailable" | "rejected" | "invalid_response") {
    super(code);
    this.name = "DiscordInternalApiError";
  }
}

export class DiscordInternalApiClient {
  constructor(
    private readonly options: {
      authKey: string;
      baseUrl: string;
      publicBaseUrl: string;
      timeoutMs: number;
      fetchImpl?: typeof fetch;
      now?: () => number;
      randomBytes?: (size: number) => Buffer;
    }
  ) {}

  async issueSetupSession(
    body: DiscordSetupSessionRequest
  ): Promise<{ url: string; expiresAt: string }> {
    const result = await this.request("/internal/discord/setup-sessions", body);
    const record = result as Record<string, unknown>;
    if (typeof record.url !== "string" || typeof record.expiresAt !== "string") {
      throw new DiscordInternalApiError("invalid_response");
    }
    let url: URL;
    try {
      url = new URL(record.url);
    } catch {
      throw new DiscordInternalApiError("invalid_response");
    }
    if (
      url.origin !== this.options.publicBaseUrl
      || url.pathname !== "/dashboard/organizations"
      || [...url.searchParams.keys()].some((key) => key !== "setup")
      || !/^[A-Za-z0-9_-]{32,128}$/u.test(url.searchParams.get("setup") ?? "")
      || !Number.isFinite(Date.parse(record.expiresAt))
    ) {
      throw new DiscordInternalApiError("invalid_response");
    }
    return { url: url.toString(), expiresAt: record.expiresAt };
  }

  async observeInstallation(body: DiscordInstallationObservationRequest): Promise<void> {
    await this.request("/internal/discord/installations/upsert", body);
  }

  async revokeInstallation(body: DiscordInstallationObservationRequest): Promise<void> {
    await this.request("/internal/discord/installations/revoked", body);
  }

  async gameServerStatus(
    body: DiscordGameServerStatusRequest
  ): Promise<DiscordGameServerStatusResponse> {
    const result = parseDiscordGameServerStatusResponse(
      await this.request("/internal/discord/game-server-status", body)
    );
    if (!result) throw new DiscordInternalApiError("invalid_response");
    return result;
  }

  async commandPolicy(
    body: DiscordBotCommandPolicyRequest
  ): Promise<DiscordBotCommandPolicyResponse> {
    const result = parseDiscordBotCommandPolicyResponse(
      await this.request("/internal/discord/command-policy", body)
    );
    if (!result) throw new DiscordInternalApiError("invalid_response");
    return result;
  }

  private async request(path: string, payload: unknown): Promise<unknown> {
    const body = JSON.stringify(payload);
    const now = this.options.now?.() ?? Date.now();
    const timestamp = String(Math.trunc(now / 1_000));
    const nonce = (this.options.randomBytes ?? crypto.randomBytes)(24).toString("base64url");
    const bodySha256 = crypto.createHash("sha256").update(body).digest("hex");
    const canonical = discordInternalCanonicalRequest({
      bodySha256,
      method: "POST",
      nonce,
      path,
      timestamp
    });
    const signature = crypto
      .createHmac("sha256", this.options.authKey)
      .update(canonical)
      .digest("hex");
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(
        new URL(path, this.options.baseUrl),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-YORO-Auth-Version": DISCORD_INTERNAL_AUTH_VERSION,
            "X-YORO-Auth-Timestamp": timestamp,
            "X-YORO-Auth-Nonce": nonce,
            "X-YORO-Auth-Signature": signature
          },
          body,
          signal: AbortSignal.timeout(this.options.timeoutMs)
        }
      );
    } catch {
      throw new DiscordInternalApiError("unavailable");
    }
    if (!response.ok) {
      throw new DiscordInternalApiError(response.status >= 500 ? "unavailable" : "rejected");
    }
    if (response.status === 204) return {};
    try {
      return await response.json();
    } catch {
      throw new DiscordInternalApiError("invalid_response");
    }
  }
}
