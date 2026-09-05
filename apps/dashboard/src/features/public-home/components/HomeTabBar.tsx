import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "../../../shared/ui/BottomSheet";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import type { HomeText } from "../i18n/home-i18n";
import type { LolHomeText } from "../i18n/lol-home-i18n";
import { HomeGamesMenuRows } from "./HomeHeader";
import { TailUnderline } from "./HomeMarks";

/* 모바일 하단 탭바 — 목업 v12(메인 홈 4탭)·v10(LoL 홈 5탭).
 * 64px 고정 바, 라인 아이콘 + 10px 라벨, 활성 탭은 잉크색 + 미니 꼬리 밑줄.
 * 데스크톱·태블릿에서는 CSS 로 감춥니다(< 48rem 전용). */

function HouseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <path d="M3 9 L 10 3 L 17 9 V 17 H 3 Z" />
      <path d="M8 17 V 12 H 12 V 17" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <rect height="6" rx="1" width="6" x="3" y="3" />
      <rect height="6" rx="1" width="6" x="11" y="3" />
      <rect height="6" rx="1" width="6" x="3" y="11" />
      <rect height="6" rx="1" width="6" x="11" y="11" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <rect height="9" rx="1.5" width="12" x="4" y="6" />
      <path d="M10 3 v3" />
      <path d="M7.5 10 v1.5" />
      <path d="M12.5 10 v1.5" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 17 c0-3 2.5-5 5.5-5 s5.5 2 5.5 5" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <rect height="10" rx="1" width="15" x="2.5" y="4" />
      <path d="M7 17 h6" />
      <circle cx="10" cy="9" r="2.2" />
    </svg>
  );
}

function PersonPlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <circle cx="8" cy="7" r="3" />
      <path d="M3 17 c0-3 2.2-5 5-5 s5 2 5 5" />
      <path d="M15 7 h4 M17 5 v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <path d="m10 2.5 1.7 3.9 4.3.4-3.2 2.9.9 4.3-3.7-2.1-3.7 2.1.9-4.3-3.2-2.9 4.3-.4Z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 20 20" width="20">
      <path d="M5 2.5 h7 l3 3 v12 H5 Z" />
      <path d="M12 2.5 v4 h4" />
      <path d="M8 10 h5 M8 13 h4" />
    </svg>
  );
}

/* 챔피언 탭 — 전적검색 챔피언 분석이 쓰던 ♛ 를 다른 탭 아이콘과 같은 line-icon
 * 문법(20×20 · fill none · stroke 1.2)으로 옮긴 것입니다. 꼭짓점이 miter 로 길게
 * 튀지 않도록 join/cap 만 round 를 씁니다(승인 스펙 §5). */
function CrownIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 20 20"
      width="20"
    >
      <path d="M4.6 14 L 3.4 6.4 L 6.6 9.6 L 10 4.6 L 13.4 9.6 L 16.6 6.4 L 15.4 14 Z" />
      <path d="M5.4 16.6 h9.2" />
    </svg>
  );
}

/* 더보기 — Palworld 탭바(PalworldBottomTabBar.tsx)의 MoreIcon 원문.
 * 크기만 다른 홈 탭 아이콘과 맞춰 20×20 으로 고정합니다(홈 탭바에는 Palworld 가
 * 가진 `.public-bottom-tab-bar__item svg` 같은 크기 규칙이 없습니다). */
function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}

function TabActiveMark() {
  return <TailUnderline className="yoro-home-tabbar-tail" height={4} width={26} />;
}

function SheetActiveMark() {
  return <TailUnderline className="yoro-home-sheet-tail" height={4} width={26} />;
}

/* 루트 홈: 헤더 정보구조(홈·게임·YORO Bot·로그인)를 그대로 옮긴 4탭.
 * 모바일에서는 헤더 nav 가 숨겨지므로 게임 탭이 게임 메뉴 패널을 대신 엽니다. */
export function HomeBottomTabBar({ text, connected, onLoginOpen }: {
  text: HomeText;
  connected: boolean;
  onLoginOpen: () => void;
}) {
  const [gamesOpen, setGamesOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!gamesOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setGamesOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGamesOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [gamesOpen]);

  return (
    <nav aria-label={text.gameMenuLabel} className="yoro-home-tabbar" ref={rootRef}>
      {gamesOpen ? (
        <div className="yoro-home-tabbar-panel" role="menu">
          <HomeGamesMenuRows text={text} />
        </div>
      ) : null}
      <a aria-current="page" className="yoro-home-tabbar-item is-active" href={localizedPublicUrlForCurrentLocale("/")}>
        <HouseIcon />
        <span>{text.navHome}</span>
        <TabActiveMark />
      </a>
      <button
        aria-expanded={gamesOpen}
        aria-haspopup="menu"
        className="yoro-home-tabbar-item"
        onClick={() => setGamesOpen((current) => !current)}
        type="button"
      >
        <GridIcon />
        <span>{text.navGames}</span>
      </button>
      <a className="yoro-home-tabbar-item" href={localizedPublicUrlForCurrentLocale("/bot")}>
        <BotIcon />
        <span>{text.navBot}</span>
      </a>
      {connected ? (
        <a className="yoro-home-tabbar-item" href="/dashboard">
          <PersonIcon />
          <span>{text.navDashboard}</span>
        </a>
      ) : (
        <button className="yoro-home-tabbar-item" onClick={onLoginOpen} type="button">
          <PersonIcon />
          <span>{text.navLogin}</span>
        </button>
      )}
    </nav>
  );
}

/** 상시 노출되는 하단 탭 4개. */
export type LolTabItem = "home" | "champions" | "aram" | "patchNotes";
/** "더보기" 시트 안에서만 나타나는 항목 — 탭 칸을 차지하지 않습니다. */
export type LolMoreItem = "streamers" | "participation";
export type LolTabActive = LolTabItem | LolMoreItem | "none";

const LOL_MORE_ITEMS = ["streamers", "participation"] as const;

function isLolMoreItem(active: LolTabActive): active is LolMoreItem {
  return (LOL_MORE_ITEMS as readonly LolTabActive[]).includes(active);
}

/** activeMainPage → 하단 탭 활성 항목. 2행 메뉴의 lolSubnavActive 와 같은 매핑이지만
 * 하단 탭은 팔로우·참여가 시트로 내려가 반환 타입이 다릅니다(시트 활성 = 더보기 활성). */
export function lolTabBarActive(page: PublicMainPage): LolTabActive {
  switch (page) {
    case "subscriptions": return "streamers";
    case "followJoin": return "participation";
    case "aram": return "aram";
    case "champions": return "champions";
    case "patchNotes": return "patchNotes";
    default: return "none";
  }
}

/* LoL 하단 탭: 상시 4탭(홈·챔피언·칼바람·패치노트) + 더보기 시트(팔로우·참여).
 * 모바일에서는 헤더 nav 가 숨겨져 탭바가 유일한 내비인데 5칸이 이미 차 있어
 * 챔피언 진입점이 없었습니다 — Palworld 가 실서비스에 쓰는 "더보기 + 시트"로
 * 사용 빈도가 낮은 팔로우·참여를 묶고 그 자리에 챔피언을 넣습니다(승인 스펙 §1·§4).
 * 시트는 목업의 하단 시트가 아니라 공용 BottomSheet(우측 풀스크린 드로어)를 그대로
 * 씁니다 — 포커스 트랩·스크롤 락·ESC·복귀 포커스가 이미 그 안에 있습니다.
 * 홈 탭은 메인 홈(/)으로 나가는 출구입니다(2026-08-19 결정 — 활성이어도 aria-current
 * 없음) — 모바일에선 헤더 nav 가 숨겨져 이 탭이 메인 홈으로 가는 유일한 경로입니다. */
export function LolBottomTabBar({ text, locale, active = "home" }: {
  text: LolHomeText;
  locale: PublicLocale;
  active?: LolTabActive;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  /* 더보기의 활성은 둘: 시트가 열려 있는 동안, 그리고 시트 안 항목이 현재
     위치일 때(Palworld 의 moreActive 규칙 + 승인 스펙 §6). */
  const moreActive = isLolMoreItem(active) || moreOpen;

  const items: Array<{ id: LolTabItem; href: string; label: string; icon: React.ReactNode }> = [
    { id: "home", href: "/", label: text.tabHome, icon: <HouseIcon /> },
    {
      id: "champions",
      href: "/lol/champions",
      label: locale === "ja" ? text.tabChampionsShort : text.tabChampions,
      icon: <CrownIcon />
    },
    { id: "aram", href: "/lol/aram", label: text.tabAramShort, icon: <StarIcon /> },
    { id: "patchNotes", href: "/patch-notes", label: text.tabPatchNotes, icon: <DocIcon /> }
  ];
  const moreItems: Array<{ id: LolMoreItem; href: string; label: string; icon: React.ReactNode }> = [
    { id: "streamers", href: "/follow", label: text.tabStreamers, icon: <MonitorIcon /> },
    { id: "participation", href: "/participation", label: text.tabParticipationShort, icon: <PersonPlusIcon /> }
  ];

  return (
    <>
      <nav aria-label={text.subnavLabel} className="yoro-home-tabbar yoro-home-tabbar--five">
        {items.map((item) => (
          <a
            aria-current={item.id === active && item.id !== "home" ? "page" : undefined}
            className={`yoro-home-tabbar-item${item.id === active ? " is-active" : ""}`}
            href={localizedPublicUrlForCurrentLocale(item.href)}
            key={item.id}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.id === active ? <TabActiveMark /> : null}
          </a>
        ))}
        <button
          aria-controls="lol-home-more-menu"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`yoro-home-tabbar-item${moreActive ? " is-active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          ref={moreTriggerRef}
          type="button"
        >
          <MoreIcon />
          <span>{locale === "ja" ? text.tabMoreShort : text.tabMore}</span>
          {moreActive ? <TabActiveMark /> : null}
        </button>
      </nav>
      <BottomSheet
        className="public-bottom-sheet--lol-home"
        closeLabel={text.closeMobileMenu}
        id="lol-home-more-menu"
        onClose={() => setMoreOpen(false)}
        open={moreOpen}
        returnFocusRef={moreTriggerRef}
        title={text.tabMore}
      >
        <div className="yoro-home-sheet-list">
          {moreItems.map((item) => (
            <a
              aria-current={item.id === active ? "page" : undefined}
              className={`yoro-home-sheet-item${item.id === active ? " is-active" : ""}`}
              href={localizedPublicUrlForCurrentLocale(item.href)}
              key={item.id}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === active ? <SheetActiveMark /> : null}
            </a>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
