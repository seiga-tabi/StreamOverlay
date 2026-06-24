import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import type { LolRankTier } from "@streamops/shared";
import { appConfig } from "../config.js";

const RANKED_EMBLEMS_ZIP_URL = "https://static.developer.riotgames.com/docs/lol/ranked-emblems-latest.zip";
const RANKED_EMBLEM_TITLES: Record<Exclude<LolRankTier, "UNRANKED">, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger"
};

const BUNDLED_RANKED_EMBLEM_FILES: Record<Exclude<LolRankTier, "UNRANKED">, string> = {
  IRON: "Rank0=Iron.png",
  BRONZE: "Rank1=Bronze.png",
  SILVER: "Rank2=Silver.png",
  GOLD: "Rank3=Gold.png",
  PLATINUM: "Rank4=Platinum.png",
  EMERALD: "Rank5=Emerald.png",
  DIAMOND: "Rank6=Diamond.png",
  GRANDMASTER: "Rank7=Grandmaster.png",
  MASTER: "Rank8=Master.png",
  CHALLENGER: "Rank9=Challenger.png"
};

type RankedEmblemTier = keyof typeof RANKED_EMBLEM_TITLES;

function normalizeTier(value: string): RankedEmblemTier | undefined {
  const tier = value.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(RANKED_EMBLEM_TITLES, tier) ? (tier as RankedEmblemTier) : undefined;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function ensureZip(zipPath: string): Promise<Buffer> {
  if (await exists(zipPath)) return fs.readFile(zipPath);
  const response = await fetch(RANKED_EMBLEMS_ZIP_URL);
  if (!response.ok) throw new Error(`Riot ranked emblems download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const tempPath = `${zipPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, buffer, { mode: 0o644 });
  await fs.rename(tempPath, zipPath);
  return buffer;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const minOffset = Math.max(0, zip.byteLength - 65_557);
  for (let offset = zip.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Riot ranked emblems zip의 central directory를 찾을 수 없습니다.");
}

function extractZipEntry(zip: Buffer, entryName: string): Buffer {
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  let offset = zip.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Riot ranked emblems zip central directory가 손상되었습니다.");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const fileName = zip.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === entryName) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error("Riot ranked emblems zip local header가 손상되었습니다.");
      const localFileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return zlib.inflateRawSync(compressed);
      throw new Error(`지원하지 않는 Riot ranked emblems zip 압축 방식입니다: ${method}`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`Riot ranked emblem asset을 찾을 수 없습니다: ${entryName}`);
}

export async function rankedEmblemAssetPath(rawTier: string): Promise<string | undefined> {
  const tier = normalizeTier(rawTier);
  if (!tier) return undefined;

  const bundledPath = path.join(appConfig.paths.config, "ranked-emblems", BUNDLED_RANKED_EMBLEM_FILES[tier]);
  if (await exists(bundledPath)) return bundledPath;

  const cacheDir = path.join(appConfig.paths.state, "riot-ranked-emblems");
  const imagePath = path.join(cacheDir, `${tier.toLowerCase()}.png`);
  if (await exists(imagePath)) return imagePath;

  await fs.mkdir(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "ranked-emblems-latest.zip");
  const zip = await ensureZip(zipPath);
  const entryName = `Ranked Emblems Latest/Rank=${RANKED_EMBLEM_TITLES[tier]}.png`;
  const image = extractZipEntry(zip, entryName);
  const tempPath = `${imagePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, image, { mode: 0o644 });
  await fs.rename(tempPath, imagePath);
  return imagePath;
}
