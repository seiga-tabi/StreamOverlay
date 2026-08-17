import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublicAccountLogin } from "../../../shared/public-account-login";
import {
  deleteMyReactionRecord,
  fetchReactionLeaderboard,
  submitReactionRecord,
  type ReactionLeaderboard,
} from "../api";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesSharePath, setGamesUrl } from "../utils/routes";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import {
  MINI_GAMES,
  miniGameName,
  readMiniGameBest,
  reactionMsToNextTier,
  reactionTierForAverage,
  reactionTierLabel,
  REACTION_TIER_TABLE,
  syncMiniGameBestFromServer,
  writeMiniGameBest,
  type ReactionTier,
} from "../registry";

/* 반응속도 테스트 — 목업 docs/mockups/reaction-test.html v7.2(전문 디자인 리뷰 반영판).
 *
 * 페이지 구조(§④-0): 테스트-퍼스트 히어로 — 첫 화면 상단 밴드 "전체"가 시작 타깃이고
 * 중앙 박스는 시각적 강조입니다(리뷰: 타깃 축소는 즉시성 상실 — 전면 타깃 복원).
 * 정보(내 최고·티어 기준·리더보드 TOP3)는 하단 3칸 스트립, 측정 안내는 푸터 칩.
 * 위치 표시는 화면당 1개 원칙 — 상단 내비 탭이 있으므로 페이지 내 breadcrumb 없음.
 *
 * 진행(§④-1 v7.2): 시작 → 전체 뷰포트 오버레이 →
 * [대기(무작위) → 신호 → 델타 1.5초("204ms ▼14ms")] ×5 → 결과(완성 그래프).
 * 라운드 중간의 미완성 그래프(2s)·휴지 카운트다운(3s)은 리뷰로 폐지 — 델타 한 줄이면
 * 충분하고, 다음 라운드의 무작위 대기가 자연 휴지를 겸합니다. 델타 동안 입력은 무시.
 *
 * 측정 정확도: performance.now() + pointerdown, goAt 은 go "커밋 후" rAF(페인트 프레임
 * vsync 정렬 — 2026-08-17 실측 보정), 120ms 미만 무효, 대기/신호 전환 트랜지션 금지,
 * 백그라운드 탭 전환 시 라운드 무효. 진행 영역은 OS 전체 화면이 아니라 페이지 위
 * 전체 뷰포트 오버레이(position:fixed)이며 Esc/✕ = 종료(진행 기록 무효).
 *
 * 접근성(§⑥): go 는 밝은 초록 배경+다크 텍스트(명도차 — 적록색약 대응, ✋→⚡ 모양 구분
 * 병행), 회차 칩 최고/최저는 색+텍스트 마커(★/▲) 병기, 티어는 이모지 대신 색 배지
 * 단일 표기(이모지는 SNS 공유 "텍스트"에서만).
 */

const ROUNDS = 5;
const WAIT_MIN_MS = 1_500;
const WAIT_MAX_MS = 4_000;
const MIN_HUMAN_MS = 120;
const DELTA_SHOW_MS = 1_500;

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "delta" | "result";
const RUNNING_PHASES: ReadonlySet<Phase> = new Set(["waiting", "go", "tooSoon", "delta"]);

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

/* 그래프 좌표(%) — 표본 범위에 여유를 두고 정규화합니다. 점은 %-좌표 HTML 오버레이로
   그려 컨테이너 종횡비와 무관하게 항상 정원을 유지합니다(모바일 실측 결함의 재발 방지). */
function chartPoints(samples: number[]): Array<{ xPct: number; yPct: number; value: number }> {
  if (samples.length === 0) return [];
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const low = min - 20;
  const span = Math.max(max + 20 - low, 1);
  return samples.map((value, index) => ({
    xPct: 10 + index * 20,
    yPct: 85 - ((value - low) / span) * 70,
    value,
  }));
}

/** 티어 배지 — 이모지 대신 단일 색 dot 표기(목업 §⑥-1). */
export function TierDot({ tier }: { tier: ReactionTier }) {
  return <i aria-hidden="true" className="games-tdot" style={{ background: tier.color }} />;
}

export function ReactionTest({ locale }: { locale: GamesLocale }) {
  const text = gamesI18n[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const [samples, setSamples] = useState<number[]>([]);
  const [best, setBest] = useState(() => readMiniGameBest(REACTION_GAME.id));
  const [bestUpdated, setBestUpdated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tiersExpanded, setTiersExpanded] = useState(false);
  /* 기록 등록 기능은 리더보드 조회 성공 여부로 게이트(fail-closed) — null = 기능 꺼짐. */
  const [leaderboard, setLeaderboard] = useState<ReactionLeaderboard | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [identity, setIdentity] = useState<"public" | "anonymous">(() => readStoredIdentity());
  const [submitState, setSubmitState] = useState<"idle" | "busy" | "error" | "rate">("idle");
  const [slowRecordMs, setSlowRecordMs] = useState<number | undefined>(undefined);
  const [shareId, setShareId] = useState<string | null>(null);
  const [registeredRank, setRegisteredRank] = useState<number | undefined>(undefined);
  const [shareCopied, setShareCopied] = useState(false);
  const account = usePublicAccountLogin();
  const timerRef = useRef<number | undefined>(undefined);
  const goAtRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const clearTimers = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const quitRun = useCallback(() => {
    /* 중단 = 진행 기록 무효(확인 없이 즉시 이탈). */
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

  /* 라운드 델타(1.5초) — 이번 기록+직전 대비 한 줄만 보여주고 다음 라운드로.
     마지막 라운드는 델타 없이 곧장 결과(완성 그래프는 결과 화면에). */
  const showDelta = useCallback((nextSamples: number[]) => {
    if (nextSamples.length >= ROUNDS) {
      finishRun(nextSamples);
      return;
    }
    setPhase("delta");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      if (phaseRef.current === "delta") scheduleGo();
    }, DELTA_SHOW_MS);
  }, [finishRun, scheduleGo]);

  useEffect(() => () => {
    clearTimers();
    document.body.style.removeProperty("overflow");
  }, [clearTimers]);

  const refreshLeaderboard = useCallback(() => {
    void fetchReactionLeaderboard().then((board) => {
      setLeaderboard(board);
      /* 같은 계정을 다른 기기에서 쓸 때 "내 최고 기록"이 기기마다 달라지는 문제 —
         서버(계정) 기록을 로컬 캐시에 합류시켜 min(로컬, 계정) 기준으로 맞춥니다. */
      if (board?.me && syncMiniGameBestFromServer(REACTION_GAME, { score: board.me.averageMs, tierKey: board.me.tierKey })) {
        setBest(readMiniGameBest(REACTION_GAME.id));
      }
    });
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

  const startRun = useCallback(() => {
    setSamples([]);
    setBestUpdated(false);
    setCopied(false);
    setShareId(null);
    setRegisteredRank(undefined);
    setShareCopied(false);
    setSlowRecordMs(undefined);
    scheduleGo();
  }, [scheduleGo]);

  const handleStageInput = useCallback(() => {
    const current = phaseRef.current;
    /* 델타 표시 동안의 입력은 전부 무시(잔여 클릭이 tooSoon 으로 번지는 사고 방지). */
    if (current === "delta") return;
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
      showDelta(nextSamples);
    }
  }, [clearTimers, samples, scheduleGo, showDelta]);

  const running = RUNNING_PHASES.has(phase);

  /* 전체 뷰포트 오버레이 동안 뒤 페이지가 스크롤되지 않게 잠급니다. */
  useEffect(() => {
    if (running) document.body.style.overflow = "hidden";
    else document.body.style.removeProperty("overflow");
  }, [running]);

  const average = samples.length > 0 ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : 0;
  const resultTier = phase === "result" ? reactionTierForAverage(average) : undefined;
  const nextTier = phase === "result" ? reactionMsToNextTier(average) : undefined;
  const bestSample = samples.length > 0 ? Math.min(...samples) : undefined;
  const worstSample = samples.length > 0 ? Math.max(...samples) : undefined;
  const bestTier = best?.tierKey ? REACTION_TIER_TABLE.find((tier) => tier.key === best.tierKey) : undefined;
  const bestNext = best ? reactionMsToNextTier(Math.round(best.score)) : undefined;

  /* 델타 = 방금 끝난 라운드, 그 외 = 진행 중인 라운드 번호. */
  const roundNumber = phase === "delta" ? samples.length : Math.min(samples.length + 1, ROUNDS);
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

  /* SNS 공유 — Web Share API(모바일 네이티브 공유 시트), 미지원 시 결과+링크 클립보드
     폴백. 링크는 등록 기록이 있으면 공유 페이지(OG 렌더), 없으면 게임 페이지 —
     둘 다 현재 로케일 프리픽스를 유지합니다. */
  const shareToSns = useCallback(async () => {
    if (!resultTier) return;
    const shareText = formatTemplate(text.snsShareText, { ms: String(average), tier: `${resultTier.emoji} ${reactionTierLabel(resultTier, locale)}` });
    const path = shareId ? gamesSharePath(shareId) : "/games/reaction";
    const url = new URL(localizedPublicUrlForCurrentLocale(path), window.location.origin).href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "YORO.gg", text: shareText, url });
      } catch {
        /* 사용자가 공유 시트를 닫음 — 오류 아님. */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
    } catch {
      window.prompt(text.snsShare, `${shareText}\n${url}`);
    }
  }, [average, locale, resultTier, shareId, text]);

  const submitRecord = useCallback(async () => {
    if (samples.length < ROUNDS) return;
    setSubmitState("busy");
    try {
      window.localStorage.setItem(IDENTITY_STORAGE_KEY, identity);
    } catch {
      /* 저장 불가(시크릿 등)는 무시 — 선택 기억만 포기합니다. */
    }
    /* "느린 기록 등록" 피드백(목업 §⑥-2) — 제출 전의 내 베스트와 비교해, 서버 정책상
       기록이 갱신되지 않는 경우임을 등록 완료 화면에서 알립니다(조용한 무시 금지). */
    const priorBest = best ? Math.round(best.score) : undefined;
    try {
      const result = await submitReactionRecord({ averageMs: average, samples, identity });
      setShareId(result.shareId);
      setRegisteredRank(result.rank);
      setSubmitState("idle");
      setSlowRecordMs(priorBest !== undefined && priorBest < average ? priorBest : undefined);
      refreshLeaderboard();
    } catch (error) {
      setSubmitState(error instanceof Error && error.message.includes("429") ? "rate" : "error");
    }
  }, [average, best, identity, refreshLeaderboard, samples]);

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
        : phase === "delta" && lastSample !== undefined
          ? formatTemplate(text.chartAnnounce, { n: String(samples.length), ms: String(lastSample) })
          : phase === "result" && resultTier
            ? `${average}ms · ${reactionTierLabel(resultTier, locale)}`
            : "";

  /* 티어 스트립 — 하이라이트 티어 ±1 만 기본 표시, "전체 보기"로 인라인 확장(목업 확정안). */
  const highlightTierKey = phase === "result" ? resultTier?.key : bestTier?.key;
  const tierRows = useMemo(() => REACTION_TIER_TABLE.map((tier) => {
    const from = REACTION_TIER_TABLE[REACTION_TIER_TABLE.indexOf(tier) - 1];
    const range = Number.isFinite(tier.maxMs)
      ? from ? `${from.maxMs + 1} ~ ${tier.maxMs}ms` : `~ ${tier.maxMs}ms`
      : `${(from?.maxMs ?? 0) + 1}ms ~`;
    return { tier, range };
  }), []);
  const visibleTierRows = useMemo(() => {
    if (tiersExpanded) return tierRows;
    const highlighted = REACTION_TIER_TABLE.findIndex((tier) => tier.key === highlightTierKey);
    const center = highlighted >= 0 ? highlighted : REACTION_TIER_TABLE.findIndex((tier) => tier.key === "gold");
    return tierRows.slice(Math.max(0, center - 1), Math.min(tierRows.length, center + 2));
  }, [highlightTierKey, tierRows, tiersExpanded]);

  return (
    <div className="games-reaction">
      {/* ── 히어로: 밴드 전체가 시작 타깃(중앙 박스는 시각 강조) ↔ 결과 무대 ── */}
      {phase === "result" && resultTier ? (
        <section className="games-hero-band is-result" data-testid="reaction-hero">
          <div className="games-hero-result">
            <div className="games-arena-ms">{average}<small>ms</small></div>
            <div className="games-hero-result-sub">{text.averageLabel}</div>
            <span className="games-tier-chip"><TierDot tier={resultTier} />{reactionTierLabel(resultTier, locale)}</span>
            <div className="games-tries">
              {samples.map((sample, index) => (
                <span
                  className={sample === bestSample ? "is-best" : sample === worstSample ? "is-worst" : ""}
                  key={`${index}-${sample}`}
                >
                  {sample}
                  <i>
                    {formatTemplate(text.roundLabel, { n: String(index + 1) })}
                    {sample === bestSample ? ` · ${text.triesBestMark}` : sample === worstSample ? ` · ${text.triesWorstMark}` : ""}
                  </i>
                </span>
              ))}
            </div>
            {/* 완성 그래프 — 라운드 중간 그래프는 폐지, 결과에서만(점=HTML 오버레이, 항상 정원). */}
            <div className="games-result-plot" data-testid="reaction-result-chart">
              <div className="games-chart-canvas">
                <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 520 110">
                  <line stroke="currentColor" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" x1="0" x2="520" y1="30" y2="30" />
                  <line stroke="currentColor" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" x1="0" x2="520" y1="70" y2="70" />
                  {points.length > 1 ? (
                    <polyline
                      className="games-chart-line"
                      fill="none"
                      points={points.map((point) => `${((point.xPct / 100) * 520).toFixed(1)},${((point.yPct / 100) * 110).toFixed(1)}`).join(" ")}
                      strokeLinecap="round"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </svg>
                {points.map((point, index) => (
                  <span
                    aria-hidden="true"
                    className={`games-chart-dot${point.value === bestSample ? " is-best" : point.value === worstSample ? " is-worst" : ""}${index === points.length - 1 ? " is-current" : ""}`}
                    key={`${index}-${point.value}`}
                    style={{ left: `${point.xPct}%`, top: `${point.yPct.toFixed(2)}%` }}
                  />
                ))}
              </div>
              <div aria-hidden="true" className="games-chart-axis">
                {Array.from({ length: ROUNDS }, (_, index) => (
                  <span key={index}>{formatTemplate(text.roundLabel, { n: String(index + 1) })}</span>
                ))}
              </div>
            </div>
            {nextTier && nextTier.deltaMs > 0 ? (
              <p className="games-next-tier">
                {formatTemplate(text.nextTier, { tier: reactionTierLabel(nextTier.tier, locale) })} <b>-{nextTier.deltaMs}ms</b>
              </p>
            ) : null}
            {bestUpdated ? <p className="games-best-updated">{text.myBestRecord} {text.bestUpdated}</p> : null}
            {/* 버튼 위계(목업 §⑥-1): 채움(골드)은 주행동 "기록 등록" 하나 — 나머지는 고스트.
               리더보드가 꺼진(fail-closed) 배포에선 "다시 도전"이 주행동으로 승격됩니다. */}
            <div className="games-result-actions">
              {leaderboard ? (
                shareId ? (
                  <button className="games-btn is-gold" onClick={() => void copyShareLink()} type="button">
                    {shareCopied ? text.shareLinkCopied : text.copyShareLink}
                  </button>
                ) : (
                  <button className="games-btn is-gold" onClick={() => { setSubmitState("idle"); setRegisterOpen(true); }} type="button">
                    {text.registerCta}
                  </button>
                )
              ) : null}
              <button className={leaderboard ? "games-btn is-ghost" : "games-btn"} onClick={() => { setPhase("idle"); setSamples([]); }} type="button">
                {text.retry}
              </button>
              <button className="games-btn is-ghost" onClick={() => void shareToSns()} type="button">
                {copied ? text.snsShareCopied : text.snsShare}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          aria-label={`${miniGameName(REACTION_GAME, locale)} — ${text.heroStartTitle}`}
          className="games-hero-band"
          data-testid="reaction-hero"
          onClick={startRun}
          type="button"
        >
          <span className="games-hero-start">
            <span aria-hidden="true" className="games-pulse">⚡</span>
            <span className="games-hero-title">{text.heroStartTitle}</span>
            <span className="games-hero-sub">{text.heroStartSub}</span>
          </span>
        </button>
      )}
      <span aria-live="polite" className="games-visually-hidden">{statusText}</span>

      {/* ── 진행 오버레이(대기/신호/조기/델타) — 페이지 위 전체 뷰포트 ── */}
      {running ? (
        <section className="games-stage is-running">
          <div className="games-fs-hud">
            <span className="games-fs-round">{formatTemplate(text.stageStep, { n: String(roundNumber) })}</span>
            <button className="games-fs-quit" onClick={quitRun} type="button">✕ {text.quitLabel} (Esc)</button>
          </div>
          {phase === "delta" ? (
            <div className="games-arena is-delta">
              <div>
                <div className="games-delta-ms">{lastSample}<small>ms</small></div>
                {deltaLabel ? <div className={`games-chart-delta ${deltaTone}`}>{deltaLabel}</div> : null}
                <div className="games-arena-sub">{text.nextRoundSoon}</div>
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
      ) : null}

      {/* ── 정보 스트립: 내 최고 / 티어 기준(±1 + 인라인 확장) / 리더보드 TOP3 ── */}
      <div className={`games-strip${leaderboard ? "" : " is-two"}`} data-testid="reaction-strip">
        <div className="games-strip-cell">
          <h3>{text.stripBestTitle}</h3>
          {best ? (
            <>
              <div className="games-strip-best">
                <b>{Math.round(best.score)}<small>ms</small></b>
                {bestTier ? <span className="games-strip-best-tier"><TierDot tier={bestTier} />{reactionTierLabel(bestTier, locale)}</span> : null}
              </div>
              {bestNext && bestNext.deltaMs > 0 ? (
                <small className="games-strip-next">
                  {formatTemplate(text.nextTier, { tier: reactionTierLabel(bestNext.tier, locale) })} -{bestNext.deltaMs}ms
                </small>
              ) : null}
            </>
          ) : (
            <small className="games-strip-empty">{text.stripBestEmpty}</small>
          )}
        </div>
        <div className="games-strip-cell">
          <h3>
            {text.stripTierTitle}
            <button className="games-strip-link" onClick={() => setTiersExpanded((value) => !value)} type="button">
              {tiersExpanded ? text.stripTierCollapse : `${text.stripTierAll} ▾`}
            </button>
          </h3>
          <div className="games-tier-table">
            {visibleTierRows.map(({ tier, range }) => (
              <div className={`games-tier-row${tier.key === highlightTierKey ? " is-me" : ""}`} data-tier={tier.key} key={tier.key}>
                <b>
                  <TierDot tier={tier} />{reactionTierLabel(tier, locale)}
                  {tier.key === highlightTierKey ? ` ${phase === "result" ? text.thisResultMark : text.myBestMark}` : ""}
                </b>
                <span>{range}</span>
              </div>
            ))}
          </div>
        </div>
        {leaderboard ? (
          <div className="games-strip-cell" data-testid="reaction-leaderboard">
            <h3>
              {text.stripLbTitle}
              <button className="games-strip-link" onClick={() => setGamesUrl("/games/ranking")} type="button">{text.stripLbAll}</button>
            </h3>
            {leaderboard.entries.length === 0 ? (
              <small className="games-strip-empty">{text.leaderboardEmpty}</small>
            ) : (
              <div className="games-lb">
                {leaderboard.entries.slice(0, 3).map((entry) => (
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
              </div>
            )}
            {leaderboard.me ? (
              <button className="games-lb-delete" onClick={() => void deleteMyRecord()} type="button">{text.leaderboardDelete}</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 측정 안내 — 사이드 카드 대신 푸터 칩(목업 §④-0). */}
      <div className="games-foot-chips">
        <span>{text.footChipInput}</span>
        <span>{text.footChipEarly}</span>
        <span>{text.footChipStore}</span>
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
                {resultTier ? <span><TierDot tier={resultTier} />{reactionTierLabel(resultTier, locale)}</span> : null}
              </div>

              {shareId ? (
                <>
                  <p className="games-sheet-done">
                    {text.registerDoneTitle}
                    {registeredRank !== undefined ? ` · ${formatTemplate(text.registerDoneRank, { rank: String(registeredRank) })}` : ""}
                  </p>
                  {slowRecordMs !== undefined ? (
                    <p className="games-sheet-note games-sheet-center">{formatTemplate(text.slowRecordNote, { ms: String(slowRecordMs) })}</p>
                  ) : null}
                  <button className="games-btn is-gold games-sheet-wide" onClick={() => void copyShareLink()} type="button">
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
                  {submitState === "rate" ? <p className="games-sheet-error">{text.rateLimited}</p> : null}
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
