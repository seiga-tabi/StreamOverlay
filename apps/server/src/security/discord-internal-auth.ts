import crypto from "node:crypto";
import {
  DISCORD_INTERNAL_AUTH_VERSION,
  discordInternalCanonicalRequest
} from "@streamops/shared";

export const DISCORD_INTERNAL_MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const MAX_NONCES = 10_000;

type InternalHeaders = Readonly<Record<string, string | string[] | undefined>>;

export type DiscordInternalAuthResult =
  | { ok: true }
  | { ok: false; code: "INTERNAL_AUTH_REQUIRED" | "INTERNAL_AUTH_REPLAY" };

function oneHeader(headers: InternalHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqualHex(expected: string, candidate: string | undefined): boolean {
  if (!candidate || !/^[a-f0-9]{64}$/u.test(candidate)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(candidate, "hex");
  return left.byteLength === right.byteLength && crypto.timingSafeEqual(left, right);
}

export class DiscordInternalAuthVerifier {
  private readonly nonces = new Map<string, number>();

  constructor(
    private readonly key: string,
    private readonly clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
    private readonly now: () => number = Date.now
  ) {}

  verify(input: {
    body: Buffer;
    headers: InternalHeaders;
    method: string;
    path: string;
  }): DiscordInternalAuthResult {
    this.prune();
    const version = oneHeader(input.headers, "x-yoro-auth-version");
    const timestamp = oneHeader(input.headers, "x-yoro-auth-timestamp");
    const nonce = oneHeader(input.headers, "x-yoro-auth-nonce");
    const signature = oneHeader(input.headers, "x-yoro-auth-signature");
    if (
      version !== DISCORD_INTERNAL_AUTH_VERSION
      || !timestamp
      || !nonce
      || !signature
    ) {
      return { ok: false, code: "INTERNAL_AUTH_REQUIRED" };
    }
    const timestampSeconds = Number(timestamp);
    if (
      !Number.isSafeInteger(timestampSeconds)
      || Math.abs(Math.trunc(this.now() / 1_000) - timestampSeconds) > this.clockSkewSeconds
    ) {
      return { ok: false, code: "INTERNAL_AUTH_REQUIRED" };
    }
    if (this.nonces.has(nonce)) {
      return { ok: false, code: "INTERNAL_AUTH_REPLAY" };
    }
    let canonical: string;
    try {
      canonical = discordInternalCanonicalRequest({
        version,
        timestamp,
        nonce,
        method: input.method,
        path: input.path,
        bodySha256: crypto.createHash("sha256").update(input.body).digest("hex")
      });
    } catch {
      return { ok: false, code: "INTERNAL_AUTH_REQUIRED" };
    }
    const expected = crypto
      .createHmac("sha256", this.key)
      .update(canonical)
      .digest("hex");
    if (!safeEqualHex(expected, signature)) {
      return { ok: false, code: "INTERNAL_AUTH_REQUIRED" };
    }
    this.nonces.set(nonce, timestampSeconds + this.clockSkewSeconds);
    while (this.nonces.size > MAX_NONCES) {
      const oldest = this.nonces.keys().next().value as string | undefined;
      if (!oldest) break;
      this.nonces.delete(oldest);
    }
    return { ok: true };
  }

  private prune(): void {
    const nowSeconds = Math.trunc(this.now() / 1_000);
    for (const [nonce, expiresAt] of this.nonces) {
      if (expiresAt < nowSeconds) this.nonces.delete(nonce);
    }
  }
}
