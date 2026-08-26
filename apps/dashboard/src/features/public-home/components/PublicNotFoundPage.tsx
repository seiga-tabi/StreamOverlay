import { useEffect } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { publicLocaleFromPathname } from "../../public-lol/utils/public-locale-path";
import { useHomeTheme } from "../hooks/useHomeTheme";
import { homeI18n } from "../i18n/home-i18n";
import { LolChrome } from "./LolChrome";

const text = {
  ko: {
    title: "페이지를 찾을 수 없습니다.",
    description: "잘못된 URL이거나 페이지가 이동되었을 수 있습니다.",
    home: "홈으로 이동",
    lol: "LoL",
    palworld: "Palworld",
    streamers: "스트리머",
  },
  ja: {
    title: "ページが見つかりません。",
    description: "URLが正しくないか、ページが移動した可能性があります。",
    home: "ホームへ移動",
    lol: "LoL",
    palworld: "Palworld",
    streamers: "配信者",
  },
  en: {
    title: "Page not found.",
    description: "The URL may be incorrect, or the page may have moved.",
    home: "Go home",
    lol: "LoL",
    palworld: "Palworld",
    streamers: "Streamers",
  },
} as const;

function publicHref(pathname: string, locale: PublicLocale): string {
  if (!publicLocaleFromPathname(window.location.pathname)) return pathname;
  return pathname === "/" ? `/${locale}/` : `/${locale}${pathname}`;
}

export function PublicNotFoundPage({ locale }: { locale: PublicLocale }) {
  const { theme, toggleTheme } = useHomeTheme();
  const localized = text[locale];
  const homeText = homeI18n[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "ja" ? "ja" : locale === "en" ? "en" : "ko";
  }, [locale]);

  return (
    <div className={`yoro-home-shell yoro-lol-home theme-${theme}`}>
      <a className="yoro-home-skip" href="#public-not-found-main">
        {homeText.skipToContent}
      </a>
      <LolChrome
        active="none"
        connected={false}
        locale={locale}
        onLocale={(nextLocale) => window.location.assign(`/${nextLocale}/`)}
        onLoginOpen={() => window.location.assign("/login")}
        onLogout={() => undefined}
        onToggleTheme={toggleTheme}
      />
      <main className="yoro-home-main" id="public-not-found-main">
        <div className="yoro-home-section">
          <EmptyState aria-labelledby="public-not-found-title" variant="error">
            <EmptyStateIcon>404</EmptyStateIcon>
            <EmptyStateTitle
              data-ja={text.ja.title}
              data-ko={text.ko.title}
              id="public-not-found-title"
            >
              {localized.title}
            </EmptyStateTitle>
            <EmptyStateDescription data-ja={text.ja.description} data-ko={text.ko.description}>
              {localized.description}
            </EmptyStateDescription>
            <EmptyStateActions>
              <Button
                as="a"
                data-ja={text.ja.home}
                data-ko={text.ko.home}
                href={publicHref("/", locale)}
                variant="primary"
              >
                {localized.home}
              </Button>
              <Button as="a" href={publicHref("/lol", locale)} variant="secondary">
                {localized.lol}
              </Button>
              <Button as="a" href={publicHref("/palworld", locale)} variant="secondary">
                {localized.palworld}
              </Button>
              <Button
                as="a"
                data-ja={text.ja.streamers}
                data-ko={text.ko.streamers}
                href={publicHref("/streamers", locale)}
                variant="secondary"
              >
                {localized.streamers}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        </div>
      </main>
    </div>
  );
}
