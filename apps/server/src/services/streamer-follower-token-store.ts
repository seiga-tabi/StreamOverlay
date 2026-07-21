import { promises as fs } from "node:fs";
import path from "node:path";
import type { TwitchStoredToken } from "./twitch-token-store.js";

const STORE_VERSION = 1;
const TWITCH_USER_ID_PATTERN = /^\d{1,32}$/;

type StoredTokenDocument = {
  version: typeof STORE_VERSION;
  tokensByBroadcasterId: Record<string, TwitchStoredToken>;
};

export interface StreamerFollowerTokenStore {
  get(broadcasterId: string): Promise<TwitchStoredToken | undefined>;
  set(broadcasterId: string, token: TwitchStoredToken): Promise<void>;
  setIfUnchanged(
    broadcasterId: string,
    expected: Pick<TwitchStoredToken, "updatedAt" | "refreshToken">,
    token: TwitchStoredToken
  ): Promise<boolean>;
  clear(broadcasterId: string): Promise<void>;
}

function tokenMatchesExpected(
  token: TwitchStoredToken | undefined,
  expected: Pick<TwitchStoredToken, "updatedAt" | "refreshToken">
): boolean {
  return Boolean(token && token.updatedAt === expected.updatedAt && token.refreshToken === expected.refreshToken);
}

function requiredBroadcasterId(value: string): string {
  const broadcasterId = value.trim();
  if (!TWITCH_USER_ID_PATTERN.test(broadcasterId)) {
    throw new Error("Twitch broadcaster ID가 올바르지 않습니다.");
  }
  return broadcasterId;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function cloneStoredToken(token: TwitchStoredToken): TwitchStoredToken {
  return {
    ...token,
    scopes: [...token.scopes],
    broadcaster: { ...token.broadcaster }
  };
}

function normalizedStoredToken(value: unknown, broadcasterId: string): TwitchStoredToken | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const broadcaster = input.broadcaster;
  if (!broadcaster || typeof broadcaster !== "object" || Array.isArray(broadcaster)) return undefined;
  const broadcasterInput = broadcaster as Record<string, unknown>;
  const storedBroadcasterId = optionalString(broadcasterInput.id);
  const accessToken = optionalString(input.accessToken);
  const refreshToken = optionalString(input.refreshToken);
  const login = optionalString(broadcasterInput.login);
  const displayName = optionalString(broadcasterInput.displayName);
  const expiresAt = optionalString(input.expiresAt);
  const updatedAt = optionalString(input.updatedAt);
  if (
    storedBroadcasterId !== broadcasterId ||
    !TWITCH_USER_ID_PATTERN.test(storedBroadcasterId) ||
    !accessToken ||
    !refreshToken ||
    input.tokenType !== "bearer" ||
    !login ||
    !displayName ||
    !expiresAt ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    !updatedAt ||
    !Number.isFinite(Date.parse(updatedAt)) ||
    !Array.isArray(input.scopes) ||
    !input.scopes.every((scope) => typeof scope === "string" && scope.trim().length > 0)
  ) return undefined;

  const profileImageUrl = optionalString(broadcasterInput.profileImageUrl);
  return {
    accessToken,
    refreshToken,
    tokenType: "bearer",
    scopes: [...new Set(input.scopes.map((scope) => String(scope).trim()))],
    expiresAt,
    broadcaster: {
      id: broadcasterId,
      login,
      displayName,
      ...(profileImageUrl ? { profileImageUrl } : {})
    },
    updatedAt
  };
}

function validatedToken(broadcasterId: string, token: TwitchStoredToken): TwitchStoredToken {
  const normalized = normalizedStoredToken(token, broadcasterId);
  if (!normalized) throw new Error("저장할 Twitch follower OAuth token 형식이 올바르지 않습니다.");
  return normalized;
}

export class MemoryStreamerFollowerTokenStore implements StreamerFollowerTokenStore {
  private readonly tokens = new Map<string, TwitchStoredToken>();

  async get(broadcasterId: string): Promise<TwitchStoredToken | undefined> {
    const token = this.tokens.get(requiredBroadcasterId(broadcasterId));
    return token ? cloneStoredToken(token) : undefined;
  }

  async set(broadcasterId: string, token: TwitchStoredToken): Promise<void> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    this.tokens.set(ownerId, validatedToken(ownerId, token));
  }

  async setIfUnchanged(
    broadcasterId: string,
    expected: Pick<TwitchStoredToken, "updatedAt" | "refreshToken">,
    token: TwitchStoredToken
  ): Promise<boolean> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    if (!tokenMatchesExpected(this.tokens.get(ownerId), expected)) return false;
    this.tokens.set(ownerId, validatedToken(ownerId, token));
    return true;
  }

  async clear(broadcasterId: string): Promise<void> {
    this.tokens.delete(requiredBroadcasterId(broadcasterId));
  }
}

export class LocalJsonStreamerFollowerTokenStore implements StreamerFollowerTokenStore {
  private readonly tokens = new Map<string, TwitchStoredToken>();
  private loadInFlight?: Promise<void>;
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async get(broadcasterId: string): Promise<TwitchStoredToken | undefined> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    await this.ensureLoaded();
    await this.mutationChain;
    const token = this.tokens.get(ownerId);
    return token ? cloneStoredToken(token) : undefined;
  }

  async set(broadcasterId: string, token: TwitchStoredToken): Promise<void> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    const next = validatedToken(ownerId, token);
    await this.ensureLoaded();
    await this.enqueueMutation(async () => {
      const previous = this.tokens.get(ownerId);
      this.tokens.set(ownerId, next);
      try {
        await this.persist();
      } catch (error) {
        if (previous) this.tokens.set(ownerId, previous);
        else this.tokens.delete(ownerId);
        throw error;
      }
    });
  }

  async setIfUnchanged(
    broadcasterId: string,
    expected: Pick<TwitchStoredToken, "updatedAt" | "refreshToken">,
    token: TwitchStoredToken
  ): Promise<boolean> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    const next = validatedToken(ownerId, token);
    await this.ensureLoaded();
    let saved = false;
    await this.enqueueMutation(async () => {
      const previous = this.tokens.get(ownerId);
      if (!tokenMatchesExpected(previous, expected)) return;
      this.tokens.set(ownerId, next);
      try {
        await this.persist();
        saved = true;
      } catch (error) {
        if (previous) this.tokens.set(ownerId, previous);
        else this.tokens.delete(ownerId);
        throw error;
      }
    });
    return saved;
  }

  async clear(broadcasterId: string): Promise<void> {
    const ownerId = requiredBroadcasterId(broadcasterId);
    await this.ensureLoaded();
    await this.enqueueMutation(async () => {
      const previous = this.tokens.get(ownerId);
      if (!previous) return;
      this.tokens.delete(ownerId);
      try {
        await this.persist();
      } catch (error) {
        this.tokens.set(ownerId, previous);
        throw error;
      }
    });
  }

  private async ensureLoaded(): Promise<void> {
    this.loadInFlight ??= this.load();
    return this.loadInFlight;
  }

  private async load(): Promise<void> {
    await this.ensureStorageDirectory();
    try {
      await fs.chmod(this.filePath, 0o600);
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredTokenDocument>;
      if (parsed.version !== STORE_VERSION || !parsed.tokensByBroadcasterId || typeof parsed.tokensByBroadcasterId !== "object") {
        throw new Error("Twitch follower OAuth token 저장소 버전 또는 형식이 올바르지 않습니다.");
      }
      const loaded = new Map<string, TwitchStoredToken>();
      for (const [rawBroadcasterId, value] of Object.entries(parsed.tokensByBroadcasterId)) {
        const broadcasterId = requiredBroadcasterId(rawBroadcasterId);
        const token = normalizedStoredToken(value, broadcasterId);
        if (!token) throw new Error("Twitch follower OAuth token 저장소에 올바르지 않은 레코드가 있습니다.");
        loaded.set(broadcasterId, token);
      }
      this.tokens.clear();
      for (const [broadcasterId, token] of loaded) this.tokens.set(broadcasterId, token);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
  }

  private async enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const pending = this.mutationChain.then(operation, operation);
    this.mutationChain = pending.catch(() => undefined);
    return pending;
  }

  private async persist(): Promise<void> {
    await this.ensureStorageDirectory();
    const document: StoredTokenDocument = {
      version: STORE_VERSION,
      tokensByBroadcasterId: Object.fromEntries(
        [...this.tokens.entries()].map(([broadcasterId, token]) => [broadcasterId, cloneStoredToken(token)])
      )
    };
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryPath, this.filePath);
    await fs.chmod(this.filePath, 0o600);
  }

  private async ensureStorageDirectory(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
  }
}
