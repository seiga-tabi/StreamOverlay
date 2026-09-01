import { useCallback, useEffect, useState } from "react";
import "../styles/pages/public-streamers/streamers-route.css";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicAccountLogin } from "../shared/public-account-login";
import { StreamersHeader } from "../features/public-streamers/components/StreamersHeader";
import { StreamerComposePage } from "../features/public-streamers/components/StreamerComposePage";
import { StreamerDetailPage } from "../features/public-streamers/components/StreamerDetailPage";
import { StreamerListPage } from "../features/public-streamers/components/StreamerListPage";
import { usePublicViewerTwitch } from "../features/public-streamers/hooks/usePublicViewerTwitch";
import { useStreamersRoute } from "../features/public-streamers/hooks/useStreamersRoute";
import { streamersI18n, type StreamersLocale } from "../features/public-streamers/i18n/streamers-i18n";
import { applyStreamersSeo } from "../features/public-streamers/utils/seo";
import { setStreamersUrl, streamerOfficialProfilePath, streamersPathForPage } from "../features/public-streamers/utils/routes";

const noServerLocalePreference = async (): Promise<StreamersLocale | undefined> => undefined;

/* 스트리머 추천 게시판 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 근거: docs/mockups/streamer-board. 미니게임 셸 패턴 복제. */
export function PublicStreamersPage() {
  const { locale: rawLocale, changeLocale } = usePublicLocale(noServerLocalePreference);
  const locale = rawLocale;
  const { theme } = usePublicTheme();
  const { page, postId, officialProfile, scope } = useStreamersRoute();
  const viewerTwitch = usePublicViewerTwitch();
  /* 글·댓글·신고를 쓸 수 있는 기준은 "공개 페이지에 로그인돼 있는가" 입니다.
     계정 세션만 보면 LoL 화면에서 Twitch 로 로그인한 사람이 여기서만 비로그인으로
     취급돼 "로그인이 필요합니다" 를 만납니다(실사례). 두 세션을 합쳐서 봅니다. */
  const { accountConnected, loginWithTwitch } = usePublicAccountLogin({
    viewerTwitch: {
      connected: viewerTwitch.status.connected,
      ...(viewerTwitch.status.user ? { user: viewerTwitch.status.user } : {}),
      onDisconnect: viewerTwitch.disconnect,
    },
  });
  const [postTitle, setPostTitle] = useState<string | undefined>();
  const text = streamersI18n[locale];
  setActivePublicLocale(locale);

  useEffect(
    () => applyStreamersSeo(
      page ?? "list",
      locale,
      postTitle,
      officialProfile
        ? streamerOfficialProfilePath(officialProfile.platform, officialProfile.seoSlug)
        : postId ?? undefined,
    ),
    [locale, officialProfile?.platform, officialProfile?.seoSlug, page, postId, postTitle],
  );

  const handleLocale = useCallback((nextLocale: StreamersLocale) => {
    setActivePublicLocale(nextLocale);
    changeLocale(nextLocale);
  }, [changeLocale]);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell streamers-shell theme-${theme}`}
      mainId="streamers-main"
      sidebarMode="drawer"
      skipLinkLabel={text.skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="streamers-shell-header">
        <StreamersHeader locale={locale} onLocale={handleLocale} scope={scope} />
      </AppShellHeader>
      <AppShellMain className="streamers-main" id="streamers-main">
        <section aria-label={text.brand} className="streamers-page-section">
          {page === null ? (
            <div className="streamers-state streamers-state--error" role="alert">
              <strong>{text.notFound}</strong>
              <p>{text.notFoundBody}</p>
              <button onClick={() => setStreamersUrl(streamersPathForPage("list"))} type="button">{text.backToList}</button>
            </div>
          ) : null}
          {page === "list" ? (
            <StreamerListPage canPost={accountConnected} onLogin={loginWithTwitch} scope={scope} text={text} />
          ) : null}
          {page === "detail" && (postId || officialProfile) ? (
            <StreamerDetailPage
              canPost={accountConnected}
              onLogin={loginWithTwitch}
              onTitle={setPostTitle}
              {...(postId ? { postId } : {})}
              {...(officialProfile ? { officialProfile } : {})}
              text={text}
            />
          ) : null}
          {page === "compose" ? (
            <StreamerComposePage canPost={accountConnected} onLogin={loginWithTwitch} text={text} />
          ) : null}
        </section>
      </AppShellMain>
    </AppShell>
  );
}
