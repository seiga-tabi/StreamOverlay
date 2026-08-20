import { useEffect, useRef, useState } from "react";
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

function TabActiveMark() {
  return <TailUnderline className="yoro-home-tabbar-tail" height={4} width={26} />;
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

export type LolTabItem = "home" | "streamers" | "participation" | "aram" | "patchNotes";

/* LoL 하단 탭: 실서비스 탭 구성(홈·스트리머·참여·칼바람·패치노트)을 수묵 스타일로.
 * 홈 탭은 메인 홈(/)으로 나가는 출구입니다(2026-08-19 결정 — 활성이어도 aria-current
 * 없음) — 모바일에선 헤더 nav 가 숨겨져 이 탭이 메인 홈으로 가는 유일한 경로입니다. */
export function LolBottomTabBar({ text, active = "home" }: { text: LolHomeText; active?: LolTabItem | "none" }) {
  const items: Array<{ id: LolTabItem; href: string; label: string; icon: React.ReactNode }> = [
    { id: "home", href: "/", label: text.tabHome, icon: <HouseIcon /> },
    { id: "streamers", href: "/follow", label: text.tabStreamers, icon: <MonitorIcon /> },
    { id: "participation", href: "/participation", label: text.tabParticipationShort, icon: <PersonPlusIcon /> },
    { id: "aram", href: "/lol/aram", label: text.tabAramShort, icon: <StarIcon /> },
    { id: "patchNotes", href: "/patch-notes", label: text.tabPatchNotes, icon: <DocIcon /> }
  ];
  return (
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
    </nav>
  );
}
