import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repositoryRoot, "apps/dashboard/public/images/public-home");

function readArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} 인수가 필요합니다.`);
  return path.resolve(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const sources = {
  lol: {
    path: readArgument("--lol-source"),
    expectedSha256: "b4232dc123c790947b01935fc326ef3c2aa026ca7c5b67c3a198ea1a9b26cdc1",
    expectedWidth: 1215,
    expectedHeight: 717,
    variants: {
      desktop: { left: 0, top: 20, width: 1215, height: 660 },
      mobile: { left: 430, top: 0, width: 785, height: 717 },
    },
  },
  palworld: {
    path: readArgument("--palworld-source"),
    expectedSha256: "398f2b4ef1a0e3c35ca40ebc17efb014e20a09d4fa45ba3919136c8ee4825e08",
    expectedWidth: 1920,
    expectedHeight: 1080,
    variants: {
      desktop: { left: 0, top: 30, width: 1920, height: 760 },
      mobile: { left: 1020, top: 20, width: 780, height: 820 },
    },
  },
};

const formats = {
  avif: (pipeline) => pipeline.avif({ quality: 58, effort: 6 }),
  webp: (pipeline) => pipeline.webp({ quality: 82, effort: 5 }),
  jpg: (pipeline) => pipeline.jpeg({ quality: 86, mozjpeg: true }),
};

const manifest = {
  schemaVersion: 1,
  rightsVerified: false,
  usageBasis: "operator_reference_use",
  games: {},
};

for (const [game, source] of Object.entries(sources)) {
  const sourceBuffer = await readFile(source.path);
  const sourceSha256 = sha256(sourceBuffer);
  const metadata = await sharp(sourceBuffer).metadata();

  if (sourceSha256 !== source.expectedSha256) {
    throw new Error(`${game} 원본 체크섬이 예상값과 일치하지 않습니다.`);
  }
  if (metadata.width !== source.expectedWidth || metadata.height !== source.expectedHeight) {
    throw new Error(`${game} 원본 이미지 크기가 예상값과 일치하지 않습니다.`);
  }

  const gameDirectory = path.join(outputRoot, game);
  await mkdir(gameDirectory, { recursive: true });
  const gameManifest = {
    sourceFilename: path.basename(source.path),
    sourceSha256,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
    variants: {},
  };

  for (const [purpose, crop] of Object.entries(source.variants)) {
    if (crop.width > metadata.width || crop.height > metadata.height) {
      throw new Error(`${game} ${purpose} 결과는 원본보다 클 수 없습니다.`);
    }

    const variantManifest = {};
    for (const [format, encode] of Object.entries(formats)) {
      const buffer = await encode(sharp(sourceBuffer).extract(crop).withMetadata({ orientation: 1 })).toBuffer();
      const outputSha256 = sha256(buffer);
      const filename = `${purpose}.${outputSha256.slice(0, 16)}.${format}`;
      const outputPath = path.join(gameDirectory, filename);
      const outputMetadata = await sharp(buffer).metadata();
      await writeFile(outputPath, buffer);
      variantManifest[format] = {
        url: `/images/public-home/${game}/${filename}`,
        outputSha256,
        width: outputMetadata.width,
        height: outputMetadata.height,
        format,
        purpose,
        crop,
      };
    }
    gameManifest.variants[purpose] = variantManifest;
  }

  manifest.games[game] = gameManifest;
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(manifest, null, 2));
