import { useEffect, useState } from "react";
import type { PalworldElement } from "@streamops/shared";
import { Badge } from "../../../shared/ui/Status";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import { PALWORLD_ELEMENT_IMAGES, isLocalPalworldElementImageUrl } from "../utils/element-images";
import { elementLabel } from "../utils/labels";

export function PalworldElementBadge({ element, locale, size = "sm" }: { element: PalworldElement; locale: PalworldLocale; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const asset = PALWORLD_ELEMENT_IMAGES[element];
  const safeImageUrl = isLocalPalworldElementImageUrl(asset.imageUrl) ? asset.imageUrl : undefined;

  useEffect(() => setFailed(false), [safeImageUrl]);

  const icon = safeImageUrl && !failed ? <img
    alt=""
    aria-hidden="true"
    className="palworld-element-icon"
    decoding="async"
    height={asset.height}
    onError={() => setFailed(true)}
    src={safeImageUrl}
    width={asset.width}
  /> : undefined;

  return <Badge className="palworld-element-badge" leftIcon={icon} size={size} tone="info">{elementLabel(element, locale)}</Badge>;
}
