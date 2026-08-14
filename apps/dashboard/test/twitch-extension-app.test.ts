import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionLocaleFromSearch,
  resolveExtensionLocale,
  shouldAutoExpand,
  shouldHideExtension,
  viewerDataFrom,
  type EbsViewerResponse,
} from "../src/twitch-extension-app/logic";

function response(overrides: Partial<EbsViewerResponse["viewer"]> & { inactiveBehavior?: "hide" | "message" } = {}): EbsViewerResponse {
  const { inactiveBehavior = "hide", ...viewer } = overrides;
  return {
    identityLinked: true,
    settings: {
      display: { joinButton: true, game: true, waitingCount: true, myPosition: true, cancelButton: true, nextState: true },
      inactiveBehavior,
    },
    viewer: { status: "active", game: "League of Legends", waitingCount: 4, ...viewer },
  };
}

test("Twitch language 파라미터는 ko 만 한국어, 나머지는 일본어 기본", () => {
  assert.equal(extensionLocaleFromSearch("?language=ko"), "ko");
  assert.equal(extensionLocaleFromSearch("?language=ko-KR"), "ko");
  assert.equal(extensionLocaleFromSearch("?language=ja"), "ja");
  assert.equal(extensionLocaleFromSearch("?language=en"), "ja");
  assert.equal(extensionLocaleFromSearch(""), "ja");
});

test("viewerDataFrom 은 서버 상태를 보존하고 joining 은 active 에서만 덮는다", () => {
  assert.equal(viewerDataFrom(response(), false).status, "active");
  assert.equal(viewerDataFrom(response(), true).status, "joining");
  assert.equal(viewerDataFrom(response({ status: "joined", myPosition: 3 }), true).status, "joined");
  assert.equal(viewerDataFrom(response({ status: "joined", myPosition: 3 }), false).myPosition, 3);
  assert.equal(viewerDataFrom(response({ status: "next" }), false).status, "next");
});

test("모집 없음 + 숨기기 설정에서만 Extension 을 숨긴다", () => {
  assert.equal(shouldHideExtension(response({ status: "no_session" })), true);
  assert.equal(shouldHideExtension(response({ status: "no_session", inactiveBehavior: "message" })), false);
  assert.equal(shouldHideExtension(response({ status: "active" })), false);
});

test("오버레이 자동 확장은 NEXT 신규 진입 시 1회만", () => {
  assert.equal(shouldAutoExpand(undefined, "next"), true);
  assert.equal(shouldAutoExpand("joined", "next"), true);
  assert.equal(shouldAutoExpand("next", "next"), false);
  assert.equal(shouldAutoExpand("next", "joined"), false);
  assert.equal(shouldAutoExpand("active", "joined"), false);
});

test("저장된 시청자 언어 선택이 Twitch 언어보다 우선한다", () => {
  assert.equal(resolveExtensionLocale("?language=ko", "ja"), "ja");
  assert.equal(resolveExtensionLocale("?language=en", "ko"), "ko");
  /* 저장값이 없거나 오염되면 Twitch 언어 자동으로 복귀 */
  assert.equal(resolveExtensionLocale("?language=ko", null), "ko");
  assert.equal(resolveExtensionLocale("?language=en", "de"), "ja");
  assert.equal(resolveExtensionLocale("", undefined), "ja");
});
