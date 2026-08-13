import type { PalworldBreedingGender } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { genderLabel } from "../utils/labels";

export function BreedingGenderControls({
  expanded,
  locale,
  onGender,
  onToggle,
  parentAGender,
  parentBGender,
}: {
  expanded: boolean;
  locale: PalworldLocale;
  onGender: (position: "parentAGender" | "parentBGender", value: string) => void;
  onToggle: () => void;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
}) {
  const text = palworldI18n[locale];
  return <div className="palworld-breeding-gender-disclosure">
    <div className="palworld-breeding-gender-disclosure-heading">
      <Button
        variant="secondary"
        aria-controls="palworld-breeding-gender-controls"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? text.collapseGenderSettings : text.genderSettings}
      </Button>
      {!expanded ? <Badge tone="neutral">{text.genderSettingsOptional}</Badge> : null}
    </div>
    <div
      className="palworld-breeding-gender-controls"
      id="palworld-breeding-gender-controls"
      role="group"
      aria-label={text.genderSettingsOptional}
      hidden={!expanded}
    >
      <label className="palworld-gender-field">
        <span>{text.parentAGender}</span>
        <select value={parentAGender ?? "any"} onChange={(event) => onGender("parentAGender", event.target.value)}>
          <option value="any">{genderLabel("any", locale)}</option>
          <option value="male">{genderLabel("male", locale)}</option>
          <option value="female">{genderLabel("female", locale)}</option>
        </select>
      </label>
      <label className="palworld-gender-field">
        <span>{text.parentBGender}</span>
        <select value={parentBGender ?? "any"} onChange={(event) => onGender("parentBGender", event.target.value)}>
          <option value="any">{genderLabel("any", locale)}</option>
          <option value="male">{genderLabel("male", locale)}</option>
          <option value="female">{genderLabel("female", locale)}</option>
        </select>
      </label>
    </div>
  </div>;
}
