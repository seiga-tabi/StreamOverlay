import test from "node:test";
import assert from "node:assert/strict";

const {
  ChatTranslationService,
  detectKoJaLanguage,
  targetLanguageFor
} = await import("../dist/services/chat-translation-service.js");

const baseConfig = {
  enabled: true,
  provider: "mock",
  maxInputLength: 180,
  cacheTtlMs: 60_000,
  maxTranslationsPerMinute: 30
};

test("채팅 언어 감지는 한국어와 일본어를 구분한다", () => {
  assert.equal(detectKoJaLanguage("오늘 시참 언제 시작해요?"), "ko");
  assert.equal(detectKoJaLanguage("今日は参加できますか？"), "ja");
  assert.equal(detectKoJaLanguage("hello chat"), undefined);
  assert.equal(targetLanguageFor("ko"), "ja");
  assert.equal(targetLanguageFor("ja"), "ko");
});

test("ChatTranslationService는 외부 API key 없이 mock 번역 결과를 반환한다", async () => {
  const service = new ChatTranslationService(baseConfig);

  const result = await service.translateChatMessage("오늘은 시참 시작합니다.");

  assert.equal(result?.sourceLanguage, "ko");
  assert.equal(result?.targetLanguage, "ja");
  assert.equal(result?.translatedText, "[ja] 오늘은 시참 시작합니다.");
});

test("ChatTranslationService는 캐시 hit에서 같은 결과를 재사용한다", async () => {
  const service = new ChatTranslationService(baseConfig);

  const first = await service.translateChatMessage("안녕하세요");
  const second = await service.translateChatMessage("안녕하세요");

  assert.deepEqual(first, second);
});

test("ChatTranslationService는 분당 제한을 넘으면 번역을 건너뛴다", async () => {
  const service = new ChatTranslationService({ ...baseConfig, maxTranslationsPerMinute: 1 });

  assert.ok(await service.translateChatMessage("안녕하세요"));
  assert.equal(await service.translateChatMessage("오늘 방송 좋아요"), undefined);
});
