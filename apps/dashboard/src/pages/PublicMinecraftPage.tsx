import { useCallback, useEffect } from "react";
import "../styles/pages/public-minecraft/minecraft-route.css";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { MinecraftBottomTabBar } from "../features/public-minecraft/components/MinecraftBottomTabBar";
import { MinecraftComingSoonPage } from "../features/public-minecraft/components/MinecraftComingSoonPage";
import { MinecraftHeader } from "../features/public-minecraft/components/MinecraftHeader";
import { MinecraftHome } from "../features/public-minecraft/components/MinecraftHome";
import { MinecraftNotFoundPage } from "../features/public-minecraft/components/MinecraftNotFoundPage";
import { useMinecraftRoute } from "../features/public-minecraft/hooks/useMinecraftRoute";
import { minecraftI18n, type MinecraftLocale } from "../features/public-minecraft/i18n/minecraft-i18n";
import { applyMinecraftSeo } from "../features/public-minecraft/utils/seo";

const noServerLocalePreference = async (): Promise<MinecraftLocale | undefined> => undefined;

/* 발로란트 공개 페이지 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 데이터 화면은 /api/minecraft/* contract(Codex handoff) 이후 feature 모듈에 붙습니다.
 * 근거: docs/mockups/minecraft-vertical.html §01 */
export function PublicMinecraftPage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme } = usePublicTheme();
  const { page } = useMinecraftRoute();
  const text = minecraftI18n[locale];
  setActivePublicLocale(locale);

  useEffect(() => applyMinecraftSeo(page ?? "home", locale), [locale, page]);

  const handleLocale = useCallback((nextLocale: MinecraftLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell minecraft-shell theme-${theme}`}
      mainId="minecraft-main"
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="minecraft-shell-header">
        <MinecraftHeader locale={locale} onLocale={handleLocale} page={page} />
      </AppShellHeader>
      <AppShellMain className="minecraft-main" id="minecraft-main">
        <section aria-label={text.brand} className="minecraft-page-section">
          {page === null ? <MinecraftNotFoundPage locale={locale} /> : null}
          {page === "home" ? <MinecraftHome locale={locale} /> : null}
          {page === "recipes" || page === "items" || page === "enchants" || page === "library" || page === "patchNotes" ? (
            <MinecraftComingSoonPage locale={locale} page={page} />
          ) : null}
        </section>
      </AppShellMain>
      {/* 하단 탭바는 AppShell 직계 자식 — 헤더의 backdrop-filter 가
          position:fixed 기준을 바꾸는 사고 방지(Palworld 선례). */}
      <MinecraftBottomTabBar locale={locale} page={page} />
    </AppShell>
  );
}
