import type { PalworldItemReference } from "@streamops/shared";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { resolvePalworldName } from "../utils/localization";
import { PalworldMedia } from "./PalworldMedia";

type PalworldItemReferenceButtonProps = {
  item: PalworldItemReference;
  locale: PalworldLocale;
  maxQuantity?: number;
  minQuantity?: number;
  onOpen: (id: string) => void;
  quantity?: number;
  dropRatePercent?: number;
};

export function PalworldItemReferenceButton({
  dropRatePercent,
  item,
  locale,
  maxQuantity,
  minQuantity,
  onOpen,
  quantity,
}: PalworldItemReferenceButtonProps) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(item, locale).text;
  const hasDropQuantity = minQuantity !== undefined && maxQuantity !== undefined;
  const quantityLabel = quantity !== undefined
    ? `× ${quantity}`
    : hasDropQuantity
      ? `${text.dropQuantity} ${minQuantity === maxQuantity ? minQuantity : `${minQuantity}–${maxQuantity}`}`
      : undefined;

  return (
    <button
      className="palworld-item-reference-button"
      type="button"
      onClick={() => onOpen(item.id)}
    >
      <span className="palworld-item-reference-media">
        <PalworldMedia
          kind="item"
          imageUrl={item.imageUrl}
          intrinsicHeight={item.imageHeight}
          intrinsicWidth={item.imageWidth}
          alt={name}
          locale={locale}
        />
      </span>
      <span className="palworld-item-reference-copy">
        <strong>{name}</strong>
        {quantityLabel || dropRatePercent !== undefined ? (
          <small>
            {quantityLabel ? <span>{quantityLabel}</span> : null}
            {quantityLabel && dropRatePercent !== undefined ? <span aria-hidden="true"> · </span> : null}
            {dropRatePercent !== undefined ? <span>{text.dropRate} {dropRatePercent}%</span> : null}
          </small>
        ) : null}
      </span>
    </button>
  );
}
