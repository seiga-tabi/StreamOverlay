import type { ReactNode } from "react";

export type MatchTeamHeaderViewModel = {
  label: ReactNode;
  resultSummary: ReactNode;
  summary: ReactNode;
  tierSummary: ReactNode;
};

/* 상대 팀 접기 토글(목업 §3-1) — 39-ink 인게임 보드와 같은 문법: 버튼은 모바일
   전용(CSS 가 데스크톱에서 숨김)이고, 접힌 머리에도 승패·팀 KDA 는 남습니다. */
export type MatchTeamHeaderToggle = {
  expanded: boolean;
  label: ReactNode;
  onToggle: () => void;
};

export type MatchTeamHeaderProps = {
  viewModel: MatchTeamHeaderViewModel;
  toggle?: MatchTeamHeaderToggle;
};

export function MatchTeamHeader({ viewModel, toggle }: MatchTeamHeaderProps) {
  return (
    <div className="public-team-head">
      <strong>{viewModel.label}</strong>
      <span>{viewModel.resultSummary}</span>
      <div className="public-team-head-summary">
        <small>{viewModel.summary}</small>
      </div>
      <em>{viewModel.tierSummary}</em>
      {toggle ? (
        <button
          aria-expanded={toggle.expanded}
          className="public-team-head-toggle"
          onClick={toggle.onToggle}
          type="button"
        >
          {toggle.label}
          <svg aria-hidden="true" fill="none" height="5" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="8">
            <path d="M1 1 L 4 4 L 7 1" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
