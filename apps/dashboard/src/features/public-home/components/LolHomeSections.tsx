import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { LolPlatformId, LolRankedStats } from "@streamops/shared";
import { normalizeLolPlatformId, parseAramAugmentCatalog, type AramAugmentRarity, type PatchNotesFeed } from "@streamops/shared";
import { requestPatchNotes } from "../../public-lol/api/patch-notes";
import { publicI18n, type PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { SearchSuggestion } from "../../public-lol/types/public-lol";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { shortRankLabel } from "../../public-lol/utils/rank";
import { buildSuggestions, normalizeSuggestionKey, publicSummonerPath, riotIdQuery } from "../../public-lol/utils/riot-id";
import { readFavorites, readRecentSearches } from "../../public-lol/utils/storage";
import type { HomeText } from "../i18n/home-i18n";
import type { LolHomeText } from "../i18n/lol-home-i18n";
import { HomeSignatureMark, NorigaeMark, TailUnderline } from "./HomeMarks";

/* LoL 홈(/lol) 전용 섹션 — 목업 캔버스 page-2(LoL 홈) 구현.
 * 데이터는 전부 기존 계약: 최근 검색·즐겨찾기(localStorage, public-lol/utils/storage),
 * 증강 카탈로그(/api/public/aram/augments), 패치노트(/api/public/patch-notes).
 * 새 endpoint 나 mock 데이터를 만들지 않습니다. */

function fill(template: string, value: string): string {
  return template.replace("{patch}", value);
}

/* ── 2행: LoL 전용 메뉴(중앙 정렬) — 목업 v11 ─────────────── */

export type LolSubnavItem = "home" | "streamers" | "participation" | "aram" | "patchNotes";

/* 홈 항목은 LoL 홈(/lol)으로 갑니다(2026-08-20 변경 — 이전의 "메인 홈 출구" 결정을
   번복). 메인 홈(/)으로 나가는 출구는 1행 헤더의 워드마크와 "홈" 링크가 담당합니다.
   활성 표시는 시그니처 꼬리 밑줄 + aria-current. */
/* active="none" — 전적 상세처럼 2행 어디에도 속하지 않는 화면(목업: 활성 항목 없음). */
export function LolSubnav({ text, active = "home" }: { text: LolHomeText; active?: LolSubnavItem | "none" }) {
  const items: Array<{ id: LolSubnavItem; href: string; label: string; tailWidth: number }> = [
    { id: "home", href: "/lol", label: text.tabHome, tailWidth: 30 },
    { id: "streamers", href: "/follow", label: text.tabStreamers, tailWidth: 40 },
    { id: "participation", href: "/participation", label: text.tabParticipation, tailWidth: 48 },
    { id: "aram", href: "/lol/aram", label: text.tabAram, tailWidth: 48 },
    { id: "patchNotes", href: "/patch-notes", label: text.tabPatchNotes, tailWidth: 40 }
  ];
  return (
    <nav aria-label={text.subnavLabel} className="yoro-lol-subnav">
      {items.map((item) => (
        <a
          aria-current={item.id === active ? "page" : undefined}
          className={`yoro-lol-subnav-item${item.id === active ? " is-active" : ""}`}
          href={localizedPublicUrlForCurrentLocale(item.href)}
          key={item.id}
        >
          {item.label}
          {item.id === active ? <TailUnderline className="yoro-lol-subnav-tail" height={6} width={item.tailWidth} /> : null}
        </a>
      ))}
    </nav>
  );
}

/* ── 히어로: LoL 단일 검색 + 최근 검색·즐겨찾기 ───────────── */

const SERVER_OPTIONS: ReadonlyArray<{ id: LolPlatformId; code: string; defaultTag: string }> = [
  { id: "kr", code: "KR", defaultTag: "KR1" },
  { id: "jp1", code: "JP", defaultTag: "JP1" },
  { id: "na1", code: "NA", defaultTag: "NA1" },
  { id: "euw1", code: "EUW", defaultTag: "EUW1" }
];

function defaultServerForLocale(locale: PublicLocale): LolPlatformId {
  if (locale === "ja") return "jp1";
  if (locale === "en") return "na1";
  return "kr";
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="17">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L 14 14" />
    </svg>
  );
}

function FavStarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="13">
      <path d="M8 1.8 L 9.9 5.9 14.3 6.4 11 9.4 11.9 13.8 8 11.6 4.1 13.8 5 9.4 1.7 6.4 6.1 5.9 Z" />
    </svg>
  );
}

/* 홈 모듈은 same-origin 상대경로 관례(HomeSections 의 fetch 와 동일) —
   api/client(apiBase)는 import.meta.env 를 만져 SSR 테스트에서 못 씁니다. */
function suggestionAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url;
}

async function fetchHomeSuggestions(query: string, signal: AbortSignal, platform: LolPlatformId): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ q: query, platform });
  const response = await fetch(`/api/lol/suggestions?${params.toString()}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal
  });
  if (!response.ok) return [];
  const body = await response.json() as { suggestions?: SearchSuggestion[] };
  return Array.isArray(body.suggestions) ? body.suggestions : [];
}

/* SearchForm 연관 패널과 같은 티어 표기(Platinum II 등) — 문구는 데이터 표기라 로케일 무관. */
function suggestionTierLabel(stats: LolRankedStats | undefined, fallbackLabel: string): string {
  if (!stats) return fallbackLabel;
  if (stats.tier === "UNRANKED") return "Unranked";
  const tierLabel = stats.tier
    .toLocaleLowerCase()
    .replace(/(^|_)([a-z])/g, (_, separator: string, letter: string) => `${separator ? " " : ""}${letter.toLocaleUpperCase()}`);
  return `${tierLabel}${stats.rank ? ` ${stats.rank}` : ""}`.trim();
}

function TierCrestFallbackIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.1" viewBox="0 0 20 22" width="18">
      <path d="M10 1.5 L18.5 6.5 V15.5 L10 20.5 L1.5 15.5 V6.5 Z" />
      <path d="M10 6 L14.5 8.7 V13.3 L10 16 L5.5 13.3 V8.7 Z" opacity=".55" />
    </svg>
  );
}

function suggestionHref(item: SearchSuggestion): string {
  return localizedPublicUrlForCurrentLocale(
    publicSummonerPath(`${item.gameName}#${item.tagLine}`, normalizeLolPlatformId(item.lolPlatform))
  );
}

function SuggestionChips({ label, items, withStar }: {
  label: string;
  items: SearchSuggestion[];
  withStar?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="yoro-lol-recent-row">
      <span className="yoro-lol-recent-label">{label}</span>
      <div className="yoro-lol-recent-chips">
        {items.map((item) => (
          <a className="yoro-lol-recent-chip" href={suggestionHref(item)} key={`${item.gameName}#${item.tagLine}`}>
            {withStar ? <FavStarIcon /> : null}
            {item.gameName}
            <span className="yoro-lol-recent-tag">#{item.tagLine}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function LolHomeHero({ text, homeText, locale }: {
  text: LolHomeText;
  homeText: HomeText;
  locale: PublicLocale;
}) {
  const [query, setQuery] = useState("");
  const [server, setServer] = useState<LolPlatformId>(() => defaultServerForLocale(locale));
  /* localStorage 는 렌더 밖 세상이라 마운트 후 한 번 읽습니다(SSR·테스트 안전). */
  const [recent, setRecent] = useState<SearchSuggestion[]>([]);
  const [favorites, setFavorites] = useState<SearchSuggestion[]>([]);
  /* 연관 검색 패널 — 전적 상단바 검색과 같은 계약(원격 /api/lol/suggestions +
     저장 목록 병합, 250ms 디바운스·중단). 화면 문구는 기존 publicI18n 키 재사용. */
  const [panelOpen, setPanelOpen] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const panelText = publicI18n[locale];
  const trimmedQuery = query.trim();

  useEffect(() => {
    setRecent(readRecentSearches().slice(0, 5));
    setFavorites(readFavorites().slice(0, 5));
  }, []);

  const storedSuggestions = useMemo(() => {
    const unique = new Map<string, SearchSuggestion>();
    for (const suggestion of [...favorites, ...recent]) {
      const key = normalizeSuggestionKey(suggestion);
      if (!unique.has(key)) unique.set(key, suggestion);
    }
    return [...unique.values()];
  }, [favorites, recent]);

  const liveSuggestions = useMemo(
    () => (trimmedQuery ? buildSuggestions(query, storedSuggestions, remoteSuggestions, server).slice(0, 6) : []),
    [trimmedQuery, query, storedSuggestions, remoteSuggestions, server]
  );

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setRemoteSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchHomeSuggestions(trimmedQuery, controller.signal, server)
        .then(setRemoteSuggestions)
        .catch((suggestionError) => {
          if (suggestionError instanceof DOMException && suggestionError.name === "AbortError") return;
          setRemoteSuggestions([]);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, server]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    function handlePointerDown(event: PointerEvent): void {
      if (searchWrapRef.current && event.target instanceof Node && !searchWrapRef.current.contains(event.target)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [panelOpen]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const option = SERVER_OPTIONS.find((candidate) => candidate.id === server) ?? SERVER_OPTIONS[0]!;
    const withTag = riotIdQuery(value, option.id).includes("#")
      ? riotIdQuery(value, option.id)
      : `${value.replace(/\s+/g, " ")}#${option.defaultTag}`;
    window.location.assign(localizedPublicUrlForCurrentLocale(publicSummonerPath(withTag, option.id)));
  }

  const favoriteKeys = useMemo(() => new Set(favorites.map(normalizeSuggestionKey)), [favorites]);

  const renderSuggestionRow = (item: SearchSuggestion) => {
    const rankedStats = item.rankedStats;
    const tierIconUrl = suggestionAssetUrl(rankedStats?.tierIconUrl);
    const tierLabel = suggestionTierLabel(rankedStats, shortRankLabel(rankedStats, "—"));
    const lpLabel = rankedStats && rankedStats.tier !== "UNRANKED" ? `${rankedStats.leaguePoints}LP` : undefined;
    const starred = favoriteKeys.has(normalizeSuggestionKey(item));
    return (
      <button
        key={`${item.lolPlatform ?? server}:${item.gameName}#${item.tagLine}`}
        onClick={() => window.location.assign(suggestionHref(item))}
        role="option"
        type="button"
      >
        <span className="yoro-lol-suggest-avatar" aria-hidden="true">
          {item.profileIconUrl ? (
            /* 패널은 열릴 때만 마운트되고 행이 6개뿐이라 lazy 이점이 없습니다.
               일부 응답의 아바타 경로(/cdn/…)는 서버에 없어 404 — 깨진 그림 대신
               이니셜 폴백으로 떨어뜨립니다. */
            <img
              alt=""
              decoding="async"
              onError={(event) => {
                event.currentTarget.hidden = true;
                event.currentTarget.parentElement?.append(item.gameName.slice(0, 1).toUpperCase());
              }}
              src={suggestionAssetUrl(item.profileIconUrl)}
            />
          ) : item.gameName.slice(0, 1).toUpperCase()}
        </span>
        <span className="yoro-lol-suggest-tier" aria-hidden="true">
          {tierIconUrl ? <img alt="" decoding="async" src={tierIconUrl} /> : <TierCrestFallbackIcon />}
        </span>
        <span className="yoro-lol-suggest-name">
          <span>{item.gameName}</span>
          <strong>#{item.tagLine}</strong>
        </span>
        <span className="yoro-lol-suggest-rank">
          <span>{tierLabel}</span>
          {lpLabel ? <small>{lpLabel}</small> : null}
        </span>
        {starred ? <span aria-hidden="true" className="yoro-lol-suggest-star"><FavStarIcon /></span> : null}
      </button>
    );
  };

  /* 타이핑 중에는 연관 목록, 빈 입력 포커스에는 즐겨찾기·최근 — 전적 상단바 패널과
     같은 진입 문법을 히어로 한 상자에 눌러 담습니다(탭 대신 소제목 두 줄). */
  const idleFavorites = favorites.slice(0, 5);
  const idleRecent = recent.filter((item) => !favoriteKeys.has(normalizeSuggestionKey(item))).slice(0, 5);
  const panelBody = trimmedQuery
    ? (liveSuggestions.length > 0 ? (
      <div className="yoro-lol-suggest-list" role="listbox" aria-label={panelText.relatedSummoners}>
        {liveSuggestions.map(renderSuggestionRow)}
      </div>
    ) : null)
    : (idleFavorites.length > 0 || idleRecent.length > 0 ? (
      <div className="yoro-lol-suggest-list" role="listbox" aria-label={panelText.relatedSummoners}>
        {idleFavorites.length > 0 ? <div className="yoro-lol-suggest-title">{panelText.favoritesTitle}</div> : null}
        {idleFavorites.map(renderSuggestionRow)}
        {idleRecent.length > 0 ? <div className="yoro-lol-suggest-title">{panelText.recentSearch}</div> : null}
        {idleRecent.map(renderSuggestionRow)}
      </div>
    ) : null);

  return (
    <section className="yoro-home-hero yoro-lol-hero">
      <HomeSignatureMark />
      <div className="yoro-home-hero-copy">
        <h1 className="yoro-home-headline">{text.heroTitle}</h1>
        <TailUnderline className="yoro-home-headline-tail" height={11} width={170} />
        <p className="yoro-home-hero-sub">{text.heroSub}</p>

        <form className="yoro-home-search" onSubmit={submit}>
          <div className="yoro-lol-searchwrap" ref={searchWrapRef}>
          <div className="yoro-home-search-box">
            <SearchIcon />
            <input
              aria-expanded={panelOpen && panelBody !== null}
              aria-label={homeText.tabLol}
              autoComplete="off"
              className="yoro-home-search-input"
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setPanelOpen(true);
              }}
              onFocus={() => setPanelOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setPanelOpen(false);
              }}
              placeholder={homeText.searchPlaceholderLol}
              value={query}
            />
            <label className="yoro-home-server">
              <span className="yoro-home-visually-hidden">{homeText.serverLabel}</span>
              <select
                className="yoro-home-server-select"
                onChange={(event) => setServer(event.currentTarget.value as LolPlatformId)}
                value={server}
              >
                {SERVER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.code}</option>
                ))}
              </select>
              <svg aria-hidden="true" className="yoro-home-server-caret" fill="none" height="5" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="8">
                <path d="M1 1 L 4 4 L 7 1" />
              </svg>
            </label>
            <button className="yoro-home-search-submit" type="submit">{homeText.searchLabel}</button>
          </div>
          {panelOpen && panelBody ? <div className="yoro-lol-suggest">{panelBody}</div> : null}
          </div>

          <SuggestionChips items={recent.slice(0, 3)} label={text.recentLabel} />
          <SuggestionChips items={favorites.slice(0, 3)} label={text.favoritesLabel} withStar />

          <div className="yoro-home-chips">
            <a className="yoro-home-chip" href={localizedPublicUrlForCurrentLocale("/lol/aram")}>
              {text.chipAram} <span aria-hidden="true">&#8594;</span>
            </a>
            <a className="yoro-home-chip yoro-home-chip--desktop" href={localizedPublicUrlForCurrentLocale("/patch-notes")}>
              {text.chipPatchNotes} <span aria-hidden="true">&#8594;</span>
            </a>
            <a className="yoro-home-chip" href={localizedPublicUrlForCurrentLocale("/participation")}>
              {text.chipParticipation} <span aria-hidden="true">&#8594;</span>
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ── LoL 데이터: 증강 칼바람 + 패치노트 ───────────────────── */

/* 상위 등급부터 — 차트 규칙 "밝을수록 상위 등급"(다크 기준). 루트 홈 카드와 같은
   순서·같은 램프 방향이어야 두 화면이 어긋나지 않습니다. */
const RARITY_ORDER: readonly AramAugmentRarity[] = ["legend", "prismatic", "gold", "silver"];

function rarityText(text: HomeText, rarity: AramAugmentRarity): string {
  if (rarity === "silver") return text.raritySilver;
  if (rarity === "gold") return text.rarityGold;
  if (rarity === "prismatic") return text.rarityPrismatic;
  return text.rarityLegend;
}

function AramStarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="m13 3 2.2 5.1L21 9.3l-4 3.9.9 5.8-4.9-2.7-4.9 2.7.9-5.8-4-3.9 5.8-1.2L13 3Z" />
    </svg>
  );
}

function PatchDocIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="M7 3 h9 l4 4 v16 H7 Z" />
      <path d="M15 3 v5 h5" />
      <path d="M10 13 h7 M10 17 h5" />
    </svg>
  );
}

export function LolDataSection({ text, homeText, locale }: {
  text: LolHomeText;
  homeText: HomeText;
  locale: PublicLocale;
}) {
  const [rarityCounts, setRarityCounts] = useState<Array<{ rarity: AramAugmentRarity; count: number }> | null>(null);
  const [patchFeed, setPatchFeed] = useState<PatchNotesFeed | null>(null);

  /* 실패 시 해당 블록만 조용히 생략합니다 — 홈의 핵심(검색)은 데이터 없이도 동작. */
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/public/aram/augments", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        if (!response.ok) return;
        const catalog = parseAramAugmentCatalog(await response.json());
        if (!catalog || catalog.augments.length === 0) return;
        const counts = new Map<AramAugmentRarity, number>();
        for (const augment of catalog.augments) {
          counts.set(augment.rarity, (counts.get(augment.rarity) ?? 0) + 1);
        }
        const data = RARITY_ORDER
          .map((rarity) => ({ rarity, count: counts.get(rarity) ?? 0 }))
          .filter((entry) => entry.count > 0);
        if (data.length > 0) setRarityCounts(data);
      } catch {
        /* 차트 생략 */
      }
    })();
    void (async () => {
      try {
        setPatchFeed(await requestPatchNotes(locale === "ja" ? "ja" : "ko", controller.signal));
      } catch {
        /* 패치 행 생략 — 전체 패치노트 링크는 항상 남습니다. */
      }
    })();
    return () => controller.abort();
  }, [locale]);

  const max = Math.max(...(rarityCounts ?? []).map((entry) => entry.count), 1);
  const latestPatch = patchFeed?.notes.find((note) => note.patchVersion)?.patchVersion;
  const patchRows = (patchFeed?.notes ?? [])
    .filter((note) => note.patchVersion)
    .slice(0, 2);
  const patchHref = localizedPublicUrlForCurrentLocale("/patch-notes");

  return (
    <section className="yoro-home-section">
      <div className="yoro-home-section-head">
        <NorigaeMark className="yoro-home-section-norigae" height={28} width={14} />
        <h2 className="yoro-home-section-title">{text.dataTitle}</h2>
      </div>
      <div className="yoro-lol-data-cards">
        <div className="yoro-home-game-card yoro-lol-data-card--aram">
          <div className="yoro-home-game-card-head">
            <AramStarIcon />
            <span className="yoro-home-game-card-name">{text.aramCardName}</span>
            {latestPatch ? <span className="yoro-lol-patch-badge">{fill(text.aramPatchBadge, latestPatch)}</span> : null}
          </div>
          {rarityCounts ? (
            <div className="yoro-home-chart">
              <div className="yoro-home-chart-title">{text.aramChartTitle}</div>
              {rarityCounts.map((entry, index) => (
                <div className="yoro-home-bar-row" key={entry.rarity}>
                  <span className="yoro-home-bar-name">{rarityText(homeText, entry.rarity)}</span>
                  <div className="yoro-home-bar-track">
                    <div
                      className="yoro-home-bar-fill"
                      style={{
                        background: `var(--home-g${Math.min(index + 1, 4)})`,
                        width: `${Math.round(entry.count / max * 100)}%`
                      }}
                    />
                  </div>
                  <span className="yoro-home-bar-value">{entry.count.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="yoro-home-game-rows">
            <a className="yoro-home-game-row" href={localizedPublicUrlForCurrentLocale("/lol/aram")}>
              <span>{text.aramViewAll}</span>
              <span aria-hidden="true" className="yoro-home-game-row-arrow">&#8594;</span>
            </a>
          </div>
        </div>
        <div className="yoro-home-game-card">
          <div className="yoro-home-game-card-head">
            <PatchDocIcon />
            <span className="yoro-home-game-card-name">{text.patchCardName}</span>
          </div>
          <div className="yoro-home-game-rows">
            {patchRows.map((note) => (
              <a className="yoro-home-game-row" href={patchHref} key={note.slug}>
                <span>{fill(text.patchRow, note.patchVersion ?? "")}</span>
                <span aria-hidden="true" className="yoro-home-game-row-arrow">&#8594;</span>
              </a>
            ))}
            <a className="yoro-home-game-row" href={patchHref}>
              <span>{text.patchViewAll}</span>
              <span aria-hidden="true" className="yoro-home-game-row-arrow">&#8594;</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 시청자 참여 배너 ─────────────────────────────────────── */

export function LolParticipationBanner({ text }: { text: LolHomeText }) {
  return (
    <section className="yoro-home-section">
      <div className="yoro-lol-participation">
        <NorigaeMark className="yoro-home-section-norigae" height={28} width={14} />
        <div className="yoro-lol-participation-body">
          <div className="yoro-lol-participation-title">{text.participationTitle}</div>
          <div className="yoro-lol-participation-desc">{text.participationDescription}</div>
        </div>
        <a className="yoro-home-outline-button yoro-lol-participation-cta" href={localizedPublicUrlForCurrentLocale("/participation")}>
          {text.participationCta}
        </a>
      </div>
    </section>
  );
}
