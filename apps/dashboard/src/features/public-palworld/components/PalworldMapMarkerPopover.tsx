import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import {
  Button,
  type ButtonVariant,
} from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import {
  resolvePalworldMapLabel,
  type PalworldMapLocalizedLabel,
} from "./PalworldMapExplorerTypes";

export type PalworldMapMarkerPopoverAction = {
  id: string;
  label: PalworldMapLocalizedLabel;
  onClick: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
};

type PalworldMapMarkerPopoverProps = {
  actions?: readonly PalworldMapMarkerPopoverAction[];
  autoFocus?: boolean;
  className?: string;
  closeLabel: PalworldMapLocalizedLabel;
  description?: PalworldMapLocalizedLabel;
  details?: readonly {
    label: PalworldMapLocalizedLabel;
    value: ReactNode;
  }[];
  id?: string;
  kindLabel: PalworldMapLocalizedLabel;
  locale: PalworldLocale;
  media?: ReactNode;
  onClose: () => void;
  title: PalworldMapLocalizedLabel;
};

/**
 * 지도 마커 선택 정보를 표시하는 비모달 대화상자입니다.
 * 닫힌 뒤 어느 마커로 초점을 돌릴지는 마커를 소유한 상위 컴포넌트가 관리합니다.
 */
export function PalworldMapMarkerPopover({
  actions = [],
  autoFocus = true,
  className,
  closeLabel,
  description,
  details = [],
  id,
  kindLabel,
  locale,
  media,
  onClose,
  title,
}: PalworldMapMarkerPopoverProps) {
  const titleId = useId();
  const descriptionId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const popoverClassName = ["palworld-map-marker-popover", className]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (autoFocus) {
      rootRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <Card
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="false"
      as="aside"
      className={popoverClassName}
      data-map-interactive="true"
      id={id}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      padding="sm"
      ref={rootRef}
      role="dialog"
      tabIndex={-1}
    >
      <header className="palworld-map-marker-popover-header">
        {media ? (
          <span className="palworld-map-marker-popover-media">
            {media}
          </span>
        ) : null}
        <span className="palworld-map-marker-popover-heading">
          <Badge
            data-ja={kindLabel.ja}
            data-ko={kindLabel.ko}
            size="sm"
            tone="info"
          >
            {resolvePalworldMapLabel(kindLabel, locale)}
          </Badge>
          <strong data-ja={title.ja} data-ko={title.ko} id={titleId}>
            {resolvePalworldMapLabel(title, locale)}
          </strong>
        </span>
        <Button
          aria-label={resolvePalworldMapLabel(closeLabel, locale)}
          className="palworld-map-marker-popover-close"
          data-ja={closeLabel.ja}
          data-ko={closeLabel.ko}
          onClick={onClose}
          size="sm"
          variant="ghost"
        >
          <span aria-hidden="true">×</span>
        </Button>
      </header>

      {description ? (
        <p
          data-ja={description.ja}
          data-ko={description.ko}
          id={descriptionId}
        >
          {resolvePalworldMapLabel(description, locale)}
        </p>
      ) : null}

      {details.length > 0 ? (
        <dl className="palworld-map-marker-popover-details">
          {details.map((detail, index) => (
            <div key={`${detail.label.ko}-${index}`}>
              <dt data-ja={detail.label.ja} data-ko={detail.label.ko}>
                {resolvePalworldMapLabel(detail.label, locale)}
              </dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions.length > 0 ? (
        <footer className="palworld-map-marker-popover-actions">
          {actions.map((action) => (
            <Button
              data-ja={action.label.ja}
              data-ko={action.label.ko}
              disabled={action.disabled}
              key={action.id}
              onClick={action.onClick}
              size="sm"
              variant={action.variant ?? "secondary"}
            >
              {resolvePalworldMapLabel(action.label, locale)}
            </Button>
          ))}
        </footer>
      ) : null}
    </Card>
  );
}

export type { PalworldMapMarkerPopoverProps };
