import { t } from "../i18n/public-lol-i18n";

/** 서버에 넘길 수 있을 만큼 값이 다 있는 소환사만 다룹니다. */
export type PatchNoteTarget = {
  gameName: string;
  tagLine: string;
  lolPlatform: string;
  /** 최근 검색에 이미 저장돼 있는 값입니다. 얼굴이 있으면 누구인지 즉시 읽힙니다. */
  profileIconUrl?: string;
};

/** `all` 은 거르지 않고, `played` 는 내 기록이 있는 패치만, 나머지는 시즌 번호입니다. */
export type PatchNotesFilter = "all" | "played" | `season:${string}`;

export type PatchNotesFilterOption = {
  value: PatchNotesFilter;
  label: string;
  count: number;
};

export function riotIdOf(target: PatchNoteTarget): string {
  return `${target.gameName}#${target.tagLine}`;
}

export function targetKey(target: PatchNoteTarget): string {
  return `${riotIdOf(target)}|${target.lolPlatform}`.toLowerCase();
}

/**
 * 패치 목록 소속 필터 바 — 검색과 시즌·플레이 칩만 둡니다.
 *
 * 소환사 선택·개인 전적 상태는 PatchNotesMineModule 로 분리했습니다(2026-08-16).
 * 한 존에 패치 필터와 개인 전적 기능이 섞여 검색창이 Riot ID 검색처럼 읽히던
 * 문제의 수정점 — docs/mockups/lol-patch-notes-search-redesign.html §①.
 */
export function PatchNotesControlBar({
  query,
  onQuery,
  resultCount,
  filter,
  filterOptions,
  onFilter
}: {
  query: string;
  onQuery: (value: string) => void;
  resultCount: number;
  filter: PatchNotesFilter;
  filterOptions: PatchNotesFilterOption[];
  onFilter: (value: PatchNotesFilter) => void;
}) {
  return (
    <div className="yoro-pn-bar">
      {/* 결과 수를 입력창 안에 두어야 "무엇의 개수"인지 붙어 읽힙니다. */}
      <div className="yoro-pn-bar-search">
        <svg
          aria-hidden="true"
          className="yoro-pn-bar-icon"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          aria-label={t().patchNotesSearchLabel}
          maxLength={80}
          onChange={(event) => onQuery(event.currentTarget.value)}
          placeholder={t().patchNotesSearchPlaceholder}
          type="search"
          value={query}
        />
        <span className="yoro-pn-bar-count">{`${resultCount}${t().patchNotesCount}`}</span>
      </div>

      {filterOptions.length > 1 ? (
        <div aria-label={t().patchNotesFilterLabel} className="yoro-pn-bar-chips" role="group">
          {filterOptions.map((option) => (
            <button
              aria-pressed={filter === option.value}
              className="yoro-pn-chip"
              key={option.value}
              onClick={() => onFilter(option.value)}
              type="button"
            >
              {option.value === "played" ? <i aria-hidden="true" /> : null}
              {option.label}
              <b>{option.count}</b>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
