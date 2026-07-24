import type { PalworldWorkSuitabilityType } from "@streamops/shared";
import { useEffect, useState, type ReactNode } from "react";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { workLabel } from "../utils/labels";
import { workSuitabilityIconUrl } from "../utils/work-suitability-icons";

/** 공식 이미지가 없거나 로딩에 실패한 항목만 대체하는 enum 기반 UI glyph입니다. */
function WorkSuitabilityGlyph({ type }: { type: PalworldWorkSuitabilityType }) {
  let glyph: ReactNode;
  switch (type) {
    case "kindling":
      glyph = <path d="M12 2.8c.4 3-2.6 4.3-2.6 7 0 1.1.6 2 1.4 2.6-.1-2.1 1.4-3.3 2.5-4.7.4 2 2.7 3.5 2.7 6.5a4 4 0 0 1-8 0c0-3.5 2.3-6.1 4-8.2Z" />;
      break;
    case "watering":
      glyph = <><path d="M4 10h9v7H4zM7 10V7h4l2 3M13 12l4-3 2 1-6 4" /><path d="M18 14c1.4 1.6 2 2.5 2 3.4a2 2 0 0 1-4 0c0-.9.6-1.8 2-3.4Z" /></>;
      break;
    case "planting":
      glyph = <><path d="M12 21V9" /><path d="M12 11c-4.4 0-6.5-2.2-6.5-5.8 4.4 0 6.5 2.2 6.5 5.8ZM12 14c4.4 0 6.5-2.2 6.5-5.8-4.4 0-6.5 2.2-6.5 5.8ZM7 21h10" /></>;
      break;
    case "generating_electricity":
      glyph = <path d="m13.2 2.8-7 10.1h5.3l-.7 8.3 7-10.2h-5.3l.7-8.2Z" />;
      break;
    case "handiwork":
      glyph = <path d="M7.5 12V7.5a1.5 1.5 0 0 1 3 0V11M10.5 10V5.5a1.5 1.5 0 0 1 3 0V11M13.5 10V6.5a1.5 1.5 0 0 1 3 0v5M16.5 10a1.5 1.5 0 0 1 3 0v4.2c0 4.2-2.7 6.8-6.8 6.8h-.5C8 21 5 17.8 5 14v-1.5a1.5 1.5 0 0 1 2.5-1.1l2 1.8" />;
      break;
    case "gathering":
      glyph = <><path d="M12 22V3M12 7C9 7 7.4 5.5 7.4 3c3 0 4.6 1.5 4.6 4ZM12 11c3 0 4.6-1.5 4.6-4-3 0-4.6 1.5-4.6 4ZM12 15c-3 0-4.6-1.5-4.6-4 3 0 4.6 1.5 4.6 4ZM12 19c3 0 4.6-1.5 4.6-4-3 0-4.6 1.5-4.6 4Z" /></>;
      break;
    case "lumbering":
      glyph = <><path d="M5 7h11a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6ZM8 13h9a3 3 0 0 1 0 6H8a3 3 0 0 1 0-6Z" /><path d="M16 9.2v1.6M17 15.2v1.6" /></>;
      break;
    case "mining":
      glyph = <><path d="M4 7c4-4 12-4 16 0M12 5v4M6 20l8-11M4 18l4 3" /></>;
      break;
    case "medicine_production":
      glyph = <><path d="M9 3h6v4l2.5 2.5V19A2 2 0 0 1 15.5 21h-7A2 2 0 0 1 6.5 19V9.5L9 7V3Z" /><path d="M6.5 12h11M9.5 16h5M12 13.5v5" /></>;
      break;
    case "cooling":
      glyph = <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" /><path d="m9 4 3 3 3-3M9 20l3-3 3 3M4.8 10.5l4.1-1.1-1.1-4M19.2 13.5l-4.1 1.1 1.1 4M4.8 13.5l4.1 1.1-1.1 4M19.2 10.5l-4.1-1.1 1.1-4" /></>;
      break;
    case "transporting":
      glyph = <><path d="M5 7h14v12H5zM5 11h14M9 7V4h6v3" /><path d="m8 15 2-2 2 2M10 13v4M16 17l-2 2-2-2" /></>;
      break;
    case "farming":
      glyph = <><path d="M5 3v18M12 3v18M19 3v18M3 8h18M3 16h18" /><path d="m5 8 7 8 7-8M5 16l7-8 7 8" /></>;
      break;
  }

  return (
    <svg aria-hidden="true" className="palworld-work-suitability-icon" focusable="false" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {glyph}
      </g>
    </svg>
  );
}

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

  useEffect(() => {
    setImageFailed(false);
  }, [iconUrl]);

  return (
    <span
      className={[
        "palworld-work-suitability-badge",
        compact ? "is-compact" : "",
      ].filter(Boolean).join(" ")}
      data-ja={labelJa}
      data-ko={labelKo}
      data-work-type={type}
      role="listitem"
      title={accessibleLabel}
    >
      {imageFailed || iconUrl === undefined ? (
        <WorkSuitabilityGlyph type={type} />
      ) : (
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
      )}
      <span className={[
        "palworld-work-suitability-label",
        compact ? "yoro-u-sr-only" : "",
      ].filter(Boolean).join(" ")}>{label}</span>
      <strong>{levelText}</strong>
    </span>
  );
}
