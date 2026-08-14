import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";

const MAX_TOKEN_LENGTH = 4_096;
const MAX_SEGMENT_LENGTH = 3_072;
const CLOCK_TOLERANCE_SECONDS = 30;
const MAX_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

export type TwitchExtensionRole = "viewer" | "moderator" | "broadcaster";

export type TwitchExtensionPrincipal = Readonly<{
  channelId: string;
  opaqueUserId: string;
  role: TwitchExtensionRole;
  userId?: string;
  expiresAt: number;
}>;

export class TwitchExtensionJwtError extends Error {
  constructor(readonly code: "missing" | "invalid" | "expired") {
    super(`twitch_extension_jwt_${code}`);
    this.name = "TwitchExtensionJwtError";
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function decodeBase64Url(value: string): Buffer {
  if (
    !value
    || value.length > MAX_SEGMENT_LENGTH
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) throw new TwitchExtensionJwtError("invalid");
  const decoded = Buffer.from(value, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== value) {
    throw new TwitchExtensionJwtError("invalid");
  }
  return decoded;
}

function decodeSharedSecret(value: string): Buffer {
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 1_024
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized)
  ) throw new Error("twitch_extension_secret_invalid");
  const secret = Buffer.from(normalized, "base64");
  if (
    secret.length < 32
    || secret.length > 512
    || secret.toString("base64").replace(/=+$/u, "") !== normalized.replace(/=+$/u, "")
  ) throw new Error("twitch_extension_secret_invalid");
  return secret;
}

function jsonSegment(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decodeBase64Url(value).toString("utf8")) as unknown;
    const result = record(parsed);
    if (!result) throw new Error("invalid");
    return result;
  } catch (error) {
    if (error instanceof TwitchExtensionJwtError) throw error;
    throw new TwitchExtensionJwtError("invalid");
  }
}

export function twitchExtensionBearerToken(req: IncomingMessage): string {
  const authorization = req.headers.authorization;
  if (
    typeof authorization !== "string"
    || authorization.length > MAX_TOKEN_LENGTH + 7
    || !authorization.startsWith("Bearer ")
  ) throw new TwitchExtensionJwtError("missing");
  const token = authorization.slice(7);
  if (!token || token.length > MAX_TOKEN_LENGTH || /\s/u.test(token)) {
    throw new TwitchExtensionJwtError("invalid");
  }
  return token;
}

export class TwitchExtensionJwtVerifier {
  private readonly secret: Buffer;

  constructor(sharedSecretBase64: string) {
    this.secret = decodeSharedSecret(sharedSecretBase64);
  }

  verify(token: string, nowSeconds = Math.floor(Date.now() / 1_000)): TwitchExtensionPrincipal {
    if (!token || token.length > MAX_TOKEN_LENGTH) throw new TwitchExtensionJwtError("invalid");
    const segments = token.split(".");
    if (segments.length !== 3) throw new TwitchExtensionJwtError("invalid");
    const [encodedHeader, encodedPayload, encodedSignature] = segments as [string, string, string];
    const header = jsonSegment(encodedHeader);
    if (
      header.alg !== "HS256"
      || (header.typ !== undefined && header.typ !== "JWT")
      || header.crit !== undefined
    ) throw new TwitchExtensionJwtError("invalid");

    const actualSignature = decodeBase64Url(encodedSignature);
    const expectedSignature = crypto
      .createHmac("sha256", this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    if (
      actualSignature.length !== expectedSignature.length
      || !crypto.timingSafeEqual(actualSignature, expectedSignature)
    ) throw new TwitchExtensionJwtError("invalid");

    const payload = jsonSegment(encodedPayload);
    const channelId = typeof payload.channel_id === "string" ? payload.channel_id : "";
    const opaqueUserId = typeof payload.opaque_user_id === "string" ? payload.opaque_user_id : "";
    const role = payload.role;
    const userId = payload.user_id;
    const exp = payload.exp;
    const iat = payload.iat;
    if (
      !/^\d{1,32}$/u.test(channelId)
      || !/^[UA][A-Za-z0-9]{1,127}$/u.test(opaqueUserId)
      || !["viewer", "moderator", "broadcaster"].includes(String(role))
      || typeof exp !== "number"
      || !Number.isSafeInteger(exp)
      || (iat !== undefined && (
        typeof iat !== "number"
        || !Number.isSafeInteger(iat)
        || iat > nowSeconds + CLOCK_TOLERANCE_SECONDS
      ))
      || (userId !== undefined && (typeof userId !== "string" || !/^\d{1,32}$/u.test(userId)))
      || (userId !== undefined && !opaqueUserId.startsWith("U"))
    ) throw new TwitchExtensionJwtError("invalid");
    if (exp <= nowSeconds - CLOCK_TOLERANCE_SECONDS) {
      throw new TwitchExtensionJwtError("expired");
    }
    if (exp > nowSeconds + MAX_TOKEN_LIFETIME_SECONDS) {
      throw new TwitchExtensionJwtError("invalid");
    }
    return Object.freeze({
      channelId,
      opaqueUserId,
      role: role as TwitchExtensionRole,
      ...(typeof userId === "string" ? { userId } : {}),
      expiresAt: exp
    });
  }

  verifyRequest(req: IncomingMessage): TwitchExtensionPrincipal {
    return this.verify(twitchExtensionBearerToken(req));
  }
}
