import type {
  PalworldAcquisitionType,
  PalworldElement,
  PalworldItemCategory,
  PalworldItemFilterCategory,
  PalworldItemRarityTier,
  PalworldGender,
  PalworldPassiveEffectTarget,
  PalworldPassiveEffectType,
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

const passiveEffectTypeLabels: Record<PalworldPassiveEffectType, [string, string]> = {
  ActiveSkillCoolTime_Decrease: ["액티브 스킬 재사용 시간", "アクティブスキルのクールタイム"],
  AutoHPRegeneRate: ["HP 자연 회복량", "HP自然回復量"],
  BreedSpeed: ["교배 속도", "配合速度"],
  BreedSpeed_InBaseCamp: ["거점 교배 속도", "拠点の配合速度"],
  CraftSpeed: ["작업 속도", "作業速度"],
  Defense: ["방어", "防御"],
  ElementBoost_Dark: ["어둠 속성 공격 피해", "闇属性の攻撃ダメージ"],
  ElementBoost_Dragon: ["용 속성 공격 피해", "竜属性の攻撃ダメージ"],
  ElementBoost_Earth: ["땅 속성 공격 피해", "地属性の攻撃ダメージ"],
  ElementBoost_Electricity: ["번개 속성 공격 피해", "雷属性の攻撃ダメージ"],
  ElementBoost_Fire: ["화염 속성 공격 피해", "炎属性の攻撃ダメージ"],
  ElementBoost_Ice: ["얼음 속성 공격 피해", "氷属性の攻撃ダメージ"],
  ElementBoost_Leaf: ["풀 속성 공격 피해", "草属性の攻撃ダメージ"],
  ElementBoost_Normal: ["무속성 공격 피해", "無属性の攻撃ダメージ"],
  ElementBoost_Water: ["물 속성 공격 피해", "水属性の攻撃ダメージ"],
  ElementResist_Dark: ["어둠 속성 피해 경감", "闇属性ダメージ軽減"],
  ElementResist_Dragon: ["용 속성 피해 경감", "竜属性ダメージ軽減"],
  ElementResist_Earth: ["땅 속성 피해 경감", "地属性ダメージ軽減"],
  ElementResist_Electricity: ["번개 속성 피해 경감", "雷属性ダメージ軽減"],
  ElementResist_Fire: ["화염 속성 피해 경감", "炎属性ダメージ軽減"],
  ElementResist_Ice: ["얼음 속성 피해 경감", "氷属性ダメージ軽減"],
  ElementResist_Leaf: ["풀 속성 피해 경감", "草属性ダメージ軽減"],
  ElementResist_Normal: ["무속성 피해 경감", "無属性ダメージ軽減"],
  ElementResist_Water: ["물 속성 피해 경감", "水属性ダメージ軽減"],
  ExplosionResist: ["폭발 피해 경감", "爆発ダメージ軽減"],
  FullStomatch_Decrease: ["포만도 감소량", "満腹度減少量"],
  KnockbackInvalid_ForPassiveSkill: ["넉백 무효", "ノックバック無効"],
  LeanBackInvalid_ForPassiveSkill: ["피격 경직 무효", "被弾のけぞり無効"],
  LifeSteal: ["생명력 흡수", "ライフスティール"],
  Logging: ["플레이어 벌목 효율", "プレイヤーの伐採効率"],
  MaxHP: ["최대 HP", "最大HP"],
  Mining: ["플레이어 채굴 효율", "プレイヤーの採掘効率"],
  MoveSpeed: ["이동 속도", "移動速度"],
  NightOwl: ["야간 활동", "夜間活動"],
  Nocturnal: ["야행성", "夜行性"],
  NonKilling: ["비살상", "非殺傷"],
  PalEggHatchingSpeed: ["Pal 알 부화 속도", "パルのタマゴ孵化速度"],
  PalSP_Increase: ["Pal 기력", "パルのスタミナ"],
  PlayerSP_DecreaseRate: ["플레이어 기력 소비량", "プレイヤーのスタミナ消費量"],
  ReloadSpeedUp: ["재장전 속도", "リロード速度"],
  ResistAdditionalEffect_Burn: ["화상 무효", "炎上無効"],
  ResistAdditionalEffect_Poison: ["독 무효", "毒無効"],
  RideJumpCount_Increase: ["탑승 점프 횟수", "ライド中のジャンプ回数"],
  Sanity_Decrease: ["SAN 감소량", "SAN値減少量"],
  SelfDeathAddItemDrop: ["사망 시 아이템 드롭", "死亡時のアイテムドロップ"],
  ShopBuyPrice_Money_Increase: ["구매 가격", "購入価格"],
  ShopSellPrice_Money_Increase: ["판매 가격", "売却価格"],
  ShotAttack: ["공격", "攻撃"],
  SwimSpeed: ["수영 속도", "泳ぐ速度"],
  WorkSuitabilityAddRank_MonsterFarm: ["목장 작업 적성", "牧場の作業適性"],
  WorldTreeDecayImmunity: ["세계수 부식 면역", "世界樹の腐食耐性"],
};

const passiveEffectTargetLabels: Record<PalworldPassiveEffectTarget, [string, string]> = {
  ToSelf: ["Pal", "パル"],
  ToTrainer: ["플레이어", "プレイヤー"],
  ToSelfAndTrainer: ["Pal·플레이어", "パル・プレイヤー"],
  ToBuildObject: ["건축물", "建築物"],
  None: ["대상 지정 없음", "対象指定なし"],
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
export const passiveEffectTypeLabel = (value: PalworldPassiveEffectType, locale: PalworldLocale) => translated(passiveEffectTypeLabels, value, locale);
export const passiveEffectTargetLabel = (value: PalworldPassiveEffectTarget, locale: PalworldLocale) => translated(passiveEffectTargetLabels, value, locale);
