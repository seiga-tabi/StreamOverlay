import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DISCORD_INTERNAL_AUTH_DIRECTORY = "/run/discord-internal-auth";
export const DISCORD_INTERNAL_AUTH_SERVER_KEY_PATH =
  `${DISCORD_INTERNAL_AUTH_DIRECTORY}/server_key`;
export const DISCORD_INTERNAL_AUTH_BOT_KEY_PATH =
  `${DISCORD_INTERNAL_AUTH_DIRECTORY}/bot_key`;

export type DiscordInternalAuthBootstrapErrorCode =
  | "invalid_path"
  | "invalid_key"
  | "key_mismatch"
  | "unsafe_file"
  | "permission_denied"
  | "write_failed";

export class DiscordInternalAuthBootstrapError extends Error {
  readonly name = "DiscordInternalAuthBootstrapError";

  constructor(readonly code: DiscordInternalAuthBootstrapErrorCode) {
    super(`Discord 내부 인증 key를 초기화할 수 없습니다. (${code})`);
  }
}

type BootstrapOptions = Readonly<{
  directory: string;
  serverUid: number;
  serverGid: number;
  botUid: number;
  botGid: number;
  randomBytes?: (size: number) => Buffer;
}>;

type BootstrapResult = Readonly<{
  keyStatus: "created" | "reused" | "recovered";
}>;

function fail(code: DiscordInternalAuthBootstrapErrorCode): never {
  throw new DiscordInternalAuthBootstrapError(code);
}

function errnoCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function lstatIfPresent(filePath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    if (["EACCES", "EPERM"].includes(errnoCode(error) ?? "")) {
      return fail("permission_denied");
    }
    return fail("unsafe_file");
  }
}

function readKey(filePath: string): Buffer {
  const stat = lstatIfPresent(filePath);
  if (!stat || stat.isSymbolicLink() || !stat.isFile() || stat.size !== 64) {
    return fail("unsafe_file");
  }
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const value = fs.readFileSync(descriptor, "utf8");
    if (!/^[a-f0-9]{64}$/u.test(value)) return fail("invalid_key");
    return Buffer.from(value, "utf8");
  } catch (error) {
    if (error instanceof DiscordInternalAuthBootstrapError) throw error;
    if (["EACCES", "EPERM"].includes(errnoCode(error) ?? "")) {
      return fail("permission_denied");
    }
    return fail("invalid_key");
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function writeKey(
  filePath: string,
  value: Buffer,
  uid: number,
  gid: number,
  randomBytes: (size: number) => Buffer
): void {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.discord-internal-auth-${randomBytes(12).toString("hex")}.tmp`
  );
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      0o600
    );
    fs.writeFileSync(descriptor, value);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.chownSync(temporaryPath, uid, gid);
    fs.chmodSync(temporaryPath, 0o400);
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // 생성 도중 실패한 임시 파일만 정리합니다.
    }
    if (["EACCES", "EPERM"].includes(errnoCode(error) ?? "")) {
      return fail("permission_denied");
    }
    return fail("write_failed");
  }
}

export function bootstrapDiscordInternalAuth(
  options: BootstrapOptions
): BootstrapResult {
  if (!path.isAbsolute(options.directory) || path.resolve(options.directory) !== options.directory) {
    return fail("invalid_path");
  }
  const existingDirectory = lstatIfPresent(options.directory);
  if (existingDirectory && (
    existingDirectory.isSymbolicLink() || !existingDirectory.isDirectory()
  )) return fail("unsafe_file");
  try {
    if (!existingDirectory) fs.mkdirSync(options.directory, { recursive: true, mode: 0o711 });
    fs.chownSync(
      options.directory,
      typeof process.getuid === "function" ? process.getuid() : 0,
      typeof process.getgid === "function" ? process.getgid() : 0
    );
    fs.chmodSync(options.directory, 0o711);
  } catch (error) {
    if (["EACCES", "EPERM"].includes(errnoCode(error) ?? "")) {
      return fail("permission_denied");
    }
    return fail("write_failed");
  }

  const serverPath = path.join(options.directory, "server_key");
  const botPath = path.join(options.directory, "bot_key");
  const serverPresent = lstatIfPresent(serverPath) !== undefined;
  const botPresent = lstatIfPresent(botPath) !== undefined;
  let key: Buffer;
  let keyStatus: BootstrapResult["keyStatus"];
  if (serverPresent && botPresent) {
    const serverKey = readKey(serverPath);
    const botKey = readKey(botPath);
    try {
      if (!crypto.timingSafeEqual(serverKey, botKey)) return fail("key_mismatch");
      key = Buffer.from(serverKey);
      keyStatus = "reused";
    } finally {
      serverKey.fill(0);
      botKey.fill(0);
    }
  } else if (serverPresent || botPresent) {
    key = readKey(serverPresent ? serverPath : botPath);
    keyStatus = "recovered";
  } else {
    key = Buffer.from(
      (options.randomBytes ?? crypto.randomBytes)(32).toString("hex"),
      "utf8"
    );
    keyStatus = "created";
  }

  try {
    if (!serverPresent) {
      writeKey(
        serverPath,
        key,
        options.serverUid,
        options.serverGid,
        options.randomBytes ?? crypto.randomBytes
      );
    }
    if (!botPresent) {
      writeKey(
        botPath,
        key,
        options.botUid,
        options.botGid,
        options.randomBytes ?? crypto.randomBytes
      );
    }
    for (const [filePath, uid, gid] of [
      [serverPath, options.serverUid, options.serverGid],
      [botPath, options.botUid, options.botGid]
    ] as const) {
      fs.chownSync(filePath, uid, gid);
      fs.chmodSync(filePath, 0o400);
    }
    return Object.freeze({ keyStatus });
  } catch (error) {
    if (error instanceof DiscordInternalAuthBootstrapError) throw error;
    if (["EACCES", "EPERM"].includes(errnoCode(error) ?? "")) {
      return fail("permission_denied");
    }
    return fail("write_failed");
  } finally {
    key.fill(0);
  }
}
