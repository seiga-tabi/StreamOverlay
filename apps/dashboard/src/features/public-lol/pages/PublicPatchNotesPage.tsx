import { useEffect, useMemo, useState } from "react";
import {
  patchKeyFromDataDragonVersion,
  type PatchNote,
  type PatchNotesFeed,
  type PatchPlayRecord,
  type PatchPlaySummary
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { NorigaeMark, TailUnderline } from "../../public-home/components/HomeMarks";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import {
  PatchNotesControlBar,
  riotIdOf,
  targetKey,
  type PatchNoteTarget,
  type PatchNotesFilter,
  type PatchNotesFilterOption
} from "../components/PatchNotesControlBar";
import { PatchNotesMineModule } from "../components/PatchNotesMineModule";
import { patchNoteLocale, requestPatchChangeSummary, requestPatchNotes, requestPatchPlaySummary } from "../api/patch-notes";
import { PatchChangeSummaryPanel } from "../components/PatchChangeSummaryPanel";
import type { PatchChangeSummary } from "../types/patch-change-summary";
import { publicIntlLocale, activePublicLocale, t } from "../i18n/public-lol-i18n";
import { readFavorites, readRecentSearches } from "../utils/storage";
import { patchNotesDetailFromPath } from "../utils/routes";
import type { SearchSuggestion } from "../types/public-lol";

type LoadState = "loading" | "ready" | "error";
type MineState = "idle" | "loading" | "ready" | "error";

/** 히어로 1장 + 키아트 타일 5장. 그 아래는 전부 아카이브 줄로 갑니다. */
const FEATURED_TILE_COUNT = 5;

/** 노트와 그 패치의 내 기록을 한 덩어리로 묶습니다. */
type PatchEntry = {
  note: PatchNote;
  record?: PatchPlayRecord;
  previousRecord?: PatchPlayRecord;
  /** 직전 패치와의 간격(일). 2주 주기가 눈에 보이도록 씁니다. */
  gapDays?: number;
};

function localeTag(): string {
  return publicIntlLocale();
}

function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(), { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(), { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/* 마지막 갱신 시각은 "언제 것인지"만 알면 되므로 상대 시간으로 짧게 씁니다. */
function formatFetchedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return t().justNow;
  if (minutes < 60) return `${minutes}${t().minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t().hoursAgo}`;
  return `${Math.floor(hours / 24)}${t().daysAgo}`;
}

/** 패치 번호의 앞자리를 시즌으로 씁니다. 26.15 → 26. 못 읽으면 묶지 않습니다. */
function seasonOf(note: PatchNote): string | undefined {
  return note.patchVersion?.split(".")[0];
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%p`;
}

/** 최근 검색과 즐겨찾기를 합쳐 중복을 지웁니다. 이 화면은 아무것도 새로 저장하지 않습니다. */
function storedTargets(): PatchNoteTarget[] {
  const merged: SearchSuggestion[] = [...readRecentSearches(), ...readFavorites()];
  const seen = new Set<string>();
  const unique: PatchNoteTarget[] = [];
  for (const item of merged) {
    if (!item.gameName || !item.tagLine || !item.lolPlatform) continue;
    const target: PatchNoteTarget = {
      gameName: item.gameName,
      tagLine: item.tagLine,
      lolPlatform: item.lolPlatform,
      /* 최근 검색에 이미 저장돼 있는 값입니다. 새로 받아오지 않습니다. */
      ...(item.profileIconUrl ? { profileIconUrl: item.profileIconUrl } : {})
    };
    const key = targetKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(target);
    if (unique.length >= 8) break;
  }
  return unique;
}

/* accentColor(--pn-k) 경로는 제거했습니다 — Riot 썸네일에서 뽑은 임의 색이라
   화면마다 달라져 팔레트를 무너뜨립니다(패치 노트 보강 §1). 색이 필요하던
   자리(플레이 표식·hover)는 고정 잉크 색을 씁니다. */

/** 원문 링크를 화면 언어의 Riot 로케일로 엽니다 — 목록 로케일(ko 폴백)과 무관하게
    /ko-kr/ ↔ /ja-jp/ ↔ /en-us/ 경로 조각만 바꿉니다(보강 §3 프런트 몫).
    en 문서가 없을 때의 404 확인(HEAD/화이트리스트)은 Codex 핸드오프에 적었습니다. */
const RIOT_LOCALE_PATH = { ko: "/ko-kr/", ja: "/ja-jp/", en: "/en-us/" } as const;

export function riotLocaleUrl(url: string): string {
  const target = RIOT_LOCALE_PATH[activePublicLocale] ?? RIOT_LOCALE_PATH.ko;
  return url.replace(/\/(?:ko-kr|ja-jp|en-us)\//, target);
}

/** 표본이 이보다 적으면 승률을 참고용으로 표시합니다 — 3판 2승의 66.7%를 과신하지 않게. */
const THIN_SAMPLE_GAMES = 5;

/**
 * 승/패 2색 막대.
 *
 * 이전 게이지는 승률 한 값만 길이로 그려서 3판 2승(66.7%)과 30판 20승(66.7%)이
 * 똑같이 보였습니다. 이제 막대 안쪽 비율이 승률이고, 막대 전체 길이는 판수에
 * 비례합니다(기준 = 그 소환사의 최다 판수 패치). 50% 기준선과 승·패 숫자는
 * 그대로 두어 색을 구분하지 못해도 읽힙니다.
 */
function WinRateGauge({
  maxGames,
  record,
  size
}: {
  maxGames: number;
  record: PatchPlayRecord;
  size: "hero" | "row";
}) {
  const losses = Math.max(0, record.games - record.wins);
  /* 판수 비례 폭. 0 나눗셈과 "너무 얇아 안 보이는" 막대를 함께 막습니다. */
  const widthRatio = maxGames > 0 ? Math.max(0.18, record.games / maxGames) : 1;
  const thin = record.games < THIN_SAMPLE_GAMES;
  return (
    <div
      className={size === "hero" ? "yoro-pn-gauge is-hero" : "yoro-pn-gauge"}
      data-tone={record.winRate >= 50 ? "good" : "bad"}
    >
      <div
        aria-label={t().patchNotesBarLabel
          .replace("{games}", String(record.games))
          .replace("{wins}", String(record.wins))
          .replace("{rate}", String(record.winRate))}
        className="yoro-pn-gauge-track"
        role="img"
        style={{ inlineSize: `${(widthRatio * 100).toFixed(1)}%` }}
      >
        <span className="yoro-pn-gauge-win" style={{ flexGrow: record.wins }} />
        <span className="yoro-pn-gauge-loss" style={{ flexGrow: losses }} />
        <span className="yoro-pn-gauge-mid" />
      </div>
      <b>{`${record.winRate.toFixed(1)}%`}</b>
      <span>
        {t().patchNotesRecordLabel
          .replace("{wins}", String(record.wins))
          .replace("{losses}", String(losses))
          .replace("{games}", String(record.games))}
      </span>
      {thin ? (
        <small className="yoro-pn-gauge-thin">
          {t().patchNotesThinSample.replace("{games}", String(record.games))}
        </small>
      ) : null}
    </div>
  );
}

/** 최근 패치 승률 추이. 이미 받아 온 summary.patches 만 씁니다(추가 요청 없음). */
function WinRateTrend({ records }: { records: readonly PatchPlayRecord[] }) {
  if (records.length < 3) return null;
  /* 최신이 오른쪽에 오도록 뒤집습니다 — 응답은 최신순입니다. */
  const points = [...records].slice(0, 10).reverse();
  return (
    <section aria-label={t().patchNotesTrendTitle} className="yoro-pn-trend">
      <p className="yoro-pn-trend-copy">
        <b>{t().patchNotesTrendTitle}</b>
        <small>{t().patchNotesTrendHint}</small>
      </p>
      <span className="yoro-pn-trend-bars">
        {points.map((point) => (
          <i
            data-tone={point.winRate > 50 ? "good" : point.winRate < 50 ? "bad" : undefined}
            key={point.patchKey}
            style={{ blockSize: `${Math.max(6, point.winRate)}%` }}
            title={t().patchNotesTrendItem
              .replace("{patch}", point.patchKey)
              .replace("{rate}", String(point.winRate))}
          />
        ))}
      </span>
    </section>
  );
}

function HeroCard({ entry, maxGames }: { entry: PatchEntry; maxGames: number }) {
  const { note, record, previousRecord } = entry;
  const delta = record && previousRecord
    ? Math.round((record.winRate - previousRecord.winRate) * 10) / 10
    : undefined;

  return (
    <article className="yoro-pn-hero">
      {/* 일러스트가 카드를 꽉 채우고, 글자가 놓이는 왼쪽만 가로 스크림으로 덮습니다
          (리스킨 §3-6 — 268×151 박스는 그림을 우표만 하게 만들어 번복됨). 이미지가
          없으면 히어로는 카드색 단색으로 남고 스크림도 그리지 않습니다. */}
      {note.imageUrl ? (
        <>
          <img
            alt=""
            aria-hidden="true"
            className="yoro-pn-hero-art"
            decoding="async"
            height={720}
            loading="eager"
            src={note.imageUrl}
            width={1280}
          />
          <span aria-hidden="true" className="yoro-pn-hero-scrim" />
        </>
      ) : null}
      <div className="yoro-pn-hero-body">
        <p className="yoro-pn-hero-eyebrow">
          <span>{t().patchNotesLatest}</span>
          <time dateTime={note.publishedAt}>{formatPublishedDate(note.publishedAt)}</time>
          {note.dataDragonVersion ? <em>{note.dataDragonVersion}</em> : null}
        </p>
        {note.patchVersion ? (
          <p className="yoro-pn-hero-num">
            {note.patchVersion}
            <span>{t().patchNotesPatchLabel}</span>
          </p>
        ) : null}
        {/* 카드 전체가 원문으로 가는 링크입니다. 읽는 이름은 제목입니다. */}
        <h2 className="yoro-pn-hero-title">
          <a className="yoro-pn-link" href={riotLocaleUrl(note.url)} rel="noopener noreferrer" target="_blank">
            {note.title}
            <span className="yoro-u-sr-only">{` — ${t().patchNotesNewTab}`}</span>
          </a>
        </h2>
        {note.summary ? <p className="yoro-pn-hero-sum">{note.summary}</p> : null}
        {record ? (
          <div className="yoro-pn-hero-mine">
            <WinRateGauge maxGames={maxGames} record={record} size="hero" />
            {delta === undefined ? null : (
              <p className="yoro-pn-delta" data-tone={delta === 0 ? undefined : delta > 0 ? "good" : "bad"}>
                <span>{t().patchNotesMineDelta}</span>
                <b>{signed(delta)}</b>
              </p>
            )}
          </div>
        ) : null}
        <p aria-hidden="true" className="yoro-pn-hero-cta">{`${t().patchNotesOpenOriginal} ↗`}</p>
      </div>
    </article>
  );
}

function FeaturedTile({ entry }: { entry: PatchEntry }) {
  const { note, record } = entry;

  return (
    <article className="yoro-pn-tile">
      {note.imageUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="yoro-pn-tile-art"
          decoding="async"
          height={360}
          loading="lazy"
          src={note.imageUrl}
          width={640}
        />
      ) : null}
      <span aria-hidden="true" className="yoro-pn-tile-scrim" />
      <p className="yoro-pn-tile-top">
        <time dateTime={note.publishedAt}>{formatShortDate(note.publishedAt)}</time>
        {record ? (
          <span className="yoro-pn-tile-rate" data-tone={record.winRate >= 50 ? "good" : "bad"}>
            {/* 카드 줄을 훑을 때 숫자만으로는 비교가 안 돼 미니 막대를 함께 둡니다. */}
            <i aria-hidden="true" style={{ inlineSize: `${record.winRate}%` }} />
            {`${record.winRate.toFixed(1)}%`}
          </span>
        ) : null}
      </p>
      <h3 className="yoro-pn-tile-num">
        <a className="yoro-pn-link" href={riotLocaleUrl(note.url)} rel="noopener noreferrer" target="_blank">
          {note.patchVersion ?? note.title}
          <span className="yoro-u-sr-only">{` ${note.title} — ${t().patchNotesNewTab}`}</span>
        </a>
      </h3>
      {note.summary ? <p className="yoro-pn-tile-sum">{note.summary}</p> : null}
    </article>
  );
}

/** 사이드바 행의 날짜 — 목업 `08.12`. 숫자만이라 로케일 표기와 무관합니다. */
function formatMonthDay(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

/* 사이드바 행 — 번호·MM.DD·우측 %p(또는 —) 세 값만(사용성 §2-1-4·5).
 * 제목은 본문 히어로·요약 카드가 보여 주므로 sr-only 링크 텍스트로만 남기고,
 * 폭 0 이던 .yoro-pn-node·.yoro-pn-row-art 와 「플레이 없음」 반복은 지웠습니다.
 * 행 전체가 stretched link(.yoro-pn-link::after) 로 그 패치 원문으로 갑니다. */
function ArchiveRow({ entry, focused = false }: { entry: PatchEntry; focused?: boolean }) {
  const { note, record, previousRecord } = entry;
  const delta = record && previousRecord
    ? Math.round((record.winRate - previousRecord.winRate) * 10) / 10
    : undefined;

  return (
    <article
      aria-current={focused ? "page" : undefined}
      className={`${record ? "yoro-pn-row is-played" : "yoro-pn-row"}${focused ? " is-focused" : ""}`}
      data-patch-version={note.patchVersion}
    >
      {record ? <span className="yoro-u-sr-only">{t().patchNotesPlayedMark}</span> : null}
      <p className="yoro-pn-row-num">
        <a className="yoro-pn-link" href={riotLocaleUrl(note.url)} rel="noopener noreferrer" target="_blank">
          {note.patchVersion ?? "—"}
          <span className="yoro-u-sr-only">{` ${note.title} — ${t().patchNotesNewTab}`}</span>
        </a>
      </p>
      <p className="yoro-pn-row-when">
        <time dateTime={note.publishedAt}>{formatMonthDay(note.publishedAt)}</time>
      </p>
      <p
        className="yoro-pn-row-delta"
        data-tone={delta === undefined || delta === 0 ? undefined : delta > 0 ? "good" : "bad"}
      >
        {delta === undefined ? "—" : signed(delta)}
      </p>
    </article>
  );
}

export function PublicPatchNotesPage({ locale }: { locale: string }) {
  /* Riot 의 ko-kr·ja-jp 목록은 서로 다른 문서입니다. 언어가 바뀌면 다시 받아야 합니다. */
  const feedLocale = patchNoteLocale(locale);
  const [state, setState] = useState<LoadState>("loading");
  const [feed, setFeed] = useState<PatchNotesFeed>();
  const [error, setError] = useState("");
  const [focusedPatchVersion] = useState(() => patchNotesDetailFromPath(window.location.pathname));
  /* 상세 URL은 새 화면을 만들지 않고 기존 검색 필터로 해당 패치 한 건을 드러냅니다. */
  const [query, setQuery] = useState(() => focusedPatchVersion ?? "");
  const [filter, setFilter] = useState<PatchNotesFilter>("all");
  /* 이 화면은 저장소를 읽기만 합니다. 아무것도 새로 저장하지 않습니다. */
  const [storedTargetList] = useState<PatchNoteTarget[]>(() => storedTargets());
  /* 모듈 입력으로 조회한 소환사는 이 세션에서만 앞에 붙습니다(저장 안 함). */
  const [manualTargets, setManualTargets] = useState<PatchNoteTarget[]>([]);
  const targets = useMemo(
    () => [...manualTargets, ...storedTargetList].slice(0, 8),
    [manualTargets, storedTargetList],
  );
  /* null = 해제(개인 전적 미표시). 최근 검색이 있으면 첫 항목을 기본 표시합니다. */
  const [targetIndex, setTargetIndex] = useState<number | null>(
    () => (storedTargets().length > 0 ? 0 : null),
  );
  const [mineState, setMineState] = useState<MineState>("idle");
  const [mine, setMine] = useState<PatchPlaySummary>();
  const [mineError, setMineError] = useState("");
  /* 다시 시도는 같은 소환사를 다시 받는 것이므로 시도 횟수를 effect 의 열쇠로 씁니다. */
  const [mineAttempt, setMineAttempt] = useState(0);
  /* 패치 변경 요약(2026-08-18) — 최신 패치 하나만 받습니다. 서버가 아직 이 계약을
     구현하지 않은 배포에서는 undefined 로 끝나고 패널이 통째로 숨습니다(fail-soft). */
  const [changeSummary, setChangeSummary] = useState<PatchChangeSummary | undefined>();

  function load(): AbortController {
    const controller = new AbortController();
    setState("loading");
    setError("");
    void requestPatchNotes(feedLocale, controller.signal)
      .then((nextFeed) => {
        if (controller.signal.aborted) return;
        setFeed(nextFeed);
        setState("ready");
      })
      .catch((requestError: unknown) => {
        /* abort 는 실패가 아닙니다. 이전 요청 취소로 오류 배너가 남지 않게 합니다. */
        if (controller.signal.aborted) return;
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : t().patchNotesLoadFailed);
        setState("error");
      });
    return controller;
  }

  useEffect(() => {
    const controller = load();
    return () => controller.abort();
  }, [feedLocale]);

  const target = targetIndex === null ? undefined : targets[targetIndex];

  useEffect(() => {
    if (!target) {
      setMineState("idle");
      setMine(undefined);
      setMineError("");
      return undefined;
    }
    const controller = new AbortController();
    setMineState("loading");
    setMineError("");
    setMine(undefined);
    void requestPatchPlaySummary(riotIdOf(target), target.lolPlatform, controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) return;
        setMine(summary);
        setMineState("ready");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setMineError(requestError instanceof Error ? requestError.message : t().patchNotesMineFailed);
        setMineState("error");
      });
    return () => controller.abort();
    /* 소환사가 바뀔 때만 다시 받습니다. 목록 검색은 이미 받은 값을 거를 뿐입니다. */
  }, [target?.gameName, target?.tagLine, target?.lolPlatform, mineAttempt]);

  /* 패치 노트의 Data Dragon 버전과 경기의 gameVersion 이 같은 열쇠(major.minor)를 씁니다. */
  const entries = useMemo<PatchEntry[]>(() => {
    const byPatch = new Map<string, { record: PatchPlayRecord; previous?: PatchPlayRecord }>();
    (mine?.patches ?? []).forEach((record, index) => {
      byPatch.set(record.patchKey, { record, previous: mine?.patches[index + 1] });
    });

    const notes = feed?.notes ?? [];
    return notes.map((note, index) => {
      const patchKey = patchKeyFromDataDragonVersion(note.dataDragonVersion);
      const found = patchKey ? byPatch.get(patchKey) : undefined;
      const next = notes[index + 1];
      const gapMs = next ? Date.parse(note.publishedAt) - Date.parse(next.publishedAt) : Number.NaN;
      return {
        note,
        record: found?.record,
        previousRecord: found?.previous,
        gapDays: Number.isFinite(gapMs) && gapMs > 0 ? Math.round(gapMs / 86_400_000) : undefined
      };
    });
  }, [feed, mine]);

  /* 막대 폭의 기준선 — 이 소환사가 가장 많이 플레이한 패치의 판수입니다.
     절대 기준(예: 20판)을 쓰면 판수가 적은 사용자는 막대가 늘 뭉개집니다. */
  const maxGames = useMemo(
    () => (mine?.patches ?? []).reduce((most, record) => Math.max(most, record.games), 0),
    [mine]
  );

  const trimmedQuery = query.trim();

  /* 빠른 필터 칩은 전체·내가 플레이한 둘만 — 시즌은 아래 셀렉트가 전부 맡습니다
     (사용성 §2-2: 칩 .slice(0,2) 로는 시즌 13·14 의 43개 패치에 도달할 수 없었음). */
  const filterOptions = useMemo<PatchNotesFilterOption[]>(() => {
    const options: PatchNotesFilterOption[] = [
      { value: "all", label: t().patchNotesFilterAll, count: entries.length }
    ];
    const played = entries.filter((entry) => entry.record).length;
    if (played > 0) {
      options.push({ value: "played", label: t().patchNotesFilterPlayed, count: played });
    }
    return options;
  }, [entries]);

  /* 시즌 셀렉트 — 데이터에 있는 모든 시즌(최신순). 시즌이 몇 개든 한 그릇입니다. */
  const seasonOptions = useMemo(() => {
    const seasons = new Map<string, number>();
    for (const entry of entries) {
      const season = seasonOf(entry.note);
      if (season) seasons.set(season, (seasons.get(season) ?? 0) + 1);
    }
    return [...seasons.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([season, count]) => ({ season, count }));
  }, [entries]);

  /* 고른 필터가 사라지면(소환사를 바꿔 기록이 없어지는 등) 전체로 되돌립니다.
     셀렉트의 시즌 값도 유효 목록에 포함합니다 — 빼먹으면 시즌을 고르는 순간
     이 가드가 전체로 되돌립니다(사용성 §2-2-5). */
  useEffect(() => {
    const valid = filterOptions.some((option) => option.value === filter)
      || seasonOptions.some((option) => `season:${option.season}` === filter);
    if (!valid) setFilter("all");
  }, [filterOptions, seasonOptions, filter]);

  const visibleEntries = useMemo(() => {
    const normalized = trimmedQuery.toLocaleLowerCase(localeTag());
    return entries.filter((entry) => {
      if (filter === "played" && !entry.record) return false;
      if (filter.startsWith("season:") && seasonOf(entry.note) !== filter.slice("season:".length)) return false;
      if (!normalized) return true;
      return [entry.note.title, entry.note.summary, entry.note.patchVersion]
        .some((value) => value?.toLocaleLowerCase(localeTag()).includes(normalized));
    });
  }, [entries, trimmedQuery, filter]);

  useEffect(() => {
    if (!focusedPatchVersion || state !== "ready" || visibleEntries.length === 0) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(
        `[data-patch-version="${focusedPatchVersion}"]`
      )?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedPatchVersion, state, visibleEntries]);

  /* 좁히는 조작을 하면 히어로·타일을 접고 결과만 한 줄로 보여 줍니다. */
  const searching = trimmedQuery.length > 0 || filter !== "all";
  const hero = searching ? undefined : visibleEntries[0];
  /* 요약은 최신 패치 하나만 받습니다 — 목록의 모든 패치를 계산시키면 서버 비용이
     패치 수만큼 늘고, 화면도 히어로 아래 한 곳에서만 씁니다. */
  const latestPatchVersion = entries[0]?.note.patchVersion;

  useEffect(() => {
    if (!latestPatchVersion) {
      setChangeSummary(undefined);
      return undefined;
    }
    const controller = new AbortController();
    void requestPatchChangeSummary(latestPatchVersion, feedLocale, controller.signal)
      .then((summary) => {
        if (!controller.signal.aborted) setChangeSummary(summary);
      })
      .catch(() => {
        /* 취소 외 오류는 이미 undefined 로 닫혀 옵니다. 화면은 패널만 숨깁니다. */
      });
    return () => controller.abort();
  }, [latestPatchVersion, feedLocale]);
  const tiles = searching ? [] : visibleEntries.slice(1, 1 + FEATURED_TILE_COUNT);
  const archive = searching ? visibleEntries : visibleEntries.slice(1 + FEATURED_TILE_COUNT);

  /* 시즌 접기(사용성 §2-1) — 54행 2,770px 통짜 목록의 수정점. 현재 시즌만 펼치고
     나머지는 44px 한 줄로 접습니다. 검색 중에는 접지 않습니다(평면 목록 유지). */
  const seasonGroups = useMemo(() => {
    const groups: Array<{ season: string | undefined; entries: PatchEntry[] }> = [];
    for (const entry of archive) {
      const season = seasonOf(entry.note);
      const last = groups[groups.length - 1];
      if (last && last.season === season) last.entries.push(entry);
      else groups.push({ season, entries: [entry] });
    }
    return groups;
  }, [archive]);
  /* season → 열림 여부. 기록이 없으면 첫 그룹(현재 시즌)만 기본 열림. */
  const [seasonToggles, setSeasonToggles] = useState<Record<string, boolean>>({});
  /* season → 4행 제한 해제 여부(「모두 보기」). */
  const [seasonShowAll, setSeasonShowAll] = useState<Record<string, boolean>>({});

  /* 펼친 시즌도 처음에는 4행만 — 목업 사이드바가 4행인 이유(§2-1-3). */
  const INITIAL_SEASON_ROWS = 4;

  /* 시즌이 바뀌는 첫 줄에만 머리글을 답니다. */
  const seasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const season = seasonOf(entry.note);
      if (season) counts.set(season, (counts.get(season) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  return (
    <section aria-labelledby="public-patch-notes-title" className="yoro-pn-page">
      {/* 페이지 머리 — 노리개 + 명조 제목 + 붓 밑줄(목업 LolPatchNotes · 리스킨 §3-4).
          공유 PageHeader 클래스를 재스타일하면 다른 페이지가 함께 바뀌므로 전용 마크업. */}
      <header className="yoro-pn-head">
        <NorigaeMark className="yoro-pn-head-norigae" height={34} width={16} />
        <div className="yoro-pn-head-copy">
          <p className="yoro-pn-head-eyebrow">{t().patchNotesEyebrow}</p>
          <h1 className="yoro-pn-head-title" id="public-patch-notes-title">
            <span className="yoro-pn-head-title-word">
              {t().patchNotesTitle}
              <TailUnderline className="yoro-pn-head-tail" height={9} width={96} />
            </span>
          </h1>
          <p className="yoro-pn-head-desc">{t().patchNotesDescription}</p>
        </div>
        {feed ? (
          <div className="yoro-pn-head-status">
            <Badge tone={feed.stale ? "warning" : "success"}>
              {feed.stale ? t().patchNotesStale : t().patchNotesFresh}
            </Badge>
            <span className="yoro-pn-updated">
              {`${t().patchNotesUpdated} ${formatFetchedAt(feed.fetchedAt)}`}
            </span>
          </div>
        ) : null}
      </header>

      {state === "loading" ? (
        <div aria-busy="true" aria-label={t().patchNotesLoading} className="yoro-pn-loading" role="status">
          <SkeletonCard loadingLabel={t().patchNotesLoading} />
          <SkeletonCard loadingLabel={t().patchNotesLoading} />
        </div>
      ) : null}

      {state === "error" ? (
        <EmptyState as="div" role="alert" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h2">{t().patchNotesLoadFailed}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={() => load()} type="button" variant="secondary">{t().patchNotesRetry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {state === "ready" && feed ? (
        <>
          {/* 저장본을 보여 주는 중이라는 사실을 배지 하나로 끝내지 않습니다. */}
          {feed.stale ? (
            <p className="yoro-pn-stale" role="status">{t().patchNotesStaleDescription}</p>
          ) : null}

          {/* 개인 전적은 전용 모듈, 검색·칩은 목록 소속 필터 바 — 역할 분리(목업 §②). */}
          {feed.notes.length > 0 ? (
            <>
              <PatchNotesMineModule
                mineError={mineError}
                mineState={mineState}
                onDismiss={() => setTargetIndex(null)}
                onManualTarget={(manual) => {
                  setManualTargets((current) => [
                    manual,
                    ...current.filter((item) => targetKey(item) !== targetKey(manual))
                  ]);
                  setTargetIndex(0);
                }}
                onRetryMine={() => setMineAttempt((current) => current + 1)}
                onTargetIndex={setTargetIndex}
                sampledMatches={mine?.sampledMatches}
                target={target}
                targetIndex={targetIndex}
                targets={targets}
              />
              {target && mineState === "ready" && mine?.patches.length
                ? <WinRateTrend records={mine.patches} />
                : null}
              <PatchNotesControlBar
                filter={filter}
                filterOptions={filterOptions}
                onFilter={setFilter}
                onQuery={setQuery}
                query={query}
                resultCount={visibleEntries.length}
                seasonOptions={seasonOptions}
              />
            </>
          ) : null}

          {feed.notes.length === 0 ? (
            <EmptyState as="div" variant="default">
              <EmptyStateIcon aria-hidden="true">◇</EmptyStateIcon>
              <EmptyStateTitle as="h2">{t().patchNotesEmpty}</EmptyStateTitle>
              <EmptyStateDescription>{t().patchNotesEmptyDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          <div aria-live="polite" className="yoro-pn-stage">
            <div className="yoro-pn-main">
            {hero ? <HeroCard entry={hero} key={hero.note.slug} maxGames={maxGames} /> : null}

            {/* 변경 요약은 히어로(최신 패치) 바로 아래에만 붙습니다. 요약이 없거나
                검색 중이거나 히어로가 그 패치가 아니면 그리지 않습니다(목업 §⑤). */}
            {hero && changeSummary && hero.note.patchVersion === changeSummary.patchVersion ? (
              <PatchChangeSummaryPanel
                note={hero.note}
                summary={changeSummary}
                {...(hero.record ? { record: hero.record } : {})}
                {...(hero.previousRecord ? { previousRecord: hero.previousRecord } : {})}
              />
            ) : null}

            {tiles.length > 0 ? (
              <div className="yoro-pn-tiles">
                {tiles.map((entry) => <FeaturedTile entry={entry} key={entry.note.slug} />)}
              </div>
            ) : null}

            </div>

            {/* 사이드바(300px) — 아카이브 줄과 출처를 오른쪽 열로(목업 사이드바 §3-5).
                같은 데이터를 옆으로 옮겼을 뿐 새 데이터가 아닙니다. 좁은 폭에서는
                본문 아래로 흐릅니다(§4). */}
            <aside className="yoro-pn-side">
            {archive.length > 0 ? (
              <div className="yoro-pn-archive">
                {searching ? null : <p className="yoro-pn-archive-title">{t().patchNotesArchiveTitle}</p>}
                {searching ? (
                  /* 검색 중에는 접지 않습니다 — 평면 결과 목록, 시즌 머리글 없음(§2-1). */
                  <div className="yoro-pn-list">
                    {archive.map((entry) => (
                      <div className="yoro-pn-group" key={entry.note.slug}>
                        <ArchiveRow entry={entry} focused={entry.note.patchVersion === focusedPatchVersion} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="yoro-pn-list">
                    {seasonGroups.map((group, groupIndex) => {
                      const season = group.season;
                      /* 시즌을 못 읽은 노트는 접을 단위가 없어 그대로 폅니다. */
                      const open = season === undefined
                        ? true
                        : seasonToggles[season] ?? groupIndex === 0;
                      const showAll = season === undefined ? true : seasonShowAll[season] ?? false;
                      const rows = showAll ? group.entries : group.entries.slice(0, INITIAL_SEASON_ROWS);
                      const hiddenCount = group.entries.length - rows.length;
                      const seasonLabel = season === undefined
                        ? ""
                        : t().patchNotesSeason.replace("{season}", season);
                      return (
                        <section className="yoro-pn-group" key={season ?? `no-season-${groupIndex}`}>
                          {season === undefined ? null : (
                            <button
                              aria-expanded={open}
                              className="yoro-pn-season-toggle"
                              onClick={() => setSeasonToggles((current) => ({ ...current, [season]: !open }))}
                              type="button"
                            >
                              <svg
                                aria-hidden="true"
                                className="yoro-pn-season-caret"
                                data-open={open ? "true" : undefined}
                                fill="none"
                                height="10"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                viewBox="0 0 10 10"
                                width="10"
                              >
                                <path d="M3 1.5 L 7.5 5 L 3 8.5" />
                              </svg>
                              <b>{seasonLabel}</b>
                              <small>
                                {t().patchNotesSeasonCount.replace("{count}", String(seasonCounts.get(season) ?? group.entries.length))}
                              </small>
                            </button>
                          )}
                          {open ? rows.map((entry) => (
                            <ArchiveRow
                              entry={entry}
                              focused={entry.note.patchVersion === focusedPatchVersion}
                              key={entry.note.slug}
                            />
                          )) : null}
                          {open && hiddenCount > 0 && season !== undefined ? (
                            <button
                              className="yoro-pn-season-more"
                              onClick={() => setSeasonShowAll((current) => ({ ...current, [season]: true }))}
                              type="button"
                            >
                              {/* 새 i18n 키 없이 기존 키 조합 — "시즌 26 · 16개 패치 더보기" */}
                              {`${seasonLabel} · ${t().patchNotesSeasonCount.replace("{count}", String(group.entries.length))} ${t().loadMoreMatches}`}
                            </button>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            {/* 출처를 숨기지 않습니다 — 사이드바 카드로 항상 둡니다. */}
            <p className="yoro-pn-attribution">{t().patchNotesAttribution}</p>
            </aside>
          </div>

          {feed.notes.length > 0 && visibleEntries.length === 0 ? (
            <EmptyState as="div" variant="search">
              <EmptyStateTitle as="h2">{t().patchNotesNoResults}</EmptyStateTitle>
              <EmptyStateDescription>{t().patchNotesNoResultsDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}

        </>
      ) : null}
    </section>
  );
}
