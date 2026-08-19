import { useCallback, useEffect, useState } from "react";
import "../styles/pages/home/01-public-home.css";
import "../styles/pages/home/02-lol-home.css";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { setActivePublicLocale, type PublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicViewerTwitchSession } from "../shared/usePublicViewerTwitchSession";
import { HomeHeader } from "../features/public-home/components/HomeHeader";
import {
  HomeFooter,
  HomeLiveSection,
  HomeLoginModal
} from "../features/public-home/components/HomeSections";
import {
  LolDataSection,
  LolHomeHero,
  LolParticipationBanner,
  LolSubnav
} from "../features/public-home/components/LolHomeSections";
import { LolBottomTabBar } from "../features/public-home/components/HomeTabBar";
import { useHomeTheme } from "../features/public-home/hooks/useHomeTheme";
import { homeI18n } from "../features/public-home/i18n/home-i18n";
import { lolHomeI18n } from "../features/public-home/i18n/lol-home-i18n";
import { applyLolHomeSeo } from "../features/public-home/utils/seo";

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
    startTwitchLogin,
    twitchStatus
  } = usePublicViewerTwitchSession({
    loginReturnTo: () => `${window.location.pathname}${window.location.search}`,
    needsFollowedChannels: true
  });

  useEffect(() => applyLolHomeSeo(locale), [locale]);

  const handleLocale = useCallback((next: PublicLocale) => {
    setActivePublicLocale(next);
    changeLocale(next);
  }, [changeLocale]);

  return (
    <div className={`yoro-home-shell yoro-lol-home theme-${theme}`}>
      <a className="yoro-home-skip" href="#yoro-lol-home-main">{homeText.skipToContent}</a>
      <HomeHeader
        accountName={twitchStatus.user?.displayName}
        activeGame="lol"
        connected={twitchStatus.connected}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={handleLocale}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={() => void disconnectTwitch()}
        onToggleTheme={toggleTheme}
        text={homeText}
      />
      <LolSubnav text={text} />
      <main className="yoro-home-main" id="yoro-lol-home-main">
        <LolHomeHero homeText={homeText} locale={locale} text={text} />
        <HomeLiveSection
          connected={twitchStatus.connected}
          followedChannels={followedChannels}
          onLoginOpen={() => setLoginOpen(true)}
          text={homeText}
        />
        <LolDataSection homeText={homeText} locale={locale} text={text} />
        <LolParticipationBanner text={text} />
      </main>
      <HomeFooter locale={locale} onLocale={handleLocale} text={homeText} />
      <LolBottomTabBar text={text} />
      <HomeLoginModal
        onClose={() => setLoginOpen(false)}
        onTwitchLogin={startTwitchLogin}
        open={loginOpen}
        text={homeText}
      />
    </div>
  );
}

export default PublicLolHomePage;
