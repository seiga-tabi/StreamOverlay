import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import yauzl from "yauzl";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = "1.0.1";
const publicDirectory = path.join(
  repositoryRoot,
  "apps/dashboard/public/images/public-home/palworld/features",
  release,
);
const manifestPath = path.join(
  repositoryRoot,
  "apps/dashboard/src/features/public-palworld/data/palworld-home-feature-assets.json",
);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} 인수가 필요합니다.`);
  return path.resolve(value);
}

const archives = {
  content: {
    path: readArgument("--content-source"),
    sha256: "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384",
  },
  inventory: {
    path: readArgument("--inventory-source"),
    sha256: "6b06519e21dd00937e54d7ffcd9cba7948917bd4e76d34bffd65a53848fd7dc1",
  },
};

const selections = [
  {
    id: "pals",
    archive: "content",
    sourceEntry: "Pal/Texture/PalIcon/Normal/T_Carbunclo_icon_normal.png",
    sourceRowId: "Carbunclo",
    canonicalEntityId: "lifmunk",
    purpose: "primary-pals",
  },
  {
    id: "breeding",
    archive: "inventory",
    sourceEntry: "Texture/T_itemicon_Material_PalEgg.png",
    sourceRowId: "PalEgg_Normal_01",
    canonicalEntityId: "pal-egg-normal-01",
    purpose: "primary-breeding",
  },
  {
    id: "map",
    archive: "content",
    sourceEntry: "Pal/Texture/UI/InGame/T_icon_compass_Teleport.png",
    sourceRowId: "DT_LocationUIData.PointFastTravel",
    canonicalEntityId: "fast-travel",
    purpose: "primary-map",
  },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function readExactZipEntry(zipPath, expectedEntry) {
  return await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error("ZIP을 열 수 없습니다."));
        return;
      }
      let matched = false;
      zipFile.on("error", reject);
      zipFile.on("end", () => {
        if (!matched) reject(new Error(`ZIP entry를 찾을 수 없습니다: ${expectedEntry}`));
      });
      zipFile.on("entry", (entry) => {
        if (entry.fileName !== expectedEntry) {
          zipFile.readEntry();
          return;
        }
        if (matched) {
          reject(new Error(`ZIP entry가 중복됩니다: ${expectedEntry}`));
          zipFile.close();
          return;
        }
        matched = true;
        const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (
          entry.fileName.endsWith("/")
          || unixMode === 0o120000
          || entry.uncompressedSize < 1
          || entry.uncompressedSize > 16 * 1024 * 1024
        ) {
          reject(new Error(`허용되지 않는 ZIP entry입니다: ${expectedEntry}`));
          zipFile.close();
          return;
        }
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error("ZIP entry를 읽을 수 없습니다."));
            return;
          }
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            resolve(Buffer.concat(chunks));
            zipFile.close();
          });
        });
      });
      zipFile.readEntry();
    });
  });
}

for (const [name, archive] of Object.entries(archives)) {
  const actualSha256 = await fileSha256(archive.path);
  if (actualSha256 !== archive.sha256) {
    throw new Error(`${name} ZIP checksum이 예상값과 일치하지 않습니다.`);
  }
}

await mkdir(publicDirectory, { recursive: true });
const entries = [];

for (const selection of selections) {
  const archive = archives[selection.archive];
  const sourceBuffer = await readExactZipEntry(archive.path, selection.sourceEntry);
  const sourceMetadata = await sharp(sourceBuffer).metadata();
  if (
    sourceMetadata.format !== "png"
    || !sourceMetadata.width
    || !sourceMetadata.height
    || sourceMetadata.width > 2_048
    || sourceMetadata.height > 2_048
  ) {
    throw new Error(`${selection.sourceEntry}는 허용된 PNG 이미지가 아닙니다.`);
  }

  const outputBuffer = await sharp(sourceBuffer)
    .webp({ quality: 86, effort: 5 })
    .toBuffer();
  const outputMetadata = await sharp(outputBuffer).metadata();
  const outputSha256 = sha256(outputBuffer);
  const outputFileName = `${outputSha256}.webp`;
  await writeFile(path.join(publicDirectory, outputFileName), outputBuffer);

  entries.push({
    id: selection.id,
    sourceArchive: path.basename(archive.path),
    sourceArchiveSha256: archive.sha256,
    sourceEntry: selection.sourceEntry,
    sourceRowId: selection.sourceRowId,
    canonicalEntityId: selection.canonicalEntityId,
    sourceSha256: sha256(sourceBuffer),
    outputSha256,
    imageUrl: `/images/public-home/palworld/features/${release}/${outputFileName}`,
    width: outputMetadata.width,
    height: outputMetadata.height,
    format: "webp",
    purpose: selection.purpose,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
  });
}

const manifest = {
  schemaVersion: 1,
  release,
  rightsVerified: false,
  usageBasis: "operator_reference_use",
  entries,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));
