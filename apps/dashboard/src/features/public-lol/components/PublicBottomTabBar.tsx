import { useRef, useState } from "react";
import { BottomSheet } from "../../../shared/ui/BottomSheet";
import { publicI18n, t } from "../i18n/public-lol-i18n";
import type { PublicLocale } from "../i18n/public-lol-i18n";
import type { PublicMainPage } from "../types/public-lol";
import {
  PublicHeaderMenuIcon,
  isHeaderMenuItemActive,
  publicHeaderMenuItems,
  type HeaderMenuItem,
  type PublicHeaderMenuProps
} from "./PublicHeaderMenu";

/* 모바일 전용 하단 고정 탭바 — 상시 4탭(홈·챔피언·칼바람·패치노트) + 더보기 시트.
 *
 * 라벨·아이콘·활성 판정은 PublicHeaderMenu 의 항목 데이터를 기준으로 씁니다.
 * 단, 일본어 챔피언과 더보기는 360px 탭 칸에서만 i18n 축약 라벨을 사용합니다.
 * 달라진 건 배치뿐입니다: 5칸이 이미 홈·스트리머·참여·칼바람·패치노트로 차 있어
 * 모바일에는 챔피언 진입점이 아예 없었습니다(모바일에서는 상단 nav 가 숨습니다).
 * 그래서 사용 빈도가 낮은 스트리머·참여를 "더보기" 시트로 내리고 그 자리에
 * 챔피언을 넣습니다 — Palworld 탭바(PalworldBottomTabBar)가 실서비스에서 쓰는
 * 것과 같은 구조이며, LoL 홈 탭바(LolBottomTabBar)의 1단계 개편과도 같은 구성
 * (승인 스펙 docs/mockups/lol-mobile-tabbar.approved-spec.html §1·§4·§6)입니다.
 *
 * 항목은 배열 순서가 아니라 icon 키로 고릅니다 — publicHeaderMenuItems 의 "홈"은
 * 현재 위치에 따라 page 가 search·palworld 로 바뀌지만 icon 은 고정이라, 탭 구성이
 * 데이터 순서 변경에 흔들리지 않습니다.
 *
 * 시트는 공용 BottomSheet(우측 드로어)입니다 — 포커스 트랩·스크롤 락·ESC·복귀
 * 포커스가 이미 그 안에 있습니다.
 */

/** 상시 노출되는 4칸. */
const TAB_ICONS = ["home", "champions", "aram", "patchNotes"] as const;
/** "더보기" 시트 안에서만 나타나는 항목 — 탭 칸을 차지하지 않습니다. */
const MORE_ICONS = ["streamers", "participation"] as const;

function pickItems(items: HeaderMenuItem[], icons: readonly HeaderMenuItem["icon"][]): HeaderMenuItem[] {
  return icons
    .map((icon) => items.find((item) => item.icon === icon))
    .filter((item): item is HeaderMenuItem => item !== undefined);
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="public-header-menu-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}

export function PublicBottomTabBar({ activePage, activeTarget, locale, onPage }: PublicHeaderMenuProps & {
  locale: PublicLocale;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const items = publicHeaderMenuItems(activePage);
  const text = t();
  const tabItems = pickItems(items, TAB_ICONS);
  const moreItems = pickItems(items, MORE_ICONS);
  /* 더보기의 활성은 둘: 시트가 열려 있는 동안, 그리고 시트 안 항목이 현재
     위치일 때 — 시트를 닫아도 현재 위치가 탭바에서 사라지지 않습니다. */
  const moreActive = moreOpen || moreItems.some((item) => isHeaderMenuItemActive(item, activePage, activeTarget));

  function go(page: PublicMainPage): void {
    setMoreOpen(false);
    onPage(page);
  }

  return (
    <>
      <nav aria-label={text.mainMenu} className="public-bottom-tab-bar" data-testid="lol-bottom-tab-bar">
        {tabItems.map((item) => {
          const isActive = isHeaderMenuItemActive(item, activePage, activeTarget);
          const label = locale === "ja" && item.icon === "champions"
            ? publicI18n.ja.championsHeaderNavShort
            : item.label;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
              data-ja={item.icon === "champions" ? publicI18n.ja.championsHeaderNavShort : item.ja}
              data-ko={item.ko}
              key={item.icon}
              onClick={() => go(item.page)}
              type="button"
            >
              <PublicHeaderMenuIcon icon={item.icon} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          aria-controls="lol-bottom-tab-bar-more"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`public-bottom-tab-bar__item ${moreActive ? "active" : ""}`}
          data-ja={publicI18n.ja.moreMenuShort}
          data-ko={publicI18n.ko.moreMenu}
          onClick={() => setMoreOpen((open) => !open)}
          ref={moreTriggerRef}
          type="button"
        >
          <MoreIcon />
          <span>{locale === "ja" ? text.moreMenuShort : text.moreMenu}</span>
        </button>
      </nav>
      <BottomSheet
        className="public-bottom-sheet--lol-nav"
        closeLabel={text.closeMobileMenu}
        id="lol-bottom-tab-bar-more"
        onClose={() => setMoreOpen(false)}
        open={moreOpen}
        returnFocusRef={moreTriggerRef}
        title={text.moreMenu}
      >
        <div className="public-bottom-tab-bar-more">
          {moreItems.map((item) => {
            const isActive = isHeaderMenuItemActive(item, activePage, activeTarget);

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`public-bottom-tab-bar-more__item ${isActive ? "active" : ""}`}
                data-ja={item.ja}
                data-ko={item.ko}
                key={item.icon}
                onClick={() => go(item.page)}
                type="button"
              >
                <PublicHeaderMenuIcon icon={item.icon} />
                <strong>{item.label}</strong>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
