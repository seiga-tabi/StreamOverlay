import { StreamersChrome } from "../../public-streamers/components/StreamersChrome";
import { streamersI18n, type StreamersLocale } from "../../public-streamers/i18n/streamers-i18n";

/* 스트리머 게시판 라우트 폴백 — PalworldRouteFallback과 동일 문법.
 * 실물 StreamersChrome을 먼저 그리고 본문은 카드 목록 형태의 골격 스켈레톤만
 * 둡니다. 테마는 부트 스크립트가 붙인 data-public-theme 을 따릅니다. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function StreamersRouteFallback({ locale = "ko" }: { locale?: StreamersLocale }) {
  const text = streamersI18n[locale];
  const theme = documentTheme();

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`yoro-home-shell yoro-lol-home streamers-shell theme-${theme}`}
      role="status"
    >
      <StreamersChrome
        accountName={undefined}
        connected={false}
        isStreamerAdmin={false}
        locale={locale}
        onLocale={noop}
        onLoginOpen={noop}
        onLogout={noop}
        onStreamerAdmin={undefined}
        onToggleTheme={noop}
        scope="all"
      />
      <main className="yoro-home-main">
        <div aria-hidden="true" className="yoro-lol-fallback-stage">
          <div className="yoro-lol-fallback-main">
            <span className="yoro-home-sk" style={{ width: "38%", height: 16 }} />
            <span className="yoro-home-sk" style={{ height: 96 }} />
            <span className="yoro-home-sk" style={{ height: 96 }} />
            <span className="yoro-home-sk" style={{ height: 96 }} />
          </div>
          <div className="yoro-lol-fallback-side">
            <span className="yoro-home-sk" style={{ height: 132 }} />
            <span className="yoro-home-sk" style={{ height: 88 }} />
          </div>
        </div>
        <p className="yoro-home-fallback-status">{text.listLoading}</p>
      </main>
    </div>
  );
}
