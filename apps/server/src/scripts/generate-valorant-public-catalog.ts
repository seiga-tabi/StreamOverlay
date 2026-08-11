import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type LocalizedSource = {
  localizedByCulture?: Record<string, unknown>;
};

type SourceEntity = {
  id?: unknown;
  name?: LocalizedSource;
  description?: LocalizedSource;
  category?: unknown;
  abilities?: Record<string, { name?: LocalizedSource; description?: LocalizedSource }>;
};

const SOURCE_URL = "https://valorant.dyn.riotcdn.net/x/content-catalog/PublicContentCatalog-release-12.08.zip";
const SOURCE_NAME = "Riot Games Public Content Catalog";
const GAME_VERSION = "12.08.00.4578383";
const LICENSE = "Riot Games 공개 콘텐츠 정책에 따라 YORO.gg 서비스 안에서만 사용";

const ROLE_BY_AGENT_NAME: Readonly<Record<string, "Controller" | "Duelist" | "Initiator" | "Sentinel">> = {
  Astra: "Controller", Brimstone: "Controller", Clove: "Controller", Harbor: "Controller",
  Miks: "Controller", Omen: "Controller", Viper: "Controller",
  Iso: "Duelist", Jett: "Duelist", Neon: "Duelist", Phoenix: "Duelist", Raze: "Duelist",
  Reyna: "Duelist", Waylay: "Duelist", Yoru: "Duelist",
  Breach: "Initiator", Fade: "Initiator", Gekko: "Initiator", "KAY/O": "Initiator",
  Skye: "Initiator", Sova: "Initiator", Tejo: "Initiator",
  Chamber: "Sentinel", Cypher: "Sentinel", Deadlock: "Sentinel", Killjoy: "Sentinel",
  Sage: "Sentinel", Veto: "Sentinel", Vyse: "Sentinel"
};

const STANDARD_WEAPONS = new Set([
  "Melee", "Classic", "Bandit", "Frenzy", "Ghost", "Sheriff", "Shorty",
  "Odin", "Ares", "Vandal", "Bulldog", "Phantom", "Guardian", "Judge",
  "Bucky", "Operator", "Outlaw", "Marshal", "Spectre", "Stinger"
]);

const STANDARD_MAPS = new Set([
  "Ascent", "Split", "Fracture", "Bind", "Breeze", "Abyss", "Lotus", "Sunset",
  "Pearl", "Icebox", "Corrode", "Haven"
]);

const CATEGORY_NAMES: Readonly<Record<string, { ko: string; ja: string }>> = {
  Melee: { ko: "근접 무기", ja: "近接武器" }, Sidearm: { ko: "보조 무기", ja: "サイドアーム" },
  SMG: { ko: "기관단총", ja: "サブマシンガン" }, Shotgun: { ko: "산탄총", ja: "ショットガン" },
  Rifle: { ko: "소총", ja: "ライフル" }, Sniper: { ko: "저격소총", ja: "スナイパー" },
  Heavy: { ko: "기관총", ja: "マシンガン" }
};

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function canonicalTimestamp(name: string): string {
  const value = argument(name);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    || new Date(value).toISOString() !== value
  ) throw new Error(`${name.slice(2).replaceAll("-", "_")}_invalid`);
  return value;
}

function text(value: unknown, pathName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${pathName}_invalid`);
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`${pathName}_invalid`);
  }
  return normalized;
}

function localized(value: LocalizedSource | undefined, pathName: string): { ko: string; ja: string } {
  const source = value?.localizedByCulture;
  return {
    ko: text(source?.["ko-KR"], `${pathName}_ko`),
    ja: text(source?.["ja-JP"], `${pathName}_ja`)
  };
}

function englishName(value: LocalizedSource | undefined, pathName: string): string {
  const record = value as LocalizedSource & { defaultText?: unknown } | undefined;
  return text(record?.defaultText, pathName);
}

function roleCatalog(source: Record<string, unknown>): Map<string, { id: string; name: { ko: string; ja: string } }> {
  const roles = source.characterRoles;
  if (!Array.isArray(roles)) throw new Error("character_roles_invalid");
  return new Map(roles.map((candidate, index) => {
    const role = candidate as SourceEntity;
    return [englishName(role.name, `role_${index}_name`), {
      id: text(role.id, `role_${index}_id`).toLowerCase(),
      name: localized(role.name, `role_${index}_name`)
    }];
  }));
}

function buildArtifact(source: Record<string, unknown>, extractedAt: string, verifiedAt: string) {
  if (source.version !== GAME_VERSION) throw new Error("catalog_version_mismatch");
  const roles = roleCatalog(source);
  const characters = source.characters;
  const weapons = source.weapons;
  const maps = source.maps;
  const acts = source.acts;
  const queues = source.matchmakingQueues;
  if (![characters, weapons, maps, acts, queues].every(Array.isArray)) throw new Error("catalog_shape_invalid");

  const agents = (characters as unknown[]).map((candidate, index) => {
    const agent = candidate as SourceEntity;
    const sourceName = englishName(agent.name, `agent_${index}_name`);
    const role = roles.get(ROLE_BY_AGENT_NAME[sourceName] ?? "");
    if (!role) throw new Error(`agent_role_missing:${sourceName}`);
    const slots = [["ability1", "C"], ["ability2", "Q"], ["grenade", "E"], ["ultimate", "X"]] as const;
    return {
      id: text(agent.id, `agent_${index}_id`).toLowerCase(),
      name: localized(agent.name, `agent_${index}_name`),
      role,
      description: localized(agent.description, `agent_${index}_description`),
      skills: slots.map(([slot, key]) => ({
        key,
        name: localized(agent.abilities?.[slot]?.name, `agent_${index}_${slot}_name`),
        description: localized(agent.abilities?.[slot]?.description, `agent_${index}_${slot}_description`)
      }))
    };
  });

  const weaponNames = new Set<string>();
  const publicWeapons = (weapons as unknown[]).flatMap((candidate, index) => {
    const weapon = candidate as SourceEntity;
    const sourceName = englishName(weapon.name, `weapon_${index}_name`);
    const category = text(weapon.category, `weapon_${index}_category`);
    if (!STANDARD_WEAPONS.has(sourceName) || weaponNames.has(sourceName) || !CATEGORY_NAMES[category]) return [];
    weaponNames.add(sourceName);
    return [{
      id: text(weapon.id, `weapon_${index}_id`).toLowerCase(),
      name: localized(weapon.name, `weapon_${index}_name`),
      category: { id: category.toLowerCase(), name: CATEGORY_NAMES[category] },
      // Public Content Catalog에는 상점 가격이 없어 추측하지 않습니다.
      creditCost: null
    }];
  });

  const publicMaps = (maps as unknown[]).flatMap((candidate, index) => {
    const map = candidate as SourceEntity;
    const sourceName = englishName(map.name, `map_${index}_name`);
    if (!STANDARD_MAPS.has(sourceName)) return [];
    return [{
      id: text(map.id, `map_${index}_id`).toLowerCase(),
      name: localized(map.name, `map_${index}_name`),
      // Public Content Catalog에는 사이트 구성이 없어 추측하지 않습니다.
      sites: []
    }];
  });

  const publicActs = (acts as unknown[]).flatMap((candidate, index) => {
    const act = candidate as SourceEntity & { type?: unknown };
    return act.type === "act" ? [{
      id: text(act.id, `act_${index}_id`).toLowerCase(),
      name: localized(act.name, `act_${index}_name`)
    }] : [];
  });

  const publicQueues = (queues as unknown[]).map((candidate, index) => {
    const queue = candidate as SourceEntity;
    return {
      id: text(queue.id, `queue_${index}_id`).toLowerCase(),
      name: localized(queue.name, `queue_${index}_name`)
    };
  });

  return {
    schemaVersion: 1,
    metadata: {
      gameVersion: GAME_VERSION,
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      extractedAt,
      verifiedAt,
      license: LICENSE
    },
    agents,
    weapons: publicWeapons,
    maps: publicMaps,
    acts: publicActs,
    queues: publicQueues
  };
}

const inputPath = path.resolve(argument("--input"));
const outputPath = path.resolve(argument("--output"));
const extractedAt = canonicalTimestamp("--extracted-at");
const verifiedAt = canonicalTimestamp("--verified-at");
if (verifiedAt < extractedAt) throw new Error("verified_at_before_extracted_at");
const sourceBytes = fs.readFileSync(inputPath);
const source = JSON.parse(sourceBytes.toString("utf8")) as Record<string, unknown>;
const artifact = buildArtifact(source, extractedAt, verifiedAt);
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o644 });
console.log(JSON.stringify({
  output: outputPath,
  sourceSha256: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
  artifactSha256: crypto.createHash("sha256").update(serialized).digest("hex"),
  counts: {
    agents: artifact.agents.length,
    weapons: artifact.weapons.length,
    maps: artifact.maps.length,
    acts: artifact.acts.length,
    queues: artifact.queues.length
  }
}));
