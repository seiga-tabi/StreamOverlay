import { useEffect, useState, type FormEvent } from "react";
import {
  PALWORLD_SEARCH_MAX_LENGTH,
  type PalworldPassiveEffect,
  type PalworldPassiveEffectState,
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
import {
  passiveEffectTargetLabel,
  passiveEffectTypeLabel,
  skillTypeLabel,
} from "../utils/labels";
import { formatPalNumber } from "../utils/search";
import {
  hasMachineAssistedTranslation,
  resolvePalworldDescription,
  resolvePalworldLocalizedText,
  resolvePalworldName,
} from "../utils/localization";
import { setPalworldUrl } from "../utils/routes";
import { PalworldAutoLoadControl } from "./PalworldAutoLoadControl";
import { PalworldPreviousLoadControl } from "./PalworldPreviousLoadControl";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import {
  PalworldSkillsFilters,
  type PalworldSkillFilterKey,
} from "./PalworldSkillsFilters";
import {
  PalworldTranslationBadges,
  PalworldTranslationReviewNotice,
} from "./PalworldTranslationBadge";
import { PalworldDetailError, PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

function skillName(skill: PalworldSkill, locale: PalworldLocale): string {
  return resolvePalworldName(skill, locale).text;
}

function relatedPalName(pal: PalworldSkillDetail["relatedPals"][number]["pal"], locale: PalworldLocale): string {
  return resolvePalworldName(pal, locale).text;
}

function skillDescription(skill: PalworldSkill, locale: PalworldLocale) {
  return resolvePalworldDescription(skill, locale);
}

function skillVisibleTranslationStatuses(skill: PalworldSkill, locale: PalworldLocale): PalworldTranslationDisplayStatus[] {
  const nameStatus = resolvePalworldName(skill, locale).status;
  const descriptionStatus = skillDescription(skill, locale).status;
  return skill.type === "passive"
    && (descriptionStatus === "source_language_fallback" || descriptionStatus === "missing_source")
    ? [nameStatus]
    : [nameStatus, descriptionStatus];
}

const PASSIVE_EFFECT_BOOLEAN_TYPES = new Set([
  "KnockbackInvalid_ForPassiveSkill",
  "LeanBackInvalid_ForPassiveSkill",
  "NightOwl",
  "Nocturnal",
  "NonKilling",
  "ResistAdditionalEffect_Burn",
  "ResistAdditionalEffect_Poison",
  "WorldTreeDecayImmunity",
]);

function passiveEffectData(skill: PalworldSkill): {
  effects: readonly PalworldPassiveEffect[];
  state: PalworldPassiveEffectState | undefined;
} {
  return {
    effects: skill.passiveEffects ?? [],
    state: skill.passiveEffectState,
  };
}

function passiveEffectStateMessage(
  state: PalworldPassiveEffectState | undefined,
  locale: PalworldLocale,
): string {
  const text = palworldI18n[locale];
  if (state === "source_mismatch") return text.passiveEffectSourceMismatch;
  if (state === undefined || state === "data_unavailable" || state === "available") {
    return text.passiveEffectDataUnavailable;
  }
  return text.passiveEffectMissingSource;
}

function formatPassiveEffectValue(
  effect: PalworldPassiveEffect,
  locale: PalworldLocale,
): string {
  if (PASSIVE_EFFECT_BOOLEAN_TYPES.has(effect.type)) {
    return palworldI18n[locale].passiveEffectEnabled;
  }
  const value = effect.value.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR", {
    maximumFractionDigits: 2,
  });
  const signed = effect.value > 0 ? `+${value}` : value;
  if (effect.type === "RideJumpCount_Increase") {
    return locale === "ja" ? `${signed}回` : `${signed}회`;
  }
  if (effect.type === "WorkSuitabilityAddRank_MonsterFarm") {
    return `Lv. ${signed}`;
  }
  return `${signed}%`;
}

function passiveEffectSummary(skill: PalworldSkill, locale: PalworldLocale): string {
  const { effects, state } = passiveEffectData(skill);
  if (state !== "available" || effects.length === 0) {
    return passiveEffectStateMessage(state, locale);
  }
  const first = effects[0]!;
  const summary = `${passiveEffectTypeLabel(first.type, locale)} ${formatPassiveEffectValue(first, locale)}`;
  if (effects.length === 1) return summary;
  return `${summary} · ${palworldI18n[locale].passiveEffectMore.replace(
    "{count}",
    String(effects.length - 1),
  )}`;
}

function visibleSkillDescription(
  skill: PalworldSkill,
  localized: ReturnType<typeof resolvePalworldLocalizedText>,
  locale: PalworldLocale,
  mode: "card" | "detail",
): string {
  const text = palworldI18n[locale];
  if (
    skill.type !== "passive"
    || (
      localized.status !== "source_language_fallback"
      && localized.status !== "missing_source"
    )
  ) {
    return localized.text || text.originalDataUnavailable;
  }
  const { state } = passiveEffectData(skill);
  if (state === "available") {
    return mode === "card"
      ? passiveEffectSummary(skill, locale)
      : text.passiveDescriptionUnavailableWithEffects;
  }
  if (mode === "detail" && state !== undefined) return "";
  return passiveEffectStateMessage(state, locale);
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

function SkillRelatedPalPreviews({
  locale,
  skill,
}: {
  locale: PalworldLocale;
  skill: PalworldSkillSummary;
}) {
  const previews = skill.relatedPalPreviews ?? [];
  if (previews.length === 0) return null;
  const text = palworldI18n[locale];
  const names = previews.map((pal) => relatedPalName(pal, locale));
  const hiddenCount = Math.max(0, skill.relatedPalCount - previews.length);
  const hiddenLabel = hiddenCount > 0
    ? text.relatedPalPreviewMore.replace("{count}", hiddenCount.toLocaleString(locale))
    : "";

  return (
    <div
      aria-label={text.relatedPals}
      className="palworld-skill-related-preview"
      role="group"
    >
      {previews.map((pal, index) => (
        <span
          className="palworld-skill-related-preview-media"
          key={pal.id}
          title={names[index] ?? ""}
        >
          <PalworldMedia
            alt={names[index] ?? ""}
            imageUrl={pal.imageUrl}
            intrinsicWidth={pal.imageWidth}
            intrinsicHeight={pal.imageHeight}
            kind="pal"
            locale={locale}
          />
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span
          aria-label={hiddenLabel}
          className="palworld-skill-related-preview-more"
          role="img"
          title={hiddenLabel}
        >
          <span aria-hidden="true">…</span>
        </span>
      ) : null}
    </div>
  );
}

export function PalworldSkillCard({ locale, onOpen, skill }: { locale: PalworldLocale; onOpen: (id: string) => void; skill: PalworldSkillSummary }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(skill, locale);
  const description = skillDescription(skill, locale);
  return <Card className="palworld-skill-card"><CardContent>
    <SkillBadges locale={locale} skill={skill} />
    <h2>{skillName(skill, locale)}</h2>
    <PalworldTranslationBadges
      locale={locale}
      showMachineAssisted={false}
      sourceIntegrities={[name.sourceIntegrity, description.sourceIntegrity]}
      statuses={skillVisibleTranslationStatuses(skill, locale)}
    />
    <p className="palworld-skill-description palworld-localized-copy">{visibleSkillDescription(skill, description, locale, "card")}</p>
    <SkillRelatedPalPreviews locale={locale} skill={skill} />
    <div className="palworld-skill-metrics"><span>{text.relatedPalCount} <strong>{skill.relatedPalCount.toLocaleString()}</strong></span>{skill.passiveTier !== undefined ? <span>{text.passiveTier} <strong>{skill.passiveTier}</strong></span> : null}</div>
    <Button size="sm" variant="secondary" onClick={() => onOpen(skill.id)}>{text.viewSkill}</Button>
  </CardContent></Card>;
}

function PassiveEffectDetails({
  locale,
  skill,
}: {
  locale: PalworldLocale;
  skill: PalworldSkill;
}) {
  const text = palworldI18n[locale];
  const { effects, state } = passiveEffectData(skill);
  if (state === undefined) return null;
  return (
    <section className="palworld-passive-effect-section">
      <h4>{text.passiveStructuredEffects}</h4>
      {state === "available" && effects.length > 0 ? (
        <ul className="palworld-passive-effect-list">
          {effects.map((effect, index) => {
            const target = passiveEffectTargetLabel(effect.target, locale);
            return (
              <li key={`${effect.type}-${effect.target}-${index}`}>
                <span className="palworld-passive-effect-name">
                  {passiveEffectTypeLabel(effect.type, locale)}
                </span>
                <strong>{formatPassiveEffectValue(effect, locale)}</strong>
                <span
                  className="palworld-passive-effect-target"
                  data-ja={palworldI18n.ja.passiveEffectTargetLabel.replace(
                    "{target}",
                    passiveEffectTargetLabel(effect.target, "ja"),
                  )}
                  data-ko={palworldI18n.ko.passiveEffectTargetLabel.replace(
                    "{target}",
                    passiveEffectTargetLabel(effect.target, "ko"),
                  )}
                >
                  {text.passiveEffectTargetLabel.replace("{target}", target)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status">
          {passiveEffectStateMessage(state, locale)}
        </p>
      )}
    </section>
  );
}

export function PalworldSkillDetailView({ detail, locale, onOpenPal }: { detail: PalworldSkillDetail; locale: PalworldLocale; onOpenPal: (id: string) => void }) {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(detail, locale);
  const description = skillDescription(detail, locale);
  const relatedPalNames = detail.relatedPals.map(({ pal }) => resolvePalworldName(pal, locale));
  const relatedPalStatuses = relatedPalNames.map((relatedName) => relatedName.status);
  const visibleDescription = visibleSkillDescription(detail, description, locale, "detail");
  const recordStatuses = [
    ...skillVisibleTranslationStatuses(detail, locale),
    ...relatedPalStatuses,
  ];
  const reviewNoticeId = `palworld-skill-translation-review-${detail.id}`;
  const hasReviewPending = hasMachineAssistedTranslation(recordStatuses);
  return <article className="palworld-detail" aria-describedby={hasReviewPending ? reviewNoticeId : undefined}>
    {hasReviewPending ? <PalworldTranslationReviewNotice id={reviewNoticeId} locale={locale} /> : null}
    <div><SkillBadges locale={locale} skill={detail} /><h3>{skillName(detail, locale)}</h3><PalworldTranslationBadges locale={locale} showMachineAssisted={false} sourceIntegrities={[name.sourceIntegrity, description.sourceIntegrity]} statuses={skillVisibleTranslationStatuses(detail, locale)} />{visibleDescription ? <p className="palworld-localized-copy">{visibleDescription}</p> : null}</div>
    {detail.type === "passive" ? <PassiveEffectDetails locale={locale} skill={detail} /> : null}
    <section><h4>{text.relatedPals}</h4>{detail.relatedPals.length ? <><div className="palworld-link-list palworld-skill-related-list">{detail.relatedPals.map(({ pal, unlockLevel }) => {
      const displayName = relatedPalName(pal, locale);
      return <button className="palworld-related-pal-link" type="button" onClick={() => onOpenPal(pal.id)} key={pal.id}><span className="palworld-related-pal-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} intrinsicWidth={pal.imageWidth} intrinsicHeight={pal.imageHeight} alt={displayName} locale={locale} /></span><span>{formatPalNumber(pal.number, locale)} · {displayName}{unlockLevel !== undefined ? ` · ${text.unlockLevel} ${unlockLevel}` : ""}</span></button>;
    })}</div><PalworldTranslationBadges locale={locale} showMachineAssisted={false} sourceIntegrities={relatedPalNames.map((relatedName) => relatedName.sourceIntegrity)} statuses={relatedPalStatuses} /></> : <p>{detail.type === "passive" ? text.notApplicable : text.relatedPalEmpty}</p>}</section>
  </article>;
}

export function SkillDetailModal({ locale, onClose, onOpenPal, skillId }: { locale: PalworldLocale; onClose: () => void; onOpenPal: (id: string) => void; skillId?: string }) {
  const [detail, setDetail] = useState<PalworldSkillDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];
  useBodyScrollLock(Boolean(skillId));

  useEffect(() => {
    if (!skillId) {
      setDetail(null);
      setError(null);
      return undefined;
    }
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    void getPalworldSkill(skillId, controller.signal).then(setDetail).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError);
    });
    return () => controller.abort();
  }, [revision, skillId]);

  return <Modal open={Boolean(skillId)} onClose={onClose} size="lg" className="palworld-detail-modal" data-testid="skill-detail-modal">
    <ModalHeader><ModalTitle>{detail ? skillName(detail, locale) : text.details}</ModalTitle><ModalCloseButton aria-label={text.close}>×</ModalCloseButton></ModalHeader>
    <ModalContent>
      {!detail && !error ? <SkeletonCard loadingLabel={text.loading} /> : null}
      {error ? <PalworldDetailError error={error} locale={locale} onClose={onClose} onRetry={() => setRevision((value) => value + 1)} /> : null}
      {detail ? <PalworldSkillDetailView detail={detail} locale={locale} onOpenPal={onOpenPal} /> : null}
    </ModalContent>
  </Modal>;
}

export function PalworldSkillsPage({ locale, params }: { locale: PalworldLocale; params: URLSearchParams }) {
  const {
    initialError: error,
    initialLoading: loading,
    hasPreviousPage,
    loadMore,
    loadMoreError,
    loadMoreLoading,
    loadMoreRetryBlocked,
    loadPrevious,
    loadPreviousError,
    loadPreviousLoading,
    loadPreviousRetryBlocked,
    response,
    retryInitial,
    retryLoadMore,
    retryLoadPrevious,
    routeQuery,
    selectedType,
  } = usePalworldSkills(params, locale);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const text = palworldI18n[locale];
  const selectedSkillId = params.get("skill")?.trim() || undefined;
  const hasReviewPending = response?.items.some((skill) => (
    hasMachineAssistedTranslation(skillVisibleTranslationStatuses(skill, locale))
  )) ?? false;

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);

  function update(
    key: PalworldSkillFilterKey | "q" | "sort" | "order" | "page",
    value: string,
  ) {
    const next = new URLSearchParams(params);
    next.delete("skill");
    if (key === "type") {
      next.delete("element");
      next.delete("partnerElement");
      next.delete("passiveEffect");
      next.delete("passiveTier");
    }
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/skills${next.toString() ? `?${next}` : ""}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update("q", nameQuery.trim());
  }

  function openSkill(id: string) {
    const current = new URL(`${window.location.pathname}${window.location.search}`, window.location.origin);
    current.searchParams.delete("pal");
    current.searchParams.delete("item");
    current.searchParams.set("skill", id);
    setPalworldUrl(`${current.pathname}${current.search}`);
  }

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">{text.skillsKicker}</span><h1 data-ko={palworldI18n.ko.skillsTitle} data-ja={palworldI18n.ja.skillsTitle}>{text.skillsTitle}</h1><p data-ko={palworldI18n.ko.skillsDescription} data-ja={palworldI18n.ja.skillsDescription}>{text.skillsDescription}</p></div></header>
    {hasReviewPending ? <PalworldTranslationReviewNotice locale={locale} /> : null}
    <form className="palworld-skill-filter-panel" onSubmit={submit} aria-label={text.filter}>
      <PalworldSkillsFilters
        facets={response?.facets}
        locale={locale}
        onUpdate={update}
        params={params}
        selectedType={selectedType}
      />
      <div className="palworld-skill-search-row">
        <label><span>{text.nameSearch}</span><Input maxLength={PALWORLD_SEARCH_MAX_LENGTH} type="search" value={nameQuery} placeholder={text.skillSearchPlaceholder} onChange={(event) => setNameQuery(event.target.value)} /></label>
        <Button size="sm" type="submit">{text.searchAction}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/skills")}>{text.clearFilters}</Button>
      </div>
      <details className="palworld-skill-advanced-filters">
        <summary>{text.skillAdvancedFilters}</summary>
        <div className="palworld-skill-filter-secondary">
          <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="power">{text.power}</option><option value="unlockLevel">{text.unlockLevel}</option></Select></label>
          <label><span>{text.sortOrder}</span><Select aria-label={text.sortOrder} value={params.get("order") ?? "asc"} onChange={(event) => update("order", event.target.value)}><option value="asc">{text.ascending}</option><option value="desc">{text.descending}</option></Select></label>
        </div>
      </details>
    </form>
    {loading && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError error={error} locale={locale} onRetry={retryInitial} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.skillListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><PalworldPreviousLoadControl error={loadPreviousError} hasPrevious={hasPreviousPage} loading={loadPreviousLoading} locale={locale} onLoadPrevious={() => { void loadPrevious(); }} onRetry={() => { void retryLoadPrevious(); }} paused={Boolean(selectedSkillId)} retryBlocked={loadPreviousRetryBlocked} /><div aria-busy={loadMoreLoading || loadPreviousLoading} className="palworld-skill-grid">{response.items.map((skill) => <PalworldSkillCard locale={locale} onOpen={openSkill} skill={skill} key={skill.id} />)}</div><PalworldAutoLoadControl error={loadMoreError} hasMore={response.pagination.hasNextPage} loadedCount={response.items.length} loading={loadMoreLoading} locale={locale} onLoadMore={() => { void loadMore(); }} onRetry={() => { void retryLoadMore(); }} paused={Boolean(selectedSkillId)} retryBlocked={loadMoreRetryBlocked} total={response.pagination.total} /></> : null}
  </section>;
}
