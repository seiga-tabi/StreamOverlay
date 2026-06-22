import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../config.js";

export type RiotApiKeySource = "runtime" | "env" | "none";

export type RiotApiKeyStatus = {
  configured: boolean;
  source: RiotApiKeySource;
  maskedKey?: string;
  updatedAt?: string;
};

export type RiotApiKeyProvider = {
  getApiKey(): string;
  getUpdatedAt(): string | undefined;
  setApiKey(apiKey: string): RiotApiKeyStatus;
  clearApiKey(): RiotApiKeyStatus;
};

type StoredRiotApiKey = {
  apiKey?: unknown;
  updatedAt?: unknown;
};

export function sanitizeRiotApiKey(input: unknown): string {
  if (typeof input !== "string") throw new Error("Riot API key는 문자열이어야 합니다.");
  const apiKey = input.trim();
  if (!apiKey) throw new Error("Riot API key가 필요합니다.");
  if (apiKey.length < 8) throw new Error("Riot API key가 너무 짧습니다.");
  if (apiKey.length > 256) throw new Error("Riot API key가 너무 깁니다.");
  if (!/^[A-Za-z0-9._-]+$/.test(apiKey)) throw new Error("Riot API key에 허용되지 않은 문자가 있습니다.");
  return apiKey;
}

export function maskRiotApiKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 10) return `${apiKey.slice(0, 2)}...${apiKey.slice(-2)}`;
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export function riotApiKeyStatus(apiKey: string, source: RiotApiKeySource, updatedAt?: string): RiotApiKeyStatus {
  return {
    configured: Boolean(apiKey),
    source: apiKey ? source : "none",
    maskedKey: apiKey ? maskRiotApiKey(apiKey) : undefined,
    updatedAt
  };
}

export class LocalJsonRiotApiKeyStore implements RiotApiKeyProvider {
  private cached: { apiKey: string; updatedAt?: string } | undefined;
  private loaded = false;

  constructor(private readonly filePath = path.resolve(appConfig.paths.state, "riot-api-key.json")) {}

  getApiKey(): string {
    return this.readCache()?.apiKey ?? "";
  }

  getUpdatedAt(): string | undefined {
    return this.readCache()?.updatedAt;
  }

  setApiKey(input: string): RiotApiKeyStatus {
    const apiKey = sanitizeRiotApiKey(input);
    const updatedAt = new Date().toISOString();
    this.write({ apiKey, updatedAt });
    this.cached = { apiKey, updatedAt };
    this.loaded = true;
    return riotApiKeyStatus(apiKey, "runtime", updatedAt);
  }

  clearApiKey(): RiotApiKeyStatus {
    this.cached = undefined;
    this.loaded = true;
    try {
      fs.rmSync(this.filePath, { force: true });
    } catch {
      // 삭제 실패는 다음 저장 시 atomic write로 복구합니다.
    }
    return riotApiKeyStatus("", "none");
  }

  private readCache(): { apiKey: string; updatedAt?: string } | undefined {
    if (this.loaded) return this.cached;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredRiotApiKey;
      const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
      if (!apiKey) return undefined;
      this.cached = {
        apiKey,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined
      };
      return this.cached;
    } catch {
      this.cached = undefined;
      return undefined;
    }
  }

  private write(payload: { apiKey: string; updatedAt: string }): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmpPath, this.filePath);
  }
}
