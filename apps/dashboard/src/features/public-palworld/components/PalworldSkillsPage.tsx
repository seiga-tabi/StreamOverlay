import { useEffect, useState, type FormEvent } from "react";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_SKILL_TYPES,
  type PalworldSkill,
  type PalworldSkillDetail,
  type PalworldSkillSummary,
  type PalworldTranslationDisplayStatus,
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
import { resolvePalworldDescription, resolvePalworldLocalizedText, resolvePalworldName } from "../utils/localization";
import { setPalworldUrl, withQueryParam } from "../utils/routes";
import { Pagination } from "./Pagination";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldTranslationBadges } from "./PalworldTranslationBadge";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

function skillName(skill: PalworldSkill, locale: PalworldLocale): string {
  return resolvePalworldName(skill, locale).text;
}

function relatedPalName(pal: PalworldSkillDetail["relatedPals"][number]["pal"], locale: PalworldLocale): string {
  return resolvePalworldName(pal, locale).text;
}

function skillDescription(skill: PalworldSkill, locale: PalworldLocale) {
  return resolvePalworldDescription(skill, locale);
}

function skillPassiveAbility(skill: PalworldSkill, locale: PalworldLocale) {
  return resolvePalworldLocalizedText(
    skill,
    "passiveAbility",
    locale,
    locale === "ja" ? skill.passiveAbilityJa : skill.passiveAbilityKo,
    skill.passiveAbility,
  );
}

function skillVisibleTranslationStatuses(skill: PalworldSkill, locale: PalworldLocale): PalworldTranslationDisplayStatus[] {
  return [resolvePalworldName(skill, locale).status, skillDescription(skill, locale).status];
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
    <PalworldTranslationBadges locale={locale} statuses={skillVisibleTranslationStatuses(skill, locale)} />
    <p className="palworld-skill-description palworld-localized-copy">{description.text || text.originalDataUnavailable}</p>
    <div className="palworld-skill-metrics"><span>{text.relatedPalCount} <strong>{skill.relatedPalCount.toLocaleString()}</strong></span>{skill.passiveTier !== undefined ? <span>{text.passiveTier} <strong>{skill.passiveTier}</strong></span> : null}</div>
    <Button size="sm" variant="secondary" onClick={() => onOpen(skill.id)}>{text.viewSkill}</Button>
  </CardContent></Card>;
}

export function PalworldSkillDetailView({ detail, locale, onOpenPal }: { detail: PalworldSkillDetail; locale: PalworldLocale; onOpenPal: (id: string) => void }) {
  const text = palworldI18n[locale];
  const description = skillDescription(detail, locale);
  const passiveAbility = skillPassiveAbility(detail, locale);
  const relatedPalStatuses = detail.relatedPals.map(({ pal }) => resolvePalworldName(pal, locale).status);
  return <article className="palworld-detail">
    <div><SkillBadges locale={locale} skill={detail} /><h3>{skillName(detail, locale)}</h3><PalworldTranslationBadges locale={locale} statuses={skillVisibleTranslationStatuses(detail, locale)} /><p className="palworld-localized-copy">{description.text || text.originalDataUnavailable}</p></div>
    {detail.type === "passive" ? <section><h4>{text.passiveAbility}</h4><PalworldTranslationBadges locale={locale} statuses={[passiveAbility.status]} /><p className="palworld-localized-copy">{passiveAbility.text || text.originalDataUnavailable}</p></section> : null}
    <section><h4>{text.relatedPals}</h4>{detail.relatedPals.length ? <><div className="palworld-link-list palworld-skill-related-list">{detail.relatedPals.map(({ pal, unlockLevel }) => {
      const displayName = relatedPalName(pal, locale);
      return <button className="palworld-related-pal-link" type="button" onClick={() => onOpenPal(pal.id)} key={pal.id}><span className="palworld-related-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} intrinsicWidth={pal.imageWidth} intrinsicHeight={pal.imageHeight} alt={displayName} locale={locale} /></span><span>{formatPalNumber(pal.number, locale)} · {displayName}{unlockLevel !== undefined ? ` · ${text.unlockLevel} ${unlockLevel}` : ""}</span></button>;
    })}</div><PalworldTranslationBadges locale={locale} statuses={relatedPalStatuses} /></> : <p>{text.originalDataUnavailable}</p>}</section>
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
  const { error, response, retry, routeQuery } = usePalworldSkills(params, locale);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const text = palworldI18n[locale];
  const selectedSkillId = params.get("skill")?.trim() || undefined;

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
    <header className="palworld-page-heading"><div><span aria-hidden="true">{text.skillsKicker}</span><h1 data-ko={palworldI18n.ko.skillsTitle} data-ja={palworldI18n.ja.skillsTitle}>{text.skillsTitle}</h1><p data-ko={palworldI18n.ko.skillsDescription} data-ja={palworldI18n.ja.skillsDescription}>{text.skillsDescription}</p></div></header>
    <form className="palworld-filter-bar palworld-skill-filter-bar" onSubmit={submit} aria-label={text.filter}>
      <label><span>{text.nameSearch}</span><Input type="search" value={nameQuery} placeholder={text.skillSearchPlaceholder} onChange={(event) => setNameQuery(event.target.value)} /></label>
      <label><span>{text.skillType}</span><Select value={params.get("type") ?? ""} onChange={(event) => update("type", event.target.value)}><option value="">{text.all}</option>{PALWORLD_SKILL_TYPES.map((value) => <option value={value} key={value}>{skillTypeLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.element}</span><Select value={params.get("element") ?? ""} onChange={(event) => update("element", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ELEMENTS.map((value) => <option value={value} key={value}>{elementLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="power">{text.power}</option><option value="unlockLevel">{text.unlockLevel}</option></Select></label>
      <label><span>{text.sort}</span><Select value={params.get("order") ?? "asc"} onChange={(event) => update("order", event.target.value)}><option value="asc">{text.ascending}</option><option value="desc">{text.descending}</option></Select></label>
      <div className="palworld-filter-actions"><Button size="sm" type="submit">{text.searchAction}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/skills")}>{text.clearFilters}</Button></div>
    </form>
    {!response && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError error={error} locale={locale} onRetry={retry} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.skillListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><div className="palworld-skill-grid">{response.items.map((skill) => <PalworldSkillCard locale={locale} onOpen={openSkill} skill={skill} key={skill.id} />)}</div><Pagination locale={locale} pagination={response.pagination} onPage={(page) => update("page", String(page))} /></> : null}
    <SkillDetailModal locale={locale} onClose={closeSkill} onOpenPal={onOpenPal} skillId={selectedSkillId} />
  </section>;
}
