import type { ReactNode, RefObject } from "react";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "../../../shared/ui/Modal";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import {
  resolvePalworldMapLabel,
  type PalworldMapLocalizedLabel,
} from "./PalworldMapExplorerTypes";

type PalworldMapLegendProps = {
  children: ReactNode;
  expanded: boolean;
  locale: PalworldLocale;
  onExpandedChange: (expanded: boolean) => void;
  title: PalworldMapLocalizedLabel;
};

type PalworldMapLegendSheetProps = {
  children: ReactNode;
  closeLabel: PalworldMapLocalizedLabel;
  locale: PalworldLocale;
  onClose: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement>;
  title: PalworldMapLocalizedLabel;
};

/**
 * 지도 위에서 필요한 만큼만 펼쳐 보는 PC용 범례입니다.
 */
export function PalworldMapLegend({
  children,
  expanded,
  locale,
  onExpandedChange,
  title,
}: PalworldMapLegendProps) {
  const label = resolvePalworldMapLabel(title, locale);

  return (
    <aside
      aria-label={label}
      className="palworld-map-layer-legend"
      data-expanded={expanded ? "true" : undefined}
      role="group"
    >
      <button
        aria-expanded={expanded}
        className="palworld-map-legend-toggle"
        data-ja={title.ja}
        data-ko={title.ko}
        onClick={() => onExpandedChange(!expanded)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      <div className="palworld-map-legend-content" hidden={!expanded}>
        {children}
      </div>
    </aside>
  );
}

/**
 * 모바일에서 지도 canvas를 가리지 않고 범례를 확인하는 Bottom Sheet입니다.
 */
export function PalworldMapLegendSheet({
  children,
  closeLabel,
  locale,
  onClose,
  open,
  returnFocusRef,
  title,
}: PalworldMapLegendSheetProps) {
  useBodyScrollLock(open);
  const titleText = resolvePalworldMapLabel(title, locale);

  return (
    <Modal
      className="palworld-map-legend-sheet"
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="sm"
    >
      <ModalHeader>
        <ModalTitle data-ja={title.ja} data-ko={title.ko}>
          {titleText}
        </ModalTitle>
        <ModalCloseButton
          aria-label={resolvePalworldMapLabel(closeLabel, locale)}
          data-ja={closeLabel.ja}
          data-ko={closeLabel.ko}
        >
          <span aria-hidden="true">×</span>
        </ModalCloseButton>
      </ModalHeader>
      <ModalContent className="palworld-map-legend-sheet__content">
        {children}
      </ModalContent>
    </Modal>
  );
}
