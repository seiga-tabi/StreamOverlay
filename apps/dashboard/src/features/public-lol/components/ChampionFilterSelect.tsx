import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ChampionFilterOption = {
  value: string;
  label: ReactNode;
  iconUrl?: string;
  fallbackLabel?: string;
  /* 목업 §2-4 — championPerformance 에서 이어 붙인 값. 없는 챔피언은 메타 줄을
     비웁니다(0 이나 "-" 로 채우지 않음). */
  games?: number;
  winRate?: number;
};

export type ChampionFilterSelectProps = {
  value: string;
  label: ReactNode;
  labelKo: string;
  labelJa: string;
  allLabel: ReactNode;
  options: ChampionFilterOption[];
  /** "게임" — 메타 줄의 경기수 접미(기존 t().games). */
  gamesSuffix?: string;
  /** "모든 챔피언" 행의 전체 경기수. 승률은 붙이지 않습니다(요약 줄이 이미 말함). */
  allGames?: number;
  /** 빈 목록(필터에 걸린 경기가 없어 챔피언이 없음) 안내 — 목업 §2-5. */
  emptyTitle?: string;
  emptyHint?: string;
  onChange: (value: string) => void;
};

export function ChampionFilterSelect({
  value,
  label,
  labelKo,
  labelJa,
  allLabel,
  options,
  gamesSuffix,
  allGames,
  emptyTitle,
  emptyHint,
  onChange
}: ChampionFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const selectedValueId = useId();
  const listboxId = useId();
  const allOption: ChampionFilterOption = {
    value: "all",
    label: allLabel,
    fallbackLabel: "∞",
    ...(allGames !== undefined ? { games: allGames } : {}),
  };
  const allOptions = [allOption, ...options];
  const selectedOption = allOptions.find((option) => option.value === value) ?? allOption;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const selected = listRef.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]');
      selected?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveOptionFocus(event: KeyboardEvent<HTMLButtonElement>, direction: 1 | -1) {
    const optionElements = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const currentIndex = optionElements.indexOf(event.currentTarget);
    if (currentIndex < 0 || optionElements.length === 0) return;
    event.preventDefault();
    optionElements[(currentIndex + direction + optionElements.length) % optionElements.length]?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") return moveOptionFocus(event, 1);
    if (event.key === "ArrowUp") return moveOptionFocus(event, -1);
    if (event.key === "Home") {
      event.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const optionElements = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      optionElements?.item(optionElements.length - 1).focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      className="public-match-filter-field public-champion-filter-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      ref={rootRef}
    >
      <span id={labelId}  >{label}</span>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${selectedValueId}`}
        className="public-champion-filter-trigger"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <ChampionFilterMedia option={selectedOption} />
        <strong id={selectedValueId}>{selectedOption.label}</strong>
        <span className="public-champion-filter-chevron" aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div
          aria-labelledby={labelId}
          className="public-champion-filter-options"
          id={listboxId}
          ref={listRef}
          role="listbox"
        >
          {options.length === 0 ? (
            /* 빈 목록(목업 §2-5) — 필터에 걸린 경기가 없어 챔피언이 하나도 없습니다.
               "모든 챔피언" 한 줄만 남기면 고장처럼 보여, 이유를 문장으로 말합니다. */
            <div className="public-champion-filter-empty" role="presentation">
              <svg aria-hidden="true" fill="none" height="20" stroke="var(--public-gray-border-strong, #4a5563)" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
                <circle cx="9" cy="9" r="6" />
                <path d="M13.5 13.5 L 18 18" />
              </svg>
              <span>{emptyTitle}</span>
              <small>{emptyHint}</small>
            </div>
          ) : allOptions.map((option) => (
            <button
              aria-selected={option.value === selectedOption.value}
              className="public-champion-filter-option"
              key={option.value}
              onClick={() => selectOption(option.value)}
              onKeyDown={handleOptionKeyDown}
              role="option"
              tabIndex={option.value === selectedOption.value ? 0 : -1}
              type="button"
            >
              <ChampionFilterMedia option={option} />
              <strong>{option.label}</strong>
              {/* 경기수 · 승률(목업 §2-4) — 값이 있는 챔피언만. 승률만 전용색. */}
              {option.games !== undefined ? (
                <span className="public-champion-filter-meta">
                  {option.games}{gamesSuffix}
                  {option.winRate !== undefined ? (
                    <>
                      {" · "}
                      <em className={option.winRate >= 50 ? "is-win" : "is-loss"}>
                        {Math.round(option.winRate)}%
                      </em>
                    </>
                  ) : null}
                </span>
              ) : null}
              <span className="public-champion-filter-check" aria-hidden="true">
                {option.value === selectedOption.value ? (
                  <svg fill="none" height="8" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 12 9" width="11">
                    <path d="M1 4.6 L 4.4 8 L 11 1" />
                  </svg>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChampionFilterMedia({ option }: { option: ChampionFilterOption }) {
  return (
    <span className={`public-champion-filter-media ${option.iconUrl ? "" : "fallback"}`} aria-hidden="true">
      {option.iconUrl ? <img src={option.iconUrl} alt="" loading="lazy" /> : option.fallbackLabel ?? "•"}
    </span>
  );
}
