import crypto from "node:crypto";

const ENVELOPE_VERSION = 1;

type DiscordSecretPurpose =
  | "pkce_verifier"
  | "pkce_verifier:web_management_connect"
  | "oauth_token"
  | "oauth_token:web_management_connect"
  | "management_pkce";

export type DiscordSecretContext = Readonly<{
  sessionId: string;
  discordUserId: string;
  purpose: DiscordSecretPurpose;
}>;

type DiscordSecretEnvelope = {
  version: 1;
  keyVersion: number;
  iv: string;
  tag: string;
  ciphertext: string;
};

function decodeKey(value: string): Buffer {
  const normalized = value.trim();
  if (/^[a-f0-9]{64}$/iu.test(normalized)) return Buffer.from(normalized, "hex");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.byteLength !== 32) throw new Error("DISCORD_ENCRYPTION_KEY_INVALID");
  return decoded;
}

function aad(context: DiscordSecretContext): Buffer {
  return Buffer.from(
    [
      "yoro.discord.oauth",
      `schema:${ENVELOPE_VERSION}`,
      `user:${context.discordUserId}`,
      `session:${context.sessionId}`,
      `purpose:${context.purpose}`
    ].join("\n"),
    "utf8"
  );
}

function parseEnvelope(value: Buffer): DiscordSecretEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error("DISCORD_CIPHERTEXT_INVALID");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("DISCORD_CIPHERTEXT_INVALID");
  const record = parsed as Record<string, unknown>;
  if (
    record.version !== 1
    || !Number.isInteger(record.keyVersion)
    || Number(record.keyVersion) < 1
    || typeof record.iv !== "string"
    || typeof record.tag !== "string"
    || typeof record.ciphertext !== "string"
    || Object.keys(record).some((key) => !["version", "keyVersion", "iv", "tag", "ciphertext"].includes(key))
  ) {
    throw new Error("DISCORD_CIPHERTEXT_INVALID");
  }
  return record as DiscordSecretEnvelope;
}

export function encryptDiscordSecret(
  plaintext: string,
  encodedKey: string,
  keyVersion: number,
  context: DiscordSecretContext
): Buffer {
  const key = decodeKey(encodedKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const envelope: DiscordSecretEnvelope = {
    version: 1,
    keyVersion,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptDiscordSecret(
  encrypted: Buffer,
  encodedKey: string,
  context: DiscordSecretContext
): string {
  const envelope = parseEnvelope(encrypted);
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      decodeKey(encodedKey),
      Buffer.from(envelope.iv, "base64")
    );
    decipher.setAAD(aad(context));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error("DISCORD_DECRYPTION_FAILED");
  }
}

export function discordSecretHash(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

export function discordSafeToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function discordPkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}
