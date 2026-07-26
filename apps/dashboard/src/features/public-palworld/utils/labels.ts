import type {
  PalworldAcquisitionType,
  PalworldElement,
  PalworldItemCategory,
  PalworldItemFilterCategory,
  PalworldItemRarityTier,
  PalworldGender,
  PalworldPassiveEffectFilter,
  PalworldSkillType,
  PalworldWorkSuitabilityType,
} from "@streamops/shared";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

const elementLabels: Record<PalworldElement, [string, string]> = {
  neutral: ["무속성", "無属性"], fire: ["불", "炎"], water: ["물", "水"], electric: ["번개", "雷"],
  grass: ["풀", "草"], ice: ["얼음", "氷"], ground: ["땅", "地"], dark: ["어둠", "闇"], dragon: ["용", "竜"],
};

const workLabels: Record<PalworldWorkSuitabilityType, [string, string]> = {
  kindling: ["불 피우기", "火おこし"], watering: ["관개", "水やり"], planting: ["파종", "種まき"],
  generating_electricity: ["발전", "発電"], handiwork: ["수작업", "手作業"], gathering: ["채집", "採集"],
  lumbering: ["벌목", "伐採"], mining: ["채굴", "採掘"], medicine_production: ["제약", "製薬"],
  cooling: ["냉각", "冷却"], transporting: ["운반", "運搬"], farming: ["목장", "牧場"],
};

const categoryLabels: Record<PalworldItemCategory, [string, string]> = {
  material: ["재료", "素材"], consumable: ["소모품", "消耗品"], weapon: ["무기", "武器"], armor: ["방어구", "防具"],
  accessory: ["액세서리", "アクセサリー"], sphere: ["Pal 스피어", "パルスフィア"], ammo: ["탄약", "弾薬"], food: ["식량", "食料"],
  medicine: ["약", "薬"], key_item: ["중요 아이템", "大事なもの"], building: ["건축", "建築"], other: ["기타", "その他"],
};

const itemTypeLabels: Record<PalworldItemFilterCategory, [string, string]> = {
  material: ["소재", "素材"],
  sphere: ["스피어", "スフィア"],
  ammo: ["탄약", "弾薬"],
  consumable: ["소모품", "消耗品"],
  weapon: ["무기", "武器"],
  armor: ["방어구", "防具"],
  accessory: ["장신구", "アクセサリー"],
  glider: ["글라이더", "グライダー"],
  food: ["식재료·음식", "食材・料理"],
  valuable: ["귀중품", "貴重品"],
  blueprint: ["설계도", "設計図"],
  sphere_module: ["스피어 모듈", "スフィアモジュール"],
};

const itemRarityTierLabels: Record<PalworldItemRarityTier, [string, string]> = {
  common: ["일반", "コモン"],
  uncommon: ["비범", "アンコモン"],
  rare: ["희귀", "レア"],
  epic: ["영웅", "エピック"],
  legendary: ["전설", "レジェンダリー"],
};

const acquisitionLabels: Record<PalworldAcquisitionType, [string, string]> = {
  craft: ["제작", "制作"], drop: ["드롭", "ドロップ"], merchant: ["상인", "商人"], chest: ["보물 상자", "宝箱"],
  gathering: ["채집", "採集"], quest: ["퀘스트", "クエスト"], other: ["기타", "その他"],
};

const genderLabels: Record<PalworldGender, [string, string]> = {
  any: ["성별 무관", "性別不問"], male: ["수컷", "オス"], female: ["암컷", "メス"],
};

const skillTypeLabels: Record<PalworldSkillType, [string, string]> = {
  active: ["액티브", "アクティブ"], partner: ["파트너", "パートナー"], passive: ["패시브", "パッシブ"],
};

const passiveEffectFilterLabels: Record<PalworldPassiveEffectFilter, [string, string]> = {
  movement_speed: ["이동 속도", "移動速度"],
  attack: ["공격", "攻撃"],
  defense: ["방어", "防御"],
  health: ["생명력", "HP"],
  stamina: ["기력", "スタミナ"],
  work_speed: ["작업 속도", "作業速度"],
  san: ["SAN 수치", "SAN値"],
  element_attack: ["속성 공격", "属性攻撃"],
  element_defense: ["속성 방어", "属性防御"],
  trade: ["거래", "取引"],
  production: ["생산", "生産"],
  other: ["기타", "その他"],
};

function translated<T extends string>(values: Record<T, [string, string]>, value: T, locale: PalworldLocale): string {
  return values[value]?.[locale === "ja" ? 1 : 0] ?? palworldI18n[locale].unknown;
}

export const elementLabel = (value: PalworldElement, locale: PalworldLocale) => translated(elementLabels, value, locale);
export const workLabel = (value: PalworldWorkSuitabilityType, locale: PalworldLocale) => translated(workLabels, value, locale);
export const categoryLabel = (value: PalworldItemCategory, locale: PalworldLocale) => translated(categoryLabels, value, locale);
export const itemTypeLabel = (value: PalworldItemFilterCategory, locale: PalworldLocale) => translated(itemTypeLabels, value, locale);
export const itemRarityTierLabel = (value: PalworldItemRarityTier, locale: PalworldLocale) => translated(itemRarityTierLabels, value, locale);
export type PalworldItemRarityBand = PalworldItemRarityTier | "unclassified";
export function itemRarityBand(rarity: number): PalworldItemRarityBand {
  if (rarity === 0) return "common";
  if (rarity === 1) return "uncommon";
  if (rarity === 2) return "rare";
  if (rarity === 3) return "epic";
  if (rarity === 4) return "legendary";
  return "unclassified";
}
export function itemRarityLabel(rarity: number, locale: PalworldLocale): string {
  const tier = itemRarityBand(rarity);
  return tier === "unclassified"
    ? `${palworldI18n[locale].rarity} ${rarity}`
    : itemRarityTierLabel(tier, locale);
}
export const acquisitionLabel = (value: PalworldAcquisitionType, locale: PalworldLocale) => translated(acquisitionLabels, value, locale);
export const genderLabel = (value: PalworldGender, locale: PalworldLocale) => translated(genderLabels, value, locale);
export const skillTypeLabel = (value: PalworldSkillType, locale: PalworldLocale) => translated(skillTypeLabels, value, locale);
export const passiveEffectFilterLabel = (value: PalworldPassiveEffectFilter, locale: PalworldLocale) => translated(passiveEffectFilterLabels, value, locale);
