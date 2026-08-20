import type { ReactNode } from "react";
import { ChampionFilterSelect } from "./ChampionFilterSelect";

export type PublicMatchFilterBarLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type PublicMatchFilterBarFilters = {
  queue: string;
  championId: string;
  period: string;
};

export type PublicMatchFilterChampionOption = {
  value: string;
  label: ReactNode;
  iconUrl?: string;
  fallbackLabel?: string;
  /* 목업 §2-4 — championPerformance 에서 이어 붙인 경기수·승률(없으면 미표기). */
  games?: number;
  winRate?: number;
};

export type PublicMatchFilterBarText = {
  filter: PublicMatchFilterBarLocalizedText;
  activeFilter: ReactNode;
  queueFilter: PublicMatchFilterBarLocalizedText;
  championFilter: PublicMatchFilterBarLocalizedText;
  periodFilter: PublicMatchFilterBarLocalizedText;
  resetFilter: PublicMatchFilterBarLocalizedText;
  queueGroupLabel: string;
  allQueues: ReactNode;
  soloQueue: ReactNode;
  flexQueue: ReactNode;
  ranked5v5: ReactNode;
  normalQueue: ReactNode;
  arenaQueue: ReactNode;
  aramQueue: ReactNode;
  allChampions: ReactNode;
  periodAll: ReactNode;
  period7: ReactNode;
  period30: ReactNode;
  /** "게임" — 챔피언 목록 메타 줄 접미(기존 t().games). */
  gamesSuffix?: string;
  /** 빈 챔피언 목록 안내 2줄(목업 §2-5). */
  championsEmptyTitle?: string;
  championsEmptyHint?: string;
};

export type PublicMatchFilterBarProps = {
  filters: PublicMatchFilterBarFilters;
  filterActive: boolean;
  championOptions: PublicMatchFilterChampionOption[];
  /** "모든 챔피언" 행에 붙는 전체 경기수(승률은 붙이지 않음 — 요약 줄 소관). */
  championAllGames?: number;
  text: PublicMatchFilterBarText;
  /** 필터 적용 결과 한 줄 요약. aria-live 로 읽힙니다. */
  resultSummary?: ReactNode;
  resultSummaryLabel?: string;
  onQueueChange: (value: string) => void;
  onChampionChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onReset: () => void;
};

export function PublicMatchFilterBar({
  filters,
  filterActive,
  championAllGames,
  championOptions,
  text,
  resultSummary,
  resultSummaryLabel,
  onQueueChange,
  onChampionChange,
  onPeriodChange,
  onReset
}: PublicMatchFilterBarProps) {
  // 자주 쓰는 큐는 select 를 열지 않고 한 번에 전환할 수 있도록 칩으로 노출합니다.
  /* 칩 순서는 목업 v23 — 전체·일반·솔로·자유·5:5·아레나·칼바람. */
  const queueChips: Array<{ value: string; label: ReactNode }> = [
    { value: "all", label: text.allQueues },
    { value: "normal", label: text.normalQueue },
    { value: "solo", label: text.soloQueue },
    { value: "flex", label: text.flexQueue },
    { value: "ranked5v5", label: text.ranked5v5 },
    { value: "arena", label: text.arenaQueue },
    { value: "aram", label: text.aramQueue }
  ];

  return (
    <div className={`public-match-filter-panel ${filterActive ? "active" : ""}`}>
      <div className="public-match-filter-controls">
        <div className="public-match-queue-chips" role="group" aria-label={text.queueGroupLabel}>
          {queueChips.map((chip) => (
            <button
              aria-pressed={filters.queue === chip.value}
              key={chip.value}
              onClick={() => onQueueChange(chip.value)}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <ChampionFilterSelect
          allGames={championAllGames}
          allLabel={text.allChampions}
          emptyHint={text.championsEmptyHint}
          emptyTitle={text.championsEmptyTitle}
          gamesSuffix={text.gamesSuffix}
          label={text.championFilter.label}
          labelJa={text.championFilter.ja}
          labelKo={text.championFilter.ko}
          onChange={onChampionChange}
          options={championOptions}
          value={filters.championId}
        />
        <label className="public-match-filter-select">
          <span>{text.periodFilter.label}</span>
          <select value={filters.period} onChange={(event) => onPeriodChange(event.target.value)}>
            <option value="all">{text.periodAll}</option>
            <option value="7d">{text.period7}</option>
            <option value="30d">{text.period30}</option>
          </select>
        </label>
        <button className="public-match-filter-reset" type="button" onClick={onReset} disabled={!filterActive}>
          {text.resetFilter.label}
        </button>
      </div>
      {resultSummary ? (
        <p aria-label={resultSummaryLabel} aria-live="polite" className="public-match-filter-summary">
          {resultSummary}
        </p>
      ) : null}
    </div>
  );
}
