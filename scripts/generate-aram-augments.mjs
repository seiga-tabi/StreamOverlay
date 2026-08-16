import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imagesDirectory = path.join(repositoryRoot, "apps/dashboard/public/images/lol/aram");
const catalogPath = path.join(repositoryRoot, "apps/server/data/lol/aram/augment-catalog.json");

const DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const arenaJsonUrl = (version, locale) =>
  `https://raw.communitydragon.org/${version}/cdragon/arena/${locale}.json`;
const rawAssetBase = (version) => `https://raw.communitydragon.org/${version}/game/`;

// CommunityDragon 실측 등급 코드: 0=실버, 1=골드, 2=프리즘, 4=레전드(3은 쓰이지 않음).
const RARITY_BY_CODE = { 0: "silver", 1: "gold", 2: "prismatic", 4: "legend" };
const RARITY_SORT_ORDER = { silver: 0, gold: 1, prismatic: 2, legend: 3 };

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`요청 실패 (${response.status}): ${url}`);
  return await response.json();
}

// Riot 툴팁 서식(<br>, <spellName>, <keyword> 등)과 macro({{...}})를 제거하고,
// @Name@ / @Name*N@ 형태의 수치 placeholder는 dataValues의 1단계(기준) 값으로 치환합니다.
// calculations 로만 계산되는(팀 구성·키바인드 등 실시간 값) placeholder는 정적으로 풀 수 없어
// 지어내지 않고 제거하며, 그 결과 설명이 비면 안전한 대체 문구를 씁니다.
const BR_RE = /<br\s*\/?>/gi;
// 단순 @Name@ / @Name*N@ 은 dataValues 로 풀 수 있지만, @spell.Foo:Bar@ 처럼
// 다른 스펠·챔피언 데이터를 참조하는 형태는 이 카탈로그의 데이터만으로 계산할 수 없어
// 지어내지 않고 빈 문자열로 지웁니다(아래 두 정규식이 각각을 처리합니다).
const SIMPLE_PLACEHOLDER_RE = /@([A-Za-z0-9_]+)(?:\*([0-9.]+))?@/g;
const ANY_PLACEHOLDER_RE = /@[^@]+@/g;
const MACRO_RE = /\{\{[^}]*\}\}/g;
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
// %i:StatAnvil% 같은 인라인 아이콘 참조입니다. 실제 그림 대신 텍스트로만 보여주므로,
// 바로 뒤에 아이콘을 설명하는 단어가 이어지는 서식이라 통째로 지워도 뜻이 남습니다.
const INLINE_ICON_RE = /%[a-zA-Z]+:[A-Za-z0-9_]+%\s*/g;

function formatNumber(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1));
}

function sanitizeDescription(raw, dataValues, fallback) {
  let text = raw.replace(BR_RE, " ");
  text = text.replace(INLINE_ICON_RE, "");
  text = text.replace(SIMPLE_PLACEHOLDER_RE, (match, name, multiplier) => {
    const series = dataValues?.[name];
    if (!Array.isArray(series) || typeof series[0] !== "number") return "";
    const value = multiplier ? series[0] * Number(multiplier) : series[0];
    return formatNumber(value);
  });
  text = text.replace(ANY_PLACEHOLDER_RE, "");
  text = text.replace(MACRO_RE, "");
  text = text.replace(TAG_RE, "");
  // calculations 로만 계산되는 값이 빠지면 "()"나 문장부호 앞 공백이 남습니다.
  // 값을 지어내는 대신 이런 흔적만 정리합니다.
  text = text.replace(/[([（【]\s*[)\]）】]/g, "");
  text = text.replace(/\s+([,.!?)])/g, "$1");
  text = text.replace(/([.!?])\s*\1+/g, "$1");
  text = text.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : fallback;
}

async function downloadIcon(iconPath, cache, assetBase) {
  const cached = cache.get(iconPath);
  if (cached) return cached;
  const url = `${assetBase}${iconPath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`아이콘을 받아올 수 없습니다 (${response.status}): ${url}`);
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const sourceMetadata = await sharp(sourceBuffer).metadata();
  if (
    sourceMetadata.format !== "png"
    || !sourceMetadata.width
    || !sourceMetadata.height
    || sourceMetadata.width > 1_024
    || sourceMetadata.height > 1_024
  ) {
    throw new Error(`허용되지 않는 아이콘 이미지입니다: ${url}`);
  }
  const outputBuffer = await sharp(sourceBuffer)
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, effort: 5 })
    .toBuffer();
  const outputSha256 = sha256(outputBuffer);
  const fileName = `${outputSha256}.webp`;
  await writeFile(path.join(imagesDirectory, fileName), outputBuffer);
  const iconUrl = `/images/lol/aram/${fileName}`;
  cache.set(iconPath, iconUrl);
  return iconUrl;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const versions = await fetchJson(DDRAGON_VERSIONS_URL);
const requestedDataVersion = process.argv[2];
if (process.argv.length > 3) {
  throw new Error("사용법: node scripts/generate-aram-augments.mjs [dataVersion]");
}
const dataVersion = requestedDataVersion ?? versions?.[0];
if (
  typeof dataVersion !== "string"
  || !/^\d+\.\d+\.\d+$/.test(dataVersion)
  || !Array.isArray(versions)
  || !versions.includes(dataVersion)
) {
  throw new Error("dataVersion(Data Dragon 최신 patch)을 확인할 수 없습니다.");
}
const cdragonVersionMatch = /^(\d+\.\d+)\.\d+$/.exec(dataVersion);
if (!cdragonVersionMatch) throw new Error(`CommunityDragon 버전을 결정할 수 없습니다: ${dataVersion}`);
const cdragonVersion = cdragonVersionMatch[1];
const [koData, jaData] = await Promise.all([
  fetchJson(arenaJsonUrl(cdragonVersion, "ko_kr")),
  fetchJson(arenaJsonUrl(cdragonVersion, "ja_jp"))
]);
if (!Array.isArray(koData?.augments) || !Array.isArray(jaData?.augments)) {
  throw new Error(`CommunityDragon 증강 목록이 올바르지 않습니다: ${cdragonVersion}`);
}
const cdragonContentRevision = sha256(Buffer.from(JSON.stringify([koData, jaData])));
const assetBase = rawAssetBase(cdragonVersion);

// 표시 이름이 아니라 cdragon의 안정적인 apiName으로 locale 레코드를 연결합니다.
// 양쪽 locale의 숫자 id가 정확히 같을 때만 match-v5 조인 키를 노출합니다.
const jaByApiName = new Map(jaData.augments.map((entry) => [entry.apiName, entry]));

await mkdir(imagesDirectory, { recursive: true });
const iconCache = new Map();

const augments = await mapWithConcurrency(koData.augments, 8, async (ko) => {
  const ja = jaByApiName.get(ko.apiName);
  if (!ja) throw new Error(`일본어 데이터가 없습니다: id=${ko.id} (${ko.apiName})`);

  const rarity = RARITY_BY_CODE[ko.rarity];
  if (!rarity) throw new Error(`알 수 없는 rarity 코드입니다: id=${ko.id} rarity=${ko.rarity}`);

  const id = String(ko.apiName).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
    throw new Error(`허용되지 않는 id 형식입니다: ${ko.apiName}`);
  }

  const nameKo = String(ko.name).trim();
  const nameJa = String(ja.name).trim();
  if (!nameKo || !nameJa) throw new Error(`이름이 비어 있습니다: id=${ko.id}`);

  const descriptionKo = sanitizeDescription(ko.desc, ko.dataValues, "게임 내 상황에 따라 효과가 달라집니다.");
  const descriptionJa = sanitizeDescription(ja.desc, ja.dataValues, "ゲーム内の状況によって効果が変わります。");

  const iconUrl = ko.iconLarge
    ? await downloadIcon(ko.iconLarge, iconCache, assetBase)
    : undefined;
  const cdragonId = Number.isSafeInteger(ko.id) && ko.id > 0 && ja.id === ko.id
    ? ko.id
    : undefined;

  return {
    id,
    nameKo,
    nameJa,
    descriptionKo,
    descriptionJa,
    rarity,
    ...(iconUrl ? { iconUrl } : {}),
    ...(cdragonId !== undefined ? { cdragonId } : {})
  };
});

const seenIds = new Set();
const seenCdragonIds = new Set();
for (const augment of augments) {
  if (seenIds.has(augment.id)) throw new Error(`중복된 id입니다: ${augment.id}`);
  seenIds.add(augment.id);
  if (augment.cdragonId === undefined) continue;
  if (seenCdragonIds.has(augment.cdragonId)) {
    throw new Error(`중복된 cdragonId입니다: ${augment.cdragonId}`);
  }
  seenCdragonIds.add(augment.cdragonId);
}

augments.sort((a, b) => (
  RARITY_SORT_ORDER[a.rarity] - RARITY_SORT_ORDER[b.rarity]
  || a.nameKo.localeCompare(b.nameKo, "ko")
));

const catalog = {
  schemaVersion: 1,
  mode: "aram_augments",
  status: "ready",
  dataVersion,
  sourceRevision:
    `communitydragon:${cdragonVersion}@sha256:${cdragonContentRevision};ddragon:${dataVersion}`,
  augments
};

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  `증강 ${augments.length}개, cdragonId ${seenCdragonIds.size}개, 아이콘 ${iconCache.size}개를 생성했습니다. `
    + `dataVersion=${dataVersion} cdragonVersion=${cdragonVersion}`
);
