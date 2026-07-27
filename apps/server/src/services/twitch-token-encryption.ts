import crypto from "node:crypto";

const TWITCH_TOKEN_ALGORITHM = "aes-256-gcm";
const ENCRYPTED_DOCUMENT_KEYS = ["algorithm", "authTag", "ciphertext", "iv", "version"] as const;

type EncryptedTwitchTokenDocument = {
  version: 1;
  algorithm: typeof TWITCH_TOKEN_ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function decodeBase64Field(value: unknown, name: string, expectedBytes?: number): Buffer {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`암호화된 Twitch OAuth token의 ${name} 형식이 올바르지 않습니다.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value || (expectedBytes !== undefined && decoded.byteLength !== expectedBytes)) {
    throw new Error(`암호화된 Twitch OAuth token의 ${name} 형식이 올바르지 않습니다.`);
  }
  return decoded;
}

export function decodeTwitchTokenEncryptionKey(value: string | undefined): Buffer | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const key = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.byteLength !== 32) {
    throw new Error("TWITCH_TOKEN_ENCRYPTION_KEY는 32바이트 base64 또는 64자리 hex 값이어야 합니다.");
  }
  return key;
}

export function encryptTwitchTokenDocument(plaintext: string, key: Buffer, aadLabel: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(TWITCH_TOKEN_ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aadLabel, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const document: EncryptedTwitchTokenDocument = {
    version: 1,
    algorithm: TWITCH_TOKEN_ALGORITHM,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
  return `${JSON.stringify(document)}\n`;
}

export function decryptTwitchTokenDocument(
  raw: string,
  key: Buffer | undefined,
  aadLabel: string
): { plaintext: string; legacyPlaintext: boolean } {
  const parsed = JSON.parse(raw) as unknown;
  if (!isPlainRecord(parsed)) throw new Error("Twitch OAuth token 저장소 형식이 올바르지 않습니다.");
  const encrypted = parsed.algorithm === TWITCH_TOKEN_ALGORITHM
    || "iv" in parsed
    || "authTag" in parsed
    || "ciphertext" in parsed;
  if (!encrypted) return { plaintext: raw, legacyPlaintext: true };
  if (
    !key
    || !hasExactKeys(parsed, ENCRYPTED_DOCUMENT_KEYS)
    || parsed.version !== 1
    || parsed.algorithm !== TWITCH_TOKEN_ALGORITHM
  ) {
    throw new Error("암호화된 Twitch OAuth token 저장소를 읽을 수 없습니다.");
  }
  const iv = decodeBase64Field(parsed.iv, "IV", 12);
  const authTag = decodeBase64Field(parsed.authTag, "인증 tag", 16);
  const ciphertext = decodeBase64Field(parsed.ciphertext, "ciphertext");
  const decipher = crypto.createDecipheriv(TWITCH_TOKEN_ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(aadLabel, "utf8"));
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString("utf8");
  return { plaintext, legacyPlaintext: false };
}
