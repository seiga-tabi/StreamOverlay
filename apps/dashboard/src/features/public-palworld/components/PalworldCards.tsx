import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber, itemName, palName } from "../utils/search";
import { categoryLabel, elementLabel, workLabel } from "../utils/labels";
import { PalworldMedia } from "./PalworldMedia";

function rarityTone(rarity: number): "neutral" | "info" | "warning" {
  if (rarity >= 4) return "warning";
  if (rarity >= 2) return "info";
  return "neutral";
}

export function PalCard({ locale, onOpen, pal }: { locale: PalworldLocale; onOpen: (pal: PalworldPalSummary) => void; pal: PalworldPalSummary }) {
  const text = palworldI18n[locale];
  const displayName = palName(pal, locale);
  return (
    <Card className="palworld-entity-card" variant="interactive" padding="none" onClick={() => onOpen(pal)} aria-label={`${displayName} · ${text.openPal}`} data-testid="pal-card">
      <div className="palworld-entity-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={displayName} locale={locale} /></div>
      <CardContent>
        <div className="palworld-card-kicker"><span>{formatPalNumber(pal.number)}</span><Badge size="sm" tone={rarityTone(pal.rarity)}>★ {pal.rarity}</Badge></div>
        <h3 title={displayName}>{displayName}</h3>
        <div className="palworld-badge-row">
          {pal.elements.map((element) => <Badge size="sm" tone="info" key={element}>{elementLabel(element, locale)}</Badge>)}
          {pal.variantType !== "normal" ? <Badge size="sm" tone="warning">{pal.variantType === "special" ? text.special : text.variantPal}</Badge> : null}
        </div>
        {pal.workSuitabilities[0] ? <p className="palworld-card-note">{workLabel(pal.workSuitabilities[0].type, locale)} Lv.{pal.workSuitabilities[0].level}</p> : null}
      </CardContent>
    </Card>
  );
}

export function ItemCard({ item, locale, onOpen }: { item: PalworldItemSummary; locale: PalworldLocale; onOpen: (item: PalworldItemSummary) => void }) {
  const text = palworldI18n[locale];
  const displayName = itemName(item, locale);
  const description = locale === "ja" ? item.descriptionJa : item.descriptionKo;
  return (
    <Card className="palworld-entity-card palworld-item-card" variant="interactive" padding="none" onClick={() => onOpen(item)} aria-label={`${displayName} · ${text.openItem}`} data-testid="item-card">
      <div className="palworld-entity-media"><PalworldMedia kind="item" imageUrl={item.imageUrl} alt={displayName} locale={locale} /></div>
      <CardContent>
        <div className="palworld-card-kicker"><Badge size="sm" tone="info">{categoryLabel(item.category, locale)}</Badge><Badge size="sm" tone={rarityTone(item.rarity)}>★ {item.rarity}</Badge></div>
        <h3 title={displayName}>{displayName}</h3>
        <p className="palworld-card-description">{description}</p>
        {item.technologyLevel !== undefined ? <p className="palworld-card-note">{text.technologyLevel} · Lv.{item.technologyLevel}</p> : null}
      </CardContent>
    </Card>
  );
}
