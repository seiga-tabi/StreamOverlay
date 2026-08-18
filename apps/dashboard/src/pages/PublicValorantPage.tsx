import { useCallback, useEffect } from "react";
import "../styles/pages/public-valorant/valorant-route.css";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { publicContentLocale, setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { ValorantBottomTabBar } from "../features/public-valorant/components/ValorantBottomTabBar";
import { ValorantComingSoonPage } from "../features/public-valorant/components/ValorantComingSoonPage";
import { ValorantHeader } from "../features/public-valorant/components/ValorantHeader";
import { ValorantHome } from "../features/public-valorant/components/ValorantHome";
import { ValorantNotFoundPage } from "../features/public-valorant/components/ValorantNotFoundPage";
import { useValorantRoute } from "../features/public-valorant/hooks/useValorantRoute";
import { valorantI18n, type ValorantLocale } from "../features/public-valorant/i18n/valorant-i18n";
import { applyValorantSeo } from "../features/public-valorant/utils/seo";

const noServerLocalePreference = async (): Promise<ValorantLocale | undefined> => undefined;

/* 발로란트 공개 페이지 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 데이터 화면은 /api/valorant/* contract(Codex handoff) 이후 feature 모듈에 붙습니다.
 * 근거: docs/mockups/valorant-page-design.html §03 */
export function PublicValorantPage() {
  const { locale: rawLocale, changeLocale } = usePublicLocale(noServerLocalePreference);
  /* en 콘텐츠가 아직 없음 — 팰월드 우선 단계의 ko 폴백. */
  const locale = publicContentLocale(rawLocale);
  const { theme } = usePublicTheme();
  const { page } = useValorantRoute();
  const text = valorantI18n[locale];
  setActivePublicLocale(locale);

  useEffect(() => applyValorantSeo(page ?? "home", locale), [locale, page]);

  const handleLocale = useCallback((nextLocale: ValorantLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell valorant-shell theme-${theme}`}
      mainId="valorant-main"
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="valorant-shell-header">
        <ValorantHeader locale={locale} onLocale={handleLocale} page={page} />
      </AppShellHeader>
      <AppShellMain className="valorant-main" id="valorant-main">
        <section aria-label={text.brand} className="valorant-page-section">
          {page === null ? <ValorantNotFoundPage locale={locale} /> : null}
          {page === "home" ? <ValorantHome locale={locale} /> : null}
          {page === "agents" || page === "weapons" || page === "maps" || page === "ranked" ? (
            <ValorantComingSoonPage locale={locale} page={page} />
          ) : null}
        </section>
      </AppShellMain>
      {/* 하단 탭바는 AppShell 직계 자식 — 헤더의 backdrop-filter 가
          position:fixed 기준을 바꾸는 사고 방지(Palworld 선례). */}
      <ValorantBottomTabBar locale={locale} page={page} />
    </AppShell>
  );
}
