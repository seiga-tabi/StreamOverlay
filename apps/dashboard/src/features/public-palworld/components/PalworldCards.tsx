import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber } from "../utils/search";
import {
  categoryLabel,
  itemRarityBand,
  itemRarityLabel,
  itemTypeLabel,
} from "../utils/labels";
import { resolvePalworldDescription, resolvePalworldName } from "../utils/localization";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldItemMedia, PalworldMedia } from "./PalworldMedia";
import { PalworldTranslationBadges } from "./PalworldTranslationBadge";
import { PalworldWorkSuitabilityBadge } from "./PalworldWorkSuitabilityBadge";

function rarityTone(rarity: number): "neutral" | "info" | "warning" {
  if (rarity >= 4) return "warning";
  if (rarity >= 2) return "info";
  return "neutral";
}

function itemRarityTone(rarity: number): "neutral" | "info" | "warning" {
  return rarity > 4 ? "neutral" : rarityTone(rarity);
}

type ImageDimensions = { imageWidth?: number; imageHeight?: number };
const PAL_CARD_WORK_SUITABILITY_LIMIT = 2;

function imageDimensions(value: ImageDimensions): { intrinsicWidth?: number; intrinsicHeight?: number } {
  return { intrinsicWidth: value.imageWidth, intrinsicHeight: value.imageHeight };
}

export function PalCard({ locale, onOpen, pal, priority = false }: { locale: PalworldLocale; onOpen: (pal: PalworldPalSummary) => void; pal: PalworldPalSummary; priority?: boolean }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(pal, locale);
  const displayName = name.text;
  const visibleWorkSuitabilities = pal.workSuitabilities.slice(0, PAL_CARD_WORK_SUITABILITY_LIMIT);
  const hiddenWorkSuitabilityCount = Math.max(0, pal.workSuitabilities.length - visibleWorkSuitabilities.length);
  const hiddenWorkSuitabilityLabel = text.additionalWorkSuitabilities.replace(
    "{count}",
    hiddenWorkSuitabilityCount.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
  );
  return (
    <Card className="palworld-entity-card palworld-pal-card" variant="interactive" padding="none" data-testid="pal-card">
      <div className="palworld-pal-card-main">
        <div className="palworld-pal-card-media">
          <div className="palworld-pal-card-image-frame">
            <PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={displayName} locale={locale} priority={priority} {...imageDimensions(pal)} />
          </div>
        </div>
        <CardContent className="palworld-pal-card-content">
          <div className="palworld-card-kicker"><span>{formatPalNumber(pal.number, locale)}</span><Badge size="sm" tone={rarityTone(pal.rarity)}>★ {pal.rarity}</Badge></div>
          <h3 title={displayName}>{displayName}</h3>
          <PalworldTranslationBadges
            locale={locale}
            sourceIntegrities={[name.sourceIntegrity]}
            statuses={[name.status]}
          />
          <div className="palworld-badge-row">
            {pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}
            {pal.variantType !== "normal" ? <Badge size="sm" tone="warning">{pal.variantType === "special" ? text.special : text.variantPal}</Badge> : null}
          </div>
        </CardContent>
      </div>
      {pal.workSuitabilities.length ? (
        <div
          aria-label={text.workSuitabilities}
          className={[
            "palworld-card-work-list",
            hiddenWorkSuitabilityCount > 0 ? "has-overflow" : "",
          ].filter(Boolean).join(" ")}
          data-ja={palworldI18n.ja.workSuitabilities}
          data-ko={palworldI18n.ko.workSuitabilities}
          role="list"
        >
          {visibleWorkSuitabilities.map((work) => (
            <PalworldWorkSuitabilityBadge compact key={work.type} level={work.level} locale={locale} type={work.type} />
          ))}
          {hiddenWorkSuitabilityCount > 0 ? (
            <span
              aria-label={hiddenWorkSuitabilityLabel}
              className="palworld-card-work-more"
              data-ja={palworldI18n.ja.additionalWorkSuitabilities.replace("{count}", hiddenWorkSuitabilityCount.toLocaleString("ja-JP"))}
              data-ko={palworldI18n.ko.additionalWorkSuitabilities.replace("{count}", hiddenWorkSuitabilityCount.toLocaleString("ko-KR"))}
              role="listitem"
              title={hiddenWorkSuitabilityLabel}
            >
              ...
            </span>
          ) : null}
        </div>
      ) : null}
      <Button
        aria-haspopup="dialog"
        className="palworld-card-open-action"
        onClick={() => onOpen(pal)}
        size="sm"
        type="button"
        variant="secondary"
      >
        {text.openPal}
      </Button>
    </Card>
  );
}

export function ItemCard({ item, locale, onOpen, priority = false }: { item: PalworldItemSummary; locale: PalworldLocale; onOpen: (item: PalworldItemSummary) => void; priority?: boolean }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(item, locale);
  const description = resolvePalworldDescription(item, locale);
  const displayName = name.text;
  const rarityLabel = itemRarityLabel(item.rarity, locale);
  return (
    <Card className="palworld-entity-card palworld-item-card" variant="interactive" padding="none" data-testid="item-card">
      <div className="palworld-entity-media" data-rarity-band={itemRarityBand(item.rarity)}><PalworldItemMedia alt={displayName} item={item} locale={locale} priority={priority} /></div>
      <CardContent>
        <div className="palworld-card-kicker"><Badge size="sm" tone="info">{item.itemType ? itemTypeLabel(item.itemType, locale) : categoryLabel(item.category, locale)}</Badge><Badge data-ja={itemRarityLabel(item.rarity, "ja")} data-ko={itemRarityLabel(item.rarity, "ko")} size="sm" tone={itemRarityTone(item.rarity)}>{rarityLabel}</Badge></div>
        <h3 title={displayName}>{displayName}</h3>
        <PalworldTranslationBadges
          locale={locale}
          showMachineAssisted={false}
          sourceIntegrities={[name.sourceIntegrity, description.sourceIntegrity]}
          statuses={[name.status, description.status]}
        />
        <p className="palworld-card-description palworld-localized-copy">{description.text || text.originalDataUnavailable}</p>
      </CardContent>
      <Button
        aria-haspopup="dialog"
        className="palworld-card-open-action"
        onClick={() => onOpen(item)}
        size="sm"
        type="button"
        variant="secondary"
      >
        {text.openItem}
      </Button>
    </Card>
  );
}
