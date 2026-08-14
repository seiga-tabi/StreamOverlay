import type {
  TwitchExtensionDisplaySettings,
  TwitchExtensionInactiveBehavior,
} from "@streamops/shared";
import type { ExtensionLocale } from "../features/twitch-extension/extension-i18n";
import type { ExtensionViewerData, ExtensionViewerStatus } from "../features/twitch-extension/ExtensionViewer";

/** EBS viewer 응답 계약 — apps/server GET /api/twitch-extension/viewer */
export type EbsViewerResponse = {
  identityLinked: boolean;
  settings: {
    display: TwitchExtensionDisplaySettings;
    inactiveBehavior: TwitchExtensionInactiveBehavior;
  };
  viewer: {
    status: "no_session" | "active" | "joined" | "next" | "paused" | "full" | "ended";
    game?: string;
    waitingCount?: number;
    myPosition?: number;
  };
};

/** Twitch iframe 이 붙여주는 ?language= 를 UI 로케일로 — 한국어 외에는 ja 기본. */
export function extensionLocaleFromSearch(search: string): ExtensionLocale {
  const language = new URLSearchParams(search).get("language") ?? "";
  return language === "ko" || language.startsWith("ko-") ? "ko" : "ja";
}

export const EXTENSION_LOCALE_STORAGE_KEY = "yoro.twitch-ext.locale";

/** 시청자가 패널에서 고른 언어가 최우선, 없으면 Twitch 언어 자동(그 외 ja). */
export function resolveExtensionLocale(
  search: string,
  stored: string | null | undefined,
): ExtensionLocale {
  if (stored === "ko" || stored === "ja") return stored;
  return extensionLocaleFromSearch(search);
}

/* Twitch iframe sandbox 에서 storage 접근이 거부될 수 있어 항상 가드합니다. */
export function readStoredExtensionLocale(): string | null {
  try {
    return window.localStorage.getItem(EXTENSION_LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeExtensionLocale(locale: ExtensionLocale): void {
  try {
    window.localStorage.setItem(EXTENSION_LOCALE_STORAGE_KEY, locale);
  } catch {
    /* 저장 불가 환경에서는 세션 동안만 유지됩니다. */
  }
}

/** 서버 상태 + 클라이언트 일시 상태(joining)를 Viewer 데이터로 변환합니다. */
export function viewerDataFrom(
  response: EbsViewerResponse,
  joining: boolean,
): ExtensionViewerData {
  const status: ExtensionViewerStatus =
    joining && response.viewer.status === "active" ? "joining" : response.viewer.status;
  return {
    status,
    ...(response.viewer.game !== undefined ? { game: response.viewer.game } : {}),
    ...(response.viewer.waitingCount !== undefined ? { waitingCount: response.viewer.waitingCount } : {}),
    ...(response.viewer.myPosition !== undefined ? { myPosition: response.viewer.myPosition } : {}),
  };
}

/** 모집이 없을 때 스트리머 설정이 "숨기기"면 아무것도 그리지 않습니다. */
export function shouldHideExtension(response: EbsViewerResponse): boolean {
  return response.viewer.status === "no_session"
    && response.settings.inactiveBehavior === "hide";
}

/** NEXT 로 새로 진입했을 때만 오버레이를 자동 확장합니다(반복 방해 금지). */
export function shouldAutoExpand(
  previous: ExtensionViewerStatus | undefined,
  next: ExtensionViewerStatus,
): boolean {
  return next === "next" && previous !== "next";
}
