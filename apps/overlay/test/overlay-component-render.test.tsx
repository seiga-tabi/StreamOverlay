import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubtitleOverlay } from "../src/overlays/SubtitleOverlay";
import { Banner } from "../src/components/Banner";

test("Overlay 자막 컴포넌트가 한국어·일본어 문구와 번역 고지를 함께 렌더링한다", () => {
  const html = renderToStaticMarkup(
    <SubtitleOverlay
      subtitle={{
        type: "subtitle.update",
        source: "test",
        sourceLanguage: "ko",
        targetLanguage: "ja",
        original: "오늘 방송을 시작합니다.",
        translated: "今日の配信を始めます。",
        isFinal: true
      }}
    />
  );
  assert.match(html, /今日の配信を始めます。/);
  assert.match(html, /오늘 방송을 시작합니다./);
  assert.match(html, /data-ko=/);
  assert.match(html, /data-ja=/);
});

test("Overlay 배너는 음성 합성 없이 텍스트와 시각 정보를 유지한다", () => {
  const html = renderToStaticMarkup(
    <Banner
      banner={{
        type: "overlay.banner",
        title: "フォローありがとう",
        subtitle: "팔로우 감사합니다",
        message: "Viewerさんがフォローしました。",
        eventKind: "follow",
        soundUrl: "/alerts/follow.wav"
      }}
    />
  );
  assert.match(html, /フォローありがとう/);
  assert.match(html, /팔로우 감사합니다/);
  assert.match(html, /Viewer/);
});
