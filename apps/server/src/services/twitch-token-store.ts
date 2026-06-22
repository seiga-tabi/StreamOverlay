import { promises as fs } from "node:fs";
import path from "node:path";
import type { TwitchBroadcasterInfo } from "@streamops/shared";

export type TwitchStoredToken = {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  scopes: string[];
  expiresAt: string;
  broadcaster: TwitchBroadcasterInfo;
  updatedAt: string;
};

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
  constructor(private readonly filePath: string) {}

  async get(): Promise<TwitchStoredToken | undefined> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as TwitchStoredToken;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.broadcaster?.id) return undefined;
      return parsed;
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async set(token: TwitchStoredToken): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    // TODO: 운영 전 DB 또는 OS secret store/encryption 기반 저장소로 교체해야 합니다.
    await fs.writeFile(temporaryPath, `${JSON.stringify(token, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporaryPath, this.filePath);
    await fs.chmod(this.filePath, 0o600);
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
  }
}
