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

export function detectBrowserPublicLocale(): PublicLocale {
  const lang = document.documentElement.lang || navigator.language || "";
  return lang.toLocaleLowerCase().startsWith("ja") ? "ja" : "ko";
}

export function detectPublicLocale(): PublicLocale {
  return readStoredLocale() ?? detectBrowserPublicLocale();
}
