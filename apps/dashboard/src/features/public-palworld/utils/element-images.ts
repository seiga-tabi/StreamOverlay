import type { PalworldElement } from "@streamops/shared";

export type PalworldElementImage = {
  imageUrl: string;
  width: number;
  height: number;
};

const ROOT = "/images/palworld/1.0.1/elements";

export const PALWORLD_ELEMENT_IMAGES: Readonly<Record<PalworldElement, PalworldElementImage>> = Object.freeze({
  neutral: { imageUrl: `${ROOT}/ab38c4cd2fc1f9ac5683c1401b5f6aee305a73f26e3d59a33f3392d8c85ac842.webp`, width: 48, height: 48 },
  fire: { imageUrl: `${ROOT}/a0104f033275025b26e3ce2665565262872b12f6434934b6f1d9e0d2c53f531a.webp`, width: 48, height: 48 },
  water: { imageUrl: `${ROOT}/9814f74c34f9e71e55f23fbecec1d8b744821c0fda82f5f02a6471c3a00785b5.webp`, width: 48, height: 48 },
  electric: { imageUrl: `${ROOT}/02e61246439c77da962825402eae51a4586d2875d8a2e077d62fe770b0aa0062.webp`, width: 48, height: 48 },
  grass: { imageUrl: `${ROOT}/ffe422a5b47592f421346a87a558329d7dda6c086120fc8df7c49e7f6625eb79.webp`, width: 48, height: 48 },
  ice: { imageUrl: `${ROOT}/6233481df822a59542b71d2d9589117895a9246b040a4444733031994e021c11.webp`, width: 48, height: 48 },
  ground: { imageUrl: `${ROOT}/fd559c7b81374007983d0cd4e4ff85062da804beca41810ffd2e27c9ecbed5c3.webp`, width: 48, height: 48 },
  dark: { imageUrl: `${ROOT}/91f0e913d19fa4c185bc43fc9351ac2d16afc159d418ac07f955c0af0d7f3159.webp`, width: 48, height: 48 },
  dragon: { imageUrl: `${ROOT}/4b267fc44f551e27ed83e90061b2b3bee9421dbf491397cd393cca31b979530f.webp`, width: 48, height: 48 },
});

const ELEMENT_IMAGE_PATTERN = /^\/images\/palworld\/1\.0\.1\/elements\/[0-9a-f]{64}\.webp$/u;

export function isLocalPalworldElementImageUrl(value: string): boolean {
  return ELEMENT_IMAGE_PATTERN.test(value);
}
