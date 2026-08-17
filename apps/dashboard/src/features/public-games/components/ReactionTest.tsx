import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicAccountLogin } from "../../../shared/public-account-login";
import {
  deleteMyReactionRecord,
  fetchReactionLeaderboard,
  submitReactionRecord,
  type ReactionLeaderboard,
} from "../api";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesSharePath } from "../utils/routes";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
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

/* 반응속도 테스트 — 목업 docs/mockups/reaction-test.html v4.
 *
 * 진행 흐름(§④-1): 시작 → 전체 화면 → [대기(무작위) → 신호 → 그래프 2.0초 → 휴지 3.0초] ×5
 * → 전체 화면 해제 → 결과. 그래프는 라운드마다 점을 하나씩 찍어 변화를 보여주고,
 * 그래프·휴지 동안의 입력은 전부 무시합니다(잔여 클릭이 tooSoon 으로 번지는 사고 방지).
 *
 * 측정 정확도 규칙(§측정 정확도):
 * - performance.now() + pointerdown 시점(click 은 up 까지 늦음)
 * - 신호 표시는 rAF 콜백에서 타임스탬프를 찍어 페인트 시점과 정렬
 * - 대기/신호 전환에 트랜지션 금지(CSS 쪽 규칙)
 * - 120ms 미만은 신호 예측으로 간주해 라운드 무효
 * - 백그라운드 탭 전환 시 진행 라운드 무효(visibilitychange)
 *
 * 진행 영역: OS 전체 화면이 아니라 웹 페이지 내부에서 스테이지가 대형 영역으로
 * 확장됩니다(사이드 패널 숨김 + 아레나 확장 — 2026-08-17 사용자 요청으로 Fullscreen API 제거).
 * Esc/✕ = 종료(진행 기록 무효).
 */

const ROUNDS = 5;
const WAIT_MIN_MS = 1_500;
const WAIT_MAX_MS = 4_000;
const MIN_HUMAN_MS = 120;
const CHART_SHOW_MS = 2_000;
const REST_TOTAL_MS = 3_000;

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "chart" | "rest" | "result";
const RUNNING_PHASES: ReadonlySet<Phase> = new Set(["waiting", "go", "tooSoon", "chart", "rest"]);

const REACTION_GAME = MINI_GAMES.find((game) => game.id === "reaction")!;
/* 등록 시트의 마지막 공개 방식 선택 기억(목업 §④-2). */
const IDENTITY_STORAGE_KEY = "yoro.games.reaction.identity.v1";

function readStoredIdentity(): "public" | "anonymous" {
  try {
    return window.localStorage.getItem(IDENTITY_STORAGE_KEY) === "anonymous" ? "anonymous" : "public";
  } catch {
    return "public";
  }
}

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/* 그래프 좌표 — 표본 범위에 여유를 두고 0~1 로 정규화합니다(점 1개면 중앙). */
function chartPoints(samples: number[]): Array<{ x: number; y: number; value: number }> {
  if (samples.length === 0) return [];
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const low = min - 20;
  const high = max + 20;
  const span = Math.max(high - low, 1);
  return samples.map((value, index) => ({
    x: 52 + index * 104,
    y: 128 - ((value - low) / span) * 106,
    value,
  }));
}

export function ReactionTest({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const [samples, setSamples] = useState<number[]>([]);
  const [restCount, setRestCount] = useState(3);
  const [best, setBest] = useState(() => readMiniGameBest(REACTION_GAME.id));
  const [bestUpdated, setBestUpdated] = useState(false);
  const [copied, setCopied] = useState(false);
  /* 기록 등록 기능은 리더보드 조회 성공 여부로 게이트(fail-closed) — null = 기능 꺼짐. */
  const [leaderboard, setLeaderboard] = useState<ReactionLeaderboard | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [identity, setIdentity] = useState<"public" | "anonymous">(() => readStoredIdentity());
  const [submitState, setSubmitState] = useState<"idle" | "busy" | "error">("idle");
  const [shareId, setShareId] = useState<string | null>(null);
  const [registeredRank, setRegisteredRank] = useState<number | undefined>(undefined);
  const [shareCopied, setShareCopied] = useState(false);
  const account = usePublicAccountLogin();
  const timerRef = useRef<number | undefined>(undefined);
  const restTickRef = useRef<number | undefined>(undefined);
  const goAtRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const clearTimers = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (restTickRef.current !== undefined) {
      window.clearInterval(restTickRef.current);
      restTickRef.current = undefined;
    }
  }, []);

  const quitRun = useCallback(() => {
    /* 중단 = 진행 기록 무효(목업 §④-1 접근성 — 확인 없이 즉시 이탈). */
    clearTimers();
    setSamples([]);
    setPhase("idle");
  }, [clearTimers]);

  const scheduleGo = useCallback(() => {
    clearTimers();
    /* 0 = 아직 신호가 페인트되지 않음 — go 입력 가드가 예측 클릭으로 처리합니다. */
    goAtRef.current = 0;
    setPhase("waiting");
    const delay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      if (phaseRef.current === "waiting") setPhase("go");
    }, delay);
  }, [clearTimers]);

  /* 신호 시작 시각 = go "커밋 후" rAF 타임스탬프 — 초록이 페인트되는 프레임의 vsync 와
     정렬됩니다. 이전에는 커밋 전 rAF 에서 찍어 실측 8~9ms(+표시 지연)가 매 라운드
     과대측정됐습니다(2026-08-17 실측 보정 — 타 사이트 대비 평균이 높던 원인 일부). */
  useEffect(() => {
    if (phase !== "go") return;
    const raf = window.requestAnimationFrame((frameTs) => {
      goAtRef.current = frameTs;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [phase]);

  const finishRun = useCallback((finalSamples: number[]) => {
    const average = Math.round(finalSamples.reduce((sum, value) => sum + value, 0) / finalSamples.length);
    const tier = reactionTierForAverage(average);
    const improved = writeMiniGameBest(REACTION_GAME, { score: average, tierKey: tier.key, at: new Date().toISOString() });
    if (improved) setBest(readMiniGameBest(REACTION_GAME.id));
    setBestUpdated(improved);
    setPhase("result");
  }, []);

  const startRest = useCallback(() => {
    setPhase("rest");
    setRestCount(Math.ceil(REST_TOTAL_MS / 1_000));
    restTickRef.current = window.setInterval(() => {
      setRestCount((count) => count - 1);
    }, 1_000);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      if (restTickRef.current !== undefined) {
        window.clearInterval(restTickRef.current);
        restTickRef.current = undefined;
      }
      if (phaseRef.current === "rest") scheduleGo();
    }, REST_TOTAL_MS);
  }, [scheduleGo]);

  const showChart = useCallback((nextSamples: number[]) => {
    setPhase("chart");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      if (phaseRef.current !== "chart") return;
      /* 마지막 라운드는 휴지 없이 결과로 — 그래프 2초 → 풀스크린 해제 → 결과(목업 흐름 ×5 → 결과). */
      if (nextSamples.length >= ROUNDS) finishRun(nextSamples);
      else startRest();
    }, CHART_SHOW_MS);
  }, [finishRun, startRest]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const refreshLeaderboard = useCallback(() => {
    void fetchReactionLeaderboard().then((board) => setLeaderboard(board));
  }, []);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  /* Esc = 진행 중 종료(웹 내부 영역이라 브라우저 풀스크린 Esc 가 없으므로 직접 처리). */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && RUNNING_PHASES.has(phaseRef.current)) quitRun();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [quitRun]);

  /* 백그라운드 탭에서는 타이머·인지 시점이 왜곡되므로 진행 중 라운드를 무효화합니다. */
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      if (phaseRef.current === "waiting" || phaseRef.current === "go") {
        clearTimers();
        setPhase("tooSoon");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [clearTimers]);

  const handleStageInput = useCallback(() => {
    const current = phaseRef.current;
    /* 그래프·휴지 동안의 입력은 전부 무시(목업 §④-1 입력 게이트). */
    if (current === "chart" || current === "rest") return;
    if (current === "idle") {
      setSamples([]);
      setBestUpdated(false);
      setCopied(false);
      setShareId(null);
      setRegisteredRank(undefined);
      setShareCopied(false);
      scheduleGo();
      return;
    }
    if (current === "waiting") {
      clearTimers();
      setPhase("tooSoon");
      return;
    }
    if (current === "tooSoon") {
      scheduleGo();
      return;
    }
    if (current === "go") {
      /* 커밋~페인트 사이(goAt 미기록)의 입력은 신호를 보고 누른 것일 수 없습니다. */
      if (goAtRef.current === 0) {
        setPhase("tooSoon");
        return;
      }
      const elapsed = performance.now() - goAtRef.current;
      if (elapsed < MIN_HUMAN_MS) {
        /* 신호 예측(인간 한계 미만) — 라운드 무효. */
        setPhase("tooSoon");
        return;
      }
      const nextSamples = [...samples, Math.round(elapsed)];
      setSamples(nextSamples);
      showChart(nextSamples);
    }
  }, [clearTimers, samples, scheduleGo, showChart]);

  const running = RUNNING_PHASES.has(phase);
  const average = samples.length > 0 ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : 0;
  const resultTier = phase === "result" ? reactionTierForAverage(average) : undefined;
  const nextTier = phase === "result" ? reactionMsToNextTier(average) : undefined;
  const bestSample = samples.length > 0 ? Math.min(...samples) : undefined;
  const worstSample = samples.length > 0 ? Math.max(...samples) : undefined;
  const bestTier = best?.tierKey ? REACTION_TIER_TABLE.find((tier) => tier.key === best.tierKey) : undefined;

  /* 그래프 = 방금 끝난 라운드, 휴지 = 준비 중인 다음 라운드 번호를 표시합니다. */
  const roundNumber = phase === "chart" ? samples.length : Math.min(samples.length + 1, ROUNDS);
  const stepLabel = phase === "idle"
    ? text.stageReady
    : phase === "result"
      ? text.stageDone
      : formatTemplate(text.stageStep, { n: String(roundNumber) });

  const lastSample = samples.at(-1);
  const previousSample = samples.at(-2);
  const deltaLabel = lastSample === undefined
    ? ""
    : previousSample === undefined
      ? text.deltaFirst
      : lastSample < previousSample
        ? formatTemplate(text.deltaFaster, { ms: String(previousSample - lastSample) })
        : lastSample > previousSample
          ? formatTemplate(text.deltaSlower, { ms: String(lastSample - previousSample) })
          : text.deltaSame;
  const deltaTone = lastSample !== undefined && previousSample !== undefined
    ? lastSample < previousSample ? "is-faster" : lastSample > previousSample ? "is-slower" : ""
    : "";
  const points = useMemo(() => chartPoints(samples), [samples]);

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

  const submitRecord = useCallback(async () => {
    if (samples.length < ROUNDS) return;
    setSubmitState("busy");
    try {
      window.localStorage.setItem(IDENTITY_STORAGE_KEY, identity);
    } catch {
      /* 저장 불가(시크릿 등)는 무시 — 선택 기억만 포기합니다. */
    }
    try {
      const result = await submitReactionRecord({ averageMs: average, samples, identity });
      setShareId(result.shareId);
      setRegisteredRank(result.rank);
      setSubmitState("idle");
      refreshLeaderboard();
    } catch {
      setSubmitState("error");
    }
  }, [average, identity, refreshLeaderboard, samples]);

  const copyShareLink = useCallback(async () => {
    if (!shareId) return;
    const url = new URL(localizedPublicUrlForCurrentLocale(gamesSharePath(shareId)), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      window.prompt(text.copyShareLink, url);
    }
  }, [shareId, text]);

  const deleteMyRecord = useCallback(async () => {
    const removed = await deleteMyReactionRecord();
    if (removed) {
      setShareId(null);
      setRegisteredRank(undefined);
      refreshLeaderboard();
    }
  }, [refreshLeaderboard]);

  const statusText = phase === "waiting"
    ? text.waitTitle
    : phase === "go"
      ? text.goTitle
      : phase === "tooSoon"
        ? text.tooSoonTitle
        : phase === "chart" && lastSample !== undefined
          ? formatTemplate(text.chartAnnounce, { n: String(samples.length), ms: String(lastSample) })
          : phase === "rest"
            ? `${restCount}`
            : phase === "result" && resultTier
              ? `${average}ms · ${reactionTierLabel(resultTier, locale)}`
              : "";

  const highlightTierKey = phase === "result" ? resultTier?.key : bestTier?.key;
  const tierRows = useMemo(() => REACTION_TIER_TABLE.map((tier) => {
    const from = REACTION_TIER_TABLE[REACTION_TIER_TABLE.indexOf(tier) - 1];
    const range = Number.isFinite(tier.maxMs)
      ? from ? `${from.maxMs + 1} ~ ${tier.maxMs}ms` : `~ ${tier.maxMs}ms`
      : `${(from?.maxMs ?? 0) + 1}ms ~`;
    return { tier, range };
  }), []);

  const hud = running ? (
    <div className="games-fs-hud">
      <span className="games-fs-round">{formatTemplate(text.stageStep, { n: String(roundNumber) })}</span>
      <button className="games-fs-quit" onClick={quitRun} type="button">✕ {text.quitLabel} (Esc)</button>
    </div>
  ) : null;

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

      <div className={`games-reaction-cols${running ? " is-running" : ""}`}>
        <section className={`games-stage${running ? " is-running" : ""}`}>
          {!running ? (
            <div className="games-stage-head">
              <h2>{text.stageTitle}</h2>
              <span className="games-stage-step">{stepLabel}</span>
            </div>
          ) : null}
          {hud}
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
                  {leaderboard ? (
                    shareId ? (
                      <button className="games-btn is-share" onClick={() => void copyShareLink()} type="button">
                        {shareCopied ? text.shareLinkCopied : text.copyShareLink}
                      </button>
                    ) : (
                      <button className="games-btn is-share" onClick={() => { setSubmitState("idle"); setRegisterOpen(true); }} type="button">
                        {text.registerCta}
                      </button>
                    )
                  ) : null}
                  <button className="games-btn is-ghost" onClick={() => void copyResult()} type="button">
                    {copied ? text.copied : text.copyResult}
                  </button>
                </div>
              </div>
            </div>
          ) : phase === "chart" ? (
            <div className="games-arena is-chart">
              <div className="games-chart">
                <div className="games-chart-now">
                  <b>{lastSample}<small>ms</small></b>
                  {deltaLabel ? <span className={`games-chart-delta ${deltaTone}`}>{deltaLabel}</span> : null}
                </div>
                <div className="games-chart-plot">
                  {/* preserveAspectRatio="none" SVG 안의 circle 은 컨테이너 종횡비에 따라
                      타원으로 찌그러집니다(모바일 실측 결함). 점은 %-좌표 HTML 오버레이로
                      그려 항상 정원을 유지하고, 선은 non-scaling-stroke 로 굵기만 고정합니다. */}
                  <div className="games-chart-canvas">
                    <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 520 150">
                      <line stroke="currentColor" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" x1="0" x2="520" y1="37" y2="37" />
                      <line stroke="currentColor" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" x1="0" x2="520" y1="75" y2="75" />
                      <line stroke="currentColor" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" x1="0" x2="520" y1="113" y2="113" />
                      {points.length > 1 ? (
                        <polyline
                          className="games-chart-line"
                          fill="none"
                          points={points.map((point) => `${point.x},${point.y.toFixed(1)}`).join(" ")}
                          strokeLinecap="round"
                          strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </svg>
                    {points.map((point, index) => (
                      <span
                        aria-hidden="true"
                        className={index === points.length - 1 ? "games-chart-dot is-current" : "games-chart-dot"}
                        key={`${index}-${point.value}`}
                        style={{ left: `${((point.x / 520) * 100).toFixed(2)}%`, top: `${((point.y / 150) * 100).toFixed(2)}%` }}
                      />
                    ))}
                  </div>
                  <div aria-hidden="true" className="games-chart-axis">
                    {Array.from({ length: ROUNDS }, (_, index) => (
                      <span key={index}>{formatTemplate(text.roundLabel, { n: String(index + 1) })}</span>
                    ))}
                  </div>
                </div>
                <span aria-hidden="true" className="games-chart-fade"><i /></span>
              </div>
            </div>
          ) : phase === "rest" ? (
            <div className="games-arena is-rest">
              <div>
                <div className="games-rest-count">{Math.max(restCount, 1)}</div>
                <div className="games-arena-sub">{text.restPreparing}</div>
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
          {leaderboard ? (
            <section className="games-side-card" data-testid="reaction-leaderboard">
              <h3>
                {formatTemplate(text.leaderboardTitle, { count: String(Math.max(leaderboard.entries.length, 1) <= 50 ? 50 : leaderboard.entries.length) })}
                <small>{text.leaderboardPill}</small>
              </h3>
              {leaderboard.entries.length === 0 ? (
                <p className="games-side-note">{text.leaderboardEmpty}</p>
              ) : (
                <div className="games-lb">
                  {leaderboard.entries.slice(0, 10).map((entry) => (
                    <div className={`games-lb-row${leaderboard.me && entry.rank === leaderboard.me.rank ? " is-me" : ""}`} data-rank={entry.rank} key={entry.rank}>
                      <span className="games-lb-rank">{entry.rank}</span>
                      <span className="games-lb-name">
                        <i aria-hidden="true" className={entry.displayName ? "" : "is-mask"}>
                          {entry.avatarUrl ? <img alt="" src={entry.avatarUrl} /> : entry.displayName ? entry.displayName.slice(0, 1).toUpperCase() : "🎭"}
                        </i>
                        <b>{entry.displayName ?? formatTemplate(text.leaderboardAnonymous, { label: entry.anonymousLabel ?? "" })}</b>
                      </span>
                      <span className="games-lb-ms">{Math.round(entry.averageMs)}ms</span>
                    </div>
                  ))}
                  {leaderboard.me && !leaderboard.entries.slice(0, 10).some((entry) => entry.rank === leaderboard.me!.rank) ? (
                    <div className="games-lb-row is-me" data-rank={leaderboard.me.rank}>
                      <span className="games-lb-rank">{leaderboard.me.rank}</span>
                      <span className="games-lb-name">
                        <i aria-hidden="true" className={leaderboard.me.displayName ? "" : "is-mask"}>
                          {leaderboard.me.avatarUrl ? <img alt="" src={leaderboard.me.avatarUrl} /> : leaderboard.me.displayName ? leaderboard.me.displayName.slice(0, 1).toUpperCase() : "🎭"}
                        </i>
                        <b>{leaderboard.me.displayName ?? formatTemplate(text.leaderboardAnonymous, { label: leaderboard.me.anonymousLabel ?? "" })}</b>
                        <small>{text.leaderboardMe}</small>
                      </span>
                      <span className="games-lb-ms">{Math.round(leaderboard.me.averageMs)}ms</span>
                    </div>
                  ) : null}
                </div>
              )}
              {leaderboard.me ? (
                <button className="games-lb-delete" onClick={() => void deleteMyRecord()} type="button">{text.leaderboardDelete}</button>
              ) : null}
            </section>
          ) : null}
          <section className="games-side-card">
            <h3>{text.measureNotesTitle}</h3>
            <p className="games-side-note">{text.measureNotes}</p>
          </section>
        </aside>
      </div>

      {registerOpen ? (
        <div aria-modal="true" className="games-modal" role="dialog">
          <button aria-label={text.registerClose} className="games-modal-scrim" onClick={() => setRegisterOpen(false)} type="button" />
          <div className="games-sheet" data-testid="reaction-register-sheet">
            <div className="games-sheet-head">
              <h3>{text.registerSheetTitle}</h3>
              <button aria-label={text.registerClose} className="games-sheet-close" onClick={() => setRegisterOpen(false)} type="button">✕</button>
            </div>
            <div className="games-sheet-body">
              <div className="games-sheet-record">
                <b>{average}<small>ms</small></b>
                {resultTier ? <span>{resultTier.emoji} {reactionTierLabel(resultTier, locale)}</span> : null}
              </div>

              {shareId ? (
                <>
                  <p className="games-sheet-done">
                    {text.registerDoneTitle}
                    {registeredRank !== undefined ? ` · ${formatTemplate(text.registerDoneRank, { rank: String(registeredRank) })}` : ""}
                  </p>
                  <button className="games-btn is-share games-sheet-wide" onClick={() => void copyShareLink()} type="button">
                    {shareCopied ? text.shareLinkCopied : text.copyShareLink}
                  </button>
                </>
              ) : account.yoroConnected && account.accountUser ? (
                <>
                  <div className="games-id-options" role="radiogroup">
                    <button aria-checked={identity === "public"} className={`games-id-option${identity === "public" ? " is-on" : ""}`} onClick={() => setIdentity("public")} role="radio" type="button">
                      <span aria-hidden="true" className="games-id-radio" />
                      <span aria-hidden="true" className="games-id-avatar">
                        {account.accountUser.profileImageUrl ? <img alt="" src={account.accountUser.profileImageUrl} /> : account.accountUser.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="games-id-copy">
                        <b>{formatTemplate(text.registerPublicTitle, { name: account.accountUser.displayName })}</b>
                        <small>{text.registerPublicNote}</small>
                      </span>
                    </button>
                    <button aria-checked={identity === "anonymous"} className={`games-id-option${identity === "anonymous" ? " is-on" : ""}`} onClick={() => setIdentity("anonymous")} role="radio" type="button">
                      <span aria-hidden="true" className="games-id-radio" />
                      <span aria-hidden="true" className="games-id-avatar is-mask">🎭</span>
                      <span className="games-id-copy">
                        <b>{text.registerAnonymousTitle}</b>
                        <small>{text.registerAnonymousNote}</small>
                      </span>
                    </button>
                  </div>
                  {submitState === "error" ? <p className="games-sheet-error">{text.registerError}</p> : null}
                  <button className="games-btn is-twitch games-sheet-wide" disabled={submitState === "busy"} onClick={() => void submitRecord()} type="button">
                    {submitState === "busy" ? text.registerSubmitting : text.registerSubmit}
                  </button>
                  <p className="games-sheet-note">{text.registerPolicy}</p>
                </>
              ) : (
                <>
                  <p className="games-sheet-note games-multiline games-sheet-center">{text.registerLoginBody}</p>
                  <button className="games-btn is-twitch games-sheet-wide" onClick={() => account.loginWithTwitch()} type="button">
                    {text.registerLoginButton}
                  </button>
                  <button className="games-btn is-ghost games-sheet-wide" onClick={() => setRegisterOpen(false)} type="button">
                    {text.registerLater}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
