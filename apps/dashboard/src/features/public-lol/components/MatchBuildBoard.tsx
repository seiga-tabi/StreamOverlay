import type { ReactNode } from "react";

/* 전적 상세 — 빌드.
 *
 * 기존 .public-match-build-picker / .public-match-skill-grid 는 legacy 에서
 * !important 로 잠겨 있고(각 26건), 390px 에서 가로 스크롤이 생깁니다
 * (실측: 선택기 492/302, 스킬 454/300). 새 이름으로 다시 짭니다.
 */

export type BuildParticipantChip = {
  key: string;
  label: string;
  championIcon?: ReactNode;
  score?: number;
  isAlly: boolean;
  isSelected: boolean;
};

export type BuildItemStep = {
  key: string;
  icon?: ReactNode;
  /** "12:34". 값이 없으면 시각 칸을 비웁니다. */
  timeLabel?: string;
};

export type BuildSkillRow = {
  key: "Q" | "W" | "E" | "R";
  /** 이 스킬을 찍은 레벨 목록입니다. */
  levels: number[];
};

export type MatchBuildBoardText = {
  ariaLabel: string;
  allyLabel: string;
  enemyLabel: string;
  itemsLabel: string;
  skillsLabel: string;
  runesLabel: string;
  noTimeLabel: string;
};

export type MatchBuildBoardProps = {
  headline: { name: string; championName: string; championIcon?: ReactNode; detail: string; spells?: ReactNode };
  participants: BuildParticipantChip[];
  runes?: ReactNode;
  items: BuildItemStep[];
  skills: BuildSkillRow[];
  maxLevel?: number;
  text: MatchBuildBoardText;
  onSelectParticipant: (key: string) => void;
};

export function MatchBuildBoard({
  headline,
  participants,
  runes,
  items,
  skills,
  maxLevel = 18,
  text,
  onSelectParticipant,
}: MatchBuildBoardProps) {
  const allies = participants.filter((participant) => participant.isAlly);
  const enemies = participants.filter((participant) => !participant.isAlly);

  const chip = (participant: BuildParticipantChip) => (
    <button
      aria-pressed={participant.isSelected}
      className={`public-md-build-chip ${participant.isSelected ? "is-selected" : ""}`}
      key={participant.key}
      onClick={() => onSelectParticipant(participant.key)}
      title={participant.label}
      type="button"
    >
      <span className="public-md-build-chip-portrait">{participant.championIcon}</span>
      {participant.score === undefined ? null : <s>{participant.score}</s>}
    </button>
  );

  return (
    <section aria-label={text.ariaLabel} className="public-md-build">
      {/* 누구 빌드인지 먼저 알립니다. 기존 화면은 챔피언 이름이 맨 아래에 있었습니다. */}
      <div className="public-md-build-headline">
        <span className="public-md-build-portrait">{headline.championIcon}</span>
        {/* 긴 Riot ID(일본어 등)가 앞에 오면 챔피언 이름이 말줄임에 먹힙니다.
            빌드에서 더 중요한 챔피언을 첫 줄에 두고 이름은 둘째 줄로 내립니다. */}
        <span className="public-md-build-who">
          <b>{headline.championName}</b>
          <small>{headline.name} · {headline.detail}</small>
        </span>
        {headline.spells ? <span className="public-md-build-spells">{headline.spells}</span> : null}
      </div>

      {/* 10명을 5열 격자 두 줄로 둡니다. 가로 스크롤이 없어집니다. */}
      <div className="public-md-build-picker">
        {allies.length > 0 ? <span className="public-md-build-side">{text.allyLabel}</span> : null}
        {allies.map(chip)}
        {enemies.length > 0 ? <span className="public-md-build-side">{text.enemyLabel}</span> : null}
        {enemies.map(chip)}
      </div>

      {/* 룬 보드가 자체 제목을 가지고 있어 여기서 제목을 겹쳐 넣지 않습니다. */}
      {runes ? <div className="public-md-build-runes">{runes}</div> : null}

      <h4 className="public-md-build-heading">{text.itemsLabel}</h4>
      <ol className="public-md-build-items">
        {items.map((item) => (
          <li key={item.key}>
            <span className="public-md-build-item">{item.icon}</span>
            <span className="public-md-build-time">{item.timeLabel ?? text.noTimeLabel}</span>
          </li>
        ))}
      </ol>

      <h4 className="public-md-build-heading">{text.skillsLabel}</h4>
      <div className="public-md-build-skills">
        {skills.map((row) => {
          const taken = new Set(row.levels);
          return (
            <div className="public-md-build-skill-row" key={row.key}>
              <b>{row.key}</b>
              {/* 레벨 숫자를 칸 안에 넣어 가로 스크롤 없이 18레벨을 담습니다. */}
              <span className="public-md-build-skill-cells">
                {Array.from({ length: maxLevel }, (_, index) => index + 1).map((level) => (
                  <i className={taken.has(level) ? "is-taken" : ""} key={level}>
                    {taken.has(level) ? level : ""}
                  </i>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
