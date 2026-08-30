import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { minecraftI18n } from "../../public-minecraft/i18n/minecraft-i18n";
import { MinecraftChrome } from "../../public-minecraft/components/MinecraftChrome";

/* 마인크래프트 라우트 폴백 — LolRouteFallback(같은 디렉터리)과 동일 문법.
 * 실측(CDP + 느린 네트워크 시뮬레이션, 2026-08-30): 페이지 진입 직후 ~1초는
 * React 마운트 전이라 손댈 수 없는 흰 화면이지만, 그 다음 Suspense fallback
 * 구간은 이전에 헤더 없이 범용 SkeletonCard(흰 널판) 하나만 떠 있었습니다.
 * 실물 MinecraftChrome(1행 64px + 2행 48px)을 먼저 그리고 본문은 minmax(0,1fr) |
 * 300px 골격 스켈레톤만 둡니다 — LolRouteFallback이 같은 문제를 해결한 패턴
 * 그대로 재사용(.yoro-lol-fallback-stage 등은 게임 공용 클래스).
 * 승인 목업: docs/mockups/game-pages-loading-shell-redesign-v1.html.
 * 테마는 부트 스크립트가 붙인 data-public-theme 을 따릅니다. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function MinecraftRouteFallback({ locale = "ko" }: { locale?: PublicLocale }) {
  const contentLocale = publicContentLocale(locale);
  const text = minecraftI18n[contentLocale];
  const theme = documentTheme();

  return (
    <div aria-busy="true" aria-live="polite" className={`yoro-home-shell yoro-lol-home theme-${theme}`} role="status">
      <MinecraftChrome
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
