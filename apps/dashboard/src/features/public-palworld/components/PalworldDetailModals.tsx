import { useEffect, useState } from "react";
import type { PalworldItemDetail, PalworldPalDetail } from "@streamops/shared";
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
import { acquisitionLabel, categoryLabel, elementLabel, workLabel } from "../utils/labels";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { PalworldMedia } from "./PalworldMedia";

type NameReference = { id: string; nameKo: string; nameJa: string; nameEn: string };

function referenceName(value: NameReference, locale: PalworldLocale): string {
  return locale === "ja" ? value.nameJa : value.nameKo;
}

function DataRow({ labelJa, labelKo, locale, children }: { labelJa: string; labelKo: string; locale: PalworldLocale; children: React.ReactNode }) {
  return <div className="palworld-data-row"><dt data-ko={labelKo} data-ja={labelJa}>{locale === "ja" ? labelJa : labelKo}</dt><dd>{children}</dd></div>;
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

  const displayName = detail ? referenceName(detail, locale) : text.details;
  return (
    <Modal open={Boolean(palId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="pal-detail-modal">
      <ModalHeader><ModalTitle>{displayName}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
      <ModalContent>
        {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
        {error ? <ErrorPanel locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {detail ? (
          <article className="palworld-detail">
            <div className="palworld-detail-hero">
              <div className="palworld-detail-media"><PalworldMedia kind="pal" imageUrl={detail.imageUrl} alt={displayName} locale={locale} /></div>
              <div><span className="palworld-detail-number">{formatPalNumber(detail.number)}</span><h3>{displayName}</h3><p>{detail.nameKo} · {detail.nameJa} · {detail.nameEn}</p><div className="palworld-badge-row">{detail.elements.map((element) => <Badge tone="info" key={element}>{elementLabel(element, locale)}</Badge>)}<Badge tone="warning">★ {detail.rarity}</Badge><Badge>{detail.variantType === "normal" ? text.normal : detail.variantType === "special" ? text.special : text.variantPal}</Badge></div></div>
            </div>
            <section><h4 data-ko={palworldI18n.ko.stats} data-ja={palworldI18n.ja.stats}>{text.stats}</h4><dl className="palworld-stat-grid">
              <DataRow locale={locale} labelKo={palworldI18n.ko.hp} labelJa={palworldI18n.ja.hp}>{detail.stats.hp}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.attack} labelJa={palworldI18n.ja.attack}>{detail.stats.attack}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.defense} labelJa={palworldI18n.ja.defense}>{detail.stats.defense}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.moveSpeed} labelJa={palworldI18n.ja.moveSpeed}>{detail.stats.moveSpeed}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.stamina} labelJa={palworldI18n.ja.stamina}>{detail.stats.stamina}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.nocturnal} labelJa={palworldI18n.ja.nocturnal}><span data-ko={detail.nocturnal ? palworldI18n.ko.yes : palworldI18n.ko.no} data-ja={detail.nocturnal ? palworldI18n.ja.yes : palworldI18n.ja.no}>{detail.nocturnal ? text.yes : text.no}</span></DataRow>
            </dl></section>
            <section><h4 data-ko={palworldI18n.ko.workSuitabilities} data-ja={palworldI18n.ja.workSuitabilities}>{text.workSuitabilities}</h4><div className="palworld-badge-row">{detail.workSuitabilities.map((work) => <Badge tone="success" key={work.type}>{workLabel(work.type, locale)} Lv.{work.level}</Badge>)}</div></section>
            <section><h4 data-ko={palworldI18n.ko.partnerSkill} data-ja={palworldI18n.ja.partnerSkill}>{text.partnerSkill}</h4><p>{detail.partnerSkill ? referenceName(detail.partnerSkill, locale) : text.none}</p></section>
            <section><h4 data-ko={palworldI18n.ko.activeSkills} data-ja={palworldI18n.ja.activeSkills}>{text.activeSkills}</h4>{detail.activeSkills.length ? <ul>{detail.activeSkills.map((skill) => <li key={skill.id}><strong>{referenceName(skill, locale)}</strong>{skill.power !== undefined ? ` · ${skill.power}` : ""}</li>)}</ul> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.drops} data-ja={palworldI18n.ja.drops}>{text.drops}</h4>{detail.drops.length ? <div className="palworld-link-list">{detail.drops.map((drop) => <button type="button" onClick={() => onOpenItem(drop.id)} key={drop.id}>{referenceName(drop, locale)}</button>)}</div> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.breedingInfo} data-ja={palworldI18n.ja.breedingInfo}>{text.breedingInfo}</h4><p>{text.breedingPower}: {detail.breeding.breedingPower ?? text.unknown}</p></section>
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

  const displayName = detail ? referenceName(detail, locale) : text.details;
  const description = detail ? (locale === "ja" ? detail.descriptionJa : detail.descriptionKo) : "";
  return (
    <Modal open={Boolean(itemId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="item-detail-modal">
      <ModalHeader><ModalTitle>{displayName}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
      <ModalContent>
        {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
        {error ? <ErrorPanel locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {detail ? (
          <article className="palworld-detail">
            <div className="palworld-detail-hero">
              <div className="palworld-detail-media"><PalworldMedia kind="item" imageUrl={detail.imageUrl} alt={displayName} locale={locale} /></div>
              <div><h3>{displayName}</h3><p>{detail.nameKo} · {detail.nameJa} · {detail.nameEn}</p><div className="palworld-badge-row"><Badge tone="info">{categoryLabel(detail.category, locale)}</Badge><Badge tone="warning">★ {detail.rarity}</Badge></div></div>
            </div>
            <dl className="palworld-detail-list">
              <DataRow locale={locale} labelKo={palworldI18n.ko.internalId} labelJa={palworldI18n.ja.internalId}><code>{detail.id}</code></DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.descriptionLabel} labelJa={palworldI18n.ja.descriptionLabel}>{description}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.sellPrice} labelJa={palworldI18n.ja.sellPrice}>{detail.sellPrice ?? text.none}</DataRow>
              <DataRow locale={locale} labelKo={palworldI18n.ko.technologyLevel} labelJa={palworldI18n.ja.technologyLevel}>{detail.technologyLevel ?? text.none}</DataRow>
            </dl>
            <section><h4 data-ko={palworldI18n.ko.craftingMaterials} data-ja={palworldI18n.ja.craftingMaterials}>{text.craftingMaterials}</h4>{detail.craftingMaterials.length ? <div className="palworld-link-list">{detail.craftingMaterials.map(({ item, quantity }) => <button type="button" onClick={() => onOpenItem(item.id)} key={item.id}>{referenceName(item, locale)} × {quantity}</button>)}</div> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.craftingFacility} data-ja={palworldI18n.ja.craftingFacility}>{text.craftingFacility}</h4><p>{detail.craftingFacility ? referenceName(detail.craftingFacility, locale) : text.none}</p></section>
            <section><h4 data-ko={palworldI18n.ko.dropPals} data-ja={palworldI18n.ja.dropPals}>{text.dropPals}</h4>{detail.dropPals.length ? <div className="palworld-link-list">{detail.dropPals.map((pal) => <button type="button" onClick={() => onOpenPal(pal.id)} key={pal.id}>{referenceName(pal, locale)}</button>)}</div> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.acquisitionMethods} data-ja={palworldI18n.ja.acquisitionMethods}>{text.acquisitionMethods}</h4>{detail.acquisitionMethods.length ? <ul>{detail.acquisitionMethods.map((method, index) => <li key={`${method.type}-${index}`}><strong>{acquisitionLabel(method.type, locale)}</strong> · {locale === "ja" ? method.labelJa : method.labelKo}{method.locationKo || method.locationJa ? ` · ${locale === "ja" ? method.locationJa : method.locationKo}` : ""}</li>)}</ul> : <p>{text.none}</p>}</section>
            <section><h4 data-ko={palworldI18n.ko.relatedItems} data-ja={palworldI18n.ja.relatedItems}>{text.relatedItems}</h4>{detail.relatedItems.length ? <div className="palworld-link-list">{detail.relatedItems.map((item) => <button type="button" onClick={() => onOpenItem(item.id)} key={item.id}>{referenceName(item, locale)}</button>)}</div> : <p>{text.none}</p>}</section>
            <section className="palworld-source"><h4 data-ko={palworldI18n.ko.source} data-ja={palworldI18n.ja.source}>{text.source}</h4><p>{detail.metadata.sourceName} · {detail.metadata.sourceRevision}</p><p>{text.gameVersion}: {detail.metadata.gameVersion} · {text.license}: {detail.metadata.license}</p></section>
          </article>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
