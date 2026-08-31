import { useCallback, useEffect, useState } from "react";
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
import { usePublicAccountLogin } from "../shared/public-account-login";

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
    twitchLoading,
    twitchStatus
  } = usePublicViewerTwitchSession({
    needsFollowedChannels: true
  });
  const account = usePublicAccountLogin({
    viewerTwitch: {
      connected: twitchStatus.connected,
      ...(twitchStatus.user ? { user: twitchStatus.user } : {}),
      onDisconnect: disconnectTwitch
    },
    tracking: { linkContext: "home_account" }
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
        accountName={account.accountUser?.displayName}
        connected={account.yoroConnected}
        isStreamerAdmin={account.isStreamerAdmin}
        locale={locale}
        onDashboard={account.openDashboard}
        onLocale={handleLocale}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={account.logout}
        onStreamerAdmin={account.openStreamerAdmin}
        onToggleTheme={toggleTheme}
        text={text}
      />
      <main className="yoro-home-main" id="yoro-home-main">
        <HomeHero text={text} />
        <HomeLiveSection
          connected={twitchStatus.connected}
          followedChannels={followedChannels}
          loading={twitchLoading}
          onLoginOpen={() => setLoginOpen(true)}
          text={text}
        />
        <HomeGameDataSection locale={locale} text={text} />
        <HomeBreedingSection text={text} />
        <HomeBotSection text={text} />
      </main>
      <HomeFooter locale={locale} onLocale={handleLocale} text={text} />
      <HomeBottomTabBar
        connected={account.yoroConnected}
        onLoginOpen={() => setLoginOpen(true)}
        text={text}
      />
      <HomeLoginModal
        onClose={() => setLoginOpen(false)}
        onTwitchLogin={account.loginWithTwitch}
        open={loginOpen}
        text={text}
      />
    </div>
  );
}

export default PublicHomePage;
