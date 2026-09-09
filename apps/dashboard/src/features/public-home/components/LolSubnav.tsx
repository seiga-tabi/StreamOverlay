import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import type { LolHomeText } from "../i18n/lol-home-i18n";
import { TailUnderline } from "./HomeMarks";

/* ── 2행: LoL 전용 메뉴(중앙 정렬) — 목업 v11 ─────────────── */

export type LolSubnavItem = "home" | "champions" | "streamers" | "participation" | "aram" | "patchNotes";

/* 홈 항목은 LoL 홈(/lol)으로 갑니다(2026-08-20 변경 — 이전의 "메인 홈 출구" 결정을
   번복). 메인 홈(/)으로 나가는 출구는 1행 헤더의 워드마크와 "홈" 링크가 담당합니다.
   활성 표시는 시그니처 꼬리 밑줄 + aria-current. */
/* active="none" — 전적 상세처럼 2행 어디에도 속하지 않는 화면(목업: 활성 항목 없음). */
export function LolSubnav({ text, active = "home" }: { text: LolHomeText; active?: LolSubnavItem | "none" }) {
  const items: Array<{ id: LolSubnavItem; href: string; label: string; tailWidth: number }> = [
    { id: "home", href: "/lol", label: text.tabHome, tailWidth: 30 },
    /* 챔피언 — 홈 바로 다음(사전 성격의 목적지라 증강 도감과 같은 축, 목업 §04). */
    { id: "champions", href: "/lol/champions", label: text.tabChampions, tailWidth: 40 },
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

