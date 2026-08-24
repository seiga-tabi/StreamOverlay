import crypto from "node:crypto";
import {
  normalizeLolPlatformId,
  parseRiotIdDetailed,
  type LolPlatformId,
} from "@streamops/shared";
import { decodeTwitchTokenEncryptionKey } from "./twitch-token-encryption.js";

const PROFILE_LINK_VERSION = 1;
const PROFILE_LINK_ALGORITHM = "aes-256-gcm";
const PROFILE_LINK_AAD = Buffer.from("yoro.public-lol.profile-link.v1", "utf8");
const PROFILE_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,512}$/u;
const DEVELOPMENT_MASTER_KEY = crypto
  .createHash("sha256")
  .update("yoro.public-lol.profile-link.development-only.v1", "utf8")
  .digest();

export type PublicLolProfileLink = Readonly<{
  riotId: string;
  lolPlatform: LolPlatformId;
}>;

function profileLinkMasterKey(encodedKey: string | undefined, nodeEnv: string): Buffer {
  const configured = decodeTwitchTokenEncryptionKey(encodedKey);
  if (configured) return configured;
  if (nodeEnv === "production") throw new Error("PUBLIC_LOL_PROFILE_LINK_KEY_UNAVAILABLE");
  /* 로컬·테스트에서는 별도 secret 없이 링크 흐름을 확인할 수 있게 합니다.
     production은 위에서 반드시 운영 encryption key를 요구합니다. */
  return DEVELOPMENT_MASTER_KEY;
}

function deriveKey(masterKey: Buffer, purpose: "encryption" | "nonce"): Buffer {
  return Buffer.from(crypto.hkdfSync(
    "sha256",
    masterKey,
    Buffer.from("yoro.public-lol.profile-link.hkdf.v1", "utf8"),
    Buffer.from(purpose, "utf8"),
    32,
  ));
}

function canonicalPayload(value: PublicLolProfileLink): Buffer {
  const parsed = parseRiotIdDetailed(value.riotId);
  const lolPlatform = normalizeLolPlatformId(value.lolPlatform);
  if (!parsed.ok || !lolPlatform) throw new Error("PUBLIC_LOL_PROFILE_LINK_INPUT_INVALID");
  return Buffer.from(JSON.stringify({
    v: PROFILE_LINK_VERSION,
    r: `${parsed.gameName}#${parsed.tagLine}`,
    p: lolPlatform,
  }), "utf8");
}

/**
 * 주소 공유용 결정적 authenticated token을 만듭니다.
 * 같은 프로필은 같은 canonical URL을 가져야 하므로 nonce를 별도 파생 key의
 * HMAC으로 만들며, 서로 다른 payload의 nonce 충돌 확률은 96-bit입니다.
 */
export function encryptPublicLolProfileLink(
  value: PublicLolProfileLink,
  encodedKey: string | undefined,
  nodeEnv: string,
): string {
  const masterKey = profileLinkMasterKey(encodedKey, nodeEnv);
  const encryptionKey = deriveKey(masterKey, "encryption");
  const nonceKey = deriveKey(masterKey, "nonce");
  const plaintext = canonicalPayload(value);
  const iv = crypto.createHmac("sha256", nonceKey).update(plaintext).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv(PROFILE_LINK_ALGORITHM, encryptionKey, iv);
  cipher.setAAD(PROFILE_LINK_AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([
    Buffer.from([PROFILE_LINK_VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url");
}

export function decryptPublicLolProfileLink(
  token: string,
  encodedKey: string | undefined,
  nodeEnv: string,
): PublicLolProfileLink {
  if (!PROFILE_LINK_TOKEN_PATTERN.test(token)) throw new Error("PUBLIC_LOL_PROFILE_LINK_INVALID");
  const envelope = Buffer.from(token, "base64url");
  if (envelope.toString("base64url") !== token || envelope[0] !== PROFILE_LINK_VERSION || envelope.byteLength <= 29) {
    throw new Error("PUBLIC_LOL_PROFILE_LINK_INVALID");
  }
  const masterKey = profileLinkMasterKey(encodedKey, nodeEnv);
  const encryptionKey = deriveKey(masterKey, "encryption");
  try {
    const decipher = crypto.createDecipheriv(PROFILE_LINK_ALGORITHM, encryptionKey, envelope.subarray(1, 13));
    decipher.setAAD(PROFILE_LINK_AAD);
    decipher.setAuthTag(envelope.subarray(13, 29));
    const plaintext = Buffer.concat([
      decipher.update(envelope.subarray(29)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Record<string, unknown>;
    if (
      parsed.v !== PROFILE_LINK_VERSION
      || typeof parsed.r !== "string"
      || typeof parsed.p !== "string"
      || Object.keys(parsed).some((key) => !["v", "r", "p"].includes(key))
    ) throw new Error("PUBLIC_LOL_PROFILE_LINK_INVALID");
    const riotId = parseRiotIdDetailed(parsed.r);
    const lolPlatform = normalizeLolPlatformId(parsed.p);
    if (!riotId.ok || !lolPlatform) throw new Error("PUBLIC_LOL_PROFILE_LINK_INVALID");
    return {
      riotId: `${riotId.gameName}#${riotId.tagLine}`,
      lolPlatform,
    };
  } catch {
    throw new Error("PUBLIC_LOL_PROFILE_LINK_INVALID");
  }
}
