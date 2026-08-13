import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl, minecraftPathForPage, type MinecraftPage } from "../utils/routes";
import { MinecraftNavIcon, minecraftTabItems } from "./MinecraftHeader";

/* 모바일 하단 고정 탭바 — 마인크래프트는 6개 메뉴 중 5개만 탭바에 노출합니다(인챈트는 상단 nav·홈 타일).
   LoL·Palworld 와 같은 .public-bottom-tab-bar CSS 를 그대로 씁니다.
   DOM 위치는 AppShell 직계 자식이어야 합니다(헤더의 backdrop-filter 가
   position:fixed 기준을 바꾸는 사고 방지 — Palworld 주석 참고). */
export function MinecraftBottomTabBar({ locale, page }: {
  locale: MinecraftLocale;
  page: MinecraftPage | null;
}) {
  const text = minecraftI18n[locale];
  return (
    <nav aria-label={text.mainMenu} className="public-bottom-tab-bar" data-testid="minecraft-bottom-tab-bar">
      {minecraftTabItems.map((item) => {
        const isActive = item.page === page;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            key={item.page}
            onClick={() => setMinecraftUrl(minecraftPathForPage(item.page))}
            type="button"
          >
            <MinecraftNavIcon page={item.page} />
            <span>{locale === "ja" ? item.ja : item.ko}</span>
          </button>
        );
      })}
    </nav>
  );
}
