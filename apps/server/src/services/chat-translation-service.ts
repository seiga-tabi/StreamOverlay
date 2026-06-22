import { appConfig } from "../config.js";

export type ChatTranslationLanguage = "ko" | "ja";

export type ChatTranslationResult = {
  sourceLanguage: ChatTranslationLanguage;
  targetLanguage: ChatTranslationLanguage;
  translatedText: string;
};

export type ChatTranslationServiceConfig = {
  enabled: boolean;
  provider: "mock";
  maxInputLength: number;
  cacheTtlMs: number;
  maxTranslationsPerMinute: number;
};

type CacheEntry = {
  result: ChatTranslationResult;
  expiresAt: number;
};

const HANGUL_RE = /[\uac00-\ud7a3]/g;
const JAPANESE_KANA_RE = /[\u3040-\u30ff]/g;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]+/g;
const HTML_BRACKETS_RE = /[<>]/g;
function defaultConfig(): ChatTranslationServiceConfig {
  return {
    enabled: appConfig.translation.chatEnabled,
    provider: "mock",
    maxInputLength: appConfig.translation.maxInputLength,
    cacheTtlMs: appConfig.translation.cacheTtlMs,
    maxTranslationsPerMinute: appConfig.translation.maxTranslationsPerMinute
  };
}

function countMatches(input: string, pattern: RegExp): number {
  return input.match(pattern)?.length ?? 0;
}

function sanitizeTranslationText(input: unknown, maxLength: number): string {
  return String(input ?? "")
    .replace(CONTROL_CHARS_RE, " ")
    .replace(HTML_BRACKETS_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function detectKoJaLanguage(input: string): ChatTranslationLanguage | undefined {
  const koreanCount = countMatches(input, HANGUL_RE);
  const japaneseCount = countMatches(input, JAPANESE_KANA_RE);
  if (koreanCount === 0 && japaneseCount === 0) return undefined;
  if (koreanCount > 0 && japaneseCount === 0) return "ko";
  if (japaneseCount > 0 && koreanCount === 0) return "ja";
  return koreanCount >= japaneseCount * 2 ? "ko" : japaneseCount >= koreanCount * 2 ? "ja" : undefined;
}

export function targetLanguageFor(sourceLanguage: ChatTranslationLanguage): ChatTranslationLanguage {
  return sourceLanguage === "ko" ? "ja" : "ko";
}

export class ChatTranslationService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<ChatTranslationResult | undefined>>();
  private windowStartedAt = Date.now();
  private windowCount = 0;

  constructor(private readonly config: ChatTranslationServiceConfig = defaultConfig()) {}

  async translateChatMessage(message: string): Promise<ChatTranslationResult | undefined> {
    if (!this.config.enabled) return undefined;
    const sourceLanguage = detectKoJaLanguage(message);
    if (!sourceLanguage) return undefined;

    const targetLanguage = targetLanguageFor(sourceLanguage);
    const safeMessage = sanitizeTranslationText(message, this.config.maxInputLength);
    if (!safeMessage) return undefined;

    const cacheKey = `${sourceLanguage}:${targetLanguage}:${safeMessage}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const pending = this.pending.get(cacheKey);
    if (pending) return pending;

    if (!this.consumeRateLimit()) return undefined;

    const request = this.translateSafe(safeMessage, sourceLanguage, targetLanguage)
      .then((result) => {
        if (result) this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.config.cacheTtlMs });
        return result;
      })
      .finally(() => this.pending.delete(cacheKey));
    this.pending.set(cacheKey, request);
    return request;
  }

  private async translateSafe(
    text: string,
    sourceLanguage: ChatTranslationLanguage,
    targetLanguage: ChatTranslationLanguage
  ): Promise<ChatTranslationResult | undefined> {
    void this.config.provider;
    return {
      sourceLanguage,
      targetLanguage,
      translatedText: `[${targetLanguage}] ${text}`
    };
  }

  private consumeRateLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStartedAt >= 60_000) {
      this.windowStartedAt = now;
      this.windowCount = 0;
    }
    if (this.windowCount >= this.config.maxTranslationsPerMinute) return false;
    this.windowCount += 1;
    return true;
  }
}

export function createDefaultChatTranslationService(): ChatTranslationService {
  return new ChatTranslationService(defaultConfig());
}
