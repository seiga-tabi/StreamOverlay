import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isPalworldServerStateDirectoryLocationAllowed } from "./palworld-server-status-config.js";

const PALWORLD_CONNECTION_AAD = Buffer.from("streamops:palworld-server-connections:v1", "utf8");
const PALWORLD_CONNECTION_ALGORITHM = "aes-256-gcm";
const PALWORLD_CONNECTION_VERSION = 1;
const MAX_OWNER_ID_LENGTH = 128;
const MAX_BASE_URL_LENGTH = 2048;
const MAX_ADMIN_PASSWORD_LENGTH = 256;
const MAX_ENCRYPTED_FILE_BYTES = 8 * 1024 * 1024;
const MAX_CIPHERTEXT_BASE64_LENGTH = 7 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 5 * 1024 * 1024;
const MAX_CONNECTION_RECORDS = 10_000;
const PALWORLD_CONNECTION_FILE_NAME = "palworld-server-connections.json.enc";

export type PalworldServerConnectionStoreErrorCode =
  | "storage_invalid"
  | "storage_write_failed";

export class PalworldServerConnectionStoreError extends Error {
  readonly name = "PalworldServerConnectionStoreError";

  constructor(public readonly code: PalworldServerConnectionStoreErrorCode) {
    super(code === "storage_invalid"
      ? "Palworld 서버 연결 저장소를 복호화하거나 검증할 수 없습니다. (storage_invalid)"
      : "Palworld 서버 연결 저장소를 저장할 수 없습니다. (storage_write_failed)");
  }
}

type EncryptedConnectionFile = {
  version: typeof PALWORLD_CONNECTION_VERSION;
  algorithm: typeof PALWORLD_CONNECTION_ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type StoredConnectionPayload = {
  version: typeof PALWORLD_CONNECTION_VERSION;
  records: StoredPalworldServerConnection[];
};

export type StoredPalworldServerConnection = {
  ownerId: string;
  baseUrl: string;
  adminPassword: string;
  createdAt: string;
  updatedAt: string;
};

export type PalworldServerConnectionStoreOptions = {
  filePath: string;
  encryptionKey: string;
};

function exactKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key))
    && allowed.every((key) => Object.hasOwn(record, key));
}

function decodeEncryptionKey(value: string): Buffer {
  const key = /^[a-f0-9]{64}$/iu.test(value)
    ? Buffer.from(value, "hex")
    : /^[A-Za-z0-9+/]{43}=$/u.test(value)
      ? Buffer.from(value, "base64")
      : undefined;
  if (!key || key.byteLength !== 32 || (!/^[a-f0-9]{64}$/iu.test(value) && key.toString("base64") !== value)) {
    key?.fill(0);
    throw new Error("Palworld 서버 연결 암호화 키 형식이 올바르지 않습니다.");
  }
  return key;
}

function validIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 40
    && Number.isFinite(Date.parse(value));
}

function validStoredConnection(value: unknown): value is StoredPalworldServerConnection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return exactKeys(record, ["ownerId", "baseUrl", "adminPassword", "createdAt", "updatedAt"])
    && typeof record.ownerId === "string"
    && record.ownerId.length > 0
    && record.ownerId.length <= MAX_OWNER_ID_LENGTH
    && typeof record.baseUrl === "string"
    && record.baseUrl.length > 0
    && record.baseUrl.length <= MAX_BASE_URL_LENGTH
    && typeof record.adminPassword === "string"
    && record.adminPassword.length > 0
    && record.adminPassword.length <= MAX_ADMIN_PASSWORD_LENGTH
    && validIsoTimestamp(record.createdAt)
    && validIsoTimestamp(record.updatedAt);
}

function validEncryptedFile(value: unknown): value is EncryptedConnectionFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return exactKeys(record, ["version", "algorithm", "iv", "authTag", "ciphertext"])
    && record.version === PALWORLD_CONNECTION_VERSION
    && record.algorithm === PALWORLD_CONNECTION_ALGORITHM
    && typeof record.iv === "string"
    && typeof record.authTag === "string"
    && typeof record.ciphertext === "string"
    && record.iv.length <= 24
    && record.authTag.length <= 32
    && record.ciphertext.length <= MAX_CIPHERTEXT_BASE64_LENGTH;
}

function decodeCanonicalBase64(value: string): Buffer | undefined {
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) return undefined;
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    decoded.fill(0);
    return undefined;
  }
  return decoded;
}

function errnoCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function assertSafeStateDirectoryPath(directory: string): void {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  if (!isPalworldServerStateDirectoryLocationAllowed(directory)) {
    throw new PalworldServerConnectionStoreError("storage_invalid");
  }

  const relative = path.relative(root, resolved);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (errnoCode(error) === "ENOENT") return;
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
  }
}

function cloneConnection(record: StoredPalworldServerConnection): StoredPalworldServerConnection {
  return { ...record };
}

function normalizedOwnerId(value: string): string {
  const ownerId = value.trim();
  if (!ownerId || ownerId.length > MAX_OWNER_ID_LENGTH) {
    throw new Error("Palworld 서버 연결 owner ID가 올바르지 않습니다.");
  }
  return ownerId;
}

function normalizedConnectionInput(input: {
  ownerId: string;
  baseUrl: string;
  adminPassword: string;
}): Pick<StoredPalworldServerConnection, "ownerId" | "baseUrl" | "adminPassword"> {
  const ownerId = normalizedOwnerId(input.ownerId);
  const baseUrl = input.baseUrl.trim();
  if (!baseUrl || baseUrl.length > MAX_BASE_URL_LENGTH) {
    throw new Error("Palworld REST API URL이 올바르지 않습니다.");
  }
  if (!input.adminPassword || input.adminPassword.length > MAX_ADMIN_PASSWORD_LENGTH) {
    throw new Error("Palworld AdminPassword가 올바르지 않습니다.");
  }
  return { ownerId, baseUrl, adminPassword: input.adminPassword };
}

export class PalworldServerConnectionStore {
  private readonly encryptionKey: Buffer;
  private readonly filePath: string;
  private records = new Map<string, StoredPalworldServerConnection>();
  private operationQueue: Promise<void> = Promise.resolve();
  private storageExistedAtLoad = false;

  constructor(options: PalworldServerConnectionStoreOptions) {
    this.filePath = options.filePath;
    if (!path.isAbsolute(this.filePath)
      || path.basename(this.filePath) !== PALWORLD_CONNECTION_FILE_NAME) {
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
    this.encryptionKey = decodeEncryptionKey(options.encryptionKey);
    try {
      this.load();
    } catch (error) {
      this.encryptionKey.fill(0);
      if (error instanceof PalworldServerConnectionStoreError) throw error;
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
  }

  private runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private prepareDirectory(create: boolean): boolean {
    const directory = path.dirname(this.filePath);
    assertSafeStateDirectoryPath(directory);
    if (create) {
      try {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      } catch {
        throw new PalworldServerConnectionStoreError("storage_invalid");
      }
      assertSafeStateDirectoryPath(directory);
    }

    let descriptor: number;
    try {
      descriptor = fs.openSync(
        directory,
        fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW
      );
    } catch (error) {
      if (!create && errnoCode(error) === "ENOENT") return false;
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
    try {
      const stat = fs.fstatSync(descriptor);
      if (!stat.isDirectory()) throw new PalworldServerConnectionStoreError("storage_invalid");
      const currentUid = typeof process.getuid === "function" ? process.getuid() : undefined;
      if (currentUid !== undefined && currentUid !== 0 && stat.uid !== currentUid) {
        throw new PalworldServerConnectionStoreError("storage_invalid");
      }
      fs.fchmodSync(descriptor, 0o700);
      return true;
    } finally {
      fs.closeSync(descriptor);
    }
  }

  private load(): void {
    this.prepareDirectory(false);
    let descriptor: number;
    try {
      descriptor = fs.openSync(this.filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    } catch (error) {
      if (errnoCode(error) === "ENOENT") return;
      throw new PalworldServerConnectionStoreError("storage_invalid");
    }
    try {
      const fileStat = fs.fstatSync(descriptor);
      if (!fileStat.isFile() || fileStat.size > MAX_ENCRYPTED_FILE_BYTES) {
        throw new PalworldServerConnectionStoreError("storage_invalid");
      }
      fs.fchmodSync(descriptor, 0o600);
      const serialized = fs.readFileSync(descriptor, "utf8");
      if (Buffer.byteLength(serialized, "utf8") > MAX_ENCRYPTED_FILE_BYTES) {
        throw new PalworldServerConnectionStoreError("storage_invalid");
      }
      const raw = JSON.parse(serialized) as unknown;
      if (!validEncryptedFile(raw)) throw new Error("encrypted envelope invalid");
      const iv = decodeCanonicalBase64(raw.iv);
      const authTag = decodeCanonicalBase64(raw.authTag);
      const ciphertext = decodeCanonicalBase64(raw.ciphertext);
      let plaintext: Buffer | undefined;
      try {
        if (!iv || !authTag || !ciphertext) throw new Error("cipher encoding invalid");
        if (iv.byteLength !== 12 || authTag.byteLength !== 16) throw new Error("cipher parameters invalid");
        const decipher = crypto.createDecipheriv(PALWORLD_CONNECTION_ALGORITHM, this.encryptionKey, iv);
        decipher.setAAD(PALWORLD_CONNECTION_AAD);
        decipher.setAuthTag(authTag);
        plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
        if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("payload too large");
        const payload = JSON.parse(plaintext.toString("utf8")) as unknown;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("payload invalid");
        const record = payload as Record<string, unknown>;
        if (!exactKeys(record, ["version", "records"])
          || record.version !== PALWORLD_CONNECTION_VERSION
          || !Array.isArray(record.records)
          || record.records.length > MAX_CONNECTION_RECORDS
          || !record.records.every(validStoredConnection)) {
          throw new Error("payload schema invalid");
        }
        const next = new Map<string, StoredPalworldServerConnection>();
        for (const connection of record.records) {
          if (next.has(connection.ownerId)) throw new Error("duplicate owner");
          next.set(connection.ownerId, cloneConnection(connection));
        }
        this.records = next;
        this.storageExistedAtLoad = true;
      } finally {
        plaintext?.fill(0);
        iv?.fill(0);
        authTag?.fill(0);
        ciphertext?.fill(0);
      }
    } catch (error) {
      if (error instanceof PalworldServerConnectionStoreError) throw error;
      throw new PalworldServerConnectionStoreError("storage_invalid");
    } finally {
      fs.closeSync(descriptor);
    }
  }

  private async persist(records: Map<string, StoredPalworldServerConnection>): Promise<void> {
    if (records.size > MAX_CONNECTION_RECORDS) {
      throw new PalworldServerConnectionStoreError("storage_write_failed");
    }
    this.prepareDirectory(true);
    const payload: StoredConnectionPayload = {
      version: PALWORLD_CONNECTION_VERSION,
      records: [...records.values()].map(cloneConnection)
    };
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
      plaintext.fill(0);
      throw new PalworldServerConnectionStoreError("storage_write_failed");
    }
    const iv = crypto.randomBytes(12);
    let temporaryPath: string | undefined;
    try {
      const cipher = crypto.createCipheriv(PALWORLD_CONNECTION_ALGORITHM, this.encryptionKey, iv);
      cipher.setAAD(PALWORLD_CONNECTION_AAD);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const encrypted: EncryptedConnectionFile = {
        version: PALWORLD_CONNECTION_VERSION,
        algorithm: PALWORLD_CONNECTION_ALGORITHM,
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64")
      };
      temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
      await fs.promises.writeFile(temporaryPath, `${JSON.stringify(encrypted)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW
      });
      if (!this.storageExistedAtLoad) {
        const linkedTemporaryPath = temporaryPath;
        try {
          await fs.promises.link(linkedTemporaryPath, this.filePath);
        } catch {
          throw new PalworldServerConnectionStoreError("storage_write_failed");
        }
        this.storageExistedAtLoad = true;
        await fs.promises.unlink(linkedTemporaryPath).catch(() => undefined);
        temporaryPath = undefined;
      } else {
        try {
          const existing = fs.lstatSync(this.filePath);
          if (existing.isSymbolicLink() || !existing.isFile()) {
            throw new PalworldServerConnectionStoreError("storage_write_failed");
          }
        } catch (error) {
          if (errnoCode(error) !== "ENOENT") throw error;
          throw new PalworldServerConnectionStoreError("storage_write_failed");
        }
        await fs.promises.rename(temporaryPath, this.filePath);
        temporaryPath = undefined;
      }
      const descriptor = fs.openSync(this.filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        fs.fchmodSync(descriptor, 0o600);
      } finally {
        fs.closeSync(descriptor);
      }
    } catch (error) {
      if (error instanceof PalworldServerConnectionStoreError) throw error;
      throw new PalworldServerConnectionStoreError("storage_write_failed");
    } finally {
      plaintext.fill(0);
      if (temporaryPath) await fs.promises.unlink(temporaryPath).catch(() => undefined);
    }
  }

  get(ownerId: string): StoredPalworldServerConnection | undefined {
    const connection = this.records.get(normalizedOwnerId(ownerId));
    return connection ? cloneConnection(connection) : undefined;
  }

  listOwnerIds(): string[] {
    return [...this.records.keys()];
  }

  async set(input: {
    ownerId: string;
    baseUrl: string;
    adminPassword: string;
  }): Promise<StoredPalworldServerConnection> {
    return this.runExclusive(async () => {
      const normalized = normalizedConnectionInput(input);
      const previous = this.records.get(normalized.ownerId);
      const now = new Date().toISOString();
      const connection: StoredPalworldServerConnection = {
        ...normalized,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
      };
      const next = new Map(this.records);
      next.set(connection.ownerId, connection);
      await this.persist(next);
      this.records = next;
      return cloneConnection(connection);
    });
  }

  async remove(ownerId: string): Promise<boolean> {
    return this.runExclusive(async () => {
      const normalized = normalizedOwnerId(ownerId);
      if (!this.records.has(normalized)) return false;
      const next = new Map(this.records);
      next.delete(normalized);
      await this.persist(next);
      this.records = next;
      return true;
    });
  }
}
