import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ChampionFilterOption = {
  value: string;
  label: ReactNode;
  iconUrl?: string;
  fallbackLabel?: string;
};

export type ChampionFilterSelectProps = {
  value: string;
  label: ReactNode;
  labelKo: string;
  labelJa: string;
  allLabel: ReactNode;
  options: ChampionFilterOption[];
  onChange: (value: string) => void;
};

export function ChampionFilterSelect({
  value,
  label,
  labelKo,
  labelJa,
  allLabel,
  options,
  onChange
}: ChampionFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const selectedValueId = useId();
  const listboxId = useId();
  const allOption: ChampionFilterOption = { value: "all", label: allLabel, fallbackLabel: "∞" };
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
      <span id={labelId} data-ko={labelKo} data-ja={labelJa}>{label}</span>
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
          {allOptions.map((option) => (
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
              <span className="public-champion-filter-check" aria-hidden="true">
                {option.value === selectedOption.value ? "✓" : ""}
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
