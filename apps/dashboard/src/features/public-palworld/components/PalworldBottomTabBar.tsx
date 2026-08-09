import { useRef, useState } from "react";
import { BottomSheet } from "../../../shared/ui/BottomSheet";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";
import { isPalworldNavItemActive, PalworldNavIcon, palworldNavItems } from "./PalworldHeader";

/* 모바일 하단 고정 탭바 — Palworld 전용.
 *
 * LoL의 PublicBottomTabBar와 같은 CSS(.public-bottom-tab-bar)를 쓰지만,
 * Palworld는 메뉴가 7개라 5칸에 다 들어가지 않습니다. 사용 빈도가 높은
 * 홈·Pal 도감·교배·지도 4개를 상시 노출하고, 아이템·기술 해금·스킬은
 * "더보기" 시트로 묶습니다. 시트 안 항목이 활성인 동안에는 더보기 탭이
 * 활성색을 이어받아 현재 위치가 시야에서 사라지지 않습니다.
 *
 * 교배 조합은 탭 칸 폭을 넘는 유일한 라벨(ja: 配合組み合わせ)이라
 * 탭바에서만 짧은 라벨(breedingShort)을 씁니다. 시트·상단 nav는 전체 라벨 유지.
 *
 * DOM 위치는 헤더 안이 아니라 AppShell 직계 자식이어야 합니다 — 헤더에
 * backdrop-filter류가 걸리면 position:fixed 의 기준이 헤더가 되어 탭바가
 * 화면 하단에서 떨어져 나갑니다(LoL 전적검색 헤더에서 실제로 났던 사고).
 */

const TAB_PAGES = ["home", "pals", "breeding", "map"] as const;
const MORE_PAGES = ["items", "technology", "skills"] as const;

type MorePage = (typeof MORE_PAGES)[number];

function isMorePage(page: PalworldPage): page is MorePage {
  return (MORE_PAGES as readonly PalworldPage[]).includes(page);
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
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

export function PalworldBottomTabBar({ locale, page }: {
  locale: PalworldLocale;
  page: PalworldPage;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const text = palworldI18n[locale];
  const moreActive = isMorePage(page);

  const go = (target: Exclude<PalworldPage, "search">) => {
    setMoreOpen(false);
    setPalworldUrl(palworldPathForPage(target));
  };

  return (
    <>
      <nav aria-label={text.mainMenu} className="public-bottom-tab-bar" data-testid="palworld-bottom-tab-bar">
        {TAB_PAGES.map((tabPage) => {
          const item = palworldNavItems.find((navItem) => navItem.page === tabPage);
          if (!item) return null;
          const isActive = isPalworldNavItemActive(tabPage, page);
          const label = tabPage === "breeding"
            ? (locale === "ja" ? palworldI18n.ja.breedingShort : palworldI18n.ko.breedingShort)
            : (locale === "ja" ? item.ja : item.ko);

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
              data-ja={tabPage === "breeding" ? palworldI18n.ja.breedingShort : item.ja}
              data-ko={tabPage === "breeding" ? palworldI18n.ko.breedingShort : item.ko}
              key={tabPage}
              onClick={() => go(tabPage)}
              type="button"
            >
              <PalworldNavIcon page={tabPage} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          aria-controls="palworld-more-menu"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`public-bottom-tab-bar__item ${moreActive ? "active" : ""}`}
          data-ja={palworldI18n.ja.moreMenu}
          data-ko={palworldI18n.ko.moreMenu}
          onClick={() => setMoreOpen((open) => !open)}
          ref={moreTriggerRef}
          type="button"
        >
          <MoreIcon />
          <span>{text.moreMenu}</span>
        </button>
      </nav>
      <BottomSheet
        className="public-bottom-sheet--palworld"
        closeLabel={text.closeMobileMenu}
        id="palworld-more-menu"
        onClose={() => setMoreOpen(false)}
        open={moreOpen}
        returnFocusRef={moreTriggerRef}
        title={text.moreMenu}
      >
        <div className="palworld-more-menu">
          {MORE_PAGES.map((morePage) => {
            const item = palworldNavItems.find((navItem) => navItem.page === morePage);
            if (!item) return null;
            const isActive = isPalworldNavItemActive(morePage, page);
            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`palworld-more-menu__item ${isActive ? "active" : ""}`}
                data-ja={item.ja}
                data-ko={item.ko}
                key={morePage}
                onClick={() => go(morePage)}
                type="button"
              >
                <PalworldNavIcon page={morePage} />
                <strong>{locale === "ja" ? item.ja : item.ko}</strong>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
