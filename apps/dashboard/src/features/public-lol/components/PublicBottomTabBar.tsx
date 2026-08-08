import { t } from "../i18n/public-lol-i18n";
import { PublicHeaderMenuIcon, isHeaderMenuItemActive, publicHeaderMenuItems, type PublicHeaderMenuProps } from "./PublicHeaderMenu";

/**
 * 모바일 전용 하단 고정 탭바. PublicHeaderMenu 와 같은 5개 항목 데이터를 그대로
 * 재사용해 라벨·아이콘·활성 판정이 어긋나지 않게 합니다. 5칸이 flex:1 균등폭이라
 * 어떤 언어로도 화면 밖으로 잘려 나가는 항목이 생기지 않습니다.
 */
export function PublicBottomTabBar({ activePage, activeTarget, onPage }: PublicHeaderMenuProps) {
  const items = publicHeaderMenuItems(activePage);

  return (
    <nav aria-label={t().mainMenu} className="public-bottom-tab-bar" data-testid="lol-bottom-tab-bar">
      {items.map((item) => {
        const isActive = isHeaderMenuItemActive(item, activePage, activeTarget);

        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`public-bottom-tab-bar__item ${isActive ? "active" : ""}`}
            data-ja={item.ja}
            data-ko={item.ko}
            key={item.page}
            onClick={() => onPage(item.page)}
            type="button"
          >
            <PublicHeaderMenuIcon icon={item.icon} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
