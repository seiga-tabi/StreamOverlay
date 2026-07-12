import { useEffect, useState } from "react";
import type { PublicLocale } from "../i18n/public-lol-i18n";
import {
  clearStoredLocale,
  detectBrowserPublicLocale,
  detectPublicLocale,
  readStoredLocale,
  saveStoredLocale,
} from "../utils/locale";

type PublicLocalePreferenceLoader = (signal?: AbortSignal) => Promise<PublicLocale | undefined>;

export function usePublicLocale(loadPreference: PublicLocalePreferenceLoader) {
  const [locale, setLocale] = useState<PublicLocale>(() => detectPublicLocale());

  const changeLocale = (nextLocale: PublicLocale): void => {
    setLocale(nextLocale);
    saveStoredLocale(nextLocale);
  };

  const autoDetectLocale = (): void => {
    clearStoredLocale();
    void loadPreference()
      .then((preferredLocale) => {
        setLocale(preferredLocale ?? detectBrowserPublicLocale());
      })
      .catch(() => {
        setLocale(detectBrowserPublicLocale());
      });
  };

  useEffect(() => {
    document.documentElement.lang = locale === "ja" ? "ja" : "ko";
  }, [locale]);

  useEffect(() => {
    if (readStoredLocale()) return undefined;
    const controller = new AbortController();
    void loadPreference(controller.signal)
      .then((preferredLocale) => {
        if (!preferredLocale || readStoredLocale()) return;
        setLocale(preferredLocale);
      })
      .catch(() => {
        // 지역 기반 언어 추정 실패 시 브라우저 언어 기본값을 유지합니다.
      });
    return () => controller.abort();
  }, [loadPreference]);

  return { locale, changeLocale, autoDetectLocale };
}
