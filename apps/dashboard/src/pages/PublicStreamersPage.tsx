import { useCallback, useEffect, useState } from "react";
import "../styles/pages/public-streamers/streamers-route.css";
import { AppShell, AppShellHeader, AppShellMain } from "../shared/ui/AppShell";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import { publicContentLocale, setActivePublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import { usePublicAccountLogin } from "../shared/public-account-login";
import { StreamersHeader } from "../features/public-streamers/components/StreamersHeader";
import { StreamerComposePage } from "../features/public-streamers/components/StreamerComposePage";
import { StreamerDetailPage } from "../features/public-streamers/components/StreamerDetailPage";
import { StreamerListPage } from "../features/public-streamers/components/StreamerListPage";
import { useStreamersRoute } from "../features/public-streamers/hooks/useStreamersRoute";
import { streamersI18n, type StreamersLocale } from "../features/public-streamers/i18n/streamers-i18n";
import { applyStreamersSeo } from "../features/public-streamers/utils/seo";
import { setStreamersUrl, streamersPathForPage } from "../features/public-streamers/utils/routes";

const noServerLocalePreference = async (): Promise<StreamersLocale | undefined> => undefined;

/* 스트리머 추천 게시판 셸 — 라우팅 상태와 화면 조립만 담당합니다(모놀리스 금지).
 * 근거: docs/mockups/streamer-board. 미니게임 셸 패턴 복제. */
export function PublicStreamersPage() {
  const { locale: rawLocale, changeLocale } = usePublicLocale(noServerLocalePreference);
  /* en 콘텐츠는 아직 팰월드만 있습니다 — 그 외는 ko 폴백. */
  const locale = publicContentLocale(rawLocale);
  const { theme } = usePublicTheme();
  const { page, postId, scope } = useStreamersRoute();
  const { loginWithTwitch, yoroConnected } = usePublicAccountLogin();
  const [postTitle, setPostTitle] = useState<string | undefined>();
  const text = streamersI18n[locale];
  setActivePublicLocale(locale);

  useEffect(
    () => applyStreamersSeo(page ?? "list", locale, postTitle),
    [locale, page, postTitle],
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
            <StreamerListPage canPost={yoroConnected} onLogin={loginWithTwitch} scope={scope} text={text} />
          ) : null}
          {page === "detail" && postId ? (
            <StreamerDetailPage
              canPost={yoroConnected}
              onLogin={loginWithTwitch}
              onTitle={setPostTitle}
              postId={postId}
              text={text}
            />
          ) : null}
          {page === "compose" ? (
            <StreamerComposePage canPost={yoroConnected} onLogin={loginWithTwitch} text={text} />
          ) : null}
        </section>
      </AppShellMain>
    </AppShell>
  );
}
