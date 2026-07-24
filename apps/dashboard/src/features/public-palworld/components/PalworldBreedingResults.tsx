import type { PalworldBreedingPair, PalworldPalReference, PalworldPagination } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { genderLabel } from "../utils/labels";
import { resolvePalworldName } from "../utils/localization";
import { formatPalNumber } from "../utils/search";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldTranslationBadge } from "./PalworldTranslationBadge";

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function BreedingPalButton({
  emphasis = "compact",
  locale,
  onOpen,
  pal,
  role,
}: {
  emphasis?: "compact" | "hero" | "target";
  locale: PalworldLocale;
  onOpen: (id: string) => void;
  pal: PalworldPalReference;
  role: string;
}) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(pal, locale);
  const ariaLabel = emphasis === "hero"
    ? `${text.resultPalDetails}: ${name.text}`
    : emphasis === "target"
      ? `${text.targetPalDetails}: ${name.text}`
    : `${text.openParentPalDetails}: ${name.text}`;
  return <button
    className={`palworld-breeding-pal-button is-${emphasis}`}
    type="button"
    aria-label={ariaLabel}
    onClick={() => onOpen(pal.id)}
  >
    <span className="palworld-breeding-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name.text} locale={locale} /></span>
    <span className="palworld-breeding-pal-copy">
      <small>{role} · {formatPalNumber(pal.number, locale)}</small>
      <strong>{name.text}</strong>
      <PalworldTranslationBadge locale={locale} status={name.status} />
      <span className="palworld-badge-row palworld-compact-element-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span>
    </span>
  </button>;
}

function PairTypeBadges({ locale, pair }: { locale: PalworldLocale; pair: PalworldBreedingPair }) {
  const text = palworldI18n[locale];
  return <div className="palworld-breeding-pair-badges">
    <Badge tone={pair.isSpecial ? "warning" : "info"}>{pair.isSpecial ? text.specialBreeding : text.normalBreeding}</Badge>
    {pair.genderCondition ? <Badge tone="warning">{text.genderCondition}: {genderLabel(pair.genderCondition.parentA, locale)} / {genderLabel(pair.genderCondition.parentB, locale)}</Badge> : null}
  </div>;
}

export function DirectBreedingResult({
  locale,
  onCopy,
  onOpenPal,
  onViewParents,
  pair,
}: {
  locale: PalworldLocale;
  onCopy: () => void;
  onOpenPal: (id: string) => void;
  onViewParents: (id: string) => void;
  pair: PalworldBreedingPair;
}) {
  const text = palworldI18n[locale];
  return <Card className="palworld-direct-result-card" data-testid="breeding-direct-card">
    <CardHeader>
      <CardTitle>{text.breedingResult}</CardTitle>
      <PairTypeBadges locale={locale} pair={pair} />
    </CardHeader>
    <CardContent>
      <div className="palworld-direct-parent-summary">
        <BreedingPalButton locale={locale} onOpen={onOpenPal} pal={pair.parentA} role={text.parentRoleA} />
        <span aria-hidden="true">＋</span>
        <BreedingPalButton locale={locale} onOpen={onOpenPal} pal={pair.parentB} role={text.parentRoleB} />
      </div>
      <div className="palworld-direct-result-connector" aria-hidden="true">↓</div>
      <div className="palworld-direct-result-hero">
        <BreedingPalButton emphasis="hero" locale={locale} onOpen={onOpenPal} pal={pair.child} role={text.resultPal} />
      </div>
      <div className="palworld-direct-result-actions">
        <Button variant="primary" onClick={() => onOpenPal(pair.child.id)}>{text.resultPalDetails}</Button>
        <Button variant="secondary" onClick={() => onViewParents(pair.child.id)}>{text.viewResultParents}</Button>
        <Button variant="ghost" onClick={onCopy}>{text.copyLink}</Button>
      </div>
    </CardContent>
  </Card>;
}

export function BreedingGenderAlternativeCard({
  locale,
  onApply,
  onOpenPal,
  pair,
}: {
  locale: PalworldLocale;
  onApply: (pair: PalworldBreedingPair) => void;
  onOpenPal: (id: string) => void;
  pair: PalworldBreedingPair;
}) {
  const text = palworldI18n[locale];
  const childName = resolvePalworldName(pair.child, locale).text;
  const conditionLabel = pair.genderCondition
    ? `${genderLabel(pair.genderCondition.parentA, locale)} / ${genderLabel(pair.genderCondition.parentB, locale)}`
    : text.genderSettingsOptional;
  return <Card className="palworld-gender-alternative-card">
    <CardHeader><PairTypeBadges locale={locale} pair={pair} /></CardHeader>
    <CardContent>
      <BreedingPalButton emphasis="target" locale={locale} onOpen={onOpenPal} pal={pair.child} role={text.resultPal} />
      <Button
        variant="primary"
        aria-label={`${text.applyGenderCondition}: ${childName}, ${conditionLabel}`}
        onClick={() => onApply(pair)}
      >
        {text.applyGenderCondition}
      </Button>
    </CardContent>
  </Card>;
}

export function ReverseBreedingTargetSummary({
  child,
  locale,
  onOpenPal,
  pagination,
}: {
  child: PalworldPalReference;
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  pagination?: PalworldPagination;
}) {
  const text = palworldI18n[locale];
  return <Card className="palworld-reverse-target-summary" data-testid="breeding-target-summary">
    <CardContent>
      <BreedingPalButton emphasis="target" locale={locale} onOpen={onOpenPal} pal={child} role={text.targetPalSummary} />
      {pagination ? <div className="palworld-reverse-target-counts">
        <strong>{formatTemplate(text.totalPairCount, { count: pagination.total.toLocaleString() })}</strong>
        {pagination.totalPages > 0
          ? <span>{formatTemplate(text.pageCount, { current: pagination.page, total: pagination.totalPages })}</span>
          : null}
      </div> : null}
    </CardContent>
  </Card>;
}

export function ReverseBreedingPairCard({
  locale,
  onOpenPal,
  onUsePair,
  pair,
}: {
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  onUsePair: (pair: PalworldBreedingPair) => void;
  pair: PalworldBreedingPair;
}) {
  const text = palworldI18n[locale];
  return <Card className="palworld-reverse-pair-card" data-testid="breeding-reverse-pair">
    <CardHeader><PairTypeBadges locale={locale} pair={pair} /></CardHeader>
    <CardContent>
      <div className="palworld-reverse-parents">
        <BreedingPalButton locale={locale} onOpen={onOpenPal} pal={pair.parentA} role={text.parentRoleA} />
        <span aria-hidden="true">＋</span>
        <BreedingPalButton locale={locale} onOpen={onOpenPal} pal={pair.parentB} role={text.parentRoleB} />
      </div>
      <div className="palworld-reverse-pair-actions">
        <Button variant="secondary" onClick={() => onUsePair(pair)}>{text.sendToCalculator}</Button>
      </div>
    </CardContent>
  </Card>;
}

export function BreedingRequestStatus({ message }: { message: string }) {
  return <p className="yoro-u-sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>;
}
