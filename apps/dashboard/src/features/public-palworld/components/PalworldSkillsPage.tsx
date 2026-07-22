import { useEffect, useState, type FormEvent } from "react";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_SKILL_TYPES,
  type PalworldSkill,
  type PalworldSkillDetail,
  type PalworldSkillSummary,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Input, Select } from "../../../shared/ui/Form";
import { Modal, ModalCloseButton, ModalContent, ModalHeader, ModalTitle } from "../../../shared/ui/Modal";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldSkill } from "../api/palworld";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { usePalworldSkills } from "../hooks/usePalworldSkills";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { elementLabel, skillTypeLabel } from "../utils/labels";
import { formatPalNumber } from "../utils/search";
import { setPalworldUrl, withQueryParam } from "../utils/routes";
import { Pagination } from "./Pagination";
import { PalworldDomainCoverageNotice, usePalworldDomainCoverage } from "./PalworldCoverageNotice";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

function skillName(skill: PalworldSkill, locale: PalworldLocale): string {
  return (locale === "ja" ? skill.nameJa : skill.nameKo)?.trim() || skill.nameEn;
}

function relatedPalName(pal: { nameKo: string; nameJa: string; nameEn: string }, locale: PalworldLocale): string {
  return (locale === "ja" ? pal.nameJa : pal.nameKo)?.trim() || pal.nameEn;
}

function skillDescription(skill: PalworldSkill, locale: PalworldLocale): { text: string; englishFallback: boolean } {
  const localized = (locale === "ja" ? skill.descriptionJa : skill.descriptionKo)?.trim();
  if (localized) return { text: localized, englishFallback: false };
  const english = skill.descriptionEn?.trim();
  return { text: english ?? "", englishFallback: Boolean(english) };
}

function usesEnglishSkillFallback(skill: PalworldSkill, locale: PalworldLocale): boolean {
  const localizedName = (locale === "ja" ? skill.nameJa : skill.nameKo)?.trim();
  return (!localizedName && Boolean(skill.nameEn.trim()))
    || skillDescription(skill, locale).englishFallback
    || Boolean(skill.passiveAbility?.trim());
}

function EnglishOriginalBadge({ locale }: { locale: PalworldLocale }) {
  const text = palworldI18n[locale];
  return <Badge size="sm" tone="neutral" data-ko={palworldI18n.ko.englishOriginal} data-ja={palworldI18n.ja.englishOriginal}>{text.englishOriginal}</Badge>;
}

function SkillBadges({ locale, skill }: { locale: PalworldLocale; skill: PalworldSkill }) {
  const text = palworldI18n[locale];
  return <div className="palworld-badge-row">
    <Badge size="sm" tone="info">{skillTypeLabel(skill.type, locale)}</Badge>
    {skill.element ? <PalworldElementBadge element={skill.element} locale={locale} /> : null}
    {skill.power !== undefined ? <Badge size="sm">{text.power} {skill.power}</Badge> : null}
    {skill.cooldownSeconds !== undefined ? <Badge size="sm">{text.cooldown} {skill.cooldownSeconds}{text.seconds}</Badge> : null}
    {skill.unlockLevel !== undefined ? <Badge size="sm">{text.unlockLevel} {skill.unlockLevel}</Badge> : null}
  </div>;
}

export function PalworldSkillCard({ locale, onOpen, skill }: { locale: PalworldLocale; onOpen: (id: string) => void; skill: PalworldSkillSummary }) {
  const text = palworldI18n[locale];
  const description = skillDescription(skill, locale);
  return <Card className="palworld-skill-card"><CardContent>
    <SkillBadges locale={locale} skill={skill} />
    <h2>{skillName(skill, locale)}</h2>
    {usesEnglishSkillFallback(skill, locale) ? <div><EnglishOriginalBadge locale={locale} /></div> : null}
    <p className="palworld-skill-description">{description.text || text.originalDataUnavailable}</p>
    <div className="palworld-skill-metrics"><span>{text.relatedPalCount} <strong>{skill.relatedPalCount.toLocaleString()}</strong></span>{skill.passiveTier !== undefined ? <span>{text.passiveTier} <strong>{skill.passiveTier}</strong></span> : null}</div>
    <Button size="sm" variant="secondary" onClick={() => onOpen(skill.id)}>{text.viewSkill}</Button>
  </CardContent></Card>;
}

export function PalworldSkillDetailView({ detail, locale, onOpenPal }: { detail: PalworldSkillDetail; locale: PalworldLocale; onOpenPal: (id: string) => void }) {
  const text = palworldI18n[locale];
  const description = skillDescription(detail, locale);
  return <article className="palworld-detail">
    <div><SkillBadges locale={locale} skill={detail} /><h3>{skillName(detail, locale)}</h3>{usesEnglishSkillFallback(detail, locale) ? <EnglishOriginalBadge locale={locale} /> : null}<p>{description.text || text.originalDataUnavailable}</p></div>
    {detail.passiveAbility ? <section><h4>{text.passiveAbility}</h4><p>{detail.passiveAbility}</p></section> : null}
    <section><h4>{text.relatedPals}</h4>{detail.relatedPals.length ? <div className="palworld-link-list palworld-skill-related-list">{detail.relatedPals.map(({ pal, unlockLevel }) => {
      const displayName = relatedPalName(pal, locale);
      return <button className="palworld-related-pal-link" type="button" onClick={() => onOpenPal(pal.id)} key={pal.id}><span className="palworld-related-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} intrinsicWidth={pal.imageWidth} intrinsicHeight={pal.imageHeight} alt={displayName} locale={locale} /></span><span>{formatPalNumber(pal.number)} · {displayName}{unlockLevel !== undefined ? ` · ${text.unlockLevel} ${unlockLevel}` : ""}</span></button>;
    })}</div> : <p>{text.originalDataUnavailable}</p>}</section>
    <section className="palworld-source"><h4>{text.source}</h4><p>{detail.metadata.sourceName} · {detail.metadata.sourceRevision}</p><p>{text.gameVersion}: {detail.metadata.gameVersion} · {text.license}: {detail.metadata.license}</p></section>
  </article>;
}

function SkillDetailModal({ locale, onClose, onOpenPal, skillId }: { locale: PalworldLocale; onClose: () => void; onOpenPal: (id: string) => void; skillId?: string }) {
  const [detail, setDetail] = useState<PalworldSkillDetail | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];
  useBodyScrollLock(Boolean(skillId));

  useEffect(() => {
    if (!skillId) {
      setDetail(null);
      setError(false);
      return undefined;
    }
    const controller = new AbortController();
    setDetail(null);
    setError(false);
    void getPalworldSkill(skillId, controller.signal).then(setDetail).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [revision, skillId]);

  return <Modal open={Boolean(skillId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="skill-detail-modal">
    <ModalHeader><ModalTitle>{detail ? skillName(detail, locale) : text.details}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
    <ModalContent>
      {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
      {error ? <div className="palworld-modal-error" role="alert"><p>{text.apiError}</p><Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>{text.retry}</Button></div> : null}
      {detail ? <PalworldSkillDetailView detail={detail} locale={locale} onOpenPal={onOpenPal} /> : null}
    </ModalContent>
  </Modal>;
}

export function PalworldSkillsPage({ locale, onOpenPal, params }: { locale: PalworldLocale; onOpenPal: (id: string) => void; params: URLSearchParams }) {
  const { error, response, retry, routeQuery } = usePalworldSkills(params);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const text = palworldI18n[locale];
  const selectedSkillId = params.get("skill")?.trim() || undefined;
  const coverage = usePalworldDomainCoverage("skills");

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("skill");
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/skills${next.toString() ? `?${next}` : ""}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update("q", nameQuery.trim());
  }

  function openSkill(id: string) {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(current, "skill", id));
  }

  function closeSkill() {
    const current = `${window.location.pathname}${window.location.search}`;
    setPalworldUrl(withQueryParam(current, "skill"), true);
  }

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">SKILLS</span><h1 data-ko={palworldI18n.ko.skillsTitle} data-ja={palworldI18n.ja.skillsTitle}>{text.skillsTitle}</h1><p data-ko={palworldI18n.ko.skillsDescription} data-ja={palworldI18n.ja.skillsDescription}>{text.skillsDescription}</p></div></header>
    <PalworldDomainCoverageNotice coverage={coverage} domain="skills" locale={locale} />
    <form className="palworld-filter-bar palworld-skill-filter-bar" onSubmit={submit} aria-label={text.filter}>
      <label><span>{text.nameSearch}</span><Input type="search" value={nameQuery} placeholder={text.skillSearchPlaceholder} onChange={(event) => setNameQuery(event.target.value)} /></label>
      <label><span>{text.skillType}</span><Select value={params.get("type") ?? ""} onChange={(event) => update("type", event.target.value)}><option value="">{text.all}</option>{PALWORLD_SKILL_TYPES.map((value) => <option value={value} key={value}>{skillTypeLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.element}</span><Select value={params.get("element") ?? ""} onChange={(event) => update("element", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ELEMENTS.map((value) => <option value={value} key={value}>{elementLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="power">{text.power}</option><option value="unlockLevel">{text.unlockLevel}</option></Select></label>
      <label><span>{text.sort}</span><Select value={params.get("order") ?? "asc"} onChange={(event) => update("order", event.target.value)}><option value="asc">{text.ascending}</option><option value="desc">{text.descending}</option></Select></label>
      <div className="palworld-filter-actions"><Button size="sm" type="submit">{text.searchAction}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/skills")}>{text.clearFilters}</Button></div>
    </form>
    {!response && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError locale={locale} onRetry={retry} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.skillListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><div className="palworld-skill-grid">{response.items.map((skill) => <PalworldSkillCard locale={locale} onOpen={openSkill} skill={skill} key={skill.id} />)}</div><Pagination locale={locale} pagination={response.pagination} onPage={(page) => update("page", String(page))} /></> : null}
    <SkillDetailModal locale={locale} onClose={closeSkill} onOpenPal={onOpenPal} skillId={selectedSkillId} />
  </section>;
}
