import type { PalworldWorkSuitabilityType } from "@streamops/shared";
import { useEffect, useId, useState } from "react";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { workLabel } from "../utils/labels";
import { workSuitabilityIconUrl } from "../utils/work-suitability-icons";

export function PalworldWorkSuitabilityBadge({
  compact = false,
  level,
  locale,
  type,
}: {
  compact?: boolean;
  level: number;
  locale: PalworldLocale;
  type: PalworldWorkSuitabilityType;
}) {
  const label = workLabel(type, locale);
  const levelText = `${palworldI18n[locale].levelPrefix}${level}`;
  const accessibleLabel = `${label}: ${levelText}`;
  const labelKo = `${workLabel(type, "ko")}: ${palworldI18n.ko.levelPrefix}${level}`;
  const labelJa = `${workLabel(type, "ja")}: ${palworldI18n.ja.levelPrefix}${level}`;
  const iconUrl = workSuitabilityIconUrl(type);
  const [imageFailed, setImageFailed] = useState(false);
  const descriptionId = useId();

  useEffect(() => {
    setImageFailed(false);
  }, [iconUrl]);
  const hasImage = iconUrl !== undefined && !imageFailed;

  return (
    <span
      className={[
        "palworld-work-suitability-badge",
        compact ? "is-compact" : "",
        hasImage ? "" : "has-no-icon",
      ].filter(Boolean).join(" ")}
      data-ja={labelJa}
      data-ko={labelKo}
      data-work-type={type}
      role="listitem"
      {...(compact ? {
        "aria-describedby": descriptionId,
        tabIndex: 0
      } : {})}
    >
      {hasImage ? (
        <img
          alt=""
          aria-hidden="true"
          className="palworld-work-suitability-icon is-source-image"
          decoding="async"
          draggable="false"
          height="64"
          loading="lazy"
          onError={() => setImageFailed(true)}
          src={iconUrl}
          width="64"
        />
      ) : null}
      <span className={[
        "palworld-work-suitability-label",
        compact && hasImage ? "yoro-u-sr-only" : "",
      ].filter(Boolean).join(" ")}>{label}</span>
      <strong>{levelText}</strong>
      {compact ? (
        <>
          <span className="yoro-u-sr-only" id={descriptionId}>{accessibleLabel}</span>
          <span aria-hidden="true" className="palworld-work-suitability-tooltip">{accessibleLabel}</span>
        </>
      ) : null}
    </span>
  );
}
