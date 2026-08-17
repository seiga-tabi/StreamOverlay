import { useCallback, useEffect } from "react";
import "../styles/pages/public-games/games-route.css";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { GamesBottomTabBar } from "../features/public-games/components/GamesBottomTabBar";
import { GamesHeader } from "../features/public-games/components/GamesHeader";
import { GamesHub } from "../features/public-games/components/GamesHub";
import { GamesNotFoundPage } from "../features/public-games/components/GamesNotFoundPage";
import { GamesRankingPage } from "../features/public-games/components/GamesRankingPage";
import { ReactionSharePage } from "../features/public-games/components/ReactionSharePage";
import { ReactionTest } from "../features/public-games/components/ReactionTest";
import { useGamesRoute } from "../features/public-games/hooks/useGamesRoute";
import { gamesI18n, type GamesLocale } from "../features/public-games/i18n/games-i18n";
import { applyGamesSeo } from "../features/public-games/utils/seo";

const noServerLocalePreference = async (): Promise<GamesLocale | undefined> => undefined;

/* 미니게임 공개 페이지 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 근거: docs/mockups/reaction-test.html v3 §①·§③. Valorant 셸 패턴 복제. */
export function PublicGamesPage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme } = usePublicTheme();
  const { page, shareId } = useGamesRoute();
  const text = gamesI18n[locale];
  setActivePublicLocale(locale);

  useEffect(() => applyGamesSeo(page ?? "hub", locale), [locale, page]);

  const handleLocale = useCallback((nextLocale: GamesLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell games-shell theme-${theme}`}
      mainId="games-main"
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="games-shell-header">
        <GamesHeader locale={locale} onLocale={handleLocale} page={page} />
      </AppShellHeader>
      <AppShellMain className="games-main" id="games-main">
        <section aria-label={text.brand} className="games-page-section">
          {page === null ? <GamesNotFoundPage locale={locale} /> : null}
          {page === "hub" ? <GamesHub locale={locale} /> : null}
          {page === "reaction" ? <ReactionTest locale={locale} /> : null}
          {page === "ranking" ? <GamesRankingPage locale={locale} /> : null}
          {page === "share" && shareId ? <ReactionSharePage locale={locale} shareId={shareId} /> : null}
        </section>
      </AppShellMain>
      {/* 하단 탭바는 AppShell 직계 자식 — 헤더의 backdrop-filter 가
          position:fixed 기준을 바꾸는 사고 방지(Palworld/Valorant 선례). */}
      <GamesBottomTabBar locale={locale} page={page} />
    </AppShell>
  );
}
