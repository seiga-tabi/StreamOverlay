import type { KeyboardEvent } from "react";
import type { PalworldBreedingGender } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { genderLabel } from "../utils/labels";
import type { PalworldBreedingMode } from "../utils/breeding";

export function BreedingModeTabs({
  locale,
  mode,
  onMode,
}: {
  locale: PalworldLocale;
  mode: PalworldBreedingMode;
  onMode: (mode: PalworldBreedingMode) => void;
}) {
  const text = palworldI18n[locale];

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, currentMode: PalworldBreedingMode): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "ArrowLeft" || event.key === "Home"
      ? "parents"
      : event.key === "ArrowRight" || event.key === "End"
        ? "child"
        : currentMode;
    if (nextMode !== currentMode) onMode(nextMode);
    window.requestAnimationFrame(() => {
      document.getElementById(`palworld-breeding-${nextMode}-tab`)?.focus();
    });
  }

  return <div className="palworld-tabs palworld-breeding-mode-tabs" role="tablist">
    <button
      id="palworld-breeding-parents-tab"
      className={mode === "parents" ? "active" : ""}
      role="tab"
      aria-controls="palworld-breeding-parents-panel"
      aria-selected={mode === "parents"}
      tabIndex={mode === "parents" ? 0 : -1}
      onKeyDown={(event) => moveTab(event, "parents")}
      onClick={() => {
        if (mode !== "parents") onMode("parents");
      }}
    >
      {text.parentsToChild}
    </button>
    <button
      id="palworld-breeding-child-tab"
      className={mode === "child" ? "active" : ""}
      role="tab"
      aria-controls="palworld-breeding-child-panel"
      aria-selected={mode === "child"}
      tabIndex={mode === "child" ? 0 : -1}
      onKeyDown={(event) => moveTab(event, "child")}
      onClick={() => {
        if (mode !== "child") onMode("child");
      }}
    >
      {text.childToParents}
    </button>
  </div>;
}

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
