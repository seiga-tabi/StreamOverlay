import { useEffect, useState } from "react";
import type {
  PalworldAcquisitionMethod,
  PalworldItemDetail,
  PalworldPalDetail,
  PalworldPalReference,
  PalworldSkill,
  PalworldTranslationDisplayStatus,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "../../../shared/ui/Modal";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldItem, getPalworldPal } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber } from "../utils/search";
import { acquisitionLabel, categoryLabel, genderLabel, workLabel } from "../utils/labels";
import {
  resolvePalworldDescription,
  resolvePalworldLocalizedText,
  resolvePalworldName,
  type PalworldTranslationCarrier,
} from "../utils/localization";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldTranslationBadge, PalworldTranslationBadges } from "./PalworldTranslationBadge";

type NameReference = PalworldTranslationCarrier & { id: string; nameKo?: string; nameJa?: string; nameEn: string };
type ImageDimensionCompatibility = { imageWidth?: number; imageHeight?: number };

function referenceName(value: NameReference, locale: PalworldLocale): string {
  return resolvePalworldName(value, locale).text;
}

function referenceTranslationStatuses(values: readonly NameReference[], locale: PalworldLocale): PalworldTranslationDisplayStatus[] {
  return values.map((value) => resolvePalworldName(value, locale).status);
}

function multilingualNames(value: NameReference): string {
  return [value.nameKo, value.nameJa, value.nameEn].filter((name): name is string => Boolean(name?.trim())).join(" · ");
}

function imageDimensions(value: ImageDimensionCompatibility): { intrinsicWidth?: number; intrinsicHeight?: number } {
  return { intrinsicWidth: value.imageWidth, intrinsicHeight: value.imageHeight };
}

function acquisitionText(method: PalworldAcquisitionMethod, locale: PalworldLocale) {
  return resolvePalworldLocalizedText(
    method,
    "label",
    locale,
    locale === "ja" ? method.labelJa : method.labelKo,
    method.labelEn,
  );
}

function acquisitionLocation(method: PalworldAcquisitionMethod, locale: PalworldLocale) {
  return resolvePalworldLocalizedText(
    method,
    "location",
    locale,
    locale === "ja" ? method.locationJa : method.locationKo,
    method.locationEn,
  );
}

function SkillDescription({ locale, skill }: { locale: PalworldLocale; skill: PalworldSkill }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(skill, locale);
  const description = resolvePalworldDescription(skill, locale);
  const statuses: PalworldTranslationDisplayStatus[] = [name.status, description.status];
  return <div className="palworld-skill-detail-copy">
    <PalworldTranslationBadges locale={locale} statuses={statuses} />
    <div className="palworld-badge-row">
      {skill.element ? <PalworldElementBadge element={skill.element} locale={locale} /> : null}
      {skill.power !== undefined ? <Badge size="sm">{text.power} {skill.power}</Badge> : null}
      {skill.cooldownSeconds !== undefined ? <Badge size="sm">{text.cooldown} {skill.cooldownSeconds}{text.seconds}</Badge> : null}
      {skill.unlockLevel !== undefined ? <Badge size="sm">{text.unlockLevel} {skill.unlockLevel}</Badge> : null}
    </div>
    <p className="palworld-localized-copy">{description.text || text.originalDataUnavailable}</p>
  </div>;
}

function DataRow({ labelJa, labelKo, locale, children }: { labelJa: string; labelKo: string; locale: PalworldLocale; children: React.ReactNode }) {
  return <div className="palworld-data-row"><dt data-ko={labelKo} data-ja={labelJa}>{locale === "ja" ? labelJa : labelKo}</dt><dd>{children}</dd></div>;
}

function SpecialParentPair({
  locale,
  pair,
}: {
  locale: PalworldLocale;
  pair: PalworldPalDetail["breeding"]["specialParentPairs"][number] & {
    parentA?: PalworldPalReference;
    parentB?: PalworldPalReference;
  };
}) {
  const text = palworldI18n[locale];
  const hasGenderCondition = pair.parentAGender !== undefined || pair.parentBGender !== undefined;
  const genderKo = `${palworldI18n.ko.genderCondition}: ${genderLabel(pair.parentAGender ?? "any", "ko")} / ${genderLabel(pair.parentBGender ?? "any", "ko")}`;
  const genderJa = `${palworldI18n.ja.genderCondition}: ${genderLabel(pair.parentAGender ?? "any", "ja")} / ${genderLabel(pair.parentBGender ?? "any", "ja")}`;
  return <li className="palworld-special-parent-pair">
    {pair.parentA && pair.parentB ? (
      <div className="palworld-special-parent-flow">
        <SpecialParentReference locale={locale} pal={pair.parentA} role={text.parentRoleA} />
        <span aria-hidden="true">＋</span>
        <SpecialParentReference locale={locale} pal={pair.parentB} role={text.parentRoleB} />
      </div>
    ) : <span data-ko={palworldI18n.ko.specialParentDataUnavailable} data-ja={palworldI18n.ja.specialParentDataUnavailable}>{text.specialParentDataUnavailable}</span>}
    {hasGenderCondition ? <Badge size="sm" tone="warning" data-ko={genderKo} data-ja={genderJa}>{locale === "ja" ? genderJa : genderKo}</Badge> : null}
  </li>;
}

function SpecialParentReference({ locale, pal, role }: { locale: PalworldLocale; pal: PalworldPalReference; role: string }) {
  const name = resolvePalworldName(pal, locale);
  return <div className="palworld-special-parent-reference">
    <span className="palworld-related-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name.text} locale={locale} {...imageDimensions(pal)} /></span>
    <span><small>{role} · {formatPalNumber(pal.number)}</small><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><span className="palworld-badge-row palworld-compact-element-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
  </div>;
}

function ErrorPanel({ locale, onRetry }: { locale: PalworldLocale; onRetry: () => void }) {
  const text = palworldI18n[locale];
  return <div className="palworld-modal-error" role="alert"><p data-ko={palworldI18n.ko.apiError} data-ja={palworldI18n.ja.apiError}>{text.apiError}</p><Button variant="secondary" onClick={onRetry}>{text.retry}</Button></div>;
}

export function PalDetailModal({
  locale,
  onClose,
  onOpenItem,
  palId,
}: {
  locale: PalworldLocale;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  palId?: string;
}) {
  const [detail, setDetail] = useState<PalworldPalDetail | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];
  useBodyScrollLock(Boolean(palId));

  useEffect(() => {
    if (!palId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    setDetail(null);
    setError(false);
    void getPalworldPal(palId, controller.signal).then(setDetail).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [palId, revision]);

  const name = detail ? resolvePalworldName(detail, locale) : null;
  const displayName = name?.text ?? text.details;
  const description = detail ? resolvePalworldDescription(detail, locale) : null;
  const dropDetails = detail?.dropDetails;
  return (
    <Modal open={Boolean(palId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="pal-detail-modal">
      <ModalHeader><ModalTitle>{displayName}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
      <ModalContent>
        {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
        {error ? <ErrorPanel locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {detail ? (
          <article className="palworld-detail">
            <div className="palworld-detail-hero">
              <div className="palworld-detail-media"><PalworldMedia kind="pal" imageUrl={detail.imageUrl} alt={displayName} locale={locale} priority {...imageDimensions(detail)} /></div>
              <div><span className="palworld-detail-number">{formatPalNumber(detail.number)}</span><h3>{displayName}</h3><p>{multilingualNames(detail)}</p>{name ? <PalworldTranslationBadges locale={locale} statuses={[name.status]} /> : null}<div className="palworld-badge-row">{detail.elements.map((element) => <PalworldElementBadge element={element} locale={locale} size="md" key={element} />)}<Badge tone="warning">★ {detail.rarity}</Badge><Badge>{detail.variantType === "normal" ? text.normal : detail.variantType === "special" ? text.special : text.variantPal}</Badge></div></div>
            </div>
            <section><h4 data-ko={palworldI18n.ko.descriptionLabel} data-ja={palworldI18n.ja.descriptionLabel}>{text.descriptionLabel}</h4>{description ? <PalworldTranslationBadges locale={locale} statuses={[description.status]} /> : null}<p className="palworld-localized-copy">{description?.text || text.originalDataUnavailable}</p></section>
            <section><h4 data-ko={palworldI18n.ko.stats} data-ja={palworldI18n.ja.stats}>{text.stats}</h4><dl className="palworld-stat-grid">
              <DataRow locale={locale} labelKo={palworldI18n.ko.hp} labelJa={palworldI18n.ja.hp}>{detail.stats.hp}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.attack} labelJa={palworldI18n.ja.attack}>{detail.stats.attack}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.defense} labelJa={palworldI18n.ja.defense}>{detail.stats.defense}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.moveSpeed} labelJa={palworldI18n.ja.moveSpeed}>{detail.stats.moveSpeed}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.stamina} labelJa={palworldI18n.ja.stamina}>{detail.stats.stamina}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.nocturnal} labelJa={palworldI18n.ja.nocturnal}><span data-ko={detail.nocturnal ? palworldI18n.ko.yes : palworldI18n.ko.no} data-ja={detail.nocturnal ? palworldI18n.ja.yes : palworldI18n.ja.no}>{detail.nocturnal ? text.yes : text.no}</span></DataRow>
            </dl></section>
            <section><h4 data-ko={palworldI18n.ko.workSuitabilities} data-ja={palworldI18n.ja.workSuitabilities}>{text.workSuitabilities}</h4><div className="palworld-badge-row">{detail.workSuitabilities.map((work) => <Badge tone="success" key={work.type}>{workLabel(work.type, locale)} Lv.{work.level}</Badge>)}</div></section>
            <section><h4 data-ko={palworldI18n.ko.partnerSkill} data-ja={palworldI18n.ja.partnerSkill}>{text.partnerSkill}</h4>{detail.partnerSkill ? <div className="palworld-skill-detail-list"><strong>{referenceName(detail.partnerSkill, locale)}</strong><SkillDescription locale={locale} skill={detail.partnerSkill} /></div> : <p>{text.originalDataUnavailable}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.activeSkills} data-ja={palworldI18n.ja.activeSkills}>{text.activeSkills}</h4>{detail.activeSkills.length ? <ul className="palworld-skill-detail-list">{detail.activeSkills.map((skill) => <li key={skill.id}><strong>{referenceName(skill, locale)}</strong><SkillDescription locale={locale} skill={skill} /></li>)}</ul> : <p>{text.originalDataUnavailable}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.drops} data-ja={palworldI18n.ja.drops}>{text.drops}</h4>{dropDetails?.length ? <><div className="palworld-drop-list">{dropDetails.map((drop) => <div className="palworld-drop-row" key={drop.item.id}><button type="button" onClick={() => onOpenItem(drop.item.id)}>{referenceName(drop.item, locale)}</button><span>{text.dropQuantity} {drop.minQuantity === drop.maxQuantity ? drop.minQuantity : `${drop.minQuantity}–${drop.maxQuantity}`}{drop.dropRatePercent !== undefined ? ` · ${text.dropRate} ${drop.dropRatePercent}%` : ""}</span></div>)}</div><PalworldTranslationBadges locale={locale} statuses={referenceTranslationStatuses(dropDetails.map((drop) => drop.item), locale)} /></> : detail.drops.length ? <><div className="palworld-link-list">{detail.drops.map((drop) => <button type="button" onClick={() => onOpenItem(drop.id)} key={drop.id}>{referenceName(drop, locale)}</button>)}</div><PalworldTranslationBadges locale={locale} statuses={referenceTranslationStatuses(detail.drops, locale)} /></> : <p>{text.originalDataUnavailable}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.breedingInfo} data-ja={palworldI18n.ja.breedingInfo}>{text.breedingInfo}</h4><p>{text.breedingPower}: {detail.breeding.breedingPower ?? text.unknown}</p>{detail.breeding.specialParentPairs.length ? <div><strong>{text.specialParentPairs}</strong><ul>{detail.breeding.specialParentPairs.map((pair) => <SpecialParentPair locale={locale} pair={pair} key={`${pair.parentAId}-${pair.parentBId}-${pair.parentAGender ?? "any"}-${pair.parentBGender ?? "any"}`} />)}</ul></div> : null}</section>
            <section className="palworld-source"><h4 data-ko={palworldI18n.ko.source} data-ja={palworldI18n.ja.source}>{text.source}</h4><p>{detail.metadata.sourceName} · {detail.metadata.sourceRevision}</p><p>{text.gameVersion}: {detail.metadata.gameVersion} · {text.license}: {detail.metadata.license}</p></section>
          </article>
        ) : null}
      </ModalContent>
    </Modal>
  );
}

export function ItemDetailModal({
  itemId,
  locale,
  onClose,
  onOpenItem,
  onOpenPal,
}: {
  itemId?: string;
  locale: PalworldLocale;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  onOpenPal: (id: string) => void;
}) {
  const [detail, setDetail] = useState<PalworldItemDetail | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];
  useBodyScrollLock(Boolean(itemId));

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      return undefined;
    }
    const controller = new AbortController();
    setDetail(null);
    setError(false);
    void getPalworldItem(itemId, controller.signal).then(setDetail).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [itemId, revision]);

  const name = detail ? resolvePalworldName(detail, locale) : null;
  const displayName = name?.text ?? text.details;
  const description = detail ? resolvePalworldDescription(detail, locale) : null;
  return (
    <Modal open={Boolean(itemId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="item-detail-modal">
      <ModalHeader><ModalTitle>{displayName}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
      <ModalContent>
        {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
        {error ? <ErrorPanel locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {detail ? (
          <article className="palworld-detail">
            <div className="palworld-detail-hero">
              <div className="palworld-detail-media"><PalworldMedia kind="item" imageUrl={detail.imageUrl} alt={displayName} locale={locale} priority {...imageDimensions(detail)} /></div>
              <div><h3>{displayName}</h3><p>{multilingualNames(detail)}</p>{name ? <PalworldTranslationBadges locale={locale} statuses={[name.status]} /> : null}<div className="palworld-badge-row"><Badge tone="info">{categoryLabel(detail.category, locale)}</Badge><Badge tone="warning">★ {detail.rarity}</Badge></div></div>
            </div>
            <dl className="palworld-detail-list">
              <DataRow locale={locale} labelKo={palworldI18n.ko.internalId} labelJa={palworldI18n.ja.internalId}><code>{detail.sourceInternalId ?? detail.id}</code></DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.descriptionLabel} labelJa={palworldI18n.ja.descriptionLabel}><span className="palworld-localized-copy">{description?.text || text.originalDataUnavailable}</span>{description ? <PalworldTranslationBadges locale={locale} statuses={[description.status]} /> : null}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.sellPrice} labelJa={palworldI18n.ja.sellPrice}>{detail.sellPrice ?? text.none}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.technologyLevel} labelJa={palworldI18n.ja.technologyLevel}>{detail.technologyLevel ?? text.none}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.weight} labelJa={palworldI18n.ja.weight}>{detail.weight ?? text.originalDataUnavailable}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.maxStack} labelJa={palworldI18n.ja.maxStack}>{detail.maxStack ?? text.originalDataUnavailable}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.durability} labelJa={palworldI18n.ja.durability}>{detail.durability ?? text.originalDataUnavailable}</DataRow>
            </dl>
            <section><h4 data-ko={palworldI18n.ko.craftingMaterials} data-ja={palworldI18n.ja.craftingMaterials}>{text.craftingMaterials}</h4>{detail.craftingMaterials.length ? <><div className="palworld-link-list">{detail.craftingMaterials.map(({ item, quantity }) => <button type="button" onClick={() => onOpenItem(item.id)} key={item.id}>{referenceName(item, locale)} × {quantity}</button>)}</div><PalworldTranslationBadges locale={locale} statuses={referenceTranslationStatuses(detail.craftingMaterials.map(({ item }) => item), locale)} /></> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.craftingFacility} data-ja={palworldI18n.ja.craftingFacility}>{text.craftingFacility}</h4>{detail.craftingFacility ? <p>{referenceName(detail.craftingFacility, locale)} <PalworldTranslationBadge locale={locale} status={resolvePalworldName(detail.craftingFacility, locale).status} /></p> : <p>{text.originalDataUnavailable}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.dropPals} data-ja={palworldI18n.ja.dropPals}>{text.dropPals}</h4>{detail.dropPals.length ? <><div className="palworld-link-list">{detail.dropPals.map((pal) => {
              const palDisplayName = referenceName(pal, locale);
              return <button className="palworld-related-pal-link" type="button" onClick={() => onOpenPal(pal.id)} key={pal.id}><span className="palworld-related-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={palDisplayName} locale={locale} {...imageDimensions(pal)} /></span><span>{palDisplayName}</span></button>;
            })}</div><PalworldTranslationBadges locale={locale} statuses={referenceTranslationStatuses(detail.dropPals, locale)} /></> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.acquisitionMethods} data-ja={palworldI18n.ja.acquisitionMethods}>{text.acquisitionMethods}</h4>{detail.acquisitionMethods.length ? <ul>{detail.acquisitionMethods.map((method, index) => {
              const label = acquisitionText(method, locale);
              const location = acquisitionLocation(method, locale);
              const statuses = [label.status, ...(location.text ? [location.status] : [])];
              return <li className="palworld-localized-copy" key={`${method.type}-${index}`}><strong>{acquisitionLabel(method.type, locale)}</strong> · {label.text || text.originalDataUnavailable}{location.text ? ` · ${location.text}` : ""}<PalworldTranslationBadges locale={locale} statuses={statuses} /></li>;
            })}</ul> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.relatedItems} data-ja={palworldI18n.ja.relatedItems}>{text.relatedItems}</h4>{detail.relatedItems.length ? <><div className="palworld-link-list">{detail.relatedItems.map((item) => <button type="button" onClick={() => onOpenItem(item.id)} key={item.id}>{referenceName(item, locale)}</button>)}</div><PalworldTranslationBadges locale={locale} statuses={referenceTranslationStatuses(detail.relatedItems, locale)} /></> : <p>{text.originalDataUnavailable}</p>}</section>
            <section className="palworld-source"><h4 data-ko={palworldI18n.ko.source} data-ja={palworldI18n.ja.source}>{text.source}</h4><p>{detail.metadata.sourceName} · {detail.metadata.sourceRevision}</p><p>{text.gameVersion}: {detail.metadata.gameVersion} · {text.license}: {detail.metadata.license}</p></section>
          </article>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
