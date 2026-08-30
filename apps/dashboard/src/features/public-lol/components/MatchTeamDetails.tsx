import { useState } from "react";
import type { ReactNode } from "react";
import {
  MatchTeamDetailsTeamSection,
  type MatchTeamDetailsColumnLabels,
  type MatchTeamDetailsTeamSectionViewModel
} from "./MatchTeamDetailsTeamSection";
import type { MatchTeamDetailsPlayerRowViewModel } from "./MatchTeamDetailsPlayerRow";

export type MatchTeamDetailsPlayer = MatchTeamDetailsPlayerRowViewModel;
export type MatchTeamDetailsTeam = MatchTeamDetailsTeamSectionViewModel;

export type MatchTeamDetailsProps = {
  ariaLabel: string;
  kdaLabel: string;
  columns: MatchTeamDetailsColumnLabels;
  teams: MatchTeamDetailsTeam[];
  /* 상대 팀 접기 토글 문구 — 기존 i18n(enemyTeam)을 그대로 받습니다. */
  enemyToggleLabel?: ReactNode;
  onSearchRiotId: (riotId: string) => void;
};

export function MatchTeamDetails({ ariaLabel, kdaLabel, columns, teams, enemyToggleLabel, onSearchRiotId }: MatchTeamDetailsProps) {
  /* 모바일 상대 팀 접힘 CSS와 토글 버튼은 ≤48rem 안에만 있어 데스크톱은 이
     상태와 무관하게 항상 펼쳐집니다. 기본값은 펼침(사용자 요청 2026-08-30) —
     상대 팀 정보를 바로 확인할 수 있도록, 접고 싶을 때만 토글합니다. */
  const [enemyOpen, setEnemyOpen] = useState(true);

  if (teams.length === 0) return null;

  return (
    <div className="public-team-detail" aria-label={ariaLabel}>
      {teams.map((team) => (
        <MatchTeamDetailsTeamSection
          collapsed={team.enemy === true && !enemyOpen}
          columns={columns}
          kdaLabel={kdaLabel}
          key={team.key}
          onSearchRiotId={onSearchRiotId}
          onToggleCollapsed={team.enemy ? () => setEnemyOpen((current) => !current) : undefined}
          team={team}
          toggleLabel={enemyToggleLabel}
        />
      ))}
    </div>
  );
}
