import type { PalworldLocale } from "../i18n/palworld-i18n";
import { PALWORLD_MAP_COLLECTIBLE_TYPE_IDS } from "../utils/map-collectible-types";

/**
 * 현재 공개 runtime에서 검증된 지도 레이어만 허용합니다.
 * 신규 레이어는 Shared schema와 artifact activation gate가 준비된 뒤 명시적으로 추가합니다.
 */
export const PALWORLD_MAP_READY_LAYER_IDS = [
  "boss",
  "spawn",
  "fast-travel",
  "dungeon",
  "npc",
  "egg",
  "lifmunk",
  "skill-fruit",
  "treasure",
  "journal",
  "resource",
  "enemy",
  "location",
  ...PALWORLD_MAP_COLLECTIBLE_TYPE_IDS,
] as const;
export const PALWORLD_MAP_PENDING_LAYER_IDS = [] as const;
export const PALWORLD_MAP_EXPLORER_LAYER_IDS = [
  ...PALWORLD_MAP_READY_LAYER_IDS,
  ...PALWORLD_MAP_PENDING_LAYER_IDS,
] as const;

export type PalworldMapExplorerLayerId =
  (typeof PALWORLD_MAP_EXPLORER_LAYER_IDS)[number];
export type PalworldMapReadyLayerId =
  (typeof PALWORLD_MAP_READY_LAYER_IDS)[number];

export type PalworldMapLocalizedLabel = {
  ko: string;
  ja: string;
};

export type PalworldMapLayerDisplayState =
  | "idle"
  | "loading"
  | "ready"
  | "confirmed_empty"
  | "data_unavailable"
  | "error";

export type PalworldMapLayerIconAsset = {
  imageUrl: string;
  width: number;
  height: number;
};

export type PalworldMapLayerOption = {
  id: PalworldMapExplorerLayerId;
  label: PalworldMapLocalizedLabel;
  description?: PalworldMapLocalizedLabel;
  statusLabel?: PalworldMapLocalizedLabel;
  count?: number;
  iconAsset?: PalworldMapLayerIconAsset;
  iconFallback: string;
  selected: boolean;
  state: PalworldMapLayerDisplayState;
};

export type PalworldMapLayerGroup = {
  id: string;
  label: PalworldMapLocalizedLabel;
  collapsed?: boolean;
  layers: readonly PalworldMapLayerOption[];
};

export function resolvePalworldMapLabel(
  label: PalworldMapLocalizedLabel,
  locale: PalworldLocale,
): string {
  /* 가져온 지도 라벨 데이터는 ko·ja 만 담김 — en 은 ko 폴백(서버 en 라벨은 후속). */
  return label[locale === "en" ? "ko" : locale];
}

export function isPalworldMapLayerReady(
  layer: PalworldMapLayerOption,
): boolean {
  return layer.state === "ready";
}
