import { useCallback, useEffect, useState } from "react";
import "../styles/pages/home/01-public-home.css";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { setActivePublicLocale, type PublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicViewerTwitchSession } from "../shared/usePublicViewerTwitchSession";
import { HomeHeader } from "../features/public-home/components/HomeHeader";
import { HomeHero } from "../features/public-home/components/HomeHero";
import {
  HomeBotSection,
  HomeBreedingSection,
  HomeFooter,
  HomeGameDataSection,
  HomeLiveSection,
  HomeLoginModal
} from "../features/public-home/components/HomeSections";
import { HomeBottomTabBar } from "../features/public-home/components/HomeTabBar";
import { useHomeTheme } from "../features/public-home/hooks/useHomeTheme";
import { homeI18n } from "../features/public-home/i18n/home-i18n";
import { applyHomeSeo } from "../features/public-home/utils/seo";

const noServerLocalePreference = async (): Promise<PublicLocale | undefined> => undefined;

/* yoro.gg 루트 홈 — 목업 캔버스 "YORO 홈 리디자인" v8 구현.
 * 화면 조립만 담당하고(모놀리스 금지), 섹션 데이터는 각 컴포넌트가
 * 기존 공개 API 계약으로 직접 가져옵니다. */
export function PublicHomePage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme, toggleTheme } = useHomeTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const text = homeI18n[locale];
  setActivePublicLocale(locale);

  const {
    disconnectTwitch,
    followedChannels,
    startTwitchLogin,
    twitchStatus
  } = usePublicViewerTwitchSession({
    loginReturnTo: () => `${window.location.pathname}${window.location.search}`,
    needsFollowedChannels: true
  });

  useEffect(() => applyHomeSeo(locale), [locale]);

  const handleLocale = useCallback((next: PublicLocale) => {
    setActivePublicLocale(next);
    changeLocale(next);
  }, [changeLocale]);

  return (
    <div className={`yoro-home-shell theme-${theme}`}>
      <a className="yoro-home-skip" href="#yoro-home-main">{text.skipToContent}</a>
      <HomeHeader
        accountName={twitchStatus.user?.displayName}
        connected={twitchStatus.connected}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={handleLocale}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={() => void disconnectTwitch()}
        onToggleTheme={toggleTheme}
        text={text}
      />
      <main className="yoro-home-main" id="yoro-home-main">
        <HomeHero locale={locale} text={text} />
        <HomeLiveSection
          connected={twitchStatus.connected}
          followedChannels={followedChannels}
          onLoginOpen={() => setLoginOpen(true)}
          text={text}
        />
        <HomeGameDataSection locale={locale} text={text} />
        <HomeBreedingSection text={text} />
        <HomeBotSection text={text} />
      </main>
      <HomeFooter locale={locale} onLocale={handleLocale} text={text} />
      <HomeBottomTabBar
        connected={twitchStatus.connected}
        onLoginOpen={() => setLoginOpen(true)}
        text={text}
      />
      <HomeLoginModal
        onClose={() => setLoginOpen(false)}
        onTwitchLogin={startTwitchLogin}
        open={loginOpen}
        text={text}
      />
    </div>
  );
}

export default PublicHomePage;
