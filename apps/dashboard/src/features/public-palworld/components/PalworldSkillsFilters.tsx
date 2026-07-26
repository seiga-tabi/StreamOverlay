import { useEffect, useRef } from "react";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_PASSIVE_EFFECT_FILTERS,
  type PalworldElement,
  type PalworldPassiveEffectFilter,
  type PalworldSkillListFacets,
  type PalworldSkillType,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { elementLabel, passiveEffectFilterLabel } from "../utils/labels";
import { PalworldElementBadge } from "./PalworldElementBadge";

const SKILL_TAB_ORDER = ["active", "passive", "partner"] as const satisfies readonly PalworldSkillType[];

export type PalworldSkillFilterKey =
  | "type"
  | "element"
  | "partnerElement"
  | "passiveEffect"
  | "passiveTier";

function tabLabel(type: PalworldSkillType, locale: PalworldLocale): string {
  const text = palworldI18n[locale];
  if (type === "active") return text.activeSkills;
  if (type === "passive") return text.passiveSkills;
  return text.partnerSkill;
}

function availableElements(
  facets: PalworldSkillListFacets | undefined,
  type: Extract<PalworldSkillType, "active" | "partner">,
): readonly PalworldElement[] {
  const entries = type === "active" ? facets?.activeElements : facets?.partnerElements;
  if (!entries) return PALWORLD_ELEMENTS;
  const available = new Set(entries.filter((entry) => entry.count > 0).map((entry) => entry.value));
  return PALWORLD_ELEMENTS.filter((element) => available.has(element));
}

function availablePassiveEffects(
  facets: PalworldSkillListFacets | undefined,
): readonly PalworldPassiveEffectFilter[] {
  if (!facets) return PALWORLD_PASSIVE_EFFECT_FILTERS;
  const available = new Set(
    facets.passiveEffects
      .filter((entry) => entry.count > 0)
      .map((entry) => entry.value),
  );
  return PALWORLD_PASSIVE_EFFECT_FILTERS.filter((effect) => available.has(effect));
}

function passiveTierLabel(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function PalworldSkillsFilters({
  facets,
  locale,
  onUpdate,
  params,
  selectedType,
}: {
  facets?: PalworldSkillListFacets;
  locale: PalworldLocale;
  onUpdate: (key: PalworldSkillFilterKey, value: string) => void;
  params: URLSearchParams;
  selectedType: PalworldSkillType;
}) {
  const text = palworldI18n[locale];
  const elementKey = selectedType === "partner" ? "partnerElement" : "element";
  const selectedElement = params.get(elementKey) ?? "";
  const selectedPassiveEffect = params.get("passiveEffect") ?? "";
  const selectedPassiveTier = params.get("passiveTier") ?? "";
  const selectedTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedTabRef.current?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }, [locale, selectedType]);

  return (
    <>
      <nav aria-label={text.skillTypeTabs} className="palworld-skill-type-tabs">
        {SKILL_TAB_ORDER.map((type) => {
          const label = tabLabel(type, locale);
          return (
            <button
              aria-pressed={selectedType === type}
              className="palworld-skill-type-tab"
              data-selected={selectedType === type}
              key={type}
              onClick={() => onUpdate("type", type)}
              ref={selectedType === type ? selectedTabRef : undefined}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </nav>

      {selectedType === "active" || selectedType === "partner" ? (
        <fieldset className="palworld-skill-filter-group">
          <legend>{text.element}</legend>
          <div className="palworld-skill-filter-chip-list">
            <Button
              aria-label={text.allSkillElements}
              aria-pressed={!selectedElement}
              className="palworld-skill-filter-chip"
              onClick={() => onUpdate(elementKey, "")}
              size="sm"
              type="button"
              variant={!selectedElement ? "primary" : "tertiary"}
            >
              {text.allElements}
            </Button>
            {availableElements(facets, selectedType).map((element) => {
              const label = elementLabel(element, locale);
              const selected = selectedElement === element;
              return (
                <Button
                  aria-label={text.filterSkillsByElement.replace("{value}", label)}
                  aria-pressed={selected}
                  className="palworld-skill-filter-chip palworld-skill-element-chip"
                  data-element={element}
                  key={element}
                  onClick={() => onUpdate(elementKey, selected ? "" : element)}
                  size="sm"
                  type="button"
                  variant={selected ? "primary" : "tertiary"}
                >
                  <PalworldElementBadge element={element} locale={locale} />
                </Button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {selectedType === "passive" ? (
        <>
          <fieldset className="palworld-skill-filter-group">
            <legend>{text.passiveEffectFilter}</legend>
            <div className="palworld-skill-filter-chip-list">
              <Button
                aria-label={text.allPassiveEffects}
                aria-pressed={!selectedPassiveEffect}
                className="palworld-skill-filter-chip"
                onClick={() => onUpdate("passiveEffect", "")}
                size="sm"
                type="button"
                variant={!selectedPassiveEffect ? "primary" : "tertiary"}
              >
                {text.all}
              </Button>
              {availablePassiveEffects(facets).map((effect) => {
                const label = passiveEffectFilterLabel(effect, locale);
                const selected = selectedPassiveEffect === effect;
                return (
                  <Button
                    aria-label={text.filterSkillsByPassiveEffect.replace("{value}", label)}
                    aria-pressed={selected}
                    className="palworld-skill-filter-chip"
                    key={effect}
                    onClick={() => onUpdate("passiveEffect", selected ? "" : effect)}
                    size="sm"
                    type="button"
                    variant={selected ? "primary" : "tertiary"}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="palworld-skill-filter-group">
            <legend>{text.passiveTier}</legend>
            <div className="palworld-skill-filter-chip-list">
              <Button
                aria-label={text.allPassiveTiers}
                aria-pressed={!selectedPassiveTier}
                className="palworld-skill-filter-chip"
                onClick={() => onUpdate("passiveTier", "")}
                size="sm"
                type="button"
                variant={!selectedPassiveTier ? "primary" : "tertiary"}
              >
                {text.all}
              </Button>
              {[...(facets?.passiveTiers ?? [])]
                .sort((left, right) => right.value - left.value)
                .map((entry) => {
                  const value = String(entry.value);
                  const label = passiveTierLabel(entry.value);
                  const selected = selectedPassiveTier === value;
                  return (
                    <Button
                      aria-label={text.filterSkillsByPassiveTier.replace("{value}", label)}
                      aria-pressed={selected}
                      className="palworld-skill-filter-chip palworld-passive-tier-chip"
                      data-tier={entry.value}
                      key={entry.value}
                      onClick={() => onUpdate("passiveTier", selected ? "" : value)}
                      size="sm"
                      type="button"
                      variant={selected ? "primary" : "tertiary"}
                    >
                      {label}
                    </Button>
                  );
                })}
            </div>
          </fieldset>
        </>
      ) : null}
    </>
  );
}
