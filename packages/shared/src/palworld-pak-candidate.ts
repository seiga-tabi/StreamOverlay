import {
  PALWORLD_ELEMENTS,
  PALWORLD_WORK_SUITABILITY_TYPES,
  assertPalworldSourceProvenance
} from "./palworld.js";

export const PALWORLD_PAK_CANDIDATE_ARTIFACT_FILES = [
  "paldex.json",
  "items.json",
  "skills.json",
  "breeding.json",
  "locales/ko.json",
  "locales/ja.json",
  "locales/en.json",
  "assets-manifest.json",
  "map-manifest.json",
  "import-report.json",
  "source-lock.json"
] as const;

export type PalworldPakCandidateArtifactFile =
  (typeof PALWORLD_PAK_CANDIDATE_ARTIFACT_FILES)[number];

export type PalworldPakCandidateArtifactContext = {
  candidateId: string;
  release: string | null;
};

type JsonRecord = Record<string, unknown>;

const CANDIDATE_ID_PATTERN = /^candidate-[a-f0-9]{16}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/u;
const SAFE_PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/u;
const PALWORLD_PAK_LOCALE_FIELDS = [
  "pal_name",
  "pal_description",
  "pal_first_activated",
  "item_name",
  "item_description",
  "skill_name",
  "skill_description",
  "partner_append",
  "ui_common",
  "map_object_name"
] as const;
const UNSAFE_CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const MAX_COLLECTION = 100_000;
const MAX_TEXT = 65_536;
const PALWORLD_PAK_ITEM_TYPE_A = [
  "Accessory",
  "Ammo",
  "Armor",
  "Blueprint",
  "CaptureItemModifier",
  "Consume",
  "Essential",
  "Food",
  "Glider",
  "Material",
  "SpecialWeapon",
  "Weapon"
] as const;
const PALWORLD_PAK_ITEM_TYPE_B = [
  "Accessory",
  "ArmorBody",
  "ArmorHead",
  "Blueprint",
  "CaptureItemModifier",
  "ConsumeAncientTechnologyBook",
  "ConsumeBullet",
  "ConsumeFishingBait",
  "ConsumeGainStatusPoints",
  "ConsumeOther",
  "ConsumePalAwakening",
  "ConsumePalGainExp",
  "ConsumePalGainFriendshipPoint",
  "ConsumePalLevelUp",
  "ConsumePalRankUp",
  "ConsumePalRevive",
  "ConsumePalTalentUp",
  "ConsumePalWorkSuitabilityUp",
  "ConsumePassiveSkillChange",
  "ConsumeTechnologyBook",
  "ConsumeTreasureMap",
  "ConsumeWazaMachine",
  "ConsumeWorldTreeHolyWater",
  "Drug",
  "Essential",
  "Essential_AdditionalInventory",
  "Essential_BossReward",
  "Essential_Lamp",
  "Essential_PalGear",
  "Essential_PassiveSkillChange",
  "Essential_UnlockPlayerFuture",
  "FoodDishFish",
  "FoodDishMeat",
  "FoodDishVegetable",
  "FoodFish",
  "FoodMeat",
  "FoodVegetable",
  "Glider",
  "MaterialIngot",
  "MaterialJewelry",
  "MaterialMonster",
  "MaterialOre",
  "MaterialPalEgg",
  "MaterialProccessing",
  "MaterialStone",
  "MaterialWood",
  "Medicine",
  "Money",
  "ReturnToBaseCamp",
  "SPWeaponCaptureBall",
  "Shield",
  "WeaponAssaultRifle",
  "WeaponBow",
  "WeaponCrossbow",
  "WeaponFishingRod",
  "WeaponFlameThrower",
  "WeaponGatlingGun",
  "WeaponGrapplingGun",
  "WeaponHandgun",
  "WeaponMelee",
  "WeaponMetalDetector",
  "WeaponRocketLauncher",
  "WeaponShotgun",
  "WeaponThrowObject"
] as const;
const PALWORLD_PAK_SOURCE_ELEMENTS = [
  "Dark",
  "Dragon",
  "Earth",
  "Electricity",
  "Fire",
  "Ice",
  "Leaf",
  "None",
  "Normal",
  "Water"
] as const;
const PALWORLD_PAK_PASSIVE_EFFECT_TYPES = [
  "ActiveSkillCoolTime_Decrease",
  "AutoHPRegeneRate",
  "BreedSpeed",
  "BreedSpeed_InBaseCamp",
  "CraftSpeed",
  "Defense",
  "ElementBoost_Dark",
  "ElementBoost_Dragon",
  "ElementBoost_Earth",
  "ElementBoost_Electricity",
  "ElementBoost_Fire",
  "ElementBoost_Ice",
  "ElementBoost_Leaf",
  "ElementBoost_Normal",
  "ElementBoost_Water",
  "ElementResist_Dark",
  "ElementResist_Dragon",
  "ElementResist_Earth",
  "ElementResist_Electricity",
  "ElementResist_Fire",
  "ElementResist_Ice",
  "ElementResist_Leaf",
  "ElementResist_Normal",
  "ElementResist_Water",
  "ExplosionResist",
  "FullStomatch_Decrease",
  "KnockbackInvalid_ForPassiveSkill",
  "LeanBackInvalid_ForPassiveSkill",
  "LifeSteal",
  "Logging",
  "MaxHP",
  "Mining",
  "MoveSpeed",
  "NightOwl",
  "Nocturnal",
  "NonKilling",
  "PalEggHatchingSpeed",
  "PalSP_Increase",
  "PlayerSP_DecreaseRate",
  "ReloadSpeedUp",
  "ResistAdditionalEffect_Burn",
  "ResistAdditionalEffect_Poison",
  "RideJumpCount_Increase",
  "Sanity_Decrease",
  "SelfDeathAddItemDrop",
  "ShopBuyPrice_Money_Increase",
  "ShopSellPrice_Money_Increase",
  "ShotAttack",
  "SwimSpeed",
  "WorkSuitabilityAddRank_MonsterFarm",
  "WorldTreeDecayImmunity"
] as const;
const PALWORLD_PAK_PASSIVE_TARGET_TYPES = [
  "None",
  "ToBuildObject",
  "ToSelf",
  "ToSelfAndTrainer",
  "ToTrainer"
] as const;

export class PalworldPakCandidateArtifactError extends Error {
  readonly code = "PALWORLD_PAK_CANDIDATE_ARTIFACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakCandidateArtifactError";
  }
}

function fail(path: string, message: string): never {
  throw new PalworldPakCandidateArtifactError(`${path}: ${message}`);
}

function recordAt(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "객체여야 합니다.");
  }
  const result = value as JsonRecord;
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of required) {
    if (!Object.hasOwn(result, key)) fail(`${path}.${key}`, "필수 필드가 없습니다.");
  }
  return result;
}

function arrayAt(value: unknown, path: string, maximum = MAX_COLLECTION): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(path, `최대 ${maximum}개 배열이어야 합니다.`);
  }
  return value;
}

function stringAt(
  value: unknown,
  path: string,
  maximum = 512,
  allowEmpty = false
): string {
  if (
    typeof value !== "string"
    || value.length > maximum
    || (!allowEmpty && value.length === 0)
    || UNSAFE_CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    fail(path, `${maximum}자 이하의 안전한 문자열이어야 합니다.`);
  }
  return value;
}

function nullableStringAt(
  value: unknown,
  path: string,
  maximum = 512
): string | null {
  return value === null ? null : stringAt(value, path, maximum);
}

function idAt(value: unknown, path: string): string {
  const result = stringAt(value, path, 192);
  if (!SAFE_ID_PATTERN.test(result)) fail(path, "안전한 canonical ID여야 합니다.");
  return result;
}

function publicIdAt(value: unknown, path: string): string {
  const result = stringAt(value, path, 192);
  if (!SAFE_PUBLIC_ID_PATTERN.test(result)) fail(path, "kebab-case 공개 ID여야 합니다.");
  return result;
}

function nullableIdAt(value: unknown, path: string): string | null {
  return value === null ? null : idAt(value, path);
}

function numberAt(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    fail(path, `${minimum}~${maximum} 범위의 유한 숫자여야 합니다.`);
  }
  return value;
}

function integerAt(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  const result = numberAt(value, path, minimum, maximum);
  if (!Number.isSafeInteger(result)) fail(path, "안전한 정수여야 합니다.");
  return result;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "boolean이어야 합니다.");
  return value;
}

function literalAt<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[]
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(path, `허용값(${allowed.join(", ")}) 중 하나여야 합니다.`);
  }
  return value as T;
}

function sha256At(value: unknown, path: string): string {
  const result = stringAt(value, path, 64);
  if (!SHA256_PATTERN.test(result)) fail(path, "소문자 64자리 SHA-256이어야 합니다.");
  return result;
}

function safeMemberAt(value: unknown, path: string): string {
  const result = stringAt(value, path, 768);
  if (
    result.startsWith("/")
    || result.includes("\\")
    || result.includes("%")
    || result.includes("//")
    || result.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(path, "안전한 archive 상대 경로여야 합니다.");
  }
  return result;
}

function uniqueStringsAt(
  value: unknown,
  path: string,
  validator: (entry: unknown, entryPath: string) => string,
  maximum = MAX_COLLECTION
): string[] {
  const result = arrayAt(value, path, maximum).map((entry, index) =>
    validator(entry, `${path}[${index}]`)
  );
  if (new Set(result).size !== result.length) fail(path, "중복 값이 있습니다.");
  return result;
}

function assertUnique<T>(
  entries: readonly T[],
  path: string,
  keyOf: (entry: T) => string
): void {
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const key = keyOf(entry);
    if (seen.has(key)) fail(`${path}[${index}]`, `중복 식별자입니다: ${key}`);
    seen.add(key);
  }
}

function safeJsonAt(value: unknown, path: string, depth = 0): void {
  if (depth > 16) fail(path, "JSON 중첩 깊이 제한을 초과했습니다.");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    stringAt(value, path, MAX_TEXT, true);
    return;
  }
  if (typeof value === "number") {
    numberAt(value, path, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION) fail(path, "배열 크기 제한을 초과했습니다.");
    value.forEach((entry, index) => safeJsonAt(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as JsonRecord);
    if (entries.length > 512) fail(path, "객체 필드 수 제한을 초과했습니다.");
    for (const [key, entry] of entries) {
      stringAt(key, `${path}.[key]`, 192);
      safeJsonAt(entry, `${path}.${key}`, depth + 1);
    }
    return;
  }
  fail(path, "JSON 값이어야 합니다.");
}

function candidateMetadataAt(
  value: unknown,
  path: string,
  context: PalworldPakCandidateArtifactContext
): void {
  const record = recordAt(value, path, [
    "candidateId",
    "sourceType",
    "release",
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256"
  ]);
  if (record.candidateId !== context.candidateId) {
    fail(`${path}.candidateId`, "artifact candidate ID와 일치해야 합니다.");
  }
  if (record.sourceType !== "operator_pak_export") {
    fail(`${path}.sourceType`, "operator_pak_export여야 합니다.");
  }
  if (record.release !== context.release || record.gameVersion !== context.release) {
    fail(`${path}.release`, "artifact release와 일치해야 합니다.");
  }
  const versionValues = [
    record.gameVersion,
    record.steamBuildId,
    record.fmodelVersion,
    record.exportedAt,
    record.mappingsSha256
  ];
  if (context.release === null) {
    if (versionValues.some((entry) => entry !== null)) {
      fail(path, "metadata가 없으면 version 필드는 모두 null이어야 합니다.");
    }
  } else {
    stringAt(record.gameVersion, `${path}.gameVersion`, 64);
    stringAt(record.steamBuildId, `${path}.steamBuildId`, 20);
    stringAt(record.fmodelVersion, `${path}.fmodelVersion`, 64);
    stringAt(record.exportedAt, `${path}.exportedAt`, 64);
    sha256At(record.mappingsSha256, `${path}.mappingsSha256`);
  }
}

function commonArtifactAt(
  value: unknown,
  path: string,
  context: PalworldPakCandidateArtifactContext,
  requiredPayloadKeys: readonly string[]
): JsonRecord {
  const record = recordAt(value, path, [
    "schemaVersion",
    "candidateId",
    "release",
    "metadata",
    "provenance",
    ...requiredPayloadKeys
  ]);
  if (record.schemaVersion !== 1) fail(`${path}.schemaVersion`, "1이어야 합니다.");
  if (record.candidateId !== context.candidateId) {
    fail(`${path}.candidateId`, "manifest candidate ID와 일치해야 합니다.");
  }
  if (record.release !== context.release) {
    fail(`${path}.release`, "manifest release와 일치해야 합니다.");
  }
  candidateMetadataAt(record.metadata, `${path}.metadata`, context);
  const metadata = record.metadata as JsonRecord;
  const provenance = assertPalworldSourceProvenance(record.provenance);
  if (
    provenance.gameVersion !== context.release
    || context.candidateId
      !== `candidate-${provenance.archiveSha256.slice(0, 16)}`
  ) {
    fail(`${path}.provenance`, "candidate release 또는 source checksum과 일치해야 합니다.");
  }
  for (const field of [
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256"
  ] as const) {
    if (metadata[field] !== provenance[field]) {
      fail(
        `${path}.metadata.${field}`,
        "operator provenance의 고정 source metadata와 일치해야 합니다."
      );
    }
  }
  return record;
}

function richTextTokenAt(value: unknown, path: string, depth = 0): void {
  if (depth > 10) fail(path, "rich-text token 중첩 제한을 초과했습니다.");
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "rich-text token은 객체여야 합니다.");
  }
  const type = (value as JsonRecord).type;
  if (type === "text") {
    const record = recordAt(value, path, ["type", "text", "styles"]);
    stringAt(record.text, `${path}.text`, MAX_TEXT, true);
    uniqueStringsAt(record.styles, `${path}.styles`, (entry, entryPath) =>
      idAt(entry, entryPath), 16
    );
    return;
  }
  if (type === "reference") {
    const record = recordAt(value, path, [
      "type",
      "referenceKind",
      "id",
      "text",
      "styles"
    ]);
    literalAt(record.referenceKind, `${path}.referenceKind`, [
      "character",
      "item",
      "active_skill",
      "ui_common",
      "map_object"
    ]);
    idAt(record.id, `${path}.id`);
    stringAt(record.text, `${path}.text`, MAX_TEXT, true);
    uniqueStringsAt(record.styles, `${path}.styles`, (entry, entryPath) =>
      idAt(entry, entryPath), 16
    );
    return;
  }
  if (type === "image") {
    const record = recordAt(value, path, ["type", "id", "text", "styles"]);
    idAt(record.id, `${path}.id`);
    stringAt(record.text, `${path}.text`, MAX_TEXT, true);
    uniqueStringsAt(record.styles, `${path}.styles`, (entry, entryPath) =>
      idAt(entry, entryPath), 16
    );
    return;
  }
  if (type === "reference_message") {
    const record = recordAt(value, path, ["type", "id", "text", "tokens", "styles"]);
    idAt(record.id, `${path}.id`);
    stringAt(record.text, `${path}.text`, MAX_TEXT, true);
    uniqueStringsAt(record.styles, `${path}.styles`, (entry, entryPath) =>
      idAt(entry, entryPath), 16
    );
    arrayAt(record.tokens, `${path}.tokens`, 4_096).forEach((entry, index) =>
      richTextTokenAt(entry, `${path}.tokens[${index}]`, depth + 1)
    );
    return;
  }
  if (type === "ranked_reference") {
    const record = recordAt(value, path, [
      "type",
      "referenceKind",
      "id",
      "text",
      "values",
      "styles"
    ]);
    literalAt(record.referenceKind, `${path}.referenceKind`, [
      "reference_message",
      "rank_variable"
    ]);
    idAt(record.id, `${path}.id`);
    stringAt(record.text, `${path}.text`, MAX_TEXT, true);
    uniqueStringsAt(record.styles, `${path}.styles`, (entry, entryPath) =>
      idAt(entry, entryPath), 16
    );
    const ranks = arrayAt(record.values, `${path}.values`, 5).map((entry, index) => {
      const rankPath = `${path}.values[${index}]`;
      const rankRecord = recordAt(entry, rankPath, ["rank", "text", "tokens"]);
      const rank = integerAt(rankRecord.rank, `${rankPath}.rank`, 1, 5);
      stringAt(rankRecord.text, `${rankPath}.text`, MAX_TEXT, true);
      arrayAt(rankRecord.tokens, `${rankPath}.tokens`, 4_096).forEach(
        (token, tokenIndex) =>
          richTextTokenAt(token, `${rankPath}.tokens[${tokenIndex}]`, depth + 1)
      );
      return rank;
    });
    if (new Set(ranks).size !== ranks.length) fail(`${path}.values`, "rank가 중복됩니다.");
    return;
  }
  fail(`${path}.type`, "허용된 rich-text token type이 아닙니다.");
}

function localizedValueAt(value: unknown, path: string): void {
  const record = recordAt(
    value,
    path,
    [
      "messageKey",
      "sourceField",
      "ko",
      "ja",
      "en",
      "koStatus",
      "jaStatus",
      "enStatus"
    ],
    [
      "koRichTextStatus",
      "jaRichTextStatus",
      "enRichTextStatus",
      "koRichText",
      "jaRichText",
      "enRichText"
    ]
  );
  const messageKey = stringAt(record.messageKey, `${path}.messageKey`, 192);
  if (!SAFE_MESSAGE_KEY_PATTERN.test(messageKey)) {
    fail(`${path}.messageKey`, "exact locale message key 형식이어야 합니다.");
  }
  literalAt(record.sourceField, `${path}.sourceField`, PALWORLD_PAK_LOCALE_FIELDS);
  const ko = nullableStringAt(record.ko, `${path}.ko`, MAX_TEXT);
  const ja = nullableStringAt(record.ja, `${path}.ja`, MAX_TEXT);
  const en = nullableStringAt(record.en, `${path}.en`, MAX_TEXT);
  if (record.koStatus !== (ko === null ? "missing_source" : "source_provided")) {
    fail(`${path}.koStatus`, "KO 값 존재 여부와 일치해야 합니다.");
  }
  if (record.jaStatus !== (ja === null ? "missing_source" : "source_provided")) {
    fail(`${path}.jaStatus`, "JA 값 존재 여부와 일치해야 합니다.");
  }
  if (record.enStatus !== (en === null ? "missing_source" : "source_provided")) {
    fail(`${path}.enStatus`, "EN 값 존재 여부와 일치해야 합니다.");
  }
  for (const locale of ["ko", "ja", "en"] as const) {
    const statusKey = `${locale}RichTextStatus`;
    const richKey = `${locale}RichText`;
    const hasStatus = Object.hasOwn(record, statusKey);
    const hasRich = Object.hasOwn(record, richKey);
    if (hasStatus !== hasRich) fail(path, "rich-text status와 token payload는 함께 있어야 합니다.");
    if (!hasStatus) continue;
    literalAt(record[statusKey], `${path}.${statusKey}`, [
      "resolved",
      "unresolved",
      "placeholder"
    ]);
    const rich = recordAt(record[richKey], `${path}.${richKey}`, [
      "tokens",
      "unresolved"
    ]);
    arrayAt(rich.tokens, `${path}.${richKey}.tokens`, 4_096).forEach(
      (token, index) =>
        richTextTokenAt(token, `${path}.${richKey}.tokens[${index}]`)
    );
    arrayAt(rich.unresolved, `${path}.${richKey}.unresolved`, 1_024).forEach(
      (entry, index) => {
        const unresolvedPath = `${path}.${richKey}.unresolved[${index}]`;
        const unresolved = recordAt(
          entry,
          unresolvedPath,
          ["code", "offset", "token"],
          ["id"]
        );
        stringAt(unresolved.code, `${unresolvedPath}.code`, 64);
        integerAt(unresolved.offset, `${unresolvedPath}.offset`, 0, MAX_TEXT);
        stringAt(unresolved.token, `${unresolvedPath}.token`, 512, true);
        if (Object.hasOwn(unresolved, "id")) idAt(unresolved.id, `${unresolvedPath}.id`);
      }
    );
  }
}

function validatePaldex(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "paldex", context, ["records", "exclusions"]);
  const records = arrayAt(root.records, "paldex.records", 10_000).map((entry, index) => {
    const path = `paldex.records[${index}]`;
    const record = recordAt(entry, path, [
      "id",
      "idStatus",
      "canonicalJoinRule",
      "sourceRowId",
      "sourceInternalId",
      "tribe",
      "bpClass",
      "bpClassAsset",
      "number",
      "suffix",
      "variantType",
      "rarity",
      "elements",
      "sourceElements",
      "stats",
      "nocturnal",
      "workSuitabilities",
      "sourceOnlyWorkSuitabilities",
      "partnerSkill",
      "activeSkillAssignmentIds",
      "drops",
      "breeding",
      "name",
      "description",
      "firstActivatedInfo"
    ]);
    const id = publicIdAt(record.id, `${path}.id`);
    literalAt(record.idStatus, `${path}.idStatus`, [
      "existing_exact",
      "candidate_internal_id"
    ]);
    literalAt(record.canonicalJoinRule, `${path}.canonicalJoinRule`, [
      "source_row_equals_tribe",
      "source_row_equals_bpclass"
    ]);
    idAt(record.sourceRowId, `${path}.sourceRowId`);
    idAt(record.sourceInternalId, `${path}.sourceInternalId`);
    idAt(record.tribe, `${path}.tribe`);
    stringAt(record.bpClass, `${path}.bpClass`, 256);
    if (record.bpClassAsset !== null) safeMemberAt(record.bpClassAsset, `${path}.bpClassAsset`);
    integerAt(record.number, `${path}.number`, 1, 100_000);
    stringAt(record.suffix, `${path}.suffix`, 64, true);
    literalAt(record.variantType, `${path}.variantType`, ["normal", "variant"]);
    integerAt(record.rarity, `${path}.rarity`, 0, 100);
    uniqueStringsAt(record.elements, `${path}.elements`, (item, itemPath) =>
      literalAt(item, itemPath, PALWORLD_ELEMENTS), PALWORLD_ELEMENTS.length
    );
    arrayAt(
      record.sourceElements,
      `${path}.sourceElements`,
      PALWORLD_ELEMENTS.length + 1
    ).forEach((item, itemIndex) =>
      literalAt(
        item,
        `${path}.sourceElements[${itemIndex}]`,
        PALWORLD_PAK_SOURCE_ELEMENTS
      )
    );
    const stats = recordAt(record.stats, `${path}.stats`, [
      "hp",
      "meleeAttack",
      "shotAttack",
      "defense",
      "walkSpeed",
      "runSpeed",
      "rideSprintSpeed",
      "stamina",
      "food"
    ]);
    for (const field of Object.keys(stats)) {
      numberAt(stats[field], `${path}.stats.${field}`, -1, 1_000_000);
    }
    booleanAt(record.nocturnal, `${path}.nocturnal`);
    arrayAt(record.workSuitabilities, `${path}.workSuitabilities`, 16).forEach(
      (work, workIndex) => {
        const workPath = `${path}.workSuitabilities[${workIndex}]`;
        const workRecord = recordAt(work, workPath, ["type", "level"]);
        literalAt(workRecord.type, `${workPath}.type`, PALWORLD_WORK_SUITABILITY_TYPES);
        integerAt(workRecord.level, `${workPath}.level`, 1, 10);
      }
    );
    arrayAt(
      record.sourceOnlyWorkSuitabilities,
      `${path}.sourceOnlyWorkSuitabilities`,
      4
    ).forEach((work, workIndex) => {
      const workPath = `${path}.sourceOnlyWorkSuitabilities[${workIndex}]`;
      const workRecord = recordAt(work, workPath, ["type", "level", "sourceField"]);
      if (workRecord.type !== "oil_extraction") fail(`${workPath}.type`, "oil_extraction이어야 합니다.");
      integerAt(workRecord.level, `${workPath}.level`, 1, 10);
      stringAt(workRecord.sourceField, `${workPath}.sourceField`, 128);
    });
    const partner = recordAt(record.partnerSkill, `${path}.partnerSkill`, [
      "id",
      "name",
      "parameterSourceRowId",
      "description"
    ]);
    idAt(partner.id, `${path}.partnerSkill.id`);
    localizedValueAt(partner.name, `${path}.partnerSkill.name`);
    nullableIdAt(partner.parameterSourceRowId, `${path}.partnerSkill.parameterSourceRowId`);
    localizedValueAt(partner.description, `${path}.partnerSkill.description`);
    uniqueStringsAt(
      record.activeSkillAssignmentIds,
      `${path}.activeSkillAssignmentIds`,
      (item, itemPath) => idAt(item, itemPath)
    );
    arrayAt(record.drops, `${path}.drops`, 128).forEach((drop, dropIndex) => {
      const dropPath = `${path}.drops[${dropIndex}]`;
      const dropRecord = recordAt(drop, dropPath, [
        "sourceRowId",
        "itemSourceInternalId",
        "itemId",
        "rate",
        "min",
        "max"
      ]);
      idAt(dropRecord.sourceRowId, `${dropPath}.sourceRowId`);
      idAt(dropRecord.itemSourceInternalId, `${dropPath}.itemSourceInternalId`);
      if (dropRecord.itemId !== null) publicIdAt(dropRecord.itemId, `${dropPath}.itemId`);
      numberAt(dropRecord.rate, `${dropPath}.rate`, 0, 100);
      const minimum = integerAt(dropRecord.min, `${dropPath}.min`, 0, 1_000_000);
      const maximum = integerAt(dropRecord.max, `${dropPath}.max`, 0, 1_000_000);
      if (minimum > maximum) fail(dropPath, "drop min은 max보다 클 수 없습니다.");
    });
    const breeding = recordAt(record.breeding, `${path}.breeding`, [
      "combiRank",
      "combiDuplicatePriority",
      "ignoreCombi",
      "maleProbability"
    ]);
    integerAt(breeding.combiRank, `${path}.breeding.combiRank`, 0, 1_000_000);
    integerAt(
      breeding.combiDuplicatePriority,
      `${path}.breeding.combiDuplicatePriority`,
      0,
      1_000_000_000
    );
    booleanAt(breeding.ignoreCombi, `${path}.breeding.ignoreCombi`);
    numberAt(breeding.maleProbability, `${path}.breeding.maleProbability`, 0, 100);
    localizedValueAt(record.name, `${path}.name`);
    localizedValueAt(record.description, `${path}.description`);
    localizedValueAt(record.firstActivatedInfo, `${path}.firstActivatedInfo`);
    return { id, sourceInternalId: record.sourceInternalId as string };
  });
  assertUnique(records, "paldex.records", (entry) => entry.id);
  assertUnique(records, "paldex.records", (entry) => entry.sourceInternalId);
  const exclusions = arrayAt(root.exclusions, "paldex.exclusions", 10_000).map(
    (entry, index) => {
      const path = `paldex.exclusions[${index}]`;
      const record = recordAt(entry, path, [
        "sourceRowId",
        "sourceInternalId",
        "reason"
      ]);
      return {
        sourceRowId: idAt(record.sourceRowId, `${path}.sourceRowId`),
        sourceInternalId: idAt(
          record.sourceInternalId,
          `${path}.sourceInternalId`
        ),
        reason: stringAt(record.reason, `${path}.reason`, 512)
      };
    }
  );
  assertUnique(exclusions, "paldex.exclusions", (entry) => entry.sourceRowId);
  return root;
}

function validateItems(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "items", context, ["records"]);
  const records = arrayAt(root.records, "items.records").map((entry, index) => {
    const path = `items.records[${index}]`;
    const record = recordAt(entry, path, [
      "id",
      "sourceInternalId",
      "typeA",
      "typeB",
      "rarity",
      "rank",
      "maxStack",
      "weight",
      "price",
      "durability",
      "legalInGame",
      "iconName",
      "iconSourceMember",
      "recipes",
      "technology",
      "dropPalIds",
      "name",
      "description"
    ]);
    const id = publicIdAt(record.id, `${path}.id`);
    const sourceInternalId = idAt(record.sourceInternalId, `${path}.sourceInternalId`);
    literalAt(record.typeA, `${path}.typeA`, PALWORLD_PAK_ITEM_TYPE_A);
    literalAt(record.typeB, `${path}.typeB`, PALWORLD_PAK_ITEM_TYPE_B);
    integerAt(record.rarity, `${path}.rarity`, 0, 100);
    integerAt(record.rank, `${path}.rank`, 0, 100_000);
    integerAt(record.maxStack, `${path}.maxStack`, 0, 100_000_000);
    numberAt(record.weight, `${path}.weight`, 0, 1_000_000);
    numberAt(record.price, `${path}.price`, 0, 1_000_000_000_000);
    numberAt(record.durability, `${path}.durability`, 0, 1_000_000_000);
    if (record.legalInGame !== true) fail(`${path}.legalInGame`, "true여야 합니다.");
    if (record.iconName !== null) idAt(record.iconName, `${path}.iconName`);
    if (record.iconSourceMember !== null) {
      safeMemberAt(record.iconSourceMember, `${path}.iconSourceMember`);
    }
    arrayAt(record.recipes, `${path}.recipes`, 128).forEach((recipe, recipeIndex) => {
      const recipePath = `${path}.recipes[${recipeIndex}]`;
      const recipeRecord = recordAt(recipe, recipePath, [
        "sourceRowId",
        "resultCount",
        "workAmount",
        "materials"
      ]);
      idAt(recipeRecord.sourceRowId, `${recipePath}.sourceRowId`);
      integerAt(recipeRecord.resultCount, `${recipePath}.resultCount`, 1, 100_000_000);
      numberAt(recipeRecord.workAmount, `${recipePath}.workAmount`, 0, 1_000_000_000_000);
      arrayAt(recipeRecord.materials, `${recipePath}.materials`, 16).forEach(
        (material, materialIndex) => {
          const materialPath = `${recipePath}.materials[${materialIndex}]`;
          const materialRecord = recordAt(material, materialPath, [
            "sourceInternalId",
            "itemId",
            "count"
          ]);
          idAt(materialRecord.sourceInternalId, `${materialPath}.sourceInternalId`);
          if (materialRecord.itemId !== null) {
            publicIdAt(materialRecord.itemId, `${materialPath}.itemId`);
          }
          integerAt(materialRecord.count, `${materialPath}.count`, 0, 1_000_000);
        }
      );
    });
    arrayAt(record.technology, `${path}.technology`, 256).forEach(
      (technology, technologyIndex) => {
        const technologyPath = `${path}.technology[${technologyIndex}]`;
        const technologyRecord = recordAt(technology, technologyPath, [
          "sourceRowId",
          "unlockLevel",
          "tier",
          "cost"
        ]);
        idAt(technologyRecord.sourceRowId, `${technologyPath}.sourceRowId`);
        integerAt(technologyRecord.unlockLevel, `${technologyPath}.unlockLevel`, 0, 1_000);
        integerAt(technologyRecord.tier, `${technologyPath}.tier`, 0, 1_000);
        integerAt(technologyRecord.cost, `${technologyPath}.cost`, 0, 1_000_000);
      }
    );
    uniqueStringsAt(record.dropPalIds, `${path}.dropPalIds`, (item, itemPath) =>
      publicIdAt(item, itemPath)
    );
    localizedValueAt(record.name, `${path}.name`);
    localizedValueAt(record.description, `${path}.description`);
    return { id, sourceInternalId };
  });
  assertUnique(records, "items.records", (entry) => entry.id);
  assertUnique(records, "items.records", (entry) => entry.sourceInternalId);
  return root;
}

function assignmentAt(value: unknown, path: string): void {
  const record = recordAt(value, path, [
    "sourceRowId",
    "palSourceInternalId",
    "palId",
    "activeSkillSourceInternalId",
    "activeSkillId",
    "level",
    "sourceTable",
    "status"
  ]);
  idAt(record.sourceRowId, `${path}.sourceRowId`);
  stringAt(record.palSourceInternalId, `${path}.palSourceInternalId`, 192);
  if (record.palId !== null) publicIdAt(record.palId, `${path}.palId`);
  idAt(record.activeSkillSourceInternalId, `${path}.activeSkillSourceInternalId`);
  if (record.activeSkillId !== null) idAt(record.activeSkillId, `${path}.activeSkillId`);
  if (record.level !== null) integerAt(record.level, `${path}.level`, 0, 1_000);
  safeMemberAt(record.sourceTable, `${path}.sourceTable`);
  const status = literalAt(record.status, `${path}.status`, [
    "resolved",
    "noncanonical_pal_excluded",
    "nonpublic_pal_excluded",
    "source_pal_missing_excluded",
    "pal_reference_unresolved",
    "skill_reference_unresolved"
  ]);
  if (
    status === "resolved"
    && (record.palId === null || record.activeSkillId === null)
  ) {
    fail(path, "resolved assignment에는 Pal과 skill ID가 모두 필요합니다.");
  }
}

function validateSkills(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "skills", context, [
    "records",
    "assignments",
    "excludedEggAssignments"
  ]);
  const records = arrayAt(root.records, "skills.records").map((entry, index) => {
    const path = `skills.records[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      fail(path, "객체여야 합니다.");
    }
    const type = (entry as JsonRecord).type;
    const keys = type === "active"
      ? [
          "id",
          "sourceRowId",
          "sourceInternalId",
          "type",
          "sourceElement",
          "element",
          "power",
          "cooldownSeconds",
          "relatedPalIds",
          "name",
          "description"
        ]
      : type === "passive"
        ? [
            "id",
            "sourceRowId",
            "sourceInternalId",
            "type",
            "rank",
            "effects",
            "name",
            "description"
          ]
        : type === "partner"
          ? [
              "id",
              "sourceRowId",
              "sourceInternalId",
              "type",
              "relatedPalIds",
              "name",
              "description"
            ]
          : [];
    if (keys.length === 0) fail(`${path}.type`, "active/passive/partner여야 합니다.");
    const record = recordAt(entry, path, keys);
    const id = idAt(record.id, `${path}.id`);
    if (record.sourceRowId !== null) idAt(record.sourceRowId, `${path}.sourceRowId`);
    idAt(record.sourceInternalId, `${path}.sourceInternalId`);
    if (type === "active") {
      literalAt(
        record.sourceElement,
        `${path}.sourceElement`,
        PALWORLD_PAK_SOURCE_ELEMENTS
      );
      if (record.element !== null) literalAt(record.element, `${path}.element`, PALWORLD_ELEMENTS);
      numberAt(record.power, `${path}.power`, 0, 1_000_000);
      numberAt(record.cooldownSeconds, `${path}.cooldownSeconds`, 0, 100_000);
      uniqueStringsAt(record.relatedPalIds, `${path}.relatedPalIds`, (item, itemPath) =>
        publicIdAt(item, itemPath)
      );
    } else if (type === "passive") {
      integerAt(record.rank, `${path}.rank`, -100, 100);
      arrayAt(record.effects, `${path}.effects`, 4).forEach((effect, effectIndex) => {
        const effectPath = `${path}.effects[${effectIndex}]`;
        const effectRecord = recordAt(effect, effectPath, ["type", "value", "target"]);
        literalAt(
          effectRecord.type,
          `${effectPath}.type`,
          PALWORLD_PAK_PASSIVE_EFFECT_TYPES
        );
        numberAt(effectRecord.value, `${effectPath}.value`, -1_000_000, 1_000_000);
        literalAt(
          effectRecord.target,
          `${effectPath}.target`,
          PALWORLD_PAK_PASSIVE_TARGET_TYPES
        );
      });
    } else {
      uniqueStringsAt(record.relatedPalIds, `${path}.relatedPalIds`, (item, itemPath) =>
        publicIdAt(item, itemPath)
      );
    }
    localizedValueAt(record.name, `${path}.name`);
    localizedValueAt(record.description, `${path}.description`);
    return { id, sourceInternalId: record.sourceInternalId as string };
  });
  assertUnique(records, "skills.records", (entry) => entry.id);
  arrayAt(root.assignments, "skills.assignments").forEach((entry, index) =>
    assignmentAt(entry, `skills.assignments[${index}]`)
  );
  arrayAt(root.excludedEggAssignments, "skills.excludedEggAssignments").forEach(
    (entry, index) => assignmentAt(entry, `skills.excludedEggAssignments[${index}]`)
  );
  return root;
}

function validateBreeding(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "breeding", context, [
    "parameters",
    "specialRules",
    "excludedSourceRows",
    "sourceMissingSourceRows",
    "duplicateSourceRows",
    "unresolvedSourceRows",
    "computedResultCount"
  ]);
  const parameters = arrayAt(root.parameters, "breeding.parameters", 10_000).map(
    (entry, index) => {
      const path = `breeding.parameters[${index}]`;
      const record = recordAt(entry, path, [
        "palId",
        "sourceRowId",
        "sourceInternalId",
        "tribe",
        "bpClass",
        "combiRank",
        "combiDuplicatePriority",
        "ignoreCombi",
        "maleProbability",
        "variantType"
      ]);
      const palId = publicIdAt(record.palId, `${path}.palId`);
      idAt(record.sourceRowId, `${path}.sourceRowId`);
      idAt(record.sourceInternalId, `${path}.sourceInternalId`);
      idAt(record.tribe, `${path}.tribe`);
      stringAt(record.bpClass, `${path}.bpClass`, 256);
      integerAt(record.combiRank, `${path}.combiRank`, 0, 1_000_000);
      integerAt(
        record.combiDuplicatePriority,
        `${path}.combiDuplicatePriority`,
        0,
        1_000_000_000
      );
      booleanAt(record.ignoreCombi, `${path}.ignoreCombi`);
      numberAt(record.maleProbability, `${path}.maleProbability`, 0, 100);
      literalAt(record.variantType, `${path}.variantType`, ["normal", "variant"]);
      return palId;
    }
  );
  assertUnique(parameters, "breeding.parameters", (entry) => entry);
  const conditions: string[] = [];
  arrayAt(root.specialRules, "breeding.specialRules", 10_000).forEach(
    (entry, index) => {
      const path = `breeding.specialRules[${index}]`;
      const record = recordAt(
        entry,
        path,
        [
          "sourceRowId",
          "parentAId",
          "parentASourceInternalId",
          "parentBId",
          "parentBSourceInternalId",
          "childId",
          "childSourceInternalId",
          "special"
        ],
        ["parentAGender", "parentBGender"]
      );
      idAt(record.sourceRowId, `${path}.sourceRowId`);
      const parentAId = publicIdAt(record.parentAId, `${path}.parentAId`);
      idAt(record.parentASourceInternalId, `${path}.parentASourceInternalId`);
      const parentBId = publicIdAt(record.parentBId, `${path}.parentBId`);
      idAt(record.parentBSourceInternalId, `${path}.parentBSourceInternalId`);
      publicIdAt(record.childId, `${path}.childId`);
      idAt(record.childSourceInternalId, `${path}.childSourceInternalId`);
      if (record.special !== true) fail(`${path}.special`, "true여야 합니다.");
      const genderA = Object.hasOwn(record, "parentAGender")
        ? literalAt(record.parentAGender, `${path}.parentAGender`, ["male", "female"])
        : "";
      const genderB = Object.hasOwn(record, "parentBGender")
        ? literalAt(record.parentBGender, `${path}.parentBGender`, ["male", "female"])
        : "";
      const ordered = parentAId <= parentBId
        ? `${parentAId}\0${parentBId}\0${genderA}\0${genderB}`
        : `${parentBId}\0${parentAId}\0${genderB}\0${genderA}`;
      conditions.push(ordered);
    }
  );
  if (new Set(conditions).size !== conditions.length) {
    fail("breeding.specialRules", "동일한 특수 교배 조건이 중복됩니다.");
  }
  arrayAt(root.excludedSourceRows, "breeding.excludedSourceRows", 10_000).forEach(
    (entry, index) => {
      const path = `breeding.excludedSourceRows[${index}]`;
      const record = recordAt(entry, path, [
        "sourceRowId",
        "parentA",
        "parentB",
        "child",
        "excludedSourceInternalIds",
        "reason"
      ]);
      idAt(record.sourceRowId, `${path}.sourceRowId`);
      idAt(record.parentA, `${path}.parentA`);
      idAt(record.parentB, `${path}.parentB`);
      idAt(record.child, `${path}.child`);
      uniqueStringsAt(
        record.excludedSourceInternalIds,
        `${path}.excludedSourceInternalIds`,
        (item, itemPath) => idAt(item, itemPath),
        3
      );
      if (record.reason !== "nonpublic_pal_relation") {
        fail(`${path}.reason`, "명시된 비공개 Pal relation 제외 사유여야 합니다.");
      }
    }
  );
  arrayAt(
    root.sourceMissingSourceRows,
    "breeding.sourceMissingSourceRows",
    10_000
  ).forEach((entry, index) => {
    const path = `breeding.sourceMissingSourceRows[${index}]`;
    const record = recordAt(entry, path, [
      "sourceRowId",
      "parentA",
      "parentB",
      "child",
      "missingSourceInternalIds",
      "reason"
    ]);
    idAt(record.sourceRowId, `${path}.sourceRowId`);
    idAt(record.parentA, `${path}.parentA`);
    idAt(record.parentB, `${path}.parentB`);
    idAt(record.child, `${path}.child`);
    uniqueStringsAt(
      record.missingSourceInternalIds,
      `${path}.missingSourceInternalIds`,
      (item, itemPath) => idAt(item, itemPath),
      3
    );
    if (record.reason !== "source_pal_row_missing") {
      fail(`${path}.reason`, "명시된 source Pal 누락 사유여야 합니다.");
    }
  });
  arrayAt(root.duplicateSourceRows, "breeding.duplicateSourceRows", 10_000).forEach(
    (entry, index) => {
      const path = `breeding.duplicateSourceRows[${index}]`;
      const record = recordAt(entry, path, [
        "sourceRowId",
        "duplicateOfSourceRowId",
        "childId",
        "reason"
      ]);
      idAt(record.sourceRowId, `${path}.sourceRowId`);
      idAt(record.duplicateOfSourceRowId, `${path}.duplicateOfSourceRowId`);
      publicIdAt(record.childId, `${path}.childId`);
      if (record.reason !== "duplicate_identical_special_condition") {
        fail(`${path}.reason`, "명시된 duplicate reason이어야 합니다.");
      }
    }
  );
  arrayAt(root.unresolvedSourceRows, "breeding.unresolvedSourceRows", 10_000).forEach(
    (entry, index) => {
      const path = `breeding.unresolvedSourceRows[${index}]`;
      const record = recordAt(entry, path, [
        "sourceRowId",
        "parentA",
        "parentB",
        "child",
        "reason"
      ]);
      idAt(record.sourceRowId, `${path}.sourceRowId`);
      stringAt(record.parentA, `${path}.parentA`, 192);
      stringAt(record.parentB, `${path}.parentB`, 192);
      stringAt(record.child, `${path}.child`, 192);
      stringAt(record.reason, `${path}.reason`, 256);
    }
  );
  integerAt(root.computedResultCount, "breeding.computedResultCount", 0, 100_000_000);
  return root;
}

function validateLocale(
  value: unknown,
  context: PalworldPakCandidateArtifactContext,
  locale: "ko" | "ja" | "en"
): JsonRecord {
  const path = `locales.${locale}`;
  const root = commonArtifactAt(value, path, context, [
    "locale",
    "status",
    "sourceArchiveSha256",
    "languageVerified",
    "records",
    "coverage"
  ]);
  if (root.locale !== locale) fail(`${path}.locale`, `${locale}여야 합니다.`);
  const status = literalAt(root.status, `${path}.status`, ["source_provided", "missing"]);
  sha256At(root.sourceArchiveSha256, `${path}.sourceArchiveSha256`);
  const languageVerified = booleanAt(root.languageVerified, `${path}.languageVerified`);
  const records = arrayAt(root.records, `${path}.records`).map((entry, index) => {
    const recordPath = `${path}.records[${index}]`;
    const record = recordAt(entry, recordPath, [
      "messageKey",
      "field",
      "text",
      "valueSha256",
      "status",
      "sourceMember",
      "sourceMemberSha256"
    ]);
    const messageKey = stringAt(record.messageKey, `${recordPath}.messageKey`, 192);
    if (!SAFE_MESSAGE_KEY_PATTERN.test(messageKey)) {
      fail(`${recordPath}.messageKey`, "exact locale message key여야 합니다.");
    }
    literalAt(record.field, `${recordPath}.field`, PALWORLD_PAK_LOCALE_FIELDS);
    stringAt(record.text, `${recordPath}.text`, 32_768);
    sha256At(record.valueSha256, `${recordPath}.valueSha256`);
    if (record.status !== "source_provided") {
      fail(`${recordPath}.status`, "source_provided여야 합니다.");
    }
    safeMemberAt(record.sourceMember, `${recordPath}.sourceMember`);
    sha256At(record.sourceMemberSha256, `${recordPath}.sourceMemberSha256`);
    return `${record.field as string}\0${messageKey}`;
  });
  assertUnique(records, `${path}.records`, (entry) => entry);
  const coverage = recordAt(root.coverage, `${path}.coverage`, [
    "inputRows",
    "includedRows",
    "placeholderRows",
    "invalidRows",
    "duplicateMessageKeys"
  ]);
  for (const key of Object.keys(coverage)) {
    integerAt(coverage[key], `${path}.coverage.${key}`, 0, 1_000_000);
  }
  if (coverage.includedRows !== records.length) {
    fail(`${path}.coverage.includedRows`, "records 길이와 일치해야 합니다.");
  }
  if (
    status === "missing"
    && (records.length !== 0 || languageVerified)
  ) {
    fail(path, "missing locale은 빈 records와 languageVerified=false여야 합니다.");
  }
  return root;
}

function imageAssetAt(value: unknown, path: string): {
  id: string;
  kind: string;
  outputFile: string;
  outputSha256: string;
} {
  const record = recordAt(value, path, [
    "id",
    "kind",
    "sourceMember",
    "sourceSha256",
    "sourceWidth",
    "sourceHeight",
    "outputFile",
    "outputSha256",
    "outputMime",
    "outputWidth",
    "outputHeight",
    "outputBytes"
  ]);
  const id = idAt(record.id, `${path}.id`);
  const kind = literalAt(record.kind, `${path}.kind`, [
    "pal",
    "item",
    "element",
    "work",
    "skill",
    "map"
  ]);
  safeMemberAt(record.sourceMember, `${path}.sourceMember`);
  sha256At(record.sourceSha256, `${path}.sourceSha256`);
  const sourceWidth = integerAt(record.sourceWidth, `${path}.sourceWidth`, 1, 8_192);
  const sourceHeight = integerAt(record.sourceHeight, `${path}.sourceHeight`, 1, 8_192);
  const outputFile = safeMemberAt(record.outputFile, `${path}.outputFile`);
  const outputSha256 = sha256At(record.outputSha256, `${path}.outputSha256`);
  if (outputFile !== `assets/${kind}/${outputSha256}.webp`) {
    fail(`${path}.outputFile`, "kind와 content hash 기반 WebP 경로여야 합니다.");
  }
  if (record.outputMime !== "image/webp") fail(`${path}.outputMime`, "image/webp여야 합니다.");
  const outputWidth = integerAt(record.outputWidth, `${path}.outputWidth`, 1, 4_096);
  const outputHeight = integerAt(record.outputHeight, `${path}.outputHeight`, 1, 4_096);
  if (outputWidth > sourceWidth || outputHeight > sourceHeight) {
    fail(path, "출력 이미지는 원본보다 커질 수 없습니다.");
  }
  integerAt(record.outputBytes, `${path}.outputBytes`, 1, 16 * 1024 * 1024);
  return { id, kind, outputFile, outputSha256 };
}

function validateAssets(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "assets", context, [
    "status",
    "importMode",
    "transform",
    "images",
    "failures",
    "missing",
    "unmappedSourceImages"
  ]);
  literalAt(root.status, "assets.status", ["candidate_incomplete", "ready"]);
  literalAt(root.importMode, "assets.importMode", ["validation_only", "converted"]);
  const transform = recordAt(root.transform, "assets.transform", [
    "tool",
    "sharpVersion",
    "libvipsVersion",
    "resizeFit",
    "withoutEnlargement",
    "iconWebp",
    "mapWebp",
    "metadataPolicy"
  ]);
  if (
    transform.tool !== "sharp"
    || transform.resizeFit !== "inside"
    || transform.withoutEnlargement !== true
    || transform.metadataPolicy !== "strip"
  ) {
    fail("assets.transform", "고정된 안전 변환 정책과 일치해야 합니다.");
  }
  stringAt(transform.sharpVersion, "assets.transform.sharpVersion", 64);
  stringAt(transform.libvipsVersion, "assets.transform.libvipsVersion", 64);
  for (const field of ["iconWebp", "mapWebp"] as const) {
    const options = recordAt(transform[field], `assets.transform.${field}`, [
      "quality",
      "alphaQuality",
      "effort",
      "smartSubsample"
    ]);
    integerAt(options.quality, `assets.transform.${field}.quality`, 1, 100);
    integerAt(options.alphaQuality, `assets.transform.${field}.alphaQuality`, 1, 100);
    integerAt(options.effort, `assets.transform.${field}.effort`, 0, 6);
    booleanAt(options.smartSubsample, `assets.transform.${field}.smartSubsample`);
  }
  const images = arrayAt(root.images, "assets.images", 10_000).map((entry, index) =>
    imageAssetAt(entry, `assets.images[${index}]`)
  );
  assertUnique(images, "assets.images", (entry) => `${entry.kind}\0${entry.id}`);
  arrayAt(root.failures, "assets.failures", 10_000).forEach((entry, index) => {
    const path = `assets.failures[${index}]`;
    const record = recordAt(entry, path, ["id", "kind", "sourceMember", "code"]);
    idAt(record.id, `${path}.id`);
    literalAt(record.kind, `${path}.kind`, ["pal", "item", "element", "work", "skill", "map"]);
    safeMemberAt(record.sourceMember, `${path}.sourceMember`);
    if (record.code !== "PALWORLD_PAK_ASSET_INVALID") {
      fail(`${path}.code`, "PALWORLD_PAK_ASSET_INVALID여야 합니다.");
    }
  });
  const missing = recordAt(root.missing, "assets.missing", [
    "pals",
    "items",
    "work",
    "skillUnmappedCount"
  ]);
  uniqueStringsAt(missing.pals, "assets.missing.pals", (entry, entryPath) =>
    idAt(entry, entryPath)
  );
  uniqueStringsAt(missing.items, "assets.missing.items", (entry, entryPath) =>
    publicIdAt(entry, entryPath)
  );
  stringAt(missing.work, "assets.missing.work", 128);
  integerAt(missing.skillUnmappedCount, "assets.missing.skillUnmappedCount", 0, 100_000);
  const unmapped = recordAt(root.unmappedSourceImages, "assets.unmappedSourceImages", [
    "skillIcons",
    "palIcons"
  ]);
  for (const field of ["skillIcons", "palIcons"] as const) {
    uniqueStringsAt(unmapped[field], `assets.unmappedSourceImages.${field}`, (entry, entryPath) =>
      safeMemberAt(entry, entryPath)
    );
  }
  return root;
}

function validateMap(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "map", context, ["status", "variants"]);
  literalAt(root.status, "map.status", ["candidate", "blocked", "ready"]);
  const variants = arrayAt(root.variants, "map.variants", 4).map((entry, index) =>
    imageAssetAt(entry, `map.variants[${index}]`)
  );
  if (variants.some((entry) => entry.kind !== "map")) {
    fail("map.variants", "map kind만 허용합니다.");
  }
  assertUnique(variants, "map.variants", (entry) => entry.id);
  return root;
}

function validateImportReport(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "importReport", context, [
    "status",
    "activationEligible",
    "blockers",
    "counts",
    "sourceCounts",
    "localeCoverage",
    "domainLocaleCoverage",
    "detailCoverage",
    "imageCoverage",
    "sourceDomainCounts",
    "richTextIssues",
    "sourceImageResolutionDistribution",
    "sourceReferenceGaps",
    "publicIdMapping",
    "skillIdMigration",
    "technologyAudit",
    "unresolved",
    "excluded",
    "aliasApplications",
    "staleAliases",
    "reviewedExclusions",
    "palIconOverrides",
    "sourceTablePalIconReferences",
    "imageAssetFailures",
    "limitations"
  ]);
  const status = literalAt(root.status, "importReport.status", [
    "blocked_candidate",
    "ready_candidate"
  ]);
  const activationEligible = booleanAt(
    root.activationEligible,
    "importReport.activationEligible"
  );
  const blockers = uniqueStringsAt(
    root.blockers,
    "importReport.blockers",
    (entry, entryPath) =>
    idAt(entry, entryPath), 128
  );
  if (
    (status === "ready_candidate"
      && (!activationEligible || blockers.length !== 0))
    || (
      status === "blocked_candidate"
      && (activationEligible || blockers.length === 0)
    )
  ) {
    fail(
      "importReport",
      "ready candidate는 blocker가 없어야 하고 blocked candidate는 blocker가 필요합니다."
    );
  }
  for (const field of [
    "counts",
    "sourceCounts",
    "localeCoverage",
    "domainLocaleCoverage",
    "detailCoverage",
    "imageCoverage",
    "sourceDomainCounts",
    "richTextIssues",
    "sourceImageResolutionDistribution",
    "sourceReferenceGaps",
    "publicIdMapping",
    "skillIdMigration",
    "technologyAudit",
    "unresolved",
    "excluded",
    "aliasApplications",
    "staleAliases",
    "reviewedExclusions",
    "palIconOverrides",
    "sourceTablePalIconReferences",
    "imageAssetFailures",
    "limitations"
  ] as const) {
    safeJsonAt(root[field], `importReport.${field}`);
  }
  return root;
}

function validateSourceLock(
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): JsonRecord {
  const root = commonArtifactAt(value, "sourceLock", context, [
    "archive",
    "mappings",
    "includedFiles"
  ]);
  const archive = recordAt(root.archive, "sourceLock.archive", [
    "sha256",
    "bytes",
    "fileCount"
  ]);
  sha256At(archive.sha256, "sourceLock.archive.sha256");
  integerAt(archive.bytes, "sourceLock.archive.bytes", 1, Number.MAX_SAFE_INTEGER);
  integerAt(archive.fileCount, "sourceLock.archive.fileCount", 1, 100_000);
  const mappings = recordAt(root.mappings, "sourceLock.mappings", [
    "publicIdMap",
    "aliases",
    "palIconOverrides",
    "elementIconMap",
    "workIconMap",
    "skillIconMap",
    "publicActiveSkillAllowlist",
    "exclusions",
    "legacySkillCatalog"
  ]);
  for (const key of Object.keys(mappings)) {
    sha256At(mappings[key], `sourceLock.mappings.${key}`);
  }
  const included = arrayAt(root.includedFiles, "sourceLock.includedFiles", 10_000).map(
    (entry, index) => {
      const path = `sourceLock.includedFiles[${index}]`;
      const record = recordAt(entry, path, ["member", "sha256", "bytes"]);
      const member = safeMemberAt(record.member, `${path}.member`);
      sha256At(record.sha256, `${path}.sha256`);
      integerAt(record.bytes, `${path}.bytes`, 1, Number.MAX_SAFE_INTEGER);
      return member;
    }
  );
  assertUnique(included, "sourceLock.includedFiles", (entry) => entry);
  return root;
}

export function assertPalworldPakCandidateArtifact(
  file: PalworldPakCandidateArtifactFile,
  value: unknown,
  context: PalworldPakCandidateArtifactContext
): Readonly<JsonRecord> {
  if (!CANDIDATE_ID_PATTERN.test(context.candidateId)) {
    fail("context.candidateId", "source checksum 기반 candidate ID여야 합니다.");
  }
  let validated: JsonRecord;
  switch (file) {
    case "paldex.json":
      validated = validatePaldex(value, context);
      break;
    case "items.json":
      validated = validateItems(value, context);
      break;
    case "skills.json":
      validated = validateSkills(value, context);
      break;
    case "breeding.json":
      validated = validateBreeding(value, context);
      break;
    case "locales/ko.json":
      validated = validateLocale(value, context, "ko");
      break;
    case "locales/ja.json":
      validated = validateLocale(value, context, "ja");
      break;
    case "locales/en.json":
      validated = validateLocale(value, context, "en");
      break;
    case "assets-manifest.json":
      validated = validateAssets(value, context);
      break;
    case "map-manifest.json":
      validated = validateMap(value, context);
      break;
    case "import-report.json":
      validated = validateImportReport(value, context);
      break;
    case "source-lock.json":
      validated = validateSourceLock(value, context);
      break;
  }
  return Object.freeze(validated);
}
