import type {
  PalworldCondensationStars,
  PalworldPalCondensationProfile,
  PalworldPalCondensationStage,
  PalworldPalStats,
} from "@streamops/shared";
import type { KeyboardEvent } from "react";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { workLabel } from "../utils/labels";
import { PalworldPalStatsGraph } from "./PalworldPalStatsGraph";

const CONDENSATION_STARS = [0, 1, 2, 3, 4] as const;

export function applyPalworldCondensationStage(
  baseStats: PalworldPalStats,
  stage?: PalworldPalCondensationStage,
): PalworldPalStats {
  if (!stage) return { ...baseStats };
  const stats = { ...baseStats } as Record<string, number | undefined>;
  for (const entry of stage.stats) stats[entry.stat] = entry.value;
  return stats as PalworldPalStats;
}

function availabilityText(
  availability: PalworldPalCondensationProfile["availability"],
  locale: PalworldLocale,
): string {
  const text = palworldI18n[locale];
  if (availability === "available") return text.condensationAvailable;
  if (availability === "unresolved_rule") return text.condensationUnresolvedRule;
  if (availability === "data_unavailable") return text.condensationDataUnavailable;
  return text.condensationMissingSource;
}

export function PalworldPalCondensation({
  baseStats,
  hasPartnerSkill,
  locale,
  onStarsChange,
  profile,
  stars,
}: {
  baseStats: PalworldPalStats;
  hasPartnerSkill: boolean;
  locale: PalworldLocale;
  onStarsChange: (stars: PalworldCondensationStars) => void;
  profile?: PalworldPalCondensationProfile;
  stars: PalworldCondensationStars;
}) {
  const text = palworldI18n[locale];
  const availability = profile?.availability ?? "missing_source";
  const stage = availability === "available"
    ? profile?.stages?.find((candidate) => candidate.stars === stars)
    : undefined;
  const displayedStats = applyPalworldCondensationStage(baseStats, stage);
  const workChanges = stage?.workSuitabilities.filter(
    (entry) => entry.level !== entry.baseLevel,
  ) ?? [];
  const stageLabel = (value: PalworldCondensationStars) =>
    text.condensationStageLabel.replace("{stars}", String(value));
  const moveSelection = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: PalworldCondensationStars,
  ) => {
    const currentIndex = CONDENSATION_STARS.indexOf(value);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? CONDENSATION_STARS.length - 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (currentIndex + CONDENSATION_STARS.length - 1) % CONDENSATION_STARS.length
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (currentIndex + 1) % CONDENSATION_STARS.length
            : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextStars = CONDENSATION_STARS[nextIndex]!;
    onStarsChange(nextStars);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      "[role='radio']",
    );
    buttons?.[nextIndex]?.focus();
  };

  return (
    <section className="palworld-condensation" data-testid="pal-condensation">
      <div className="palworld-condensation-heading">
        <div>
          <h4
            data-ja={palworldI18n.ja.condensationTitle}
            data-ko={palworldI18n.ko.condensationTitle}
          >
            {text.condensationTitle}
          </h4>
          <p>{text.condensationDescription}</p>
        </div>
        {availability === "available" ? (
          <Badge tone="success">{text.condensationAvailable}</Badge>
        ) : null}
      </div>

      <div
        aria-label={text.condensationTitle}
        className="palworld-condensation-stars"
        role="radiogroup"
      >
        {CONDENSATION_STARS.map((value) => (
          <button
            aria-checked={stars === value}
            aria-label={stageLabel(value)}
            className="palworld-condensation-star"
            data-selected={stars === value ? "true" : undefined}
            key={value}
            onClick={() => onStarsChange(value)}
            onKeyDown={(event) => moveSelection(event, value)}
            role="radio"
            tabIndex={stars === value ? 0 : -1}
            type="button"
          >
            {value}★
          </button>
        ))}
      </div>

      {availability !== "available" ? (
        <p className="palworld-condensation-status" role="status">
          {availabilityText(availability, locale)}
        </p>
      ) : null}

      <div className="palworld-condensation-ranks" aria-live="polite">
        {stage ? (
          <>
            <Badge tone="info">
              {text.condensationCharacterRank} {stage.characterRank}
            </Badge>
            {hasPartnerSkill ? (
              <Badge tone="info">
                {text.condensationPartnerSkillRank} {stage.partnerSkillRank}
              </Badge>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="palworld-condensation-stats">
        <h5
          data-ja={stage && stars > 0
            ? palworldI18n.ja.condensationAppliedStats
            : palworldI18n.ja.stats}
          data-ko={stage && stars > 0
            ? palworldI18n.ko.condensationAppliedStats
            : palworldI18n.ko.stats}
        >
          {stage && stars > 0 ? text.condensationAppliedStats : text.stats}
        </h5>
        <PalworldPalStatsGraph
          baselineStats={stage && stars > 0 ? baseStats : undefined}
          locale={locale}
          stats={displayedStats}
        />
      </div>

      {stage && stars > 0 ? (
        <div className="palworld-condensation-work">
          <h5>{text.condensationWorkChanges}</h5>
          {workChanges.length ? (
            <ul>
              {workChanges.map((entry) => (
                <li
                  aria-label={`${workLabel(entry.type, locale)}: ${text.levelPrefix}${entry.baseLevel} → ${text.levelPrefix}${entry.level}`}
                  key={entry.type}
                >
                  <strong>{workLabel(entry.type, locale)}</strong>
                  <span>
                    {text.levelPrefix}{entry.baseLevel}
                    <span aria-hidden="true"> → </span>
                    {text.levelPrefix}{entry.level}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{text.condensationNoVerifiedChanges}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
