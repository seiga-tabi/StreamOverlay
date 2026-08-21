import { useEffect, useId, useRef, type ReactNode } from "react";

export type RecentMatchRowLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type RecentMatchRowMediaItem = {
  key: string;
  className?: string;
  label?: string;
  focusable?: boolean;
  content: ReactNode;
};

export type RecentMatchRowMetric = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** 0~100. 값이 있으면 라벨 아래에 게이지를 그립니다. */
  ratio?: number;
  /** 폭이 좁아지면 가장 먼저 감추는 보조 문구입니다. */
  labelSuffix?: ReactNode;
  /** 모바일에서 label 대신 쓰는 짧은 라벨입니다. 본문 최소 12px 를 지키기 위해 필요합니다. */
  labelShort?: ReactNode;
  title?: string;
};

export type RecentMatchRowTeamMember = {
  key: string;
  label: string;
  /* 아이콘 옆에 표기되는 Riot ID(마스킹 반영) — 목업 v30. 없으면 아이콘만. */
  name?: string;
  isTarget?: boolean;
  content: ReactNode;
};

export type RecentMatchRowTeams = {
  allies: RecentMatchRowTeamMember[];
  opponents: RecentMatchRowTeamMember[];
  compositionLabel: string;
  alliesLabel: string;
  opponentsLabel: string;
};

export type RecentMatchRowProps = {
  matchAriaLabel: string;
  result: string;
  highlightClass: string;
  expanded: boolean;
  resultLabel: ReactNode;
  resultShortLabel: ReactNode;
  queueLabel: ReactNode;
  startedAtLabel: ReactNode;
  startedAtTimeLabel: ReactNode;
  resultDurationLabel: ReactNode;
  championIconUrl?: string;
  championFallback: ReactNode;
  championName: ReactNode;
  championRoleLabel: ReactNode;
  championLevelLabel: ReactNode;
  spellItems: RecentMatchRowMediaItem[];
  summonerSpellsLabel: string;
  kdaScore: ReactNode;
  kdaMetric: ReactNode;
  scoreClassName: string;
  scoreDescription: RecentMatchRowLocalizedText;
  scoreGrade: string;
  scoreAriaLabel: string;
  metrics: RecentMatchRowMetric[];
  /** 아레나 증강 6픽 — 스펠·룬과 별개의 3×2 격자 열(목업 lol-arena-match-row.html §②). */
  loadoutGridItems?: RecentMatchRowMediaItem[];
  /** 아레나처럼 5v5 기준 AI 스코어가 성립하지 않는 큐에서 배지를 숨깁니다. */
  hideScore?: boolean;
  itemSlots: RecentMatchRowMediaItem[];
  trinketSlot?: RecentMatchRowMediaItem;
  itemsLabel: string;
  teams?: RecentMatchRowTeams;
  /* 다시보기 링크(목업 v27 행 ⑦ 액션) — 스트리머 프로필에서 VOD 가 잡힌 경기만.
     확장 캐럿과 같은 액션 열에 세로로 붙습니다. */
  replayAction?: ReactNode;
  expandAriaLabel: string;
  expandedPanel?: ReactNode;
  onToggleExpand: () => void;
};

export function recentMatchScoreGrade(score: number): string {
  if (score >= 90) return "S+";
  if (score >= 85) return "S";
  if (score >= 75) return "A+";
  if (score >= 65) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

function highlightBadge(highlightClass: string): { className: string; label: string } | null {
  if (highlightClass === "highlight-mvp") return { className: "mvp", label: "MVP" };
  if (highlightClass === "highlight-ace") return { className: "ace", label: "ACE" };
  return null;
}

export function RecentMatchRow({
  matchAriaLabel,
  result,
  highlightClass,
  expanded,
  resultLabel,
  resultShortLabel,
  queueLabel,
  startedAtLabel,
  startedAtTimeLabel,
  resultDurationLabel,
  championIconUrl,
  championFallback,
  championName,
  championRoleLabel,
  championLevelLabel,
  spellItems,
  summonerSpellsLabel,
  kdaScore,
  kdaMetric,
  scoreClassName,
  scoreDescription,
  scoreGrade,
  scoreAriaLabel,
  metrics,
  loadoutGridItems,
  hideScore,
  itemSlots,
  trinketSlot,
  itemsLabel,
  teams,
  replayAction,
  expandAriaLabel,
  expandedPanel,
  onToggleExpand
}: RecentMatchRowProps) {
  const scoreDescriptionId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const wasExpanded = useRef(expanded);
  /* 행이 화면 아래쪽에 있으면 펼친 내용이 화면 밖에서 열립니다 — 펼칠 때 행을
     화면 위쪽으로 올립니다(목업 §3-2). sticky 크롬만큼은 scroll-margin-top
     (22-match-card.css)이 비켜 줍니다. */
  useEffect(() => {
    if (expanded && !wasExpanded.current) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
    wasExpanded.current = expanded;
  }, [expanded]);
  const summonerSpellItems = spellItems.filter((item) => item.className !== "rune");
  const runeItems = spellItems.filter((item) => item.className === "rune");
  const highlight = highlightBadge(highlightClass);

  const renderLoadoutItems = (items: RecentMatchRowMediaItem[]) => items.map((item) => (
    <span className={item.className} key={item.key} title={item.label}>
      {item.content}
    </span>
  ));

  const renderTeamLine = (members: RecentMatchRowTeamMember[], variant: string, label: string) => (
    <div className={`public-match-card-team-line ${variant}`}>
      <b>{label}</b>
      {members.map((member) => (
        <span
          className={`public-match-card-team-member ${member.isTarget ? "is-target" : ""}`}
          key={member.key}
          title={member.label}
        >
          {member.content}
          {member.name ? <em className="public-match-card-team-name">{member.name}</em> : null}
        </span>
      ))}
    </div>
  );

  return (
    <article
      aria-label={matchAriaLabel}
      className={`public-match-card ${result} ${highlightClass} ${expanded ? "expanded" : ""}`}
      ref={rootRef}
    >
      {/* 요약 영역 전체가 확장 토글입니다. 실제 button 은 아래에 그대로 남아
          aria-expanded 와 키보드 탐색 순서를 유지합니다. */}
      <div className="public-match-card-summary" onClick={onToggleExpand} role="presentation">
        <div className="public-match-card-outcome">
          <span className="public-match-card-outcome-line">
            <b className={`public-match-card-result ${result}`} aria-hidden="true">{resultShortLabel}</b>
            <strong>{queueLabel}</strong>
          </span>
          <small title={`${startedAtTimeLabel} · ${resultDurationLabel}`}>
            {startedAtLabel}
            <i className="public-match-card-duration">
              <span aria-hidden="true"> · </span>
              {resultDurationLabel}
            </i>
          </small>
          <span className="yoro-u-sr-only">{resultLabel}</span>
        </div>

        {/* 병합 셀(목업 "전적 행 — 네 가지 수정" §2-3·2-4) — 챔피언·KDA 두 칸이
            바깥 격자의 트랙 2–3(176px+116px)을 span 2 로 차지하고, 아이템이 그
            아래 전폭 한 줄로 깔립니다. 모바일(≤720)에서는 display: contents 로
            풀려 기존 3행 압축 격자가 그대로 동작합니다. */}
        <div className="public-match-card-champ-block">
        {/* 포지션은 모바일에서 접히므로 title 로도 남깁니다. */}
        <div className={`public-match-card-champion ${highlightClass}`} title={String(championRoleLabel)}>
          <span className="public-match-card-portrait">
            {championIconUrl ? <img src={championIconUrl} alt="" /> : <span>{championFallback}</span>}
            <b aria-hidden="true">{championLevelLabel}</b>
          </span>
          {spellItems.length > 0 || (loadoutGridItems?.length ?? 0) > 0 ? (
            <div className="public-match-card-loadout" aria-label={summonerSpellsLabel}>
              {summonerSpellItems.length > 0 ? (
                <div className="public-match-card-loadout-column spells">
                  {renderLoadoutItems(summonerSpellItems)}
                </div>
              ) : null}
              {runeItems.length > 0 ? (
                <div className="public-match-card-loadout-column runes">
                  {renderLoadoutItems(runeItems)}
                </div>
              ) : null}
              {loadoutGridItems && loadoutGridItems.length > 0 ? (
                <div className="public-match-card-loadout-grid">
                  {renderLoadoutItems(loadoutGridItems)}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="public-match-card-copy">
            <strong>{championName}</strong>
            <span className="public-match-card-role">{championRoleLabel}</span>
            {highlight ? (
              <span className={`public-match-card-highlight ${highlight.className}`}>{highlight.label}</span>
            ) : null}
          </div>
        </div>

        <div className="public-match-card-perf">
          {!hideScore ? (
            <div
              aria-describedby={scoreDescriptionId}
              aria-label={scoreAriaLabel}
              className={`public-match-card-score ${scoreClassName}`}
              data-grade={scoreGrade}
              tabIndex={0}
            >
              <b>{scoreGrade}</b>
              <span
                className="public-match-card-score-description"
                data-ko={scoreDescription.ko}
                data-ja={scoreDescription.ja}
                id={scoreDescriptionId}
                role="tooltip"
              >
                {scoreDescription.label}
              </span>
            </div>
          ) : null}
          <div className="public-match-card-kda">
            <strong>{kdaScore}</strong>
            <div className="public-match-card-kda-summary">
              <span>{kdaMetric}</span>
            </div>
          </div>
        </div>

        <div className="public-match-card-items" aria-label={itemsLabel}>
          <span className="public-match-card-item-grid">
            {itemSlots.map((item) => (
              <span
                aria-label={item.label}
                className={item.className ?? ""}
                data-tooltip={item.label}
                key={item.key}
                tabIndex={item.focusable ? 0 : undefined}
                title={item.label}
              >
                {item.content}
              </span>
            ))}
          </span>
          {trinketSlot ? (
            <span
              aria-label={trinketSlot.label}
              className={`public-match-card-trinket ${trinketSlot.className ?? ""}`}
              key={trinketSlot.key}
              title={trinketSlot.label}
            >
              {trinketSlot.content}
            </span>
          ) : null}
        </div>
        </div>

        <div className="public-match-card-stats">
          {metrics.map((metric) => (
            <span key={metric.key}>
              <strong>{metric.value}</strong>
              <small title={metric.title}>
                <i className="public-match-card-stat-label">{metric.label}</i>
                {metric.labelShort ? <i className="public-match-card-stat-label-short">{metric.labelShort}</i> : null}
                {metric.labelSuffix ? <i className="public-match-card-stat-suffix">{metric.labelSuffix}</i> : null}
              </small>
              {typeof metric.ratio === "number" ? (
                <span aria-hidden="true" className="public-match-card-stat-bar">
                  <em style={{ width: `${Math.max(0, Math.min(100, metric.ratio))}%` }} />
                </span>
              ) : null}
            </span>
          ))}
        </div>

        {teams ? (
          <div className="public-match-card-team" aria-label={teams.compositionLabel}>
            {teams.allies.length > 0 ? renderTeamLine(teams.allies, "allies", teams.alliesLabel) : null}
            {/* 아레나는 상대 줄이 비어 있습니다(행에서 상대 제외 — 목업 v1.4). */}
            {teams.opponents.length > 0 ? renderTeamLine(teams.opponents, "opponents", teams.opponentsLabel) : null}
          </div>
        ) : null}

        {/* 액션 열 — grid 자식 수(7)를 유지하려고 다시보기와 캐럿을 한 셀에 묶습니다. */}
        <div className="public-match-card-actions">
          {replayAction}
          <button
            type="button"
            className="public-match-card-expand"
            aria-expanded={expanded}
            aria-label={expandAriaLabel}
            onClick={(event) => {
              // 요약 영역 핸들러와 중복 실행되지 않도록 버튼에서 전파를 끊습니다.
              event.stopPropagation();
              onToggleExpand();
            }}
          >
            <span aria-hidden="true" className="public-match-card-expand-icon" />
            <span className="public-match-card-expand-label" role="tooltip">{expandAriaLabel}</span>
          </button>
        </div>
      </div>

      {expanded ? expandedPanel : null}
    </article>
  );
}
