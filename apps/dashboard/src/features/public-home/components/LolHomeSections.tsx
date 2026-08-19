import { useEffect, useState, type FormEvent } from "react";
import type { LolPlatformId } from "@streamops/shared";
import { normalizeLolPlatformId, parseAramAugmentCatalog, type AramAugmentRarity, type PatchNotesFeed } from "@streamops/shared";
import { requestPatchNotes } from "../../public-lol/api/patch-notes";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { SearchSuggestion } from "../../public-lol/types/public-lol";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { publicSummonerPath, riotIdQuery } from "../../public-lol/utils/riot-id";
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

export function LolSubnav({ text }: { text: LolHomeText }) {
  const items: Array<{ href: string; label: string }> = [
    { href: "/follow", label: text.tabStreamers },
    { href: "/participation", label: text.tabParticipation },
    { href: "/lol/aram", label: text.tabAram },
    { href: "/patch-notes", label: text.tabPatchNotes }
  ];
  return (
    <nav aria-label={text.subnavLabel} className="yoro-lol-subnav">
      <a aria-current="page" className="yoro-lol-subnav-item is-active" href={localizedPublicUrlForCurrentLocale("/lol")}>
        {text.tabHome}
        <TailUnderline className="yoro-lol-subnav-tail" height={6} width={30} />
      </a>
      {items.map((item) => (
        <a className="yoro-lol-subnav-item" href={localizedPublicUrlForCurrentLocale(item.href)} key={item.href}>
          {item.label}
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

  useEffect(() => {
    setRecent(readRecentSearches().slice(0, 3));
    setFavorites(readFavorites().slice(0, 3));
  }, []);

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

  return (
    <section className="yoro-home-hero yoro-lol-hero">
      <HomeSignatureMark />
      <div className="yoro-home-hero-copy">
        <h1 className="yoro-home-headline">{text.heroTitle}</h1>
        <TailUnderline className="yoro-home-headline-tail" height={11} width={170} />
        <p className="yoro-home-hero-sub">{text.heroSub}</p>

        <form className="yoro-home-search" onSubmit={submit}>
          <div className="yoro-home-search-box">
            <SearchIcon />
            <input
              aria-label={homeText.tabLol}
              autoComplete="off"
              className="yoro-home-search-input"
              onChange={(event) => setQuery(event.currentTarget.value)}
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

          <SuggestionChips items={recent} label={text.recentLabel} />
          <SuggestionChips items={favorites} label={text.favoritesLabel} withStar />

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

const RARITY_ORDER: readonly AramAugmentRarity[] = ["silver", "gold", "prismatic", "legend"];

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
