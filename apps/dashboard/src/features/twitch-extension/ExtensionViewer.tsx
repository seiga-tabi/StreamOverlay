import {
  extensionViewerI18n,
  formatExtensionTemplate,
  type ExtensionLocale,
} from "./extension-i18n";
import {
  DEFAULT_TWITCH_EXTENSION_DISPLAY,
  type TwitchExtensionDisplaySettings,
} from "@streamops/shared";

/* Twitch Extension Viewer UI — 순수 표시 컴포넌트.
 *
 * 실제 Extension(iframe)과 대시보드 Live Preview 가 같은 컴포넌트를 씁니다.
 * EBS 연동·JWT·설정 저장은 Codex handoff 대상이며, 여기서는 콜백만 받습니다.
 * 근거: docs/mockups/twitch-extension-viewer.html (정보 위계 ①상태 ②참가 ③내 상태 ④순번 ⑤인원 ⑥게임 ⑦브랜드)
 */

export type ExtensionViewerStatus =
  | "loading"
  | "no_session"
  | "active"
  | "joining"
  | "joined"
  | "next"
  | "paused"
  | "full"
  | "ended"
  | "error";

export type ExtensionViewerData = {
  status: ExtensionViewerStatus;
  game?: string;
  waitingCount?: number;
  myPosition?: number;
};

export type ExtensionDisplaySettings = TwitchExtensionDisplaySettings;

export const DEFAULT_EXTENSION_DISPLAY = DEFAULT_TWITCH_EXTENSION_DISPLAY;

function GameBadge({ name }: { name: string }) {
  return (
    <span className="twitch-ext-game">
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <rect height="12" rx="4" width="20" x="2" y="7" />
        <path d="M7 11v4M5 13h4M15.5 12h.01M18 14h.01" />
      </svg>
      <span className="twitch-ext-game__name">{name}</span>
    </span>
  );
}

function YoroLogo() {
  /* 브랜드는 항상 최저 위계 — 참가 행동보다 강조되지 않습니다. */
  return <span aria-hidden="true" className="twitch-ext-logo"><b>YORO</b>.GG</span>;
}

function StatusBadge({ locale, status }: { locale: ExtensionLocale; status: ExtensionViewerStatus }) {
  const text = extensionViewerI18n[locale];
  const map: Partial<Record<ExtensionViewerStatus, { className: string; label: string }>> = {
    active: { className: "is-open", label: text.statusOpen },
    joining: { className: "is-open", label: text.statusOpen },
    paused: { className: "is-paused", label: text.statusPaused },
    full: { className: "is-full", label: text.statusFull },
    ended: { className: "is-closed", label: text.statusClosed },
    error: { className: "is-error", label: text.statusError },
  };
  const entry = map[status];
  if (!entry) return null;
  return <span className={`twitch-ext-status ${entry.className}`}>{entry.label}</span>;
}

function WaitingCounter({ count, locale }: { count: number; locale: ExtensionLocale }) {
  const template = extensionViewerI18n[locale].waiting;
  const [before, after] = formatExtensionTemplate(template, { count: "\u0000" }).split("\u0000");
  return (
    <span className="twitch-ext-waiting">{before}<b>{count}</b>{after}</span>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
      <path d="m4 12 5 5L20 6" />
    </svg>
  );
}

export function ExtensionOverlayCollapsed({ data, locale, onExpand }: {
  data: ExtensionViewerData;
  locale: ExtensionLocale;
  onExpand?: () => void;
}) {
  const text = extensionViewerI18n[locale];
  return (
    <button className="twitch-ext-shell twitch-ext-collapsed" onClick={onExpand} type="button">
      <span aria-hidden="true" className="twitch-ext-collapsed__dot" />
      {formatExtensionTemplate(text.collapsed, { count: data.waitingCount ?? 0 })}
    </button>
  );
}

export function ExtensionViewerPanel({
  data,
  display = DEFAULT_EXTENSION_DISPLAY,
  locale,
  onCancel,
  onJoin,
  onRetry,
  variant = "panel",
}: {
  data: ExtensionViewerData;
  display?: ExtensionDisplaySettings;
  locale: ExtensionLocale;
  onCancel?: () => void;
  onJoin?: () => void;
  onRetry?: () => void;
  variant?: "panel" | "overlay";
}) {
  const text = extensionViewerI18n[locale];
  /* NEXT 표시가 꺼져 있으면 선정 상태도 참가 완료 화면으로 보여줍니다. */
  const status: ExtensionViewerStatus =
    data.status === "next" && !display.nextState ? "joined" : data.status;
  const joined = status === "joined";
  const showHead = display.game && data.game !== undefined && status !== "loading" && status !== "no_session" && status !== "ended" && status !== "error";

  return (
    <section
      aria-label="YORO.GG"
      className={`twitch-ext twitch-ext-shell twitch-ext-panel is-${variant}${status === "next" ? " is-next" : ""}`}
      data-testid="twitch-ext-panel"
    >
      <div className="twitch-ext-panel__head">
        {showHead ? <GameBadge name={data.game ?? ""} /> : <span />}
        <YoroLogo />
      </div>

      {status === "loading" ? (
        <div aria-label={text.loadingLabel} className="twitch-ext-skeletons" role="status">
          <span className="twitch-ext-skeleton" style={{ blockSize: "1.25rem", inlineSize: "60%" }} />
          <span className="twitch-ext-skeleton" style={{ blockSize: ".875rem", inlineSize: "40%" }} />
          <span className="twitch-ext-skeleton" style={{ blockSize: "2.5rem" }} />
        </div>
      ) : null}

      {status === "no_session" ? (
        <p className="twitch-ext-message">{text.noSessionMessage}</p>
      ) : null}

      {status === "active" || status === "joining" ? (
        <>
          <StatusBadge locale={locale} status={status} />
          {display.waitingCount && data.waitingCount !== undefined
            ? <WaitingCounter count={data.waitingCount} locale={locale} />
            : null}
          {display.joinButton ? (
            <button
              className={`twitch-ext-join${status === "joining" ? " is-loading" : ""}`}
              disabled={status === "joining"}
              onClick={onJoin}
              type="button"
            >
              {status === "joining" ? <><span aria-hidden="true" className="twitch-ext-spinner" />{text.joining}</> : text.join}
            </button>
          ) : null}
        </>
      ) : null}

      {joined ? (
        <>
          <span className="twitch-ext-joined"><CheckIcon />{variant === "overlay" ? text.joinedOverlay : text.joinedPanel}</span>
          {display.myPosition && data.myPosition !== undefined ? (
            <div className="twitch-ext-queuepos">
              <span className="twitch-ext-queuepos__label">{text.myTurnLabel}</span>
              <span className="twitch-ext-queuepos__num">#{data.myPosition}</span>
            </div>
          ) : null}
          {display.waitingCount && data.waitingCount !== undefined
            ? <WaitingCounter count={data.waitingCount} locale={locale} />
            : null}
          {display.cancelButton ? (
            <button className="twitch-ext-cancel" onClick={onCancel} type="button">{text.cancel}</button>
          ) : null}
        </>
      ) : null}

      {status === "next" ? (
        <>
          <span className="twitch-ext-next-tag">{text.nextTag}</span>
          <strong className="twitch-ext-next-title">{text.nextTitle}</strong>
          <p className="twitch-ext-message">{text.nextMessage}</p>
        </>
      ) : null}

      {status === "paused" || status === "full" ? (
        <>
          <StatusBadge locale={locale} status={status} />
          <p className="twitch-ext-message">{status === "paused" ? text.pausedMessage : text.fullMessage}</p>
          {display.joinButton ? (
            <button className="twitch-ext-join" disabled type="button">{text.join}</button>
          ) : null}
        </>
      ) : null}

      {status === "ended" ? (
        <>
          <StatusBadge locale={locale} status={status} />
          <p className="twitch-ext-message">{text.endedMessage}</p>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <StatusBadge locale={locale} status={status} />
          <p className="twitch-ext-message">{text.errorMessage}</p>
          <button className="twitch-ext-cancel is-retry" onClick={onRetry} type="button">{text.retry}</button>
        </>
      ) : null}
    </section>
  );
}
