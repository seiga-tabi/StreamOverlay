import { useState } from "react";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { palworldI18n } from "../i18n/palworld-i18n";

export function PalworldMedia({
  alt,
  imageUrl,
  locale,
  kind,
}: {
  alt: string;
  imageUrl?: string;
  locale: PalworldLocale;
  kind: "pal" | "item";
}) {
  const [failed, setFailed] = useState(false);
  const fallback = palworldI18n[locale].imageFallback;
  if (!imageUrl || failed) {
    return (
      <div className={`palworld-media-fallback is-${kind}`} role="img" aria-label={`${alt} · ${fallback}`}>
        <span aria-hidden="true">{kind === "pal" ? "P" : "◇"}</span>
        <small data-ko={palworldI18n.ko.imageFallback} data-ja={palworldI18n.ja.imageFallback}>{fallback}</small>
      </div>
    );
  }
  return <img className="palworld-media-image" src={imageUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
