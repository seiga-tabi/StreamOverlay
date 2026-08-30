import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { valorantI18n } from "../../public-valorant/i18n/valorant-i18n";
import { ValorantChrome } from "../../public-valorant/components/ValorantChrome";

/* 발로란트 라우트 폴백 — MinecraftRouteFallback/LolRouteFallback과 동일 문법.
 * 실물 ValorantChrome을 먼저 그리고 본문은 골격 스켈레톤만 둡니다.
 * 승인 목업: docs/mockups/game-pages-loading-shell-redesign-v1.html. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function ValorantRouteFallback({ locale = "ko" }: { locale?: PublicLocale }) {
  const contentLocale = publicContentLocale(locale);
  const text = valorantI18n[contentLocale];
  const theme = documentTheme();

  return (
    <div aria-busy="true" aria-live="polite" className={`yoro-home-shell yoro-lol-home theme-${theme}`} role="status">
      <ValorantChrome
        accountName={undefined}
        connected={false}
        locale={contentLocale}
        onLocale={noop}
        onLoginOpen={noop}
        onLogout={noop}
        onToggleTheme={noop}
        page={null}
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
