import type { RefObject } from "react";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../shared/ui/Modal";
import { Button } from "../../../shared/ui/Button";
import {
  PalworldMapFilterPanel,
  type PalworldMapFilterPanelProps,
} from "./PalworldMapFilterPanel";
import { resolvePalworldMapLabel } from "./PalworldMapExplorerTypes";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { palworldI18n } from "../i18n/palworld-i18n";

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
  onReset,
  open,
  returnFocusRef,
  ...panelProps
}: PalworldMapMobileFiltersProps) {
  useBodyScrollLock(open);
  const closeLabel = palworldI18n[locale].close;
  const resetLabel = resolvePalworldMapLabel(copy.reset, locale);

  return (
    <Modal
      className="palworld-map-mobile-filters"
      data-testid="palworld-map-mobile-filters"
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="sm"
    >
      <ModalHeader className="palworld-map-mobile-filters__header">
        <ModalTitle
          data-ja={copy.title.ja}
          data-ko={copy.title.ko}
        >
          {resolvePalworldMapLabel(copy.title, locale)}
        </ModalTitle>
        <ModalCloseButton
          aria-label={closeLabel}
          data-ja={palworldI18n.ja.close}
          data-ko={palworldI18n.ko.close}
        >
          <span aria-hidden="true">×</span>
        </ModalCloseButton>
      </ModalHeader>
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
          onReset={onReset}
        />
      </ModalContent>
      <ModalFooter className="palworld-map-mobile-filters__footer">
        <Button
          data-ja={copy.reset.ja}
          data-ko={copy.reset.ko}
          onClick={onReset}
          variant="secondary"
        >
          {resetLabel}
        </Button>
        <Button
          data-ja={palworldI18n.ja.close}
          data-ko={palworldI18n.ko.close}
          onClick={onClose}
          variant="primary"
        >
          {closeLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
