import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { LocalTtsService, speechTextForBanner } = await import("../dist/services/local-tts-service.js");
const { appConfig } = await import("../dist/config.js");

test("speechTextForBanner는 일본어 읽어주기 문장을 안전하게 정리한다", () => {
  const text = speechTextForBanner({
    type: "overlay.banner",
    title: "フォロー通知",
    message: "ありがとうございます。\n次もよろしくお願いします。",
    speechEnabled: true,
    speechLanguage: "ja-JP"
  }, 24);

  assert.equal(text, "フォロー通知。ありがとうございます。 次もよろし");
});

test("LocalTtsService는 VOICEVOX 호환 엔진으로 WAV를 만들고 캐시한다", async () => {
  const previous = { ...appConfig.localTts };
  const previousFetch = globalThis.fetch;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-local-tts-"));
  const events = [];
  const errors = [];
  const calls = [];

  try {
    appConfig.localTts.enabled = true;
    appConfig.localTts.provider = "voicevox";
    appConfig.localTts.baseUrl = "http://127.0.0.1:50021";
    appConfig.localTts.speaker = 3;
    appConfig.localTts.timeoutMs = 1000;
    appConfig.localTts.maxTextLength = 80;
    appConfig.localTts.cacheDir = dir;
    appConfig.localTts.publicPath = "/tts";

    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      if (String(url).includes("/audio_query")) {
        return new Response(JSON.stringify({ speedScale: 1, pitchScale: 0, volumeScale: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (String(url).includes("/synthesis")) {
        return new Response(Buffer.from("RIFF"), { status: 200, headers: { "Content-Type": "audio/wav" } });
      }
      return new Response("not found", { status: 404 });
    };

    const service = new LocalTtsService({
      event(payload) {
        events.push(payload);
      },
      error(payload) {
        errors.push(payload);
      }
    });
    const message = {
      type: "overlay.banner",
      title: "フォロー通知",
      message: "ありがとうございます。",
      speechEnabled: true,
      speechLanguage: "ja-JP",
      speechRate: 1,
      speechPitch: 1,
      speechVolume: 0.8
    };

    const audioUrl = await service.synthesizeOverlaySpeech(message);
    assert.match(audioUrl, /^\/tts\/[a-f0-9]{32}\.wav$/);
    assert.equal(existsSync(path.join(dir, path.basename(audioUrl))), true);
    assert.equal(calls.length, 2);
    assert.equal(events[0].type, "local_tts.generated");
    assert.equal(errors.length, 0);

    const cachedUrl = await service.synthesizeOverlaySpeech(message);
    assert.equal(cachedUrl, audioUrl);
    assert.equal(calls.length, 2);
  } finally {
    Object.assign(appConfig.localTts, previous);
    globalThis.fetch = previousFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("LocalTtsService는 Seoya TTS 엔진 /speak API를 사용할 수 있다", async () => {
  const previous = { ...appConfig.localTts };
  const previousFetch = globalThis.fetch;
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-seoya-tts-"));
  const calls = [];

  try {
    appConfig.localTts.enabled = true;
    appConfig.localTts.provider = "seoya";
    appConfig.localTts.baseUrl = "http://tts-engine:8787";
    appConfig.localTts.speaker = 3;
    appConfig.localTts.timeoutMs = 1000;
    appConfig.localTts.maxTextLength = 80;
    appConfig.localTts.cacheDir = dir;
    appConfig.localTts.publicPath = "/tts";

    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(Buffer.from("RIFF"), { status: 200, headers: { "Content-Type": "audio/wav" } });
    };

    const service = new LocalTtsService({
      event() {},
      error(payload) {
        throw new Error(`예상하지 못한 TTS 오류: ${JSON.stringify(payload)}`);
      }
    });

    const audioUrl = await service.synthesizeOverlaySpeech({
      type: "overlay.banner",
      message: "こんにちは。これはテストです。",
      speechEnabled: true,
      speechLanguage: "ja-JP"
    });

    assert.match(audioUrl, /^\/tts\/[a-f0-9]{32}\.wav$/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://tts-engine:8787/speak");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body.text, "こんにちは。これはテストです。");
    assert.equal(calls[0].body.with_sfx, false);
    assert.equal(calls[0].body.save_file, false);
  } finally {
    Object.assign(appConfig.localTts, previous);
    globalThis.fetch = previousFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});
