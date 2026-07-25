import type { RefObject } from "react";
import {
  Modal,
  ModalContent,
  ModalTitle,
} from "../../../shared/ui/Modal";
import {
  PalworldMapFilterPanel,
  type PalworldMapFilterPanelProps,
} from "./PalworldMapFilterPanel";
import { resolvePalworldMapLabel } from "./PalworldMapExplorerTypes";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

export type PalworldMapMobileFiltersProps = Omit<
  PalworldMapFilterPanelProps,
  "className" | "collapsed" | "onCollapsedChange"
> & {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement>;
};

/**
 * 모바일 지도에서 필터 패널을 Bottom sheet 형태로 제공하는 접근 가능한 래퍼입니다.
 * 레이어 상태와 선택 검증은 공용 `PalworldMapFilterPanel`에 위임합니다.
 */
export function PalworldMapMobileFilters({
  copy,
  locale,
  onClose,
  open,
  returnFocusRef,
  ...panelProps
}: PalworldMapMobileFiltersProps) {
  useBodyScrollLock(open);

  return (
    <Modal
      className="palworld-map-mobile-filters"
      data-testid="palworld-map-mobile-filters"
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="sm"
    >
      <ModalTitle
        className="yoro-u-sr-only"
        data-ja={copy.title.ja}
        data-ko={copy.title.ko}
      >
        {resolvePalworldMapLabel(copy.title, locale)}
      </ModalTitle>
      <ModalContent className="palworld-map-mobile-filters__content">
        <PalworldMapFilterPanel
          {...panelProps}
          className="palworld-map-mobile-filters__panel"
          collapsed={false}
          copy={copy}
          locale={locale}
          onCollapsedChange={(collapsed) => {
            if (collapsed) {
              onClose();
            }
          }}
        />
      </ModalContent>
    </Modal>
  );
}
