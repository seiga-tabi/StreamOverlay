import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { palworldI18n } from "../../public-palworld/i18n/palworld-i18n";
import { PalworldChrome } from "../../public-palworld/components/PalworldChrome";

/* 팰월드 라우트 폴백 — MinecraftRouteFallback/LolRouteFallback과 동일 문법.
 * PalworldChrome의 page는 nullable이 아니라(PalworldSubnav가 활성 탭을 판정)
 * "home"을 넘깁니다 — 폴백은 잠깐만 보이므로 실제 페이지 진입 후 정확한 탭으로
 * 즉시 교체되어 위화감이 없습니다(LoL/마인크래프트/발로란트는 page=null 지원,
 * 팰월드만 이 최소 침습 방식 — PalworldChrome 자체는 변경하지 않음).
 * 승인 목업: docs/mockups/game-pages-loading-shell-redesign-v1.html. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function PalworldRouteFallback({ locale = "ko" }: { locale?: PublicLocale }) {
  const contentLocale = publicContentLocale(locale);
  const text = palworldI18n[contentLocale];
  const theme = documentTheme();

  return (
    <div aria-busy="true" aria-live="polite" className={`yoro-home-shell yoro-lol-home theme-${theme}`} role="status">
      <PalworldChrome
        accountName={undefined}
        connected={false}
        locale={contentLocale}
        onLocale={noop}
        onLoginOpen={noop}
        onLogout={noop}
        onToggleTheme={noop}
        page="home"
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
