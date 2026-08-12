import type { ReactNode } from "react";
import type { ViewerQueuePhase } from "../../participation/participation-display";

/* 참여 화면 조각 3종.
 *
 * 설명문을 두지 않는 것이 이 화면의 규칙입니다. 화면을 보면 알 수 있는 내용은
 * 쓰지 않고, 상태는 색이 아니라 짧은 글자로 알립니다(색만으로 구분하면
 * 접근성이 깨집니다).
 */

/* ── 스트리머 전환 바 ──────────────────────────────────────── */

export type ParticipationStreamerSwitcherText = {
  changeLabel: string;
  liveLabel: string;
  offlineLabel: string;
  refreshLabel: string;
  watchLabel: string;
  watchAriaLabel: string;
};

export type ParticipationStreamerSwitcherProps = {
  avatar?: ReactNode;
  displayName: string;
  isLive?: boolean;
  loading?: boolean;
  sessionLabel: string;
  sessionTone: "good" | "info" | "warn" | "mute";
  watchUrl?: string;
  onChange: () => void;
  onRefresh: () => void;
  text: ParticipationStreamerSwitcherText;
};

export function ParticipationStreamerSwitcher({
  avatar,
  displayName,
  isLive = false,
  loading = false,
  sessionLabel,
  sessionTone,
  watchUrl,
  onChange,
  onRefresh,
  text,
}: ParticipationStreamerSwitcherProps) {
  return (
    <div className="public-participation-switcher">
      <span className={`public-participation-switcher-avatar ${isLive ? "is-live" : ""}`}>{avatar}</span>
      <span className="public-participation-switcher-who">
        <b>{displayName}</b>
      </span>
      <span className="public-participation-switcher-meta">
        <span className="public-participation-tag" data-tone={isLive ? "live" : "mute"}>
          {isLive ? text.liveLabel : text.offlineLabel}
        </span>
        <span className="public-participation-tag" data-tone={sessionTone}>{sessionLabel}</span>
        {watchUrl ? (
          <a
            aria-label={text.watchAriaLabel}
            className="public-participation-mini-button"
            href={watchUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            {text.watchLabel}
          </a>
        ) : null}
        <button className="public-participation-mini-button" onClick={onChange} type="button">
          {text.changeLabel}
        </button>
        <button
          aria-busy={loading}
          aria-label={text.refreshLabel}
          className={`public-participation-mini-button is-icon${loading ? " is-spinning" : ""}`}
          disabled={loading}
          onClick={onRefresh}
          type="button"
        >
          <span aria-hidden="true">↻</span>
        </button>
      </span>
    </div>
  );
}

/* ── 내 참여 상태 ──────────────────────────────────────────── */

export type ParticipationMyStatusText = {
  cancelLabel: string;
  cancellingLabel: string;
  notifyOnLabel: string;
  notifyOffLabel: string;
  currentPlayerLabel: string;
  capacityLabel: string;
};

export type ParticipationMyStatusProps = {
  phase: ViewerQueuePhase;
  position: number;
  /** "내 앞 3명" 처럼 이미 조립된 문구입니다. */
  aheadLabel: string;
  phaseLabel: string;
  currentPlayerLabel: string;
  capacityLabel: string;
  canCancel: boolean;
  cancelling: boolean;
  notificationsEnabled?: boolean;
  onCancel: () => void;
  onToggleNotifications?: () => void;
  text: ParticipationMyStatusText;
};

export function ParticipationMyStatus({
  phase,
  position,
  aheadLabel,
  phaseLabel,
  currentPlayerLabel,
  capacityLabel,
  canCancel,
  cancelling,
  notificationsEnabled,
  onCancel,
  onToggleNotifications,
  text,
}: ParticipationMyStatusProps) {
  return (
    <section className="public-participation-mine" data-phase={phase}>
      <div className="public-participation-mine-head">
        <strong className="public-participation-mine-number">#{position}</strong>
        <span className="public-participation-mine-copy">
          <b>{phaseLabel}</b>
          <span>{aheadLabel}</span>
        </span>
        {onToggleNotifications ? (
          <button
            aria-label={notificationsEnabled ? text.notifyOnLabel : text.notifyOffLabel}
            aria-pressed={Boolean(notificationsEnabled)}
            className="public-participation-mini-button is-icon"
            onClick={onToggleNotifications}
            type="button"
          >
            <span aria-hidden="true">{notificationsEnabled ? "🔔" : "🔕"}</span>
          </button>
        ) : null}
      </div>

      <dl className="public-participation-mine-metrics">
        <div>
          <dt>{text.currentPlayerLabel}</dt>
          <dd>{currentPlayerLabel}</dd>
        </div>
        <div>
          <dt>{text.capacityLabel}</dt>
          <dd>{capacityLabel}</dd>
        </div>
      </dl>

      {canCancel ? (
        <button
          className="public-participation-cancel"
          disabled={cancelling}
          onClick={onCancel}
          type="button"
        >
          {cancelling ? text.cancellingLabel : text.cancelLabel}
        </button>
      ) : null}
    </section>
  );
}

/* ── 대기열 ────────────────────────────────────────────────── */

export type ParticipationQueueRow = {
  key: string;
  position: number;
  name: string;
  /** "Platinum II · 미드" 처럼 이미 조립된 한 줄입니다. */
  detail: string;
  /** 값이 있으면 detail 대신 상태 배지를 보여줍니다. */
  statusLabel?: string;
  statusTone?: "info" | "warn" | "good" | "brand" | "mute";
  isViewer?: boolean;
  champions: Array<{ key: string; iconUrl?: string }>;
};

export type ParticipationQueueListText = {
  title: string;
  emptyLabel: string;
  moreLabel: string;
  lessLabel: string;
  gapLabel: string;
};

export type ParticipationQueueListProps = {
  rows: ParticipationQueueRow[];
  totalCount: number;
  /** 접힘 상태에서 생략된 구간이 있으면 그 자리에 표식을 넣습니다. */
  gapAfterPositions?: number[];
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
  text: ParticipationQueueListText;
};

export function ParticipationQueueList({
  rows,
  totalCount,
  gapAfterPositions = [],
  hiddenCount,
  expanded,
  onToggle,
  text,
}: ParticipationQueueListProps) {
  return (
    <section className="public-participation-qpanel">
      <div className="public-participation-qhead">
        <h3>{text.title}</h3>
        <span className="public-participation-tag" data-tone="mute">{totalCount}</span>
      </div>

      {rows.length === 0 ? (
        <p className="public-participation-qempty">{text.emptyLabel}</p>
      ) : (
        <ol className="public-participation-qlist">
          {rows.map((row) => (
            <li key={row.key}>
              <div
                aria-current={row.isViewer ? "true" : undefined}
                className={`public-participation-qrow ${row.isViewer ? "is-viewer" : ""}`}
                data-tone={row.statusTone ?? "none"}
              >
                <span className="public-participation-qpos">{row.position}</span>
                <span className="public-participation-qname">{row.name}</span>
                {row.statusLabel ? (
                  <span className="public-participation-tag" data-tone={row.statusTone ?? "mute"}>{row.statusLabel}</span>
                ) : (
                  <span className="public-participation-qdetail">{row.detail}</span>
                )}
                <span aria-hidden="true" className="public-participation-qchamps">
                  {row.champions.map((champion) => (
                    champion.iconUrl
                      ? <img alt="" key={champion.key} src={champion.iconUrl} />
                      : <i key={champion.key} />
                  ))}
                </span>
              </div>
              {gapAfterPositions.includes(row.position) ? (
                <p className="public-participation-qgap">{text.gapLabel}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {hiddenCount > 0 || expanded ? (
        <button
          aria-expanded={expanded}
          className="public-participation-qtoggle"
          onClick={onToggle}
          type="button"
        >
          {expanded ? text.lessLabel : text.moreLabel}
        </button>
      ) : null}
    </section>
  );
}

/* ── 스트리머 선택 ─────────────────────────────────────────── */

export type ParticipationStreamerOption = {
  key: string;
  id: string;
  displayName: string;
  avatar?: ReactNode;
  isLive?: boolean;
  isOpen: boolean;
  queueSize: number;
  maxQueueSize: number;
};

export type ParticipationStreamerPicksProps = {
  options: ParticipationStreamerOption[];
  closedOptions: ParticipationStreamerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  text: { title: string; emptyLabel: string; closedLabel: string; countLabel: string };
};

export function ParticipationStreamerPicks({
  options,
  closedOptions,
  selectedId,
  onSelect,
  text,
}: ParticipationStreamerPicksProps) {
  return (
    <section className="public-participation-picks-section">
      <div className="public-participation-qhead">
        <h3>{text.title}</h3>
        <span className="public-participation-tag" data-tone="brand">{options.length}{text.countLabel}</span>
      </div>

      {options.length === 0 ? (
        <p className="public-participation-qempty">{text.emptyLabel}</p>
      ) : (
        <div className="public-participation-picks">
          {options.map((option) => (
            <button
              aria-pressed={option.id === selectedId}
              className={`public-participation-pick ${option.id === selectedId ? "is-active" : ""}`}
              key={option.key}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              <span className={`public-participation-switcher-avatar ${option.isLive ? "is-live" : ""}`}>{option.avatar}</span>
              <b>{option.displayName}</b>
              <span className="public-participation-pick-count">
                {option.queueSize}/{option.maxQueueSize}
              </span>
              <span className="public-participation-pick-gauge">
                <i style={{ width: `${Math.max(2, Math.min(100, (option.queueSize / Math.max(1, option.maxQueueSize)) * 100))}%` }} />
              </span>
            </button>
          ))}
        </div>
      )}

      {closedOptions.length > 0 ? (
        <div className="public-participation-picks is-closed-list">
          {closedOptions.map((option) => (
            <div className="public-participation-pick is-closed" key={option.key}>
              <span className="public-participation-switcher-avatar">{option.avatar}</span>
              <b>{option.displayName}</b>
              <span className="public-participation-tag" data-tone="mute">{text.closedLabel}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
