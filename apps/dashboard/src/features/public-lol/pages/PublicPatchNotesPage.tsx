import { useEffect, useMemo, useState } from "react";
import {
  patchKeyFromDataDragonVersion,
  type PatchNote,
  type PatchNotesFeed,
  type PatchNoteLocale,
  type PatchPlayRecord,
  type PatchPlaySummary
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { PageHeader, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../../../shared/ui/PageHeader";
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
import { requestPatchNotes, requestPatchPlaySummary } from "../api/patch-notes";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import { readFavorites, readRecentSearches } from "../utils/storage";
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
  return activePublicLocale === "ja" ? "ja-JP" : "ko-KR";
}

/** 화면이 쓰는 언어를 Riot 목록의 언어 열쇠로 바꿉니다. */
function patchNoteLocale(locale: string): PatchNoteLocale {
  return locale === "ja" ? "ja" : "ko";
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

/**
 * Riot 이 썸네일에서 뽑아 준 대표 색을 CSS 로 흘려보냅니다.
 *
 * shared parser 가 `#RRGGBB` 만 통과시키므로 임의 문자열이 style 로 들어가지 않습니다.
 * 색이 없으면 아무것도 넘기지 않고 CSS 기본값을 쓰게 둡니다.
 */
function accentStyle(note: PatchNote): Record<string, string> {
  return note.accentColor ? { "--pn-k": note.accentColor } : {};
}

/** 50% 기준선이 있는 승률 게이지. 색만이 아니라 길이와 눈금으로도 읽힙니다. */
function WinRateGauge({ record, size }: { record: PatchPlayRecord; size: "hero" | "row" }) {
  return (
    <div
      className={size === "hero" ? "yoro-pn-gauge is-hero" : "yoro-pn-gauge"}
      data-tone={record.winRate >= 50 ? "good" : "bad"}
    >
      <div
        aria-label={t().patchNotesGaugeLabel.replace("{rate}", String(record.winRate))}
        className="yoro-pn-gauge-track"
        role="img"
      >
        <span className="yoro-pn-gauge-fill" style={{ width: `${record.winRate}%` }} />
        <span className="yoro-pn-gauge-mid" />
      </div>
      <b>{`${record.winRate.toFixed(1)}%`}</b>
      <span>{`${record.wins}${t().patchNotesMineWins} / ${record.games}${t().patchNotesMineGames}`}</span>
    </div>
  );
}

function HeroCard({ entry }: { entry: PatchEntry }) {
  const { note, record, previousRecord } = entry;
  const delta = record && previousRecord
    ? Math.round((record.winRate - previousRecord.winRate) * 10) / 10
    : undefined;

  return (
    <article className="yoro-pn-hero" style={accentStyle(note)}>
      {note.imageUrl ? (
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
      ) : null}
      <span aria-hidden="true" className="yoro-pn-hero-scrim" />
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
          <a className="yoro-pn-link" href={note.url} rel="noopener noreferrer" target="_blank">
            {note.title}
            <span className="yoro-u-sr-only">{` — ${t().patchNotesNewTab}`}</span>
          </a>
        </h2>
        {note.summary ? <p className="yoro-pn-hero-sum">{note.summary}</p> : null}
        {record ? (
          <div className="yoro-pn-hero-mine">
            <WinRateGauge record={record} size="hero" />
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
    <article className="yoro-pn-tile" style={accentStyle(note)}>
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
            {`${record.winRate.toFixed(1)}%`}
          </span>
        ) : null}
      </p>
      <h3 className="yoro-pn-tile-num">
        <a className="yoro-pn-link" href={note.url} rel="noopener noreferrer" target="_blank">
          {note.patchVersion ?? note.title}
          <span className="yoro-u-sr-only">{` ${note.title} — ${t().patchNotesNewTab}`}</span>
        </a>
      </h3>
      {note.summary ? <p className="yoro-pn-tile-sum">{note.summary}</p> : null}
    </article>
  );
}

function ArchiveRow({ entry }: { entry: PatchEntry }) {
  const { note, record, gapDays } = entry;

  return (
    <article className={record ? "yoro-pn-row is-played" : "yoro-pn-row"} style={accentStyle(note)}>
      <span aria-hidden="true" className="yoro-pn-node" />
      {record ? <span className="yoro-u-sr-only">{t().patchNotesPlayedMark}</span> : null}
      {note.imageUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="yoro-pn-row-art"
          decoding="async"
          height={30}
          loading="lazy"
          src={note.imageUrl}
          width={52}
        />
      ) : null}
      <p className="yoro-pn-row-num">{note.patchVersion ?? "—"}</p>
      <div className="yoro-pn-row-body">
        {/* 반복되는 원문 제목 대신 요약이 앞에 옵니다. 원문 제목은 바로 아래 남깁니다. */}
        <h3 className="yoro-pn-row-title">
          <a className="yoro-pn-link" href={note.url} rel="noopener noreferrer" target="_blank">
            {note.summary || note.title}
            <span className="yoro-u-sr-only">{` ${note.title} — ${t().patchNotesNewTab}`}</span>
          </a>
        </h3>
        <p className="yoro-pn-row-source">{note.title}</p>
      </div>
      <p className="yoro-pn-row-when">
        <time dateTime={note.publishedAt}>{formatShortDate(note.publishedAt)}</time>
        {gapDays === undefined ? null : <span>{t().patchNotesGapDays.replace("{days}", String(gapDays))}</span>}
        {note.dataDragonVersion ? <em>{note.dataDragonVersion}</em> : null}
      </p>
      {record
        ? <WinRateGauge record={record} size="row" />
        : <p className="yoro-pn-row-norate">{t().patchNotesNoRecordShort}</p>}
    </article>
  );
}

export function PublicPatchNotesPage({ locale }: { locale: string }) {
  /* Riot 의 ko-kr·ja-jp 목록은 서로 다른 문서입니다. 언어가 바뀌면 다시 받아야 합니다. */
  const feedLocale = patchNoteLocale(locale);
  const [state, setState] = useState<LoadState>("loading");
  const [feed, setFeed] = useState<PatchNotesFeed>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatchNotesFilter>("all");
  /* 이 화면은 저장소를 읽기만 합니다. 아무것도 새로 저장하지 않습니다. */
  const [targets] = useState<PatchNoteTarget[]>(() => storedTargets());
  const [targetIndex, setTargetIndex] = useState(0);
  const [mineState, setMineState] = useState<MineState>("idle");
  const [mine, setMine] = useState<PatchPlaySummary>();
  const [mineError, setMineError] = useState("");
  /* 다시 시도는 같은 소환사를 다시 받는 것이므로 시도 횟수를 effect 의 열쇠로 씁니다. */
  const [mineAttempt, setMineAttempt] = useState(0);

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

  const target = targets[targetIndex];

  useEffect(() => {
    if (!target) return undefined;
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

  const trimmedQuery = query.trim();

  /* 빠른 필터. 개수까지 함께 보여 주어야 누르기 전에 결과 규모를 압니다. */
  const filterOptions = useMemo<PatchNotesFilterOption[]>(() => {
    const options: PatchNotesFilterOption[] = [
      { value: "all", label: t().patchNotesFilterAll, count: entries.length }
    ];
    const played = entries.filter((entry) => entry.record).length;
    if (played > 0) {
      options.push({ value: "played", label: t().patchNotesFilterPlayed, count: played });
    }
    const seasons = new Map<string, number>();
    for (const entry of entries) {
      const season = seasonOf(entry.note);
      if (season) seasons.set(season, (seasons.get(season) ?? 0) + 1);
    }
    /* 시즌이 여러 개면 최근 두 개만 칩으로 냅니다. 나머지는 아카이브 머리글이 맡습니다. */
    for (const [season, count] of [...seasons.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .slice(0, 2)) {
      options.push({
        value: `season:${season}`,
        label: t().patchNotesFilterSeason.replace("{season}", season),
        count
      });
    }
    return options;
  }, [entries]);

  /* 고른 필터가 사라지면(소환사를 바꿔 기록이 없어지는 등) 전체로 되돌립니다. */
  useEffect(() => {
    if (!filterOptions.some((option) => option.value === filter)) setFilter("all");
  }, [filterOptions, filter]);

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

  /* 좁히는 조작을 하면 히어로·타일을 접고 결과만 한 줄로 보여 줍니다. */
  const searching = trimmedQuery.length > 0 || filter !== "all";
  const hero = searching ? undefined : visibleEntries[0];
  const tiles = searching ? [] : visibleEntries.slice(1, 1 + FEATURED_TILE_COUNT);
  const archive = searching ? visibleEntries : visibleEntries.slice(1 + FEATURED_TILE_COUNT);

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
      <PageHeader layout="split">
        <PageHeaderEyebrow>{t().patchNotesEyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle as="h1" id="public-patch-notes-title">{t().patchNotesTitle}</PageHeaderTitle>
        <PageHeaderDescription>{t().patchNotesDescription}</PageHeaderDescription>
        {feed ? (
          <PageHeaderStatus>
            <Badge tone={feed.stale ? "warning" : "success"}>
              {feed.stale ? t().patchNotesStale : t().patchNotesFresh}
            </Badge>
            <span className="yoro-pn-updated">
              {`${t().patchNotesUpdated} ${formatFetchedAt(feed.fetchedAt)}`}
            </span>
          </PageHeaderStatus>
        ) : null}
      </PageHeader>

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

          {/* 검색·빠른 필터·소환사를 한 줄에 둡니다. 예전에는 전폭 흰 바 두 개였습니다. */}
          {feed.notes.length > 0 ? (
            <PatchNotesControlBar
              filter={filter}
              filterOptions={filterOptions}
              mineError={mineError}
              mineState={mineState}
              onFilter={setFilter}
              onQuery={setQuery}
              onRetryMine={() => setMineAttempt((current) => current + 1)}
              onTargetIndex={setTargetIndex}
              query={query}
              resultCount={visibleEntries.length}
              sampledMatches={mine?.sampledMatches}
              targetIndex={targetIndex}
              targets={targets}
            />
          ) : null}

          {/* 검색 이력이 없으면 왜 승률이 없는지 한 번 더 말합니다. */}
          {feed.notes.length > 0 && targets.length === 0 ? (
            <p className="yoro-pn-mine-hint">
              <b>{t().patchNotesMineEmptyTitle}</b>
              <small>{t().patchNotesMineEmptyDescription}</small>
            </p>
          ) : null}

          {feed.notes.length === 0 ? (
            <EmptyState as="div" variant="default">
              <EmptyStateIcon aria-hidden="true">◇</EmptyStateIcon>
              <EmptyStateTitle as="h2">{t().patchNotesEmpty}</EmptyStateTitle>
              <EmptyStateDescription>{t().patchNotesEmptyDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          <div aria-live="polite" className="yoro-pn-stage">
            {hero ? <HeroCard entry={hero} key={hero.note.slug} /> : null}

            {tiles.length > 0 ? (
              <div className="yoro-pn-tiles">
                {tiles.map((entry) => <FeaturedTile entry={entry} key={entry.note.slug} />)}
              </div>
            ) : null}

            {archive.length > 0 ? (
              <div className="yoro-pn-archive">
                {searching ? null : <p className="yoro-pn-archive-title">{t().patchNotesArchiveTitle}</p>}
                <div className="yoro-pn-list">
                  {archive.map((entry, index) => {
                    const season = seasonOf(entry.note);
                    const previousSeason = index > 0 ? seasonOf(archive[index - 1]!.note) : undefined;
                    const showSeason = !searching && season !== undefined && season !== previousSeason;
                    return (
                      <div className="yoro-pn-group" key={entry.note.slug}>
                        {showSeason ? (
                          <p className="yoro-pn-season">
                            <b>{t().patchNotesSeason.replace("{season}", season)}</b>
                            <small>
                              {t().patchNotesSeasonCount.replace("{count}", String(seasonCounts.get(season) ?? 0))}
                            </small>
                          </p>
                        ) : null}
                        <ArchiveRow entry={entry} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {feed.notes.length > 0 && visibleEntries.length === 0 ? (
            <EmptyState as="div" variant="search">
              <EmptyStateTitle as="h2">{t().patchNotesNoResults}</EmptyStateTitle>
              <EmptyStateDescription>{t().patchNotesNoResultsDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          {/* 출처를 숨기지 않습니다. 목록 아래에 항상 둡니다. */}
          <p className="yoro-pn-attribution">{t().patchNotesAttribution}</p>
        </>
      ) : null}
    </section>
  );
}
