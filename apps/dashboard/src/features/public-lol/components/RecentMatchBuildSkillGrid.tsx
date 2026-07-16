export type RecentMatchBuildSkillGridLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type RecentMatchBuildSkillIconViewModel = {
  key: string;
  title: string;
  iconUrl?: string;
  fallbackLabel: string;
  skillKey: string;
};

export type RecentMatchBuildSkillCellViewModel = {
  key: string;
  className: string;
  title: string;
  label: string;
};

export type RecentMatchBuildSkillRowViewModel = {
  key: string;
  cells: RecentMatchBuildSkillCellViewModel[];
};

export type RecentMatchBuildSkillGridProps = {
  label: RecentMatchBuildSkillGridLocalizedText;
  skillIcons: RecentMatchBuildSkillIconViewModel[];
  skillRows: RecentMatchBuildSkillRowViewModel[];
  skillOrderLabel: string;
};

export function RecentMatchBuildSkillGrid({
  label,
  skillIcons,
  skillRows,
  skillOrderLabel
}: RecentMatchBuildSkillGridProps) {
  return (
    <div className="public-match-build-group skills">
      <span  >{label.label}</span>
      <div className="public-match-skill-build">
        <div className="public-match-skill-icons">
          {skillIcons.map((skill) => (
            <span key={skill.key} title={skill.title}>
              {skill.iconUrl ? <img src={skill.iconUrl} alt="" /> : skill.fallbackLabel}
              <b>{skill.skillKey}</b>
            </span>
          ))}
        </div>
        <div className="public-match-skill-grid" aria-label={skillOrderLabel}>
          {skillRows.map((row) => (
            <SkillGridRow row={row} key={row.key} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillGridRow({ row }: { row: RecentMatchBuildSkillRowViewModel }) {
  return (
    <>
      <strong>{row.key}</strong>
      {row.cells.map((cell) => (
        <span className={cell.className} key={cell.key} title={cell.title}>
          {cell.label}
        </span>
      ))}
    </>
  );
}
