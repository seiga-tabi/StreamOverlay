import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import {
  PUBLIC_GAME_HOME_IMAGES,
  type PublicGameHomeImageVariant
} from "../../../shared/PublicGameHome";
import type { HomeText } from "../i18n/home-i18n";
import { TailUnderline } from "./HomeMarks";

/* 헤더 — 목업 v8 HomeDark §1. 게임 링크 나열 대신 "게임 ▾" 드롭다운 하나:
 * 게임이 늘어도 헤더 폭이 변하지 않고 패널에 행만 추가됩니다.
 * 언어는 지구본 아이콘 하나로 통합, 활성 게임 표시는 시그니처 꼬리 밑줄. */

/* 공용 상단바 규격 §3: 지구본 데스크톱·태블릿 18, 모바일 17(모바일은 CSS 로 축소). */
function GlobeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeWidth="1" viewBox="0 0 16 16" width="18">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8 L 14 8" />
      <path d="M8 2 C 5.8 4, 5.8 12, 8 14 C 10.2 12, 10.2 4, 8 2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="1" viewBox="0 0 16 16" width="16">
      <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z" />
    </svg>
  );
}

function CaretIcon({ open }: { open?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="5"
      stroke="currentColor"
      strokeWidth="1"
      style={open ? { rotate: "180deg" } : undefined}
      viewBox="0 0 8 5"
      width="8"
    >
      <path d="M1 1 L 4 4 L 7 1" />
    </svg>
  );
}

export function LolIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="M6 20 L 13 4 L 20 20" />
      <path d="M9 15 h8" />
      <path d="M4 22 h18" />
    </svg>
  );
}

export function PalIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <circle cx="13" cy="12" r="7" />
      <path d="M8 7 L 5 3" />
      <path d="M18 7 L 21 3" />
      <circle cx="10.5" cy="11" fill="currentColor" r=".8" stroke="none" />
      <circle cx="15.5" cy="11" fill="currentColor" r=".8" stroke="none" />
    </svg>
  );
}

export function ValorantIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="M4 5 L 13 21 L 22 5" />
      <path d="M9 5 L 13 12 L 17 5" />
    </svg>
  );
}

export function MinecraftIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="M5 9 L 13 4 L 21 9 L 21 18 L 13 23 L 5 18 Z" />
      <path d="M5 9 L 13 14 L 21 9" />
      <path d="M13 14 L 13 23" />
    </svg>
  );
}

function GameMenuRow({ href, icon, name, sub, active, arrow }: {
  href: string;
  icon: React.ReactNode;
  name: string;
  sub: string;
  active?: boolean;
  arrow: boolean;
}) {
  return (
    <a className="yoro-home-menu-row" href={href}>
      {icon}
      <span className="yoro-home-menu-row-body">
        <span className="yoro-home-menu-row-name">
          {name}
          {active ? <TailUnderline className="yoro-home-menu-row-tail" height={6} width={56} /> : null}
        </span>
        <span className="yoro-home-menu-row-sub">{sub}</span>
      </span>
      {arrow ? <span aria-hidden="true" className="yoro-home-menu-row-arrow">&#8594;</span> : null}
    </a>
  );
}

const LOCALE_OPTIONS: ReadonlyArray<{ locale: PublicLocale; label: string }> = [
  { locale: "ko", label: "한국어" },
  { locale: "ja", label: "日本語" },
  { locale: "en", label: "English" }
];

export type HomeActiveGame = "lol" | "palworld" | "valorant" | "minecraft";

export type HomeGameKey = "lol" | "palworld" | "valorant" | "minecraft";

/* 게임 목록의 단일 원본 — 헤더 드롭다운·모바일 게임 패널·홈 히어로 카테고리
 * 격자가 같은 데이터를 공유합니다(목업 카테고리 선택). 순서는 목업 순서.
 * art: 3:4 타일에 담을 키아트(안 A — 기존 mobile 키아트 크롭). null 이면
 * 자체 제작 마크 타일로 그립니다. 트위치 박스아트(안 B)가 들어오면 이 슬롯만
 * 갈아 끼웁니다(§handoff). */
export const HOME_GAMES: ReadonlyArray<{
  key: HomeGameKey;
  path: string;
  name: (text: HomeText) => string;
  sub: (text: HomeText) => string;
  icon: () => ReactNode;
  art: PublicGameHomeImageVariant | null;
}> = [
  {
    key: "lol",
    path: "/lol",
    name: (text) => text.gameLolName,
    sub: (text) => text.gameLolSub,
    icon: () => <LolIcon />,
    art: PUBLIC_GAME_HOME_IMAGES.lol.mobile
  },
  {
    key: "palworld",
    path: "/palworld",
    name: (text) => text.gamePalName,
    sub: (text) => text.gamePalSub,
    icon: () => <PalIcon />,
    art: PUBLIC_GAME_HOME_IMAGES.palworld.mobile
  },
  {
    key: "valorant",
    path: "/valorant",
    name: (text) => text.gameValorantName,
    sub: (text) => text.gameValorantSub,
    icon: () => <ValorantIcon />,
    art: null
  },
  {
    key: "minecraft",
    path: "/minecraft",
    name: (text) => text.gameMinecraftName,
    sub: (text) => text.gameMinecraftSub,
    icon: () => <MinecraftIcon />,
    art: null
  }
];

/* 게임 메뉴 행 목록 — 헤더 드롭다운과 모바일 하단 탭바의 게임 패널이 같은 데이터를
 * 공유합니다. 활성 게임(현재 게임 홈)은 시그니처 꼬리 밑줄로 표시합니다. */
export function HomeGamesMenuRows({ text, activeGame }: { text: HomeText; activeGame?: HomeActiveGame }) {
  return (
    <>
      {HOME_GAMES.map((game) => (
        <GameMenuRow
          active={activeGame === game.key}
          arrow
          href={localizedPublicUrlForCurrentLocale(game.path)}
          icon={game.icon()}
          key={game.key}
          name={game.name(text)}
          sub={game.sub(text)}
        />
      ))}
    </>
  );
}

export function HomeHeader({ text, locale, onLocale, onToggleTheme, accountName, connected, onLoginOpen, onLogout, onDashboard, activeGame, searchSlot }: {
  text: HomeText;
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  onToggleTheme: () => void;
  accountName?: string;
  connected: boolean;
  onLoginOpen: () => void;
  onLogout: () => void;
  onDashboard: () => void;
  /* 게임 홈(예: /lol)에서는 게임 트리거가 현재 게임 이름 + 꼬리 밑줄로 바뀝니다(목업 v9). */
  activeGame?: HomeActiveGame;
  /* 전적 상세 헤더의 컴팩트 검색바(목업 v26) — 우측 묶음 맨 앞에 놓입니다. */
  searchSlot?: ReactNode;
}) {
  const [openMenu, setOpenMenu] = useState<"games" | "lang" | "account" | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  /* 바깥 클릭·Escape 로 드롭다운을 닫습니다 — 홈은 전역 keydown 을 삼키지 않고
     열려 있을 때만 반응합니다. */
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const toggle = (menu: "games" | "lang" | "account") => {
    setOpenMenu((current) => current === menu ? null : menu);
  };

  return (
    <header className="yoro-home-header" ref={rootRef}>
      <a className="yoro-home-wordmark" href={localizedPublicUrlForCurrentLocale("/")}>
        YORO<span>.GG</span>
      </a>
      <nav aria-label={text.gameMenuLabel} className="yoro-home-nav">
        <a
          aria-current={activeGame ? undefined : "page"}
          className={activeGame ? "yoro-home-nav-link" : "yoro-home-nav-home"}
          href={localizedPublicUrlForCurrentLocale("/")}
        >
          {text.navHome}
        </a>
        <div className="yoro-home-menu-wrap">
          <button
            aria-expanded={openMenu === "games"}
            aria-haspopup="menu"
            className="yoro-home-games-trigger"
            onClick={() => toggle("games")}
            type="button"
          >
            {activeGame ? (
              <span className="yoro-home-games-trigger-name">
                {HOME_GAMES.find((game) => game.key === activeGame)?.name(text) ?? text.navGames}
                <TailUnderline className="yoro-home-games-trigger-tail" height={6} width={56} />
              </span>
            ) : (
              text.navGames
            )}
            <CaretIcon open={openMenu === "games"} />
          </button>
          {openMenu === "games" ? (
            <div className="yoro-home-menu-panel" role="menu">
              <HomeGamesMenuRows activeGame={activeGame} text={text} />
            </div>
          ) : null}
        </div>
        <a className="yoro-home-nav-link" href={localizedPublicUrlForCurrentLocale("/bot")}>{text.navBot}</a>
      </nav>
      <div className="yoro-home-header-actions">
        {searchSlot}
        <div className="yoro-home-menu-wrap">
          <button
            aria-expanded={openMenu === "lang"}
            aria-haspopup="menu"
            aria-label={text.langMenuLabel}
            className="yoro-home-icon-button"
            onClick={() => toggle("lang")}
            type="button"
          >
            <GlobeIcon />
          </button>
          {openMenu === "lang" ? (
            <div className="yoro-home-menu-panel yoro-home-menu-panel--compact" role="menu">
              {LOCALE_OPTIONS.map((option) => (
                <button
                  aria-current={option.locale === locale ? "true" : undefined}
                  className={`yoro-home-lang-option${option.locale === locale ? " is-active" : ""}`}
                  key={option.locale}
                  onClick={() => {
                    setOpenMenu(null);
                    onLocale(option.locale);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          aria-label={text.themeToggleLabel}
          className="yoro-home-icon-button"
          onClick={onToggleTheme}
          type="button"
        >
          <MoonIcon />
        </button>
        {connected && accountName ? (
          <div className="yoro-home-menu-wrap">
            <button
              aria-expanded={openMenu === "account"}
              aria-haspopup="menu"
              className="yoro-home-login-button"
              onClick={() => toggle("account")}
              type="button"
            >
              {accountName}
              <CaretIcon open={openMenu === "account"} />
            </button>
            {openMenu === "account" ? (
              <div className="yoro-home-menu-panel yoro-home-menu-panel--compact" role="menu">
                <button className="yoro-home-lang-option" onClick={onDashboard} role="menuitem" type="button">
                  {text.navDashboard}
                </button>
                <button
                  className="yoro-home-lang-option"
                  onClick={() => {
                    setOpenMenu(null);
                    onLogout();
                  }}
                  role="menuitem"
                  type="button"
                >
                  {text.navLogout}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button className="yoro-home-login-button" onClick={onLoginOpen} type="button">
            {text.navLogin}
          </button>
        )}
      </div>
    </header>
  );
}
