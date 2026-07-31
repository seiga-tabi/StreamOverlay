import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicLocale } from "../i18n/public-lol-i18n";
import {
  clearStoredLocale,
  detectBrowserPublicLocale,
  detectPublicLocale,
  readStoredLocale,
  saveStoredLocale,
} from "../utils/locale";
import {
  isLocalizablePublicPath,
  localizedPublicUrl,
  notifyPublicRouteChange,
  publicLocaleFromPathname,
} from "../utils/public-locale-path";

type PublicLocalePreferenceLoader = (signal?: AbortSignal) => Promise<PublicLocale | undefined>;

export function usePublicLocale(loadPreference: PublicLocalePreferenceLoader) {
  const pathLocaleAtMount = useRef(
    publicLocaleFromPathname(window.location.pathname),
  ).current;
  const [locale, setLocale] = useState<PublicLocale>(
    () => pathLocaleAtMount ?? detectPublicLocale(),
  );
  const [localeResolved, setLocaleResolved] = useState(
    () => Boolean(pathLocaleAtMount || readStoredLocale()),
  );

  const updateLocaleUrl = useCallback((nextLocale: PublicLocale, replace: boolean): void => {
    const currentUrl = `${window.location.pathname}${window.location.search ?? ""}${window.location.hash ?? ""}`;
    if (!isLocalizablePublicPath(currentUrl)) return;
    const nextUrl = localizedPublicUrl(currentUrl, nextLocale);
    if (nextUrl === currentUrl) return;
    if (replace) window.history.replaceState({}, "", nextUrl);
    else window.history.pushState({}, "", nextUrl);
    notifyPublicRouteChange();
  }, []);

  const changeLocale = useCallback((nextLocale: PublicLocale): void => {
    setLocale(nextLocale);
    setLocaleResolved(true);
    saveStoredLocale(nextLocale);
    updateLocaleUrl(nextLocale, false);
  }, [updateLocaleUrl]);

  const autoDetectLocale = useCallback((): void => {
    clearStoredLocale();
    void loadPreference()
      .then((preferredLocale) => {
        const nextLocale = preferredLocale ?? detectBrowserPublicLocale();
        setLocale(nextLocale);
        setLocaleResolved(true);
        updateLocaleUrl(nextLocale, false);
      })
      .catch(() => {
        const nextLocale = detectBrowserPublicLocale();
        setLocale(nextLocale);
        setLocaleResolved(true);
        updateLocaleUrl(nextLocale, false);
      });
  }, [loadPreference, updateLocaleUrl]);

  useEffect(() => {
    document.documentElement.lang = locale === "ja" ? "ja" : "ko";
  }, [locale]);

  useEffect(() => {
    if (pathLocaleAtMount) saveStoredLocale(pathLocaleAtMount);
  }, [pathLocaleAtMount]);

  useEffect(() => {
    if (!localeResolved) return;
    if (publicLocaleFromPathname(window.location.pathname)) return;
    updateLocaleUrl(locale, true);
  }, [locale, localeResolved, updateLocaleUrl]);

  useEffect(() => {
    const syncLocaleFromUrl = () => {
      const pathLocale = publicLocaleFromPathname(window.location.pathname);
      if (!pathLocale) return;
      setLocale(pathLocale);
      setLocaleResolved(true);
      saveStoredLocale(pathLocale);
    };
    window.addEventListener("popstate", syncLocaleFromUrl);
    return () => window.removeEventListener("popstate", syncLocaleFromUrl);
  }, []);

  useEffect(() => {
    if (pathLocaleAtMount || readStoredLocale()) return undefined;
    const controller = new AbortController();
    void loadPreference(controller.signal)
      .then((preferredLocale) => {
        if (controller.signal.aborted || readStoredLocale()) return;
        if (preferredLocale) setLocale(preferredLocale);
        setLocaleResolved(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // 지역 기반 언어 추정 실패 시 브라우저 언어 기본값을 유지합니다.
        setLocaleResolved(true);
      });
    return () => controller.abort();
  }, [loadPreference, pathLocaleAtMount]);

  return { locale, changeLocale, autoDetectLocale };
}
