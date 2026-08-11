import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { setValorantUrl, valorantPathForPage, type ValorantPage } from "../utils/routes";
import { ValorantNavIcon, valorantNavItems } from "./ValorantHeader";

/* 모바일 하단 고정 탭바 — 발로란트는 메뉴가 정확히 5개라 더보기 시트가 없습니다.
   LoL·Palworld 와 같은 .public-bottom-tab-bar CSS 를 그대로 씁니다.
   DOM 위치는 AppShell 직계 자식이어야 합니다(헤더의 backdrop-filter 가
   position:fixed 기준을 바꾸는 사고 방지 — Palworld 주석 참고). */
export function ValorantBottomTabBar({ locale, page }: {
  locale: ValorantLocale;
  page: ValorantPage | null;
}) {
  const text = valorantI18n[locale];
  return (
    <nav aria-label={text.mainMenu} className="public-bottom-tab-bar" data-testid="valorant-bottom-tab-bar">
      {valorantNavItems.map((item) => {
        const isActive = item.page === page;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            key={item.page}
            onClick={() => setValorantUrl(valorantPathForPage(item.page))}
            type="button"
          >
            <ValorantNavIcon page={item.page} />
            <span>{locale === "ja" ? item.ja : item.ko}</span>
          </button>
        );
      })}
    </nav>
  );
}
