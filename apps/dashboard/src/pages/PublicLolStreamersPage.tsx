import { useCallback, useEffect, useState } from "react";
import "../styles/pages/home/01-public-home.css";
import "../styles/pages/home/02-lol-home.css";
import "../styles/pages/home/03-lol-streamers.css";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { setActivePublicLocale, type PublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicViewerTwitchSession } from "../shared/usePublicViewerTwitchSession";
import { HomeFooter, HomeLoginModal } from "../features/public-home/components/HomeSections";
import { LolChrome } from "../features/public-home/components/LolChrome";
import { StreamersBody, StreamersPageHead } from "../features/public-home/components/LolStreamersSections";
import { LolBottomTabBar } from "../features/public-home/components/HomeTabBar";
import { useHomeTheme } from "../features/public-home/hooks/useHomeTheme";
import { homeI18n } from "../features/public-home/i18n/home-i18n";
import { lolHomeI18n } from "../features/public-home/i18n/lol-home-i18n";
import { lolStreamersI18n } from "../features/public-home/i18n/lol-streamers-i18n";
import { applyLolStreamersSeo } from "../features/public-home/utils/seo";

const noServerLocalePreference = async (): Promise<PublicLocale | undefined> => undefined;

/* LoL 스트리머(/follow) — 목업 캔버스 "YORO 홈 리디자인" page-3 구현.
 * 홈 계열과 같은 공통 컴포넌트(헤더·2행 메뉴·방송 카드·푸터·하단 탭·로그인 팝업)에
 * 이 화면 전용 조각(페이지 헤드·필터 칩·랭크 배지·오프라인 행)을 얹습니다.
 * 데이터는 기존 계약 그대로: 뷰어 Twitch 세션 + 팔로우 LoL 채널. */
export function PublicLolStreamersPage() {
  const { locale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const { theme, toggleTheme } = useHomeTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const homeText = homeI18n[locale];
  const lolText = lolHomeI18n[locale];
  const text = lolStreamersI18n[locale];
  setActivePublicLocale(locale);

  const {
    disconnectTwitch,
    followedChannels,
    retryTwitch,
    startTwitchLogin,
    twitchError,
    twitchLoading,
    twitchStatus
  } = usePublicViewerTwitchSession({
    loginReturnTo: () => `${window.location.pathname}${window.location.search}`,
    needsFollowedChannels: true
  });

  useEffect(() => applyLolStreamersSeo(locale), [locale]);

  const handleLocale = useCallback((next: PublicLocale) => {
    setActivePublicLocale(next);
    changeLocale(next);
  }, [changeLocale]);

  return (
    <div className={`yoro-home-shell yoro-lol-home yoro-streamers-page theme-${theme}`}>
      <a className="yoro-home-skip" href="#yoro-streamers-main">{homeText.skipToContent}</a>
      <LolChrome
        accountName={twitchStatus.user?.displayName}
        active="streamers"
        connected={twitchStatus.connected}
        locale={locale}
        onLocale={handleLocale}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={() => void disconnectTwitch()}
        onToggleTheme={toggleTheme}
      />
      <main className="yoro-home-main" id="yoro-streamers-main">
        <StreamersPageHead
          count={twitchStatus.connected && followedChannels ? followedChannels.channels.length : undefined}
          loading={twitchLoading}
          onRefresh={() => void retryTwitch()}
          text={text}
        />
        <StreamersBody
          configured={twitchStatus.configured}
          connected={twitchStatus.connected}
          error={twitchError}
          followed={followedChannels}
          homeText={homeText}
          loading={twitchLoading}
          locale={locale}
          onLoginOpen={() => setLoginOpen(true)}
          onRetry={() => void retryTwitch()}
          text={text}
        />
      </main>
      <HomeFooter locale={locale} onLocale={handleLocale} text={homeText} />
      <LolBottomTabBar active="streamers" text={lolText} />
      <HomeLoginModal
        onClose={() => setLoginOpen(false)}
        onTwitchLogin={startTwitchLogin}
        open={loginOpen}
        text={homeText}
      />
    </div>
  );
}

export default PublicLolStreamersPage;
