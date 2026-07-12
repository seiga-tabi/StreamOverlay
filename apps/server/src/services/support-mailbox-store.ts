import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  SupportMailInboundPayload,
  SupportMailMessage,
  SupportMailMessageSummary
} from "@streamops/shared";

const MAILBOX_AAD = Buffer.from("yoro-support-mailbox:v1", "utf8");
const MAILBOX_ALGORITHM = "aes-256-gcm";

type EncryptedMailboxFile = {
  version: 1;
  algorithm: typeof MAILBOX_ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type MailboxPayload = {
  version: 1;
  messages: SupportMailMessage[];
};

export type SupportMailboxFilter = "all" | "unread" | "read";

export type SupportMailboxStoreOptions = {
  filePath: string;
  encryptionKey: string;
  retentionDays: number;
  maxMessages: number;
};

function decodeEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  const key = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (key.byteLength !== 32) {
    throw new Error("SUPPORT_MAILBOX_ENCRYPTION_KEY는 32바이트 base64 또는 64자리 hex 값이어야 합니다.");
  }
  return key;
}

function cleanPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function messageSummary(message: SupportMailMessage): SupportMailMessageSummary {
  const { text, ...summary } = message;
  return { ...summary, preview: cleanPreview(text) };
}

function cloneMessage(message: SupportMailMessage): SupportMailMessage {
  return {
    ...message,
    from: { ...message.from },
    attachments: message.attachments.map((attachment) => ({ ...attachment }))
  };
}

function validStoredMessage(value: unknown): value is SupportMailMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.providerMessageId === "string"
    && typeof record.subject === "string"
    && typeof record.text === "string"
    && typeof record.receivedAt === "string"
    && typeof record.storedAt === "string"
    && typeof record.to === "string"
    && typeof record.sizeBytes === "number"
    && Boolean(record.from && typeof record.from === "object")
    && Array.isArray(record.attachments);
}

export class SupportMailboxStore {
  private readonly encryptionKey: Buffer;
  private readonly retentionMs: number;
  private readonly maxMessages: number;
  private messages: SupportMailMessage[] = [];
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: SupportMailboxStoreOptions) {
    this.encryptionKey = decodeEncryptionKey(options.encryptionKey);
    this.retentionMs = Math.max(1, options.retentionDays) * 24 * 60 * 60 * 1000;
    this.maxMessages = Math.max(1, options.maxMessages);
    this.load();
  }

  private runExclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private load(): void {
    if (!fs.existsSync(this.options.filePath)) return;
    const encrypted = JSON.parse(fs.readFileSync(this.options.filePath, "utf8")) as EncryptedMailboxFile;
    if (encrypted.version !== 1 || encrypted.algorithm !== MAILBOX_ALGORITHM) {
      throw new Error("지원 메일함 저장 파일 버전을 읽을 수 없습니다.");
    }
    const decipher = crypto.createDecipheriv(MAILBOX_ALGORITHM, this.encryptionKey, Buffer.from(encrypted.iv, "base64"));
    decipher.setAAD(MAILBOX_AAD);
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as MailboxPayload;
    this.messages = Array.isArray(payload.messages)
      ? payload.messages.filter(validStoredMessage).map(cloneMessage)
      : [];
    this.cleanupExpired();
  }

  private cleanupExpired(now = Date.now()): boolean {
    const next = this.messages.filter((message) => {
      const receivedAt = Date.parse(message.receivedAt);
      return Number.isFinite(receivedAt) && now - receivedAt < this.retentionMs;
    });
    if (next.length === this.messages.length) return false;
    this.messages = next;
    return true;
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.options.filePath);
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    const plaintext = Buffer.from(JSON.stringify({ version: 1, messages: this.messages } satisfies MailboxPayload), "utf8");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(MAILBOX_ALGORITHM, this.encryptionKey, iv);
    cipher.setAAD(MAILBOX_AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const encrypted: EncryptedMailboxFile = {
      version: 1,
      algorithm: MAILBOX_ALGORITHM,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
    const tmpPath = `${this.options.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmpPath, `${JSON.stringify(encrypted)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.promises.rename(tmpPath, this.options.filePath);
  }

  async add(payload: SupportMailInboundPayload): Promise<{ message: SupportMailMessage; deduplicated: boolean }> {
    return this.runExclusive(async () => {
      this.cleanupExpired();
      const existing = this.messages.find((message) => message.providerMessageId === payload.providerMessageId);
      if (existing) return { message: cloneMessage(existing), deduplicated: true };
      const storedAt = new Date().toISOString();
      const message: SupportMailMessage = {
        id: crypto.randomUUID(),
        providerMessageId: payload.providerMessageId,
        from: {
          address: payload.fromAddress,
          name: payload.fromName || undefined
        },
        to: payload.envelopeTo,
        replyTo: payload.replyTo || undefined,
        subject: payload.subject,
        text: payload.text,
        receivedAt: payload.receivedAt,
        storedAt,
        sizeBytes: payload.sizeBytes,
        attachments: payload.attachments.map((attachment) => ({ ...attachment }))
      };
      this.messages = [message, ...this.messages]
        .sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt))
        .slice(0, this.maxMessages);
      await this.persist();
      return { message: cloneMessage(message), deduplicated: false };
    });
  }

  async list(filter: SupportMailboxFilter = "all", limit = 100): Promise<SupportMailMessageSummary[]> {
    return this.runExclusive(async () => {
      if (this.cleanupExpired()) await this.persist();
      return this.messages
        .filter((message) => filter === "all" || (filter === "unread" ? !message.readAt : Boolean(message.readAt)))
        .slice(0, Math.max(1, Math.min(200, Math.trunc(limit))))
        .map(messageSummary);
    });
  }

  async counts(): Promise<{ totalCount: number; unreadCount: number }> {
    return this.runExclusive(async () => {
      if (this.cleanupExpired()) await this.persist();
      return {
        totalCount: this.messages.length,
        unreadCount: this.messages.filter((message) => !message.readAt).length
      };
    });
  }

  async get(id: string): Promise<SupportMailMessage | undefined> {
    return this.runExclusive(async () => {
      if (this.cleanupExpired()) await this.persist();
      const message = this.messages.find((candidate) => candidate.id === id);
      return message ? cloneMessage(message) : undefined;
    });
  }

  async setRead(id: string, read: boolean): Promise<SupportMailMessage | undefined> {
    return this.runExclusive(async () => {
      const index = this.messages.findIndex((message) => message.id === id);
      if (index < 0) return undefined;
      const current = this.messages[index]!;
      const updated = { ...current, readAt: read ? current.readAt ?? new Date().toISOString() : undefined };
      this.messages = this.messages.map((message, messageIndex) => messageIndex === index ? updated : message);
      await this.persist();
      return cloneMessage(updated);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.runExclusive(async () => {
      const next = this.messages.filter((message) => message.id !== id);
      if (next.length === this.messages.length) return false;
      this.messages = next;
      await this.persist();
      return true;
    });
  }
}
