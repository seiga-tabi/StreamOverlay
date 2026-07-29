import fs from "node:fs";
import path from "node:path";

export class SafeFileError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "SafeFileError";
  }
}

export function assertSafeDirectory(directory: string, production: boolean): void {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    throw new SafeFileError("directory_unreadable");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new SafeFileError("directory_invalid");
  }
  if (production && (stat.mode & 0o077) !== 0) {
    throw new SafeFileError("directory_permissions");
  }
}

export function ensureSafeDirectory(directory: string, production: boolean): void {
  const parent = path.dirname(directory);
  if (parent !== directory && fs.existsSync(parent)) {
    const parentStat = fs.lstatSync(parent);
    if (parentStat.isSymbolicLink()) throw new SafeFileError("directory_invalid");
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  assertSafeDirectory(directory, production);
}

export function readSecretFile(filePath: string, production: boolean): string {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid");
    if (stat.size < 1 || stat.size > 4_096) throw new Error("size");
    if (production && (stat.mode & 0o077) !== 0) throw new Error("permission");
    const value = fs.readFileSync(filePath, "utf8").replace(/(?:\r\n|\n|\r)$/u, "");
    if (!value || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("content");
    return value;
  } catch {
    throw new SafeFileError("secret_file_unreadable");
  }
}

export function safeSecret(input: {
  name: string;
  direct?: string;
  file?: string;
  production: boolean;
  required?: boolean;
}): string | undefined {
  if (input.direct && input.file) throw new SafeFileError(`${input.name}_ambiguous`);
  if (input.production && input.direct) throw new SafeFileError(`${input.name}_file_required`);
  const value = input.file
    ? readSecretFile(input.file, input.production)
    : input.direct?.trim();
  if (input.required && !value) throw new SafeFileError(`${input.name}_required`);
  if (value && /^(?:change-?me|placeholder|example|secret)$/iu.test(value)) {
    throw new SafeFileError(`${input.name}_placeholder`);
  }
  return value || undefined;
}

export function atomicWriteNewJson(filePath: string, value: unknown): void {
  if (fs.existsSync(filePath)) throw new SafeFileError("target_exists");
  const directory = path.dirname(filePath);
  ensureSafeDirectory(directory, false);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    const body = `${JSON.stringify(value)}\n`;
    fs.writeFileSync(descriptor, body, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.chmodSync(temporary, 0o600);
    const stat = fs.lstatSync(temporary);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
      throw new SafeFileError("temporary_invalid");
    }
    fs.renameSync(temporary, filePath);
    const directoryDescriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // 원본 credential을 보존하는 것이 우선이므로 임시 파일 정리 오류는 덮어쓰지 않습니다.
    }
    if (error instanceof SafeFileError) throw error;
    throw new SafeFileError("atomic_write_failed");
  }
}

export function atomicReplaceJson(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  ensureSafeDirectory(directory, false);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    const descriptor = fs.openSync(temporary, "r");
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, filePath);
    const directoryDescriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } catch {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // 손상 원본을 빈 상태로 대체하지 않습니다.
    }
    throw new SafeFileError("atomic_write_failed");
  }
}
