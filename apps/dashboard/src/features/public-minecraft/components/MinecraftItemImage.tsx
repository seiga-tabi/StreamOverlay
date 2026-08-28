import { useEffect, useState, type CSSProperties } from "react";
import { minecraftTileHue } from "../utils/names";

export const MINECRAFT_TEXTURE_ORIGIN = "https://assets.mcasset.cloud" as const;
export const MINECRAFT_TEXTURE_VERSION = "1.21.11" as const;

const MINECRAFT_ID_PATTERN = /^[a-z0-9][a-z0-9_]{0,127}$/u;

/** 사용자 입력 URL을 받지 않고 검증된 canonical ID만 버전 고정 CDN 경로로 변환합니다. */
export function minecraftTextureUrls(id: string): readonly string[] {
  if (!MINECRAFT_ID_PATTERN.test(id)) return [];
  const root = `${MINECRAFT_TEXTURE_ORIGIN}/${MINECRAFT_TEXTURE_VERSION}/assets/minecraft/textures`;
  return [`${root}/item/${id}.png`, `${root}/block/${id}.png`];
}

type MinecraftItemImageProps = {
  decorative?: boolean;
  fallbackText: string;
  id: string;
  label: string;
};

/**
 * 실제 게임 텍스처는 외부 버전 고정 CDN에서만 표시합니다.
 * item → block 순으로 시도하고 둘 다 없거나 CDN 장애가 나면 자체 스와치로 복귀합니다.
 */
export function MinecraftItemImage({
  decorative = false,
  fallbackText,
  id,
  label,
}: MinecraftItemImageProps) {
  const sources = minecraftTextureUrls(id);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [id]);

  const source = sources[sourceIndex];
  const accessibility = decorative
    ? { "aria-hidden": true as const }
    : { "aria-label": label, role: "img" as const };

  return (
    <span
      {...accessibility}
      className="minecraft-item-swatch pixel-corner-sm"
      style={{ "--minecraft-tile-hue": minecraftTileHue(id) } as CSSProperties}
      title={decorative ? undefined : label}
    >
      {source ? (
        <img
          alt=""
          aria-hidden="true"
          className="minecraft-item-swatch__image"
          decoding="async"
          loading="lazy"
          onError={() => setSourceIndex((current) => current + 1)}
          referrerPolicy="no-referrer"
          src={source}
        />
      ) : (
        <span aria-hidden="true" className="minecraft-item-swatch__fallback">
          {fallbackText.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
