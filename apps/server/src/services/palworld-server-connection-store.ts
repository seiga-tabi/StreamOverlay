import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PALWORLD_CONNECTION_AAD = Buffer.from("streamops:palworld-server-connections:v1", "utf8");
const PALWORLD_CONNECTION_ALGORITHM = "aes-256-gcm";
const PALWORLD_CONNECTION_VERSION = 1;
const MAX_OWNER_ID_LENGTH = 128;
const MAX_BASE_URL_LENGTH = 2048;
const MAX_ADMIN_PASSWORD_LENGTH = 256;

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
  const trimmed = value.trim();
  const key = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.byteLength !== 32) {
    throw new Error("PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY는 32바이트 base64 또는 64자리 hex 값이어야 합니다.");
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
    && typeof record.ciphertext === "string";
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
  private records = new Map<string, StoredPalworldServerConnection>();
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: PalworldServerConnectionStoreOptions) {
    this.encryptionKey = decodeEncryptionKey(options.encryptionKey);
    this.load();
  }

  private runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private load(): void {
    if (!fs.existsSync(this.options.filePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.options.filePath, "utf8")) as unknown;
      if (!validEncryptedFile(raw)) throw new Error("encrypted envelope invalid");
      const iv = Buffer.from(raw.iv, "base64");
      const authTag = Buffer.from(raw.authTag, "base64");
      if (iv.byteLength !== 12 || authTag.byteLength !== 16) throw new Error("cipher parameters invalid");
      const decipher = crypto.createDecipheriv(PALWORLD_CONNECTION_ALGORITHM, this.encryptionKey, iv);
      decipher.setAAD(PALWORLD_CONNECTION_AAD);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(raw.ciphertext, "base64")),
        decipher.final()
      ]);
      try {
        const payload = JSON.parse(plaintext.toString("utf8")) as unknown;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("payload invalid");
        const record = payload as Record<string, unknown>;
        if (!exactKeys(record, ["version", "records"])
          || record.version !== PALWORLD_CONNECTION_VERSION
          || !Array.isArray(record.records)
          || !record.records.every(validStoredConnection)) {
          throw new Error("payload schema invalid");
        }
        const next = new Map<string, StoredPalworldServerConnection>();
        for (const connection of record.records) {
          if (next.has(connection.ownerId)) throw new Error("duplicate owner");
          next.set(connection.ownerId, cloneConnection(connection));
        }
        this.records = next;
      } finally {
        plaintext.fill(0);
      }
    } catch {
      throw new Error("Palworld 서버 연결 저장소를 복호화하거나 검증할 수 없습니다.");
    }
  }

  private async persist(records: Map<string, StoredPalworldServerConnection>): Promise<void> {
    const directory = path.dirname(this.options.filePath);
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.promises.chmod(directory, 0o700);
    const payload: StoredConnectionPayload = {
      version: PALWORLD_CONNECTION_VERSION,
      records: [...records.values()].map(cloneConnection)
    };
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
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
      temporaryPath = `${this.options.filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
      await fs.promises.writeFile(temporaryPath, `${JSON.stringify(encrypted)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await fs.promises.rename(temporaryPath, this.options.filePath);
      await fs.promises.chmod(this.options.filePath, 0o600);
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
