import { useState, type FormEvent } from "react";
import type { LolPlatformId } from "@streamops/shared";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { publicSummonerPath, riotIdQuery } from "../../public-lol/utils/riot-id";
import type { HomeText } from "../i18n/home-i18n";
import { HomeSignatureMark, TailUnderline } from "./HomeMarks";

/* 히어로 — 목업 v8 HomeDark §2. 검색이 화면의 주인: 좌측 광폭 여백의 비대칭 축,
 * 명조 헤드라인 한 층 + 꼬리 밑줄, 우측에 YORO 시그니처 마크.
 * 검색 구역에는 애니메이션을 두지 않습니다(목업 규칙). */

type SearchTab = "lol" | "pal";

/* 홈 검색에서 고를 수 있는 서버 — 주력 시장(KR·JP) + 영어권 기본 2종.
 * 태그 미입력 시 서버별 기본 태그를 붙입니다(플레이어 관례). */
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

export function HomeHero({ text, locale }: {
  text: HomeText;
  locale: PublicLocale;
}) {
  const [tab, setTab] = useState<SearchTab>("lol");
  const [query, setQuery] = useState("");
  const [server, setServer] = useState<LolPlatformId>(() => defaultServerForLocale(locale));

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (tab === "pal") {
      const params = new URLSearchParams({ q: value });
      window.location.assign(localizedPublicUrlForCurrentLocale(`/palworld/pals?${params.toString()}`));
      return;
    }
    const option = SERVER_OPTIONS.find((candidate) => candidate.id === server) ?? SERVER_OPTIONS[0]!;
    const withTag = riotIdQuery(value, option.id).includes("#")
      ? riotIdQuery(value, option.id)
      : `${value.replace(/\s+/g, " ")}#${option.defaultTag}`;
    window.location.assign(localizedPublicUrlForCurrentLocale(publicSummonerPath(withTag, option.id)));
  }

  return (
    <section className="yoro-home-hero">
      <HomeSignatureMark />
      <div className="yoro-home-hero-copy">
        <h1 className="yoro-home-headline">{text.heroTitle}</h1>
        <TailUnderline className="yoro-home-headline-tail" height={11} width={170} />
        <p className="yoro-home-hero-sub">{text.heroSub}</p>

        <form className="yoro-home-search" onSubmit={submit}>
          <div className="yoro-home-search-tabs" role="tablist">
            <button
              aria-selected={tab === "lol"}
              className={`yoro-home-search-tab${tab === "lol" ? " is-active" : ""}`}
              onClick={() => setTab("lol")}
              role="tab"
              type="button"
            >
              {text.tabLol}
              {tab === "lol" ? <TailUnderline className="yoro-home-search-tab-tail" height={7} width={64} /> : null}
            </button>
            <button
              aria-selected={tab === "pal"}
              className={`yoro-home-search-tab${tab === "pal" ? " is-active" : ""}`}
              onClick={() => setTab("pal")}
              role="tab"
              type="button"
            >
              {text.tabPal}
              {tab === "pal" ? <TailUnderline className="yoro-home-search-tab-tail" height={7} width={64} /> : null}
            </button>
          </div>
          <div className="yoro-home-search-box">
            <SearchIcon />
            <input
              aria-label={tab === "lol" ? text.tabLol : text.tabPal}
              autoComplete="off"
              className="yoro-home-search-input"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={tab === "lol" ? text.searchPlaceholderLol : text.searchPlaceholderPal}
              value={query}
            />
            {tab === "lol" ? (
              <label className="yoro-home-server">
                <span className="yoro-home-visually-hidden">{text.serverLabel}</span>
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
            ) : null}
            <button className="yoro-home-search-submit" type="submit">{text.searchLabel}</button>
          </div>
          <div className="yoro-home-chips">
            <a className="yoro-home-chip" href={localizedPublicUrlForCurrentLocale("/palworld/breeding")}>
              {text.chipBreeding} <span aria-hidden="true">&#8594;</span>
            </a>
            <a className="yoro-home-chip" href={localizedPublicUrlForCurrentLocale("/lol/aram")}>
              {text.chipAram} <span aria-hidden="true">&#8594;</span>
            </a>
            <a className="yoro-home-chip yoro-home-chip--desktop" href={localizedPublicUrlForCurrentLocale("/patch-notes")}>
              {text.chipPatchNotes} <span aria-hidden="true">&#8594;</span>
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}
