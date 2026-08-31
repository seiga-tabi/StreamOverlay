import { useCallback, useEffect } from "react";
import "../styles/pages/public-minecraft/minecraft-route.css";
import { AppShell, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { publicContentLocale, setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { MinecraftBottomTabBar } from "../features/public-minecraft/components/MinecraftBottomTabBar";
import { MinecraftChrome } from "../features/public-minecraft/components/MinecraftChrome";
import { MinecraftComingSoonPage } from "../features/public-minecraft/components/MinecraftComingSoonPage";
import { MinecraftEnchantsPage } from "../features/public-minecraft/components/MinecraftEnchantsPage";
import { MinecraftHome } from "../features/public-minecraft/components/MinecraftHome";
import { MinecraftItemsPage } from "../features/public-minecraft/components/MinecraftItemsPage";
import { MinecraftNotFoundPage } from "../features/public-minecraft/components/MinecraftNotFoundPage";
import { MinecraftPatchNotesPage } from "../features/public-minecraft/components/MinecraftPatchNotesPage";
import { MinecraftRecipesPage } from "../features/public-minecraft/components/MinecraftRecipesPage";
import { useMinecraftRoute } from "../features/public-minecraft/hooks/useMinecraftRoute";
import { minecraftI18n, type MinecraftLocale } from "../features/public-minecraft/i18n/minecraft-i18n";
import { applyMinecraftSeo } from "../features/public-minecraft/utils/seo";
import { usePublicAccountLogin } from "../shared/public-account-login";

const noServerLocalePreference = async (): Promise<MinecraftLocale | undefined> => undefined;

/* 마인크래프트 공개 페이지 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 조합법·아이템·인챈트는 /api/minecraft/* 카탈로그 contract(Codex 구현)를 사용하고,
 * 자료실·패치 노트는 3단계 handoff 전까지 준비 중 화면을 유지합니다.
 * 상단바는 메인 홈/LoL/Palworld/Valorant와 같은 HomeHeader 기반 MinecraftChrome을
 * 씁니다(사용자 지적 2026-08-28: 구 MinecraftHeader만 이 전환이 누락돼 있었음).
 * 근거: docs/mockups/minecraft-vertical.html §01 */
export function PublicMinecraftPage() {
  const { locale: rawLocale, changeLocale } = usePublicLocale(noServerLocalePreference);
  /* en 콘텐츠가 아직 없음 — 팰월드 우선 단계의 ko 폴백. */
  const locale = publicContentLocale(rawLocale);
  const { theme, toggleTheme } = usePublicTheme();
  const { page } = useMinecraftRoute();
  const text = minecraftI18n[locale];
  const account = usePublicAccountLogin();
  setActivePublicLocale(locale);

  useEffect(() => applyMinecraftSeo(page, locale), [locale, page]);

  const handleLocale = useCallback((nextLocale: MinecraftLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  return (
    <AppShell
      className={`yoro-home-shell minecraft-shell theme-${theme}`}
      mainId="minecraft-main"
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <MinecraftChrome
        accountName={account.accountUser?.displayName}
        connected={account.yoroConnected}
        isStreamerAdmin={account.isStreamerAdmin}
        locale={locale}
        onLocale={handleLocale}
        onLoginOpen={account.loginWithTwitch}
        onLogout={account.logout}
        onStreamerAdmin={account.openStreamerAdmin}
        onToggleTheme={toggleTheme}
        page={page}
      />
      <AppShellMain className="minecraft-main" id="minecraft-main">
        <section aria-label={text.brand} className="minecraft-page-section">
          {page === null ? <MinecraftNotFoundPage locale={locale} /> : null}
          {page === "home" ? <MinecraftHome locale={locale} /> : null}
          {page === "recipes" ? <MinecraftRecipesPage locale={locale} /> : null}
          {page === "items" ? <MinecraftItemsPage locale={locale} /> : null}
          {page === "enchants" ? <MinecraftEnchantsPage locale={locale} /> : null}
          {page === "patchNotes" ? <MinecraftPatchNotesPage locale={locale} /> : null}
          {page === "library" ? <MinecraftComingSoonPage locale={locale} page={page} /> : null}
        </section>
      </AppShellMain>
      {/* 하단 탭바는 AppShell 직계 자식 — 헤더의 backdrop-filter 가
          position:fixed 기준을 바꾸는 사고 방지(Palworld 선례). */}
      <MinecraftBottomTabBar locale={locale} page={page} />
    </AppShell>
  );
}
