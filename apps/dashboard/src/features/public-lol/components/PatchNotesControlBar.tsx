import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { t } from "../i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";

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
 * 검색·빠른 필터·소환사를 한 줄에 둡니다.
 *
 * 이전에는 전폭 흰 바 두 개가 따로 있었고, 1440px 에서 Riot ID 와 표본 수 사이가
 * 987px 떨어져 있었습니다. 같이 읽어야 뜻이 되는 값이라 한 덩어리로 묶습니다.
 *
 * 근거: docs/mockups/patch-notes-redesign.html §8~10
 */
export function PatchNotesControlBar({
  query,
  onQuery,
  resultCount,
  filter,
  filterOptions,
  onFilter,
  targets,
  targetIndex,
  onTargetIndex,
  sampledMatches,
  mineState,
  mineError,
  onRetryMine
}: {
  query: string;
  onQuery: (value: string) => void;
  resultCount: number;
  filter: PatchNotesFilter;
  filterOptions: PatchNotesFilterOption[];
  onFilter: (value: PatchNotesFilter) => void;
  targets: PatchNoteTarget[];
  targetIndex: number;
  onTargetIndex: (index: number) => void;
  sampledMatches?: number;
  mineState: "idle" | "loading" | "ready" | "error";
  mineError: string;
  onRetryMine: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const target = targets[targetIndex];

  const restoreTriggerFocus = useCallback((): void => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function focusOption(index: number): void {
    if (targets.length === 0) return;
    optionRefs.current[(index + targets.length) % targets.length]?.focus();
  }

  function selectTarget(index: number): void {
    onTargetIndex(index);
    setOpen(false);
    restoreTriggerFocus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(targets.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      restoreTriggerFocus();
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      restoreTriggerFocus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, restoreTriggerFocus]);

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

      {/* 링크만 모으면 이 화면이 있을 이유가 없습니다. 누구의 전적인지를 옆에 둡니다. */}
      {target ? (
        <div className="yoro-pn-who-wrap" ref={wrapRef}>
          <button
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={t().patchNotesSummonerMenu}
            className="yoro-pn-who"
            onClick={() => setOpen((current) => !current)}
            ref={triggerRef}
            type="button"
          >
            {target.profileIconUrl ? (
              <img alt="" aria-hidden="true" decoding="async" height={30} loading="lazy" src={target.profileIconUrl} width={30} />
            ) : null}
            <span>
              <b>{riotIdOf(target)}</b>
              <small>
                {target.lolPlatform.toUpperCase()}
                {mineState === "ready" && sampledMatches !== undefined && sampledMatches > 0
                  ? ` · ${t().patchNotesSampleShort.replace("{count}", String(sampledMatches))}`
                  : ""}
              </small>
            </span>
            <span aria-hidden="true" className="yoro-pn-who-caret">⌄</span>
          </button>
          {open ? (
            <div aria-label={t().patchNotesSummonerMenu} className="yoro-pn-who-menu" id={menuId} role="menu">
              {targets.map((item, index) => (
                <button
                  aria-checked={index === targetIndex}
                  key={targetKey(item)}
                  onClick={() => selectTarget(index)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  role="menuitemradio"
                  type="button"
                >
                  {item.profileIconUrl ? (
                    <img alt="" aria-hidden="true" decoding="async" height={26} loading="lazy" src={item.profileIconUrl} width={26} />
                  ) : null}
                  <span>
                    <b>{riotIdOf(item)}</b>
                    <small>{item.lolPlatform.toUpperCase()}</small>
                  </span>
                </button>
              ))}
              <a className="yoro-pn-who-more" href={localizedPublicUrlForCurrentLocale("/")} role="menuitem">
                {`${t().patchNotesSummonerChange} →`}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {targets.length === 0 ? (
        <a className="yoro-pn-bar-cta" href={localizedPublicUrlForCurrentLocale("/")}>
          {`${t().patchNotesMineEmptyAction} →`}
        </a>
      ) : null}

      {mineState === "loading" ? (
        <span className="yoro-pn-bar-state" role="status">{t().patchNotesMineLoading}</span>
      ) : null}

      {mineState === "error" ? (
        <span className="yoro-pn-bar-state" data-tone="bad" role="alert">
          {mineError}
          <Button onClick={onRetryMine} size="sm" type="button" variant="secondary">
            {t().patchNotesMineRetry}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
