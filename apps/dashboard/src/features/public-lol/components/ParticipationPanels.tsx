import type { ReactNode } from "react";
import type { ViewerQueuePhase } from "../../participation/participation-display";

/* 참여 화면 조각 3종.
 *
 * 설명문을 두지 않는 것이 이 화면의 규칙입니다. 화면을 보면 알 수 있는 내용은
 * 쓰지 않고, 상태는 색이 아니라 짧은 글자로 알립니다(색만으로 구분하면
 * 접근성이 깨집니다).
 */

/* 아이콘은 SVG 로 그립니다 — 이모지·딩벳은 글꼴에 따라 크기·색이 흔들리고
   OS 마다 다른 그림이 나옵니다(목업 규칙). stroke 1.2 · 15px 한 벌. */
function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="15">
      <path d="M20 11A8 8 0 0 0 6.3 6.3L3 9" />
      <path d="M3 4v5h5" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L21 15" />
      <path d="M21 20v-5h-5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="15">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="15">
      <path d="M18 8a6 6 0 0 0-9.3-5" />
      <path d="M6 8c0 7-3 9-3 9h13" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/* 홈 시그니처 꼬리 밑줄 — 내 순번 아래 한 획(목업 §내 상태). */
function TailUnderline({ className, width, height }: { className?: string; width: number; height: number }) {
  return (
    <svg aria-hidden="true" className={className} height={height} viewBox="0 0 180 12" width={width}>
      <path d="M2 5.5 C 50 1.5, 100 11, 176 5.2 C 120 8.4, 55 7.5, 2 9 Z" fill="currentColor" />
    </svg>
  );
}

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
          <RefreshIcon />
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
  waitingLabel: string;
  checkedInLabel: string;
  /** 큰 순번 뒤에 붙는 단위("번"). */
  positionUnit: string;
  notificationsTitle: string;
  notificationsDescription: string;
};

export type ParticipationMyStatusProps = {
  phase: ViewerQueuePhase;
  position: number;
  /** "내 앞 3명" 처럼 이미 조립된 문구입니다. */
  aheadLabel: string;
  phaseLabel: string;
  currentPlayerLabel: string;
  capacityLabel: string;
  /** 지표 4칸의 나머지 둘 — 서버 summary 가 이미 보내는 값입니다. */
  waitingLabel: string;
  checkedInLabel: string;
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
  waitingLabel,
  checkedInLabel,
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
        {/* 목업 §내 상태: 명조 큰 숫자 + 작은 단위 + 꼬리 밑줄. "#" 기호는 뺍니다. */}
        <strong className="public-participation-mine-number">
          <span>{position}</span>
          <em>{text.positionUnit}</em>
          <TailUnderline className="public-participation-mine-tail" height={8} width={52} />
        </strong>
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
            {notificationsEnabled ? <BellIcon /> : <BellOffIcon />}
          </button>
        ) : null}
      </div>

      {/* 지표 2 → 4(목업). waiting·checkedIn 은 서버 summary 가 이미 보내는 값이라
          새 API 가 필요 없습니다. */}
      <dl className="public-participation-mine-metrics">
        <div>
          <dt>{text.currentPlayerLabel}</dt>
          <dd>{currentPlayerLabel}</dd>
        </div>
        <div>
          <dt>{text.capacityLabel}</dt>
          <dd>{capacityLabel}</dd>
        </div>
        <div>
          <dt>{text.waitingLabel}</dt>
          <dd>{waitingLabel}</dd>
        </div>
        <div>
          <dt>{text.checkedInLabel}</dt>
          <dd>{checkedInLabel}</dd>
        </div>
      </dl>

      {/* 상태 알림 안내 — 문구는 이미 있었고 렌더만 빠져 있었습니다(목업 우측 하단). */}
      <div className="public-participation-mine-notice">
        <b>{text.notificationsTitle}</b>
        <span>{text.notificationsDescription}</span>
      </div>

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
  /** 이름 왼쪽 26px 원형 — ParticipationStreamerOption 과 같은 방식입니다. */
  avatar?: ReactNode;
  /** "Platinum II" — 티어색으로 칠합니다. */
  tierLabel: string;
  /** 소문자 티어 열쇠(gold·emerald…). 티어색 CSS 훅이고 없으면 무채입니다. */
  tierKey?: string;
  /** "미드" — 티어 뒤 무채 보조 문구. 없으면 티어만 보입니다. */
  roleLabel?: string;
  /** 상태 칩. 티어·포지션과 배타가 아니라 각자의 칸에 섭니다(목업 5열). */
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
  /** 열 머리 다섯 — 목업 대기열 상단. */
  colOrder: string;
  colViewer: string;
  colTier: string;
  colStatus: string;
  colChampion: string;
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
        <>
        {/* 열 머리 — 행과 같은 5트랙. 값이 어느 칸의 것인지 글자로 말합니다. */}
        <div aria-hidden="true" className="public-participation-qcols">
          <span>{text.colOrder}</span>
          <span>{text.colViewer}</span>
          <span>{text.colTier}</span>
          <span>{text.colStatus}</span>
          <span>{text.colChampion}</span>
        </div>
        <ol className="public-participation-qlist">
          {rows.map((row) => (
            <li key={row.key}>
              <div
                aria-current={row.isViewer ? "true" : undefined}
                className={`public-participation-qrow ${row.isViewer ? "is-viewer" : ""}`}
                data-tone={row.statusTone ?? "none"}
              >
                <span className="public-participation-qpos">{row.position}</span>
                <span className="public-participation-qname">
                  <span aria-hidden="true" className="public-participation-qavatar">{row.avatar}</span>
                  <b>{row.name}</b>
                </span>
                {/* 티어·포지션과 상태를 각자의 칸에 둡니다(예전에는 배타였습니다).
                    상태가 없는 행은 그 칸이 빈 채로 남아 열이 어긋나지 않습니다. */}
                <span className="public-participation-qdetail">
                  <b data-tier={row.tierKey ?? "unranked"}>{row.tierLabel}</b>
                  {row.roleLabel ? <span>{row.roleLabel}</span> : null}
                </span>
                <span className="public-participation-qstatus">
                  {row.statusLabel ? (
                    <span className="public-participation-tag" data-tone={row.statusTone ?? "mute"}>{row.statusLabel}</span>
                  ) : null}
                </span>
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
        </>
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
