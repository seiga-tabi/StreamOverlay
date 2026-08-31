import { useCallback, useEffect, useState } from "react";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { setActivePublicLocale, type PublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicViewerTwitchSession } from "../shared/usePublicViewerTwitchSession";
import {
  HomeFooter,
  HomeLiveSection,
  HomeLoginModal
} from "../features/public-home/components/HomeSections";
import { LolChrome } from "../features/public-home/components/LolChrome";
import {
  LolDataSection,
  LolHomeHero,
  LolParticipationBanner
} from "../features/public-home/components/LolHomeSections";
import { LolBottomTabBar } from "../features/public-home/components/HomeTabBar";
import { useHomeTheme } from "../features/public-home/hooks/useHomeTheme";
import { homeI18n } from "../features/public-home/i18n/home-i18n";
import { lolHomeI18n } from "../features/public-home/i18n/lol-home-i18n";
import { applyLolHomeSeo } from "../features/public-home/utils/seo";
import { usePublicAccountLogin } from "../shared/public-account-login";

const noServerLocalePreference = async (): Promise<PublicLocale | undefined> => undefined;

/* LoL 홈(/lol) — 목업 캔버스 "YORO 홈 리디자인" page-2 구현.
 * 루트 홈과 같은 백자·수묵 시스템, 같은 공통 컴포넌트(헤더·방송 카드·푸터·로그인 팝업).
 * 다른 점: 상단바 2행(중앙 정렬 LoL 메뉴), LoL 단일 검색 + 최근 검색·즐겨찾기,
 * 증강 칼바람·패치노트 카드, 시청자 참여 배너, 모바일 하단 5탭.
 * 전적·증강·패치노트 등 세부 화면은 기존 PublicLolPage 라우트가 그대로 담당합니다. */
export function PublicLolHomePage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme, toggleTheme } = useHomeTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const homeText = homeI18n[locale];
  const text = lolHomeI18n[locale];
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
    tracking: { linkContext: "lol_home_account" }
  });

  useEffect(() => applyLolHomeSeo(locale), [locale]);

  const handleLocale = useCallback((next: PublicLocale) => {
    setActivePublicLocale(next);
    changeLocale(next);
  }, [changeLocale]);

  return (
    <div className={`yoro-home-shell yoro-lol-home theme-${theme}`}>
      <a className="yoro-home-skip" href="#yoro-lol-home-main">{homeText.skipToContent}</a>
      <LolChrome
        accountName={account.accountUser?.displayName}
        active="home"
        connected={account.yoroConnected}
        isStreamerAdmin={account.isStreamerAdmin}
        locale={locale}
        onLocale={handleLocale}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={account.logout}
        onStreamerAdmin={account.openStreamerAdmin}
        onToggleTheme={toggleTheme}
      />
      <main className="yoro-home-main" id="yoro-lol-home-main">
        <LolHomeHero homeText={homeText} locale={locale} text={text} />
        <HomeLiveSection
          connected={twitchStatus.connected}
          followedChannels={followedChannels}
          loading={twitchLoading}
          onLoginOpen={() => setLoginOpen(true)}
          text={homeText}
          variant="lol"
        />
        <LolDataSection homeText={homeText} locale={locale} text={text} />
        <LolParticipationBanner text={text} />
      </main>
      <HomeFooter locale={locale} onLocale={handleLocale} text={homeText} />
      <LolBottomTabBar text={text} />
      <HomeLoginModal
        onClose={() => setLoginOpen(false)}
        onTwitchLogin={account.loginWithTwitch}
        open={loginOpen}
        text={homeText}
      />
    </div>
  );
}

export default PublicLolHomePage;
