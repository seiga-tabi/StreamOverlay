import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { homeI18n } from "../i18n/home-i18n";
import { LolChrome } from "./LolChrome";
import type { LolSubnavItem } from "./LolHomeSections";

/* LoL 계열 라우트 폴백 — 목업 「앱 로딩」 4장. 실물 LolChrome(1행 64px + 2행
 * 48px, 규격은 2026-08-21-app-header-shared-prompt.md 단일 원본)을 먼저 그리고
 * 본문은 minmax(0,1fr) | 300px 골격 스켈레톤만 둡니다. 이전에는 전적·증강·패치
 * 노트 라우트의 폴백이 빈 <div> 라 아무것도 보이지 않았습니다.
 * 테마는 부트 스크립트가 붙인 data-public-theme 을 따릅니다. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function LolRouteFallback({ active = "none", locale = "ko" }: {
  active?: LolSubnavItem | "none";
  locale?: PublicLocale;
}) {
  const text = homeI18n[locale];
  const theme = documentTheme();

  return (
    <div aria-busy="true" aria-live="polite" className={`yoro-home-shell yoro-lol-home theme-${theme}`} role="status">
      <LolChrome
        active={active}
        connected={false}
        locale={locale}
        onLocale={noop}
        onLoginOpen={noop}
        onLogout={noop}
        onToggleTheme={noop}
      />
      <main className="yoro-home-main">
        <div aria-hidden="true" className="yoro-lol-fallback-stage">
          <div className="yoro-lol-fallback-main">
            <span className="yoro-home-sk" style={{ height: 180 }} />
            <span className="yoro-home-sk" style={{ height: 96 }} />
            <span className="yoro-home-sk" style={{ width: "62%", height: 12 }} />
            <span className="yoro-home-sk" style={{ width: "44%", height: 12 }} />
          </div>
          <div className="yoro-lol-fallback-side">
            <span className="yoro-home-sk" style={{ height: 132 }} />
            <span className="yoro-home-sk" style={{ height: 88 }} />
          </div>
        </div>
        <p className="yoro-home-fallback-status">{text.loading}</p>
      </main>
    </div>
  );
}
