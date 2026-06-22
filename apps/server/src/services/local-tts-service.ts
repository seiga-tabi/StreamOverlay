import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { OverlayBannerMessage } from "@streamops/shared";
import { toSafeErrorMessage } from "@streamops/shared";
import { appConfig } from "../config.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";

type VoicevoxAudioQuery = Record<string, unknown> & {
  speedScale?: number;
  pitchScale?: number;
  volumeScale?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePublicPath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "/tts";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function speechTextForBanner(message: OverlayBannerMessage, maxLength: number): string | undefined {
  if (message.speechEnabled !== true) return undefined;
  const raw = hasText(message.speechText)
    ? message.speechText
    : [message.title, message.message].filter(hasText).join("。");
  const normalized = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return undefined;
  return normalized.slice(0, Math.max(1, maxLength));
}

export class LocalTtsService {
  constructor(private readonly logger: JsonlLogger) {}

  async synthesizeOverlaySpeech(message: OverlayBannerMessage): Promise<string | undefined> {
    const config = appConfig.localTts;
    if (!config.enabled) return undefined;
    if (message.speechAudioUrl) return message.speechAudioUrl;
    if ((message.speechLanguage ?? "ja-JP") !== "ja-JP") return undefined;

    const maxLength = clamp(config.maxTextLength, 1, config.provider === "seoya" ? 300 : 500);
    const text = speechTextForBanner(message, maxLength);
    if (!text) return undefined;

    const publicPath = normalizePublicPath(config.publicPath);
    const cacheKey = this.cacheKey(text, message);
    const fileName = `${cacheKey}.wav`;
    const filePath = path.join(config.cacheDir, fileName);
    try {
      await fs.access(filePath);
      return `${publicPath}/${fileName}`;
    } catch {
      // 캐시가 없으면 아래에서 생성합니다.
    }

    try {
      await fs.mkdir(config.cacheDir, { recursive: true });
      const audio = config.provider === "seoya"
        ? await this.synthesizeSeoyaAudio(text)
        : await this.synthesizeVoicevoxText(text, message);
      await fs.writeFile(filePath, audio);
      this.logger.event({
        type: "local_tts.generated",
        provider: config.provider,
        speaker: config.speaker,
        textLength: text.length,
        fileName
      });
      return `${publicPath}/${fileName}`;
    } catch (error) {
      this.logger.error({
        type: "local_tts.failed",
        provider: config.provider,
        speaker: config.speaker,
        textLength: text.length,
        error: toSafeErrorMessage(error)
      });
      return undefined;
    }
  }

  private cacheKey(text: string, message: OverlayBannerMessage): string {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify({
      provider: appConfig.localTts.provider,
      speaker: appConfig.localTts.speaker,
      text,
      rate: message.speechRate ?? 1,
      pitch: message.speechPitch ?? 1,
      volume: message.speechVolume ?? 0.9
    }));
    return hash.digest("hex").slice(0, 32);
  }

  private async synthesizeVoicevoxText(text: string, message: OverlayBannerMessage): Promise<Buffer> {
    if (appConfig.localTts.provider !== "voicevox") {
      throw new Error(`Unsupported local TTS provider: ${appConfig.localTts.provider}`);
    }
    const query = await this.createVoicevoxAudioQuery(text);
    query.speedScale = clamp(message.speechRate ?? 1, 0.5, 1.5);
    query.pitchScale = clamp(((message.speechPitch ?? 1) - 1) * 0.15, -0.15, 0.15);
    query.volumeScale = clamp(message.speechVolume ?? 0.9, 0, 1);
    return await this.synthesizeVoicevoxAudio(query);
  }

  private async synthesizeSeoyaAudio(text: string): Promise<Buffer> {
    const response = await fetch(new URL("speak", appConfig.localTts.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        speaker_id: appConfig.localTts.speaker,
        with_sfx: false,
        save_file: false
      }),
      signal: AbortSignal.timeout(clamp(appConfig.localTts.timeoutMs, 500, 30_000))
    });
    if (!response.ok) throw new Error(`Seoya TTS speak failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  private voicevoxUrl(pathname: "audio_query" | "synthesis", text?: string): URL {
    const url = new URL(pathname, appConfig.localTts.baseUrl);
    url.searchParams.set("speaker", String(appConfig.localTts.speaker));
    if (text !== undefined) url.searchParams.set("text", text);
    return url;
  }

  private async createVoicevoxAudioQuery(text: string): Promise<VoicevoxAudioQuery> {
    const response = await fetch(this.voicevoxUrl("audio_query", text), {
      method: "POST",
      signal: AbortSignal.timeout(clamp(appConfig.localTts.timeoutMs, 500, 30_000))
    });
    if (!response.ok) throw new Error(`VOICEVOX audio_query failed: ${response.status}`);
    return (await response.json()) as VoicevoxAudioQuery;
  }

  private async synthesizeVoicevoxAudio(query: VoicevoxAudioQuery): Promise<Buffer> {
    const response = await fetch(this.voicevoxUrl("synthesis"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(clamp(appConfig.localTts.timeoutMs, 500, 30_000))
    });
    if (!response.ok) throw new Error(`VOICEVOX synthesis failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}
