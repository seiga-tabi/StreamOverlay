import type { PublicLocale } from "../i18n/public-lol-i18n";

const LOCALE_STORAGE_KEY = "loltrace.locale";

export function isPublicLocale(value: unknown): value is PublicLocale {
  return value === "ko" || value === "ja";
}

export function readStoredLocale(): PublicLocale | undefined {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isPublicLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredLocale(locale: PublicLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 언어 저장 실패는 화면 사용을 막지 않습니다.
  }
}

export function clearStoredLocale(): void {
  try {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // 언어 저장소 삭제 실패는 화면 사용을 막지 않습니다.
  }
}

/* 브라우저 언어가 지원 언어(ko·ja)로 명시된 경우만 반환합니다.
   document.documentElement.lang 은 앱이 스스로 바꾸는 값이라 근거로 쓰지 않습니다.
   이 값이 있으면 서버 지역 추정(loadPreference)보다 우선합니다 — 게임별로
   언어 판정이 갈리는 문제(LoL만 ja)의 단일 원본 수정점입니다. */
export function detectExplicitBrowserPublicLocale(): PublicLocale | undefined {
  const lang = (navigator.language || "").toLocaleLowerCase();
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("ja")) return "ja";
  return undefined;
}

export function detectBrowserPublicLocale(): PublicLocale {
  /* document.documentElement.lang 은 index.html 정적 값(ko)이거나 앱이 바꾼 값이라
     브라우저 언어보다 먼저 읽으면 ja 브라우저도 ko 로 판정되는 자기참조가 됩니다. */
  return detectExplicitBrowserPublicLocale()
    ?? (document.documentElement.lang.toLocaleLowerCase().startsWith("ja") ? "ja" : "ko");
}

export function detectPublicLocale(): PublicLocale {
  return readStoredLocale() ?? detectBrowserPublicLocale();
}
