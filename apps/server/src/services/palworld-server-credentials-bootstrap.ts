import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  PALWORLD_SERVER_CONNECTIONS_STATE_FILE,
  PALWORLD_SERVER_CREDENTIALS_SECRET_PATH
} from "./palworld-server-status-config.js";

export const PALWORLD_SERVER_CREDENTIALS_DIRECTORY = path.dirname(
  PALWORLD_SERVER_CREDENTIALS_SECRET_PATH
);

export type PalworldServerCredentialsBootstrapErrorCode =
  | "invalid_path"
  | "invalid_key"
  | "unsafe_file"
  | "state_exists_without_key"
  | "permission_denied"
  | "write_failed";

export class PalworldServerCredentialsBootstrapError extends Error {
  readonly name = "PalworldServerCredentialsBootstrapError";

  constructor(public readonly code: PalworldServerCredentialsBootstrapErrorCode) {
    super(`Palworld 자격 증명 저장소를 초기화할 수 없습니다. (${code})`);
  }
}

export type PalworldServerCredentialsBootstrapOptions = {
  secretDirectory: string;
  stateDirectory: string;
  targetUid: number;
  targetGid: number;
  randomBytes?: (size: number) => Buffer;
};

export type PalworldServerCredentialsBootstrapResult = {
  keyStatus: "created" | "reused";
  stateStatus: "empty" | "existing";
  keyPath: string;
  statePath: string;
};

function errnoCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function bootstrapError(code: PalworldServerCredentialsBootstrapErrorCode): never {
  throw new PalworldServerCredentialsBootstrapError(code);
}

function lstatIfPresent(filePath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    if (errnoCode(error) === "EACCES" || errnoCode(error) === "EPERM") {
      return bootstrapError("permission_denied");
    }
    return bootstrapError("unsafe_file");
  }
}

function assertAbsoluteDirectory(directory: string): void {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory) {
    bootstrapError("invalid_path");
  }
}

function prepareDirectory(directory: string, targetUid: number, targetGid: number): void {
  assertAbsoluteDirectory(directory);
  const existing = lstatIfPresent(directory);
  if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) {
    bootstrapError("unsafe_file");
  }
  try {
    if (!existing) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.chownSync(directory, targetUid, targetGid);
    fs.chmodSync(directory, 0o700);
  } catch (error) {
    if (errnoCode(error) === "EACCES" || errnoCode(error) === "EPERM") {
      bootstrapError("permission_denied");
    }
    bootstrapError("write_failed");
  }
}

function prepareExistingFile(
  filePath: string,
  mode: number,
  targetUid: number,
  targetGid: number
): fs.Stats | undefined {
  const stat = lstatIfPresent(filePath);
  if (!stat) return undefined;
  if (stat.isSymbolicLink() || !stat.isFile()) bootstrapError("unsafe_file");
  try {
    fs.chownSync(filePath, targetUid, targetGid);
    fs.chmodSync(filePath, mode);
  } catch (error) {
    if (errnoCode(error) === "EACCES" || errnoCode(error) === "EPERM") {
      bootstrapError("permission_denied");
    }
    bootstrapError("write_failed");
  }
  return stat;
}

function normalizedKey(raw: string): string {
  const value = raw.endsWith("\r\n")
    ? raw.slice(0, -2)
    : raw.endsWith("\n")
      ? raw.slice(0, -1)
      : raw;
  const validLineEnding = raw === value || raw === `${value}\n` || raw === `${value}\r\n`;
  const decoded = /^[a-f0-9]{64}$/iu.test(value)
    ? Buffer.from(value, "hex")
    : /^[A-Za-z0-9+/]{43}=$/u.test(value)
      ? Buffer.from(value, "base64")
      : undefined;
  try {
    if (!validLineEnding
      || !decoded
      || decoded.byteLength !== 32
      || (!/^[a-f0-9]{64}$/iu.test(value) && decoded.toString("base64") !== value)
      || new Set(decoded).size < 8) {
      bootstrapError("invalid_key");
    }
    return value;
  } finally {
    decoded?.fill(0);
  }
}

function readAndValidateKey(keyPath: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(keyPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const raw = fs.readFileSync(descriptor, "utf8");
    if (Buffer.byteLength(raw, "utf8") > 1024) bootstrapError("invalid_key");
    normalizedKey(raw);
  } catch (error) {
    if (error instanceof PalworldServerCredentialsBootstrapError) throw error;
    if (errnoCode(error) === "EACCES" || errnoCode(error) === "EPERM") {
      bootstrapError("permission_denied");
    }
    bootstrapError("invalid_key");
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function createKey(
  keyPath: string,
  targetUid: number,
  targetGid: number,
  randomBytes: (size: number) => Buffer
): void {
  const material = randomBytes(32);
  let descriptor: number | undefined;
  let created = false;
  try {
    if (!Buffer.isBuffer(material) || material.byteLength !== 32) {
      bootstrapError("write_failed");
    }
    const serialized = `${material.toString("base64")}\n`;
    descriptor = fs.openSync(
      keyPath,
      fs.constants.O_WRONLY
        | fs.constants.O_CREAT
        | fs.constants.O_EXCL
        | fs.constants.O_NOFOLLOW,
      0o400
    );
    created = true;
    fs.writeFileSync(descriptor, serialized, "utf8");
    fs.fsyncSync(descriptor);
    fs.fchownSync(descriptor, targetUid, targetGid);
    fs.fchmodSync(descriptor, 0o400);
  } catch (error) {
    if (error instanceof PalworldServerCredentialsBootstrapError) throw error;
    if (errnoCode(error) === "EACCES" || errnoCode(error) === "EPERM") {
      bootstrapError("permission_denied");
    }
    bootstrapError("write_failed");
  } finally {
    material.fill(0);
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (created) {
      try {
        readAndValidateKey(keyPath);
      } catch (error) {
        try {
          fs.unlinkSync(keyPath);
        } catch {
          // 이 실행에서 새로 만든 불완전 파일만 정리하며 기존 key에는 손대지 않습니다.
        }
        throw error;
      }
    }
  }
}

export function bootstrapPalworldServerCredentials(
  options: PalworldServerCredentialsBootstrapOptions
): PalworldServerCredentialsBootstrapResult {
  if (!Number.isSafeInteger(options.targetUid)
    || options.targetUid < 0
    || !Number.isSafeInteger(options.targetGid)
    || options.targetGid < 0) {
    bootstrapError("invalid_path");
  }
  prepareDirectory(options.secretDirectory, options.targetUid, options.targetGid);
  prepareDirectory(options.stateDirectory, options.targetUid, options.targetGid);

  const keyPath = path.join(
    options.secretDirectory,
    path.basename(PALWORLD_SERVER_CREDENTIALS_SECRET_PATH)
  );
  const statePath = path.join(options.stateDirectory, PALWORLD_SERVER_CONNECTIONS_STATE_FILE);
  const state = prepareExistingFile(
    statePath,
    0o600,
    options.targetUid,
    options.targetGid
  );
  const key = prepareExistingFile(
    keyPath,
    0o400,
    options.targetUid,
    options.targetGid
  );

  if (!key && state) bootstrapError("state_exists_without_key");
  if (!key) {
    createKey(
      keyPath,
      options.targetUid,
      options.targetGid,
      options.randomBytes ?? crypto.randomBytes
    );
  } else {
    readAndValidateKey(keyPath);
  }

  return {
    keyStatus: key ? "reused" : "created",
    stateStatus: state ? "existing" : "empty",
    keyPath,
    statePath
  };
}
