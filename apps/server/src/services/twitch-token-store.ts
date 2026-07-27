import { promises as fs } from "node:fs";
import path from "node:path";
import type { TwitchBroadcasterInfo } from "@streamops/shared";
import {
  decodeTwitchTokenEncryptionKey,
  decryptTwitchTokenDocument,
  encryptTwitchTokenDocument
} from "./twitch-token-encryption.js";

export const TWITCH_TOKEN_AAD = "streamops:twitch-token:v1";

export type TwitchStoredToken = {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  scopes: string[];
  expiresAt: string;
  broadcaster: TwitchBroadcasterInfo;
  updatedAt: string;
};

const TOKEN_KEYS = [
  "accessToken",
  "broadcaster",
  "expiresAt",
  "refreshToken",
  "scopes",
  "tokenType",
  "updatedAt"
] as const;
const BROADCASTER_KEYS = ["displayName", "id", "login", "profileImageUrl"] as const;

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function parseTwitchStoredToken(value: unknown, expectedBroadcasterId?: string): TwitchStoredToken {
  const input = plainRecord(value);
  const broadcaster = plainRecord(input?.broadcaster);
  if (
    !input
    || !broadcaster
    || !hasOnlyKeys(input, TOKEN_KEYS)
    || !hasOnlyKeys(broadcaster, BROADCASTER_KEYS)
    || typeof input.accessToken !== "string"
    || input.accessToken.length === 0
    || typeof input.refreshToken !== "string"
    || input.refreshToken.length === 0
    || input.tokenType !== "bearer"
    || !Array.isArray(input.scopes)
    || !input.scopes.every((scope) => typeof scope === "string" && scope.trim().length > 0)
    || typeof input.expiresAt !== "string"
    || !Number.isFinite(Date.parse(input.expiresAt))
    || typeof input.updatedAt !== "string"
    || !Number.isFinite(Date.parse(input.updatedAt))
    || typeof broadcaster.id !== "string"
    || broadcaster.id.length === 0
    || (expectedBroadcasterId !== undefined && broadcaster.id !== expectedBroadcasterId)
    || typeof broadcaster.login !== "string"
    || broadcaster.login.length === 0
    || typeof broadcaster.displayName !== "string"
    || broadcaster.displayName.length === 0
    || (broadcaster.profileImageUrl !== undefined && typeof broadcaster.profileImageUrl !== "string")
  ) {
    throw new Error("Twitch OAuth token 저장소 schema가 올바르지 않습니다.");
  }
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenType: "bearer",
    scopes: [...new Set(input.scopes.map((scope) => String(scope).trim()))],
    expiresAt: input.expiresAt,
    broadcaster: {
      id: broadcaster.id,
      login: broadcaster.login,
      displayName: broadcaster.displayName,
      ...(broadcaster.profileImageUrl ? { profileImageUrl: broadcaster.profileImageUrl } : {})
    },
    updatedAt: input.updatedAt
  };
}

export interface TwitchTokenStore {
  get(): Promise<TwitchStoredToken | undefined>;
  set(token: TwitchStoredToken): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTwitchTokenStore implements TwitchTokenStore {
  private token?: TwitchStoredToken;

  async get(): Promise<TwitchStoredToken | undefined> {
    return this.token;
  }

  async set(token: TwitchStoredToken): Promise<void> {
    this.token = token;
  }

  async clear(): Promise<void> {
    this.token = undefined;
  }
}

export class LocalJsonTwitchTokenStore implements TwitchTokenStore {
  private readonly encryptionKey?: Buffer;
  private mutationChain: Promise<void> = Promise.resolve();
  private loadState: "not_loaded" | "ready" | "corrupted" | "unreadable" | "encryption_failed" = "not_loaded";
  private loadFailure?: Error;

  constructor(
    private readonly filePath: string,
    encryptionKey = ""
  ) {
    this.encryptionKey = decodeTwitchTokenEncryptionKey(encryptionKey);
  }

  async get(): Promise<TwitchStoredToken | undefined> {
    if (this.loadState !== "not_loaded" && this.loadState !== "ready") {
      throw this.loadFailure ?? new Error(`STATE_UNAVAILABLE:twitch_token:${this.loadState}`);
    }
    try {
      await this.hardenStoragePermissions();
      const raw = await fs.readFile(this.filePath, "utf8");
      let decoded: ReturnType<typeof decryptTwitchTokenDocument>;
      try {
        decoded = decryptTwitchTokenDocument(raw, this.encryptionKey, TWITCH_TOKEN_AAD);
      } catch {
        this.failClosed("encryption_failed");
      }
      const parsed = parseTwitchStoredToken(JSON.parse(decoded.plaintext));
      if (decoded.legacyPlaintext && this.encryptionKey) {
        this.failClosed("encryption_failed", "평문 Twitch OAuth token 저장소는 승인된 마이그레이션이 필요합니다.");
      }
      this.loadState = "ready";
      return parsed;
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        this.loadState = "ready";
        return undefined;
      }
      if (this.loadState === "not_loaded" || this.loadState === "ready") {
        const state = typeof error === "object" && error && "code" in error
          ? "unreadable"
          : "corrupted";
        this.failClosed(state);
      }
      throw error;
    }
  }

  async set(token: TwitchStoredToken): Promise<void> {
    const validated = parseTwitchStoredToken(token);
    await this.enqueueMutation(async () => {
      await this.assertMutationAllowed();
      await this.writeToken(validated);
    });
  }

  private async writeToken(token: TwitchStoredToken): Promise<void> {
    await this.ensureStorageDirectory();
    const temporaryPath = `${this.filePath}.tmp`;
    const plaintext = JSON.stringify(token);
    const document = this.encryptionKey
      ? encryptTwitchTokenDocument(plaintext, this.encryptionKey, TWITCH_TOKEN_AAD)
      : `${JSON.stringify(token, null, 2)}\n`;
    await fs.writeFile(temporaryPath, document, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryPath, this.filePath);
    await fs.chmod(this.filePath, 0o600);
  }

  async clear(): Promise<void> {
    await this.enqueueMutation(async () => {
      await this.assertMutationAllowed();
      try {
        await fs.unlink(this.filePath);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return;
        throw error;
      }
    });
  }

  private async enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const pending = this.mutationChain.then(operation, operation);
    this.mutationChain = pending.catch(() => undefined);
    return pending;
  }

  getLoadState(): typeof this.loadState {
    return this.loadState;
  }

  private async assertMutationAllowed(): Promise<void> {
    if (this.loadState === "not_loaded") await this.get();
    if (this.loadState !== "ready") {
      throw this.loadFailure ?? new Error(`STATE_UNAVAILABLE:twitch_token:${this.loadState}`);
    }
  }

  private failClosed(
    state: Exclude<typeof this.loadState, "not_loaded" | "ready">,
    message = `STATE_UNAVAILABLE:twitch_token:${state}`
  ): never {
    this.loadState = state;
    this.loadFailure = new Error(message);
    throw this.loadFailure;
  }

  private async ensureStorageDirectory(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
  }

  private async hardenStoragePermissions(): Promise<void> {
    await this.ensureStorageDirectory();
    try {
      await fs.chmod(this.filePath, 0o600);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
  }
}
