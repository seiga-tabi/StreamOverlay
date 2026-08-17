import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import {
  MINI_GAMES,
  miniGameName,
  readMiniGameBest,
  reactionMsToNextTier,
  reactionTierForAverage,
  reactionTierLabel,
  REACTION_TIER_TABLE,
  writeMiniGameBest,
} from "../registry";

/* 반응속도 테스트 — 목업 docs/mockups/reaction-test.html v2~v3.
 *
 * 측정 정확도 규칙(목업 §측정 정확도):
 * - performance.now() + pointerdown 시점(click 은 up 까지 늦음)
 * - 신호 표시는 rAF 콜백에서 타임스탬프를 찍어 페인트 시점과 정렬
 * - 대기/신호 전환에 트랜지션 금지(전환 애니메이션이 있으면 신호 인지가 늦어짐 — CSS 쪽 규칙)
 * - 120ms 미만은 신호 예측으로 간주해 라운드 무효
 * - 백그라운드 탭 전환 시 진행 라운드 무효(visibilitychange)
 */

const ROUNDS = 5;
const WAIT_MIN_MS = 1_500;
const WAIT_MAX_MS = 4_000;
const MIN_HUMAN_MS = 120;

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "result";

const REACTION_GAME = MINI_GAMES.find((game) => game.id === "reaction")!;

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export function ReactionTest({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const [samples, setSamples] = useState<number[]>([]);
  const [best, setBest] = useState(() => readMiniGameBest(REACTION_GAME.id));
  const [bestUpdated, setBestUpdated] = useState(false);
  const [copied, setCopied] = useState(false);
  const waitTimerRef = useRef<number | undefined>(undefined);
  const goAtRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current !== undefined) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = undefined;
    }
  }, []);

  const scheduleGo = useCallback(() => {
    clearWaitTimer();
    setPhase("waiting");
    const delay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    waitTimerRef.current = window.setTimeout(() => {
      waitTimerRef.current = undefined;
      /* 페인트 시점과 측정 기준을 정렬 — rAF 콜백에서 신호 상태와 타임스탬프를 함께 찍습니다. */
      window.requestAnimationFrame(() => {
        if (phaseRef.current !== "waiting") return;
        goAtRef.current = performance.now();
        setPhase("go");
      });
    }, delay);
  }, [clearWaitTimer]);

  useEffect(() => () => clearWaitTimer(), [clearWaitTimer]);

  /* 백그라운드 탭에서는 타이머·인지 시점이 왜곡되므로 진행 중 라운드를 무효화합니다. */
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      if (phaseRef.current === "waiting" || phaseRef.current === "go") {
        clearWaitTimer();
        setPhase("tooSoon");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [clearWaitTimer]);

  const finishRun = useCallback((finalSamples: number[]) => {
    const average = Math.round(finalSamples.reduce((sum, value) => sum + value, 0) / finalSamples.length);
    const tier = reactionTierForAverage(average);
    const improved = writeMiniGameBest(REACTION_GAME, { score: average, tierKey: tier.key, at: new Date().toISOString() });
    if (improved) setBest(readMiniGameBest(REACTION_GAME.id));
    setBestUpdated(improved);
    setPhase("result");
  }, []);

  const handleStageInput = useCallback(() => {
    const current = phaseRef.current;
    if (current === "idle") {
      setSamples([]);
      setBestUpdated(false);
      setCopied(false);
      scheduleGo();
      return;
    }
    if (current === "waiting") {
      clearWaitTimer();
      setPhase("tooSoon");
      return;
    }
    if (current === "tooSoon") {
      scheduleGo();
      return;
    }
    if (current === "go") {
      const elapsed = performance.now() - goAtRef.current;
      if (elapsed < MIN_HUMAN_MS) {
        /* 신호 예측(인간 한계 미만) — 라운드 무효. */
        setPhase("tooSoon");
        return;
      }
      const nextSamples = [...samples, Math.round(elapsed)];
      setSamples(nextSamples);
      if (nextSamples.length >= ROUNDS) finishRun(nextSamples);
      else scheduleGo();
    }
  }, [clearWaitTimer, finishRun, samples, scheduleGo]);

  const average = samples.length > 0 ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : 0;
  const resultTier = phase === "result" ? reactionTierForAverage(average) : undefined;
  const nextTier = phase === "result" ? reactionMsToNextTier(average) : undefined;
  const bestSample = samples.length > 0 ? Math.min(...samples) : undefined;
  const worstSample = samples.length > 0 ? Math.max(...samples) : undefined;
  const bestTier = best?.tierKey ? REACTION_TIER_TABLE.find((tier) => tier.key === best.tierKey) : undefined;

  const stepLabel = phase === "idle"
    ? text.stageReady
    : phase === "result"
      ? text.stageDone
      : formatTemplate(text.stageStep, { n: String(Math.min(samples.length + 1, ROUNDS)) });

  const copyResult = useCallback(async () => {
    if (!resultTier) return;
    const payload = formatTemplate(text.copyText, { ms: String(average), tier: `${resultTier.emoji} ${reactionTierLabel(resultTier, locale)}` });
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
    } catch {
      /* 클립보드 API 불가(권한 등) — 복사 대신 문구를 그대로 노출합니다. */
      window.prompt(text.copyResult, payload);
    }
  }, [average, locale, resultTier, text]);

  const statusText = phase === "waiting"
    ? text.waitTitle
    : phase === "go"
      ? text.goTitle
      : phase === "tooSoon"
        ? text.tooSoonTitle
        : phase === "result" && resultTier
          ? `${average}ms · ${reactionTierLabel(resultTier, locale)}`
          : "";

  /* 최고 기록 하이라이트 위치: 결과 화면은 이번 결과, 그 외에는 내 최고 기록. */
  const highlightTierKey = phase === "result" ? resultTier?.key : bestTier?.key;
  const tierRows = useMemo(() => REACTION_TIER_TABLE.map((tier) => {
    const from = REACTION_TIER_TABLE[REACTION_TIER_TABLE.indexOf(tier) - 1];
    const range = Number.isFinite(tier.maxMs)
      ? from ? `${from.maxMs + 1} ~ ${tier.maxMs}ms` : `~ ${tier.maxMs}ms`
      : `${(from?.maxMs ?? 0) + 1}ms ~`;
    return { tier, range };
  }), []);

  return (
    <div className="games-reaction">
      <div className="games-crumb" aria-hidden="true">{text.brand} › <b>{miniGameName(REACTION_GAME, locale)}</b></div>
      <div className="games-hero">
        <div>
          <h1>{miniGameName(REACTION_GAME, locale)}</h1>
          <p>{text.hubSubtitle}</p>
        </div>
        {best && phase !== "result" ? (
          <span className="games-best-chip">
            {text.myBestRecord} <b>{Math.round(best.score)}ms{bestTier ? ` · ${bestTier.emoji} ${reactionTierLabel(bestTier, locale)}` : ""}</b>
          </span>
        ) : null}
      </div>

      <div className="games-reaction-cols">
        <section className="games-stage">
          <div className="games-stage-head">
            <h2>{text.stageTitle}</h2>
            <span className="games-stage-step">{stepLabel}</span>
          </div>
          <span aria-live="polite" className="games-visually-hidden">{statusText}</span>

          {phase === "result" && resultTier ? (
            <div className="games-arena is-result">
              <div>
                <div className="games-arena-ms">{average}<small>ms</small></div>
                <div className="games-arena-sub">{text.averageLabel}</div>
                <span className="games-tier-chip">{resultTier.emoji} {reactionTierLabel(resultTier, locale)}</span>
                <div className="games-tries">
                  {samples.map((sample, index) => (
                    <span
                      className={sample === bestSample ? "is-best" : sample === worstSample ? "is-worst" : ""}
                      key={`${index}-${sample}`}
                    >
                      {sample}
                      <i>{formatTemplate(text.roundLabel, { n: String(index + 1) })}</i>
                    </span>
                  ))}
                </div>
                <p className="games-result-line">
                  {text.bestOfRun} <b>{bestSample}ms</b>
                  {nextTier && nextTier.deltaMs > 0 ? (
                    <> · {formatTemplate(text.nextTier, { tier: reactionTierLabel(nextTier.tier, locale) })} <b>-{nextTier.deltaMs}ms</b></>
                  ) : null}
                  {best ? (
                    <> · {text.myBestRecord} <b>{Math.round(best.score)}ms</b>{bestUpdated ? <span className="is-updated"> — {text.bestUpdated}</span> : null}</>
                  ) : null}
                </p>
                <div className="games-result-actions">
                  <button className="games-btn" onClick={() => { setPhase("idle"); setSamples([]); }} type="button">{text.retry}</button>
                  <button className="games-btn is-ghost" onClick={() => void copyResult()} type="button">
                    {copied ? text.copied : text.copyResult}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className={`games-arena is-${phase}`}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  handleStageInput();
                }
              }}
              onPointerDown={handleStageInput}
              type="button"
            >
              {phase === "idle" ? (
                <span>
                  <span aria-hidden="true" className="games-pulse">⚡</span>
                  <span className="games-arena-title">{text.idleTitle}</span>
                  <span className="games-arena-sub games-multiline">{text.idleSubtitle}</span>
                  <span className="games-btn games-btn-visual">{text.startButton}</span>
                </span>
              ) : null}
              {phase === "waiting" ? (
                <span>
                  <span aria-hidden="true" className="games-pulse">✋</span>
                  <span className="games-arena-title">{text.waitTitle}</span>
                  <span className="games-arena-sub">{text.waitSubtitle}</span>
                </span>
              ) : null}
              {phase === "go" ? (
                <span>
                  <span aria-hidden="true" className="games-pulse">⚡</span>
                  <span className="games-arena-title">{text.goTitle}</span>
                </span>
              ) : null}
              {phase === "tooSoon" ? (
                <span>
                  <span aria-hidden="true" className="games-pulse">🫢</span>
                  <span className="games-arena-title">{text.tooSoonTitle}</span>
                  <span className="games-arena-sub games-multiline">{text.tooSoonSubtitle}</span>
                </span>
              ) : null}
            </button>
          )}
        </section>

        <aside className="games-side">
          <section className="games-side-card">
            <h3>{text.tierTableTitle}</h3>
            <div className="games-tier-table">
              {tierRows.map(({ tier, range }) => (
                <div className={`games-tier-row${tier.key === highlightTierKey ? " is-me" : ""}`} data-tier={tier.key} key={tier.key}>
                  <b>
                    {tier.emoji} {reactionTierLabel(tier, locale)}
                    {tier.key === highlightTierKey ? ` ${phase === "result" ? text.thisResultMark : text.myBestMark}` : ""}
                  </b>
                  <span>{range}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="games-side-card">
            <h3>{text.measureNotesTitle}</h3>
            <p className="games-side-note">{text.measureNotes}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
