import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber } from "../utils/search";
import { categoryLabel, workLabel } from "../utils/labels";
import { resolvePalworldDescription, resolvePalworldName } from "../utils/localization";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldTranslationBadges } from "./PalworldTranslationBadge";

function rarityTone(rarity: number): "neutral" | "info" | "warning" {
  if (rarity >= 4) return "warning";
  if (rarity >= 2) return "info";
  return "neutral";
}

type ImageDimensions = { imageWidth?: number; imageHeight?: number };

function imageDimensions(value: ImageDimensions): { intrinsicWidth?: number; intrinsicHeight?: number } {
  return { intrinsicWidth: value.imageWidth, intrinsicHeight: value.imageHeight };
}

export function PalCard({ locale, onOpen, pal, priority = false }: { locale: PalworldLocale; onOpen: (pal: PalworldPalSummary) => void; pal: PalworldPalSummary; priority?: boolean }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(pal, locale);
  const displayName = name.text;
  return (
    <Card className="palworld-entity-card" variant="interactive" padding="none" onClick={() => onOpen(pal)} aria-label={`${displayName} · ${text.openPal}`} data-testid="pal-card">
      <div className="palworld-entity-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={displayName} locale={locale} priority={priority} {...imageDimensions(pal)} /></div>
      <CardContent>
        <div className="palworld-card-kicker"><span>{formatPalNumber(pal.number)}</span><Badge size="sm" tone={rarityTone(pal.rarity)}>★ {pal.rarity}</Badge></div>
        <h3 title={displayName}>{displayName}</h3>
        <PalworldTranslationBadges locale={locale} statuses={[name.status]} />
        <div className="palworld-badge-row">
          {pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}
          {pal.variantType !== "normal" ? <Badge size="sm" tone="warning">{pal.variantType === "special" ? text.special : text.variantPal}</Badge> : null}
        </div>
        {pal.workSuitabilities[0] ? <p className="palworld-card-note">{workLabel(pal.workSuitabilities[0].type, locale)} Lv.{pal.workSuitabilities[0].level}</p> : null}
      </CardContent>
    </Card>
  );
}

export function ItemCard({ item, locale, onOpen, priority = false }: { item: PalworldItemSummary; locale: PalworldLocale; onOpen: (item: PalworldItemSummary) => void; priority?: boolean }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(item, locale);
  const description = resolvePalworldDescription(item, locale);
  const displayName = name.text;
  return (
    <Card className="palworld-entity-card palworld-item-card" variant="interactive" padding="none" onClick={() => onOpen(item)} aria-label={`${displayName} · ${text.openItem}`} data-testid="item-card">
      <div className="palworld-entity-media"><PalworldMedia kind="item" imageUrl={item.imageUrl} alt={displayName} locale={locale} priority={priority} {...imageDimensions(item)} /></div>
      <CardContent>
        <div className="palworld-card-kicker"><Badge size="sm" tone="info">{categoryLabel(item.category, locale)}</Badge><Badge size="sm" tone={rarityTone(item.rarity)}>★ {item.rarity}</Badge></div>
        <h3 title={displayName}>{displayName}</h3>
        <PalworldTranslationBadges locale={locale} statuses={[name.status, description.status]} />
        <p className="palworld-card-description palworld-localized-copy">{description.text || text.originalDataUnavailable}</p>
        {item.technologyLevel !== undefined ? <p className="palworld-card-note">{text.technologyLevel} · Lv.{item.technologyLevel}</p> : null}
      </CardContent>
    </Card>
  );
}
