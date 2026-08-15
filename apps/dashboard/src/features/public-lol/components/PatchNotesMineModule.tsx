import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LOL_PLATFORM_IDS } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { t } from "../i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";
import { riotIdOf, targetKey, type PatchNoteTarget } from "./PatchNotesControlBar";

/* "패치별 내 승률"의 전용 모듈 — docs/mockups/lol-patch-notes-search-redesign.html §②.
 *
 * 이전에는 소환사 선택·안내문·이동 CTA 가 패치 검색창과 같은 바에 섞여 있어
 * 검색창이 Riot ID 검색처럼 읽혔습니다. 개인 전적 기능을 카드 하나로 분리하고,
 * 용어는 조회형(보기/표시 중/해제)을 씁니다 — 계정 연동(OAuth)이 아니기 때문입니다. */

const RIOT_ID_PATTERN = /^(.{1,40})#(.{1,10})$/u;

export function PatchNotesMineModule({
  mineError,
  mineState,
  onDismiss,
  onManualTarget,
  onRetryMine,
  onTargetIndex,
  sampledMatches,
  target,
  targetIndex,
  targets
}: {
  mineError: string;
  mineState: "idle" | "loading" | "ready" | "error";
  onDismiss: () => void;
  onManualTarget: (target: PatchNoteTarget) => void;
  onRetryMine: () => void;
  onTargetIndex: (index: number) => void;
  sampledMatches?: number;
  target: PatchNoteTarget | undefined;
  targetIndex: number | null;
  targets: PatchNoteTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [platform, setPlatform] = useState<string>(targets[0]?.lolPlatform ?? "jp1");
  const [draftError, setDraftError] = useState("");
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  function submitDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const match = RIOT_ID_PATTERN.exec(draft.trim());
    if (!match?.[1] || !match[2]) {
      setDraftError(t().patchNotesMineInvalidId);
      return;
    }
    setDraftError("");
    onManualTarget({ gameName: match[1].trim(), tagLine: match[2].trim(), lolPlatform: platform });
    setDraft("");
  }

  /* ── 표시 중(활성) 상태 ─────────────────────────────────────────── */
  if (target) {
    return (
      <div className="yoro-pn-mine-module is-active" data-testid="patch-notes-mine-module">
        <span aria-hidden="true" className="yoro-pn-mine-icon">📊</span>
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

        {mineState === "ready" ? (
          <span className="yoro-pn-mine-badge" data-tone="good">{t().patchNotesMineActive}</span>
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

        <span className="yoro-pn-mine-actions">
          <a
            className="yoro-pn-mine-profile"
            href={localizedPublicUrlForCurrentLocale(
              `/lol/summoners/${target.lolPlatform}/${encodeURIComponent(`${target.gameName}-${target.tagLine}`)}`
            )}
          >
            {`${t().patchNotesMineProfile} ↗`}
          </a>
          <button className="yoro-pn-mine-dismiss" onClick={onDismiss} type="button">
            {t().patchNotesMineDismiss}
          </button>
        </span>
      </div>
    );
  }

  /* ── 초대(미표시) 상태 ─────────────────────────────────────────── */
  return (
    <div className="yoro-pn-mine-module" data-testid="patch-notes-mine-module">
      <span aria-hidden="true" className="yoro-pn-mine-icon">📊</span>
      <div className="yoro-pn-mine-copy">
        <b>{t().patchNotesMineEmptyTitle}</b>
        <small>{t().patchNotesMineModuleDescription}</small>
      </div>
      <form className="yoro-pn-mine-form" onSubmit={submitDraft}>
        <select
          aria-label={t().patchNotesMinePlatform}
          onChange={(event) => setPlatform(event.currentTarget.value)}
          value={platform}
        >
          {LOL_PLATFORM_IDS.map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}
        </select>
        <input
          aria-label="Riot ID"
          maxLength={52}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            if (draftError) setDraftError("");
          }}
          placeholder={t().patchNotesMinePlaceholder}
          value={draft}
        />
        <Button size="sm" type="submit">{t().patchNotesMineView}</Button>
      </form>
      {draftError ? <p className="yoro-pn-mine-error" role="alert">{draftError}</p> : null}
      {targets.length > 0 ? (
        <p className="yoro-pn-mine-recent">
          {t().patchNotesMineRecent}
          {targets.slice(0, 3).map((item, index) => (
            <button key={targetKey(item)} onClick={() => onTargetIndex(index)} type="button">
              {riotIdOf(item)}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}
