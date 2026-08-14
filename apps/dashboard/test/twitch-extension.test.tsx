import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_EXTENSION_DISPLAY,
  ExtensionOverlayCollapsed,
  ExtensionViewerPanel,
} from "../src/features/twitch-extension/ExtensionViewer";
import { TwitchExtensionCard } from "../src/features/twitch-extension/TwitchExtensionCard";

const data = { status: "active" as const, game: "League of Legends", waitingCount: 4, myPosition: 3 };

test("Extension Viewer는 상태별 일본어 카피와 정보 위계를 렌더한다", () => {
  const active = renderToStaticMarkup(<ExtensionViewerPanel data={data} locale="ja" />);
  assert.match(active, /参加受付中/u);
  assert.match(active, /現在 <b>4<\/b>人待機中/u);
  assert.match(active, /参加する/u);
  assert.match(active, /League of Legends/u);
  /* 브랜드는 최저 위계 — 존재하되 버튼보다 앞서지 않음 */
  assert.match(active, /YORO/u);

  const joined = renderToStaticMarkup(
    <ExtensionViewerPanel data={{ ...data, status: "joined", waitingCount: 5 }} locale="ja" />,
  );
  assert.match(joined, /参加申請完了/u);
  assert.match(joined, /あなたの順番/u);
  assert.match(joined, /#3/u);
  assert.match(joined, /参加をキャンセル/u);

  const next = renderToStaticMarkup(<ExtensionViewerPanel data={{ ...data, status: "next" }} locale="ja" />);
  assert.match(next, /NEXT/u);
  assert.match(next, /あなたの番です！/u);
  assert.match(next, /配信者の案内を確認してください/u);
  assert.match(next, /is-next/u);

  const paused = renderToStaticMarkup(<ExtensionViewerPanel data={{ ...data, status: "paused" }} locale="ja" />);
  assert.match(paused, /受付一時停止中/u);
  assert.match(paused, /現在、新規参加を受け付けていません。/u);
  assert.match(paused, /disabled/u);

  const ended = renderToStaticMarkup(<ExtensionViewerPanel data={{ ...data, status: "ended" }} locale="ja" />);
  assert.match(ended, /受付終了/u);
  assert.match(ended, /ご参加ありがとうございました！/u);

  const error = renderToStaticMarkup(<ExtensionViewerPanel data={{ ...data, status: "error" }} locale="ja" />);
  assert.match(error, /接続に問題が発生しました。/u);
  assert.match(error, /再試行/u);

  const noSession = renderToStaticMarkup(<ExtensionViewerPanel data={{ status: "no_session" }} locale="ja" />);
  assert.match(noSession, /現在、参加募集はありません。/u);

  const korean = renderToStaticMarkup(<ExtensionViewerPanel data={data} locale="ko" />);
  assert.match(korean, /참가 모집 중/u);
  assert.match(korean, /참가하기/u);
});

test("표시 설정 토글은 요소를 실제로 감추고 NEXT 끔은 참가 완료로 강등된다", () => {
  const display = { ...DEFAULT_EXTENSION_DISPLAY, game: false, waitingCount: false, cancelButton: false };
  const joined = renderToStaticMarkup(
    <ExtensionViewerPanel data={{ ...data, status: "joined" }} display={display} locale="ja" />,
  );
  assert.doesNotMatch(joined, /League of Legends/u);
  assert.doesNotMatch(joined, /待機中/u);
  assert.doesNotMatch(joined, /参加をキャンセル/u);
  assert.match(joined, /あなたの順番/u);

  const demoted = renderToStaticMarkup(
    <ExtensionViewerPanel
      data={{ ...data, status: "next" }}
      display={{ ...DEFAULT_EXTENSION_DISPLAY, nextState: false }}
      locale="ja"
    />,
  );
  assert.doesNotMatch(demoted, /あなたの番です！/u);
  assert.match(demoted, /参加申請完了/u);
});

test("Collapsed 오버레이는 한 줄 요약을 렌더한다", () => {
  const collapsed = renderToStaticMarkup(<ExtensionOverlayCollapsed data={data} locale="ja" />);
  assert.match(collapsed, /参加受付中 · 4人/u);
});

test("대시보드 Extension 카드는 연동 확인 상태·저장 동작·실컴포넌트 미리보기를 렌더한다", () => {
  const korean = renderToStaticMarkup(<TwitchExtensionCard locale="ko" />);
  assert.match(korean, /연동 확인 중/u);
  assert.match(korean, /설정 저장/u);
  assert.match(korean, /표시 항목/u);
  assert.match(korean, /Extension 숨기기/u);
  assert.match(korean, /Live Preview/u);
  /* 미리보기는 실제 Viewer 컴포넌트 — 기본 상태(모집 중, ko 카피) 렌더 */
  assert.match(korean, /data-testid="twitch-ext-panel"/u);
  assert.match(korean, /참가 모집 중/u);

  const japanese = renderToStaticMarkup(<TwitchExtensionCard locale="ja" />);
  assert.match(japanese, /連携確認中/u);
  assert.match(japanese, /参加受付中/u);
});
