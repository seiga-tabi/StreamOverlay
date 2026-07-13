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
};

export type PublicMatchFilterBarText = {
  filter: PublicMatchFilterBarLocalizedText;
  activeFilter: ReactNode;
  queueFilter: PublicMatchFilterBarLocalizedText;
  championFilter: PublicMatchFilterBarLocalizedText;
  periodFilter: PublicMatchFilterBarLocalizedText;
  resetFilter: PublicMatchFilterBarLocalizedText;
  allQueues: ReactNode;
  soloQueue: ReactNode;
  flexQueue: ReactNode;
  ranked5v5: ReactNode;
  normalQueue: ReactNode;
  aramQueue: ReactNode;
  allChampions: ReactNode;
  periodAll: ReactNode;
  period7: ReactNode;
  period30: ReactNode;
};

export type PublicMatchFilterBarProps = {
  filters: PublicMatchFilterBarFilters;
  filterActive: boolean;
  championOptions: PublicMatchFilterChampionOption[];
  text: PublicMatchFilterBarText;
  onQueueChange: (value: string) => void;
  onChampionChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onReset: () => void;
};

export function PublicMatchFilterBar({
  filters,
  filterActive,
  championOptions,
  text,
  onQueueChange,
  onChampionChange,
  onPeriodChange,
  onReset
}: PublicMatchFilterBarProps) {
  return (
    <div className={`public-match-filter-bar ${filterActive ? "active" : ""}`}>
      <div className="public-match-filter-title">
        <span aria-hidden="true">▽</span>
        <strong data-ko={text.filter.ko} data-ja={text.filter.ja}>
          {filterActive ? text.activeFilter : text.filter.label}
        </strong>
      </div>
      <label>
        <span data-ko={text.queueFilter.ko} data-ja={text.queueFilter.ja}>{text.queueFilter.label}</span>
        <select value={filters.queue} onChange={(event) => onQueueChange(event.target.value)}>
          <option value="all">{text.allQueues}</option>
          <option value="solo">{text.soloQueue}</option>
          <option value="flex">{text.flexQueue}</option>
          <option value="ranked5v5">{text.ranked5v5}</option>
          <option value="normal">{text.normalQueue}</option>
          <option value="aram">{text.aramQueue}</option>
        </select>
      </label>
      <ChampionFilterSelect
        allLabel={text.allChampions}
        label={text.championFilter.label}
        labelJa={text.championFilter.ja}
        labelKo={text.championFilter.ko}
        onChange={onChampionChange}
        options={championOptions}
        value={filters.championId}
      />
      <label>
        <span data-ko={text.periodFilter.ko} data-ja={text.periodFilter.ja}>{text.periodFilter.label}</span>
        <select value={filters.period} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="all">{text.periodAll}</option>
          <option value="7d">{text.period7}</option>
          <option value="30d">{text.period30}</option>
        </select>
      </label>
      <button type="button" onClick={onReset} disabled={!filterActive} data-ko={text.resetFilter.ko} data-ja={text.resetFilter.ja}>
        {text.resetFilter.label}
      </button>
    </div>
  );
}
