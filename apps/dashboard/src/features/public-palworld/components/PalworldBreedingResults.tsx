import type { PalworldBreedingPair, PalworldPalReference, PalworldPagination } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import {
  orientBreedingPairForSelectedParent,
} from "../utils/breeding";
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

export function BreedingEmptyGuide({ locale }: { locale: PalworldLocale }) {
  const text = palworldI18n[locale];
  const steps = [text.breedingStepParentA, text.breedingStepTarget, text.breedingStepResult];

  return <div className="palworld-breeding-empty-guide" data-testid="breeding-board-empty">
    <div aria-hidden="true" className="palworld-breeding-empty-icon">🧬</div>
    <p className="palworld-breeding-empty-kicker">{text.breedingGuideKicker}</p>
    <h3>{text.selectAtLeastOneParent}</h3>
    <p className="palworld-breeding-empty-description">{text.autoCalculateHint}</p>
    <ol className="palworld-breeding-empty-steps">
      {steps.map((step, index) => <li key={step}>
        <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <strong>{step}</strong>
      </li>)}
    </ol>
  </div>;
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
        <span aria-hidden="true">×</span>
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
  loadedCount,
  locale,
  onOpenPal,
  pagination,
}: {
  child: PalworldPalReference;
  loadedCount?: number;
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
        {pagination.total > 0 && loadedCount !== undefined
          ? <span>{formatTemplate(text.loadedPairCount, {
            loaded: loadedCount.toLocaleString(),
            total: pagination.total.toLocaleString(),
          })}</span>
          : null}
      </div> : null}
    </CardContent>
  </Card>;
}

export type BreedingCombinationListVariant = "partner-results" | "reverse-results";

function BreedingPalCell({
  cellRole = true,
  gender,
  locale,
  mobileLabel,
  onOpenPal,
  pal,
  result = false,
}: {
  cellRole?: boolean;
  gender?: NonNullable<PalworldBreedingPair["genderCondition"]>["parentA"];
  locale: PalworldLocale;
  mobileLabel: string;
  onOpenPal: (id: string) => void;
  pal: PalworldPalReference;
  result?: boolean;
}) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(pal, locale);
  const detailLabel = result ? text.resultPalDetails : text.openParentPalDetails;
  return <div className="palworld-breeding-combination-cell is-pal" role={cellRole ? "cell" : undefined}>
    <span aria-hidden="true" className="palworld-breeding-combination-mobile-label">{mobileLabel}</span>
    <button
      aria-label={`${detailLabel}: ${name.text}`}
      className="palworld-breeding-pal-button palworld-breeding-combination-pal"
      onClick={() => onOpenPal(pal.id)}
      type="button"
    >
      <span className="palworld-breeding-combination-media">
        <PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt="" locale={locale} />
      </span>
      <span className="palworld-breeding-combination-copy">
        <strong>{name.text}</strong>
        <span className="palworld-breeding-combination-meta">
          <small>{formatPalNumber(pal.number, locale)}</small>
          {pal.elements[0] ? <PalworldElementBadge element={pal.elements[0]} locale={locale} /> : null}
        </span>
        <PalworldTranslationBadge locale={locale} status={name.status} />
      </span>
    </button>
    {gender ? <Badge size="sm" tone="warning">{genderLabel(gender, locale)}</Badge> : null}
  </div>;
}

function BreedingCombinationConditionCell({
  cellRole = true,
  locale,
  onUsePair,
  pair,
}: {
  cellRole?: boolean;
  locale: PalworldLocale;
  onUsePair?: (pair: PalworldBreedingPair) => void;
  pair: PalworldBreedingPair;
}) {
  const text = palworldI18n[locale];
  const parentAName = resolvePalworldName(pair.parentA, locale).text;
  const parentBName = resolvePalworldName(pair.parentB, locale).text;
  return <div className="palworld-breeding-combination-cell is-action" role={cellRole ? "cell" : undefined}>
    <span aria-hidden="true" className="palworld-breeding-combination-mobile-label">{text.breedingCondition}</span>
    <div className="palworld-breeding-combination-badges">
      <Badge size="sm" tone={pair.isSpecial ? "warning" : "info"}>
        {pair.isSpecial ? text.specialBreeding : text.normalBreeding}
      </Badge>
      {onUsePair ? <Button
        size="sm"
        variant="secondary"
        aria-label={`${text.usePairAction}: ${parentAName} × ${parentBName}`}
        onClick={() => onUsePair(pair)}
      >
        {text.usePairAction}
      </Button> : null}
    </div>
  </div>;
}

export function ReverseBreedingPairCard({
  locale,
  onOpenPal,
  onUsePair,
  pair,
  rowIndex,
}: {
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  onUsePair?: (pair: PalworldBreedingPair) => void;
  pair: PalworldBreedingPair;
  rowIndex?: number;
}) {
  const text = palworldI18n[locale];
  return <div
    className="palworld-breeding-combination-row is-reverse"
    data-testid="breeding-reverse-pair"
    aria-rowindex={rowIndex}
    role="row"
  >
    <BreedingPalCell
      gender={pair.genderCondition?.parentA}
      locale={locale}
      mobileLabel={text.parentRoleA}
      onOpenPal={onOpenPal}
      pal={pair.parentA}
    />
    <span aria-hidden="true" className="palworld-breeding-combination-symbol is-plus">×</span>
    <BreedingPalCell
      gender={pair.genderCondition?.parentB}
      locale={locale}
      mobileLabel={text.parentRoleB}
      onOpenPal={onOpenPal}
      pal={pair.parentB}
    />
    <BreedingCombinationConditionCell locale={locale} onUsePair={onUsePair} pair={pair} />
  </div>;
}

export function BreedingPartnerPairCard({
  locale,
  onOpenPal,
  onUsePair,
  pair,
  rowIndex,
  selectedParentId,
}: {
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  onUsePair?: (pair: PalworldBreedingPair) => void;
  pair: PalworldBreedingPair;
  rowIndex?: number;
  selectedParentId: string;
}) {
  const text = palworldI18n[locale];
  const oriented = orientBreedingPairForSelectedParent(pair, selectedParentId);
  if (!oriented) {
    return <p className="palworld-breeding-combination-invalid" role="alert">{text.invalidPartnerPair}</p>;
  }
  return <div
    className="palworld-breeding-combination-row is-partner"
    data-testid="breeding-partner-pair"
    aria-rowindex={rowIndex}
    role="row"
  >
    <BreedingPalCell
      gender={oriented.selectedParentGender}
      locale={locale}
      mobileLabel={text.selectedParent}
      onOpenPal={onOpenPal}
      pal={oriented.selectedParent}
    />
    <span aria-hidden="true" className="palworld-breeding-combination-symbol is-plus">×</span>
    <BreedingPalCell
      gender={oriented.partnerParentGender}
      locale={locale}
      mobileLabel={text.partnerParent}
      onOpenPal={onOpenPal}
      pal={oriented.partnerParent}
    />
    <span aria-hidden="true" className="palworld-breeding-combination-symbol is-arrow">=</span>
    <div className="palworld-breeding-combination-result" role="cell">
      <BreedingPalCell
        cellRole={false}
        locale={locale}
        mobileLabel={text.resultPal}
        onOpenPal={onOpenPal}
        pal={oriented.child}
        result
      />
      <BreedingCombinationConditionCell
        cellRole={false}
        locale={locale}
        onUsePair={onUsePair}
        pair={pair}
      />
    </div>
  </div>;
}

export function BreedingCombinationList({
  labelledBy,
  loading = false,
  locale,
  onOpenPal,
  onUsePair,
  pairs,
  selectedParentId,
  total,
  variant,
}: {
  labelledBy: string;
  loading?: boolean;
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  onUsePair?: (pair: PalworldBreedingPair) => void;
  pairs: PalworldBreedingPair[];
  selectedParentId?: string;
  total: number;
  variant: BreedingCombinationListVariant;
}) {
  const text = palworldI18n[locale];
  const isPartner = variant === "partner-results";
  const headerLabels = isPartner
    ? [text.selectedParent, text.partnerParent, text.resultPal]
    : [text.parentRoleA, text.parentRoleB, text.breedingCondition];
  const invalidPartnerPair = isPartner && (
    !selectedParentId
    || pairs.some((pair) => !orientBreedingPairForSelectedParent(pair, selectedParentId))
  );
  if (invalidPartnerPair) {
    return <p className="palworld-breeding-combination-invalid" role="alert">{text.invalidPartnerPair}</p>;
  }
  return <>
    {isPartner ? <div aria-live="polite" className="palworld-breeding-combination-summary">
      <strong>{formatTemplate(text.availableCombinationCount, {
        count: total.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
      })}</strong>
      <span>{formatTemplate(text.visibleCombinationCount, {
        loaded: pairs.length.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
        total: total.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
      })}</span>
    </div> : null}
    <div
      aria-labelledby={labelledBy}
      aria-busy={loading}
      aria-rowcount={total + 1}
      className={`palworld-breeding-combination-list is-${variant}`}
      role="table"
    >
      <div className="palworld-breeding-combination-header" role="rowgroup">
        <div role="row">
          {headerLabels.map((label) => <span key={label} role="columnheader">{label}</span>)}
        </div>
      </div>
      <div role="rowgroup">
        {pairs.map((pair, index) => isPartner
          ? <BreedingPartnerPairCard
              key={pair.id}
              locale={locale}
              onOpenPal={onOpenPal}
              onUsePair={onUsePair}
              pair={pair}
              rowIndex={index + 2}
              selectedParentId={selectedParentId!}
            />
          : <ReverseBreedingPairCard
              key={pair.id}
              locale={locale}
              onOpenPal={onOpenPal}
              onUsePair={onUsePair}
              pair={pair}
              rowIndex={index + 2}
            />)}
        {loading ? Array.from({ length: 2 }, (_, index) => <div
          aria-hidden="true"
          className="palworld-breeding-combination-row is-appending"
          key={`breeding-appending-${index}`}
          role="row"
        >
          <Skeleton className="palworld-breeding-combination-skeleton-cell" role="cell" />
          <Skeleton className="palworld-breeding-combination-skeleton-cell" role="cell" />
          <Skeleton className="palworld-breeding-combination-skeleton-cell" role="cell" />
        </div>) : null}
      </div>
    </div>
  </>;
}

export function BreedingCombinationListSkeleton({
  locale,
  rows = 5,
  variant,
}: {
  locale: PalworldLocale;
  rows?: number;
  variant: BreedingCombinationListVariant;
}) {
  const text = palworldI18n[locale];
  const labels = variant === "partner-results"
    ? [text.selectedParent, text.partnerParent, text.resultPal]
    : [text.parentRoleA, text.parentRoleB, text.breedingCondition];
  return <div aria-hidden="true" className={`palworld-breeding-combination-list is-${variant} is-loading`}>
    <div className="palworld-breeding-combination-header">
      <div>{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
    <div>
      {Array.from({ length: rows }, (_, index) => <div
        className="palworld-breeding-combination-row"
        key={`breeding-row-skeleton-${index}`}
      >
        <Skeleton className="palworld-breeding-combination-skeleton-cell" />
        <Skeleton className="palworld-breeding-combination-skeleton-cell" />
        <Skeleton className="palworld-breeding-combination-skeleton-cell" />
      </div>)}
    </div>
  </div>;
}

export function BreedingRequestStatus({ message }: { message: string }) {
  return <p className="yoro-u-sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>;
}
