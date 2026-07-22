import { useEffect, useState } from "react";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { palworldI18n } from "../i18n/palworld-i18n";

const LOCAL_PALWORLD_IMAGE_PATTERNS = {
  pal: /^\/images\/palworld\/1\.0\.1\/pals\/[0-9a-f]{64}\.webp$/u,
  item: /^\/images\/palworld\/1\.0\.1\/items\/[0-9a-f]{64}\.webp$/u,
} as const;

export function isLocalPalworldImageUrl(
  imageUrl: string | undefined,
  kind?: "pal" | "item"
): imageUrl is string {
  if (typeof imageUrl !== "string") return false;
  return kind
    ? LOCAL_PALWORLD_IMAGE_PATTERNS[kind].test(imageUrl)
    : Object.values(LOCAL_PALWORLD_IMAGE_PATTERNS).some((pattern) => pattern.test(imageUrl));
}

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
  const safeImageUrl = isLocalPalworldImageUrl(imageUrl, kind) ? imageUrl : undefined;

  useEffect(() => {
    setFailed(false);
  }, [safeImageUrl]);

  if (!safeImageUrl || failed) {
    return (
      <div className={`palworld-media-fallback is-${kind}`} role="img" aria-label={`${alt} · ${fallback}`}>
        <span aria-hidden="true">{kind === "pal" ? "P" : "◇"}</span>
        <small data-ko={palworldI18n.ko.imageFallback} data-ja={palworldI18n.ja.imageFallback}>{fallback}</small>
      </div>
    );
  }
  return <img className="palworld-media-image" src={safeImageUrl} alt={alt} decoding="async" loading="lazy" onError={() => setFailed(true)} />;
}
