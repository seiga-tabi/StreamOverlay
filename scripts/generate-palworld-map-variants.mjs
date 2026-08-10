/**
 * 팰월드 지도 이미지의 반응형 변형을 생성합니다.
 *
 * 원본은 4096×4096 하나뿐이라 390px 화면도 1,056KB 를 받았습니다(11.2배 과잉).
 * `<hash>-w{768,1024,1536,2048}.webp` 를 만들어 두면 화면 폭과 확대
 * 배율에 맞는 판을 브라우저가 고릅니다. 원본은 그대로 두므로 되돌릴 것이 없습니다.
 *
 * 변형은 `/images/palworld-derived/` 아래에 씁니다. `/images/palworld/<release>/`
 * 트리는 서버 runtime bundle 이 "파일명 = 내용 SHA-256, manifest 와 정확히 일치"로
 * 검증하는 원본 전용 공간이라 리사이즈본을 둘 수 없습니다.
 *
 * 사용: node scripts/generate-palworld-map-variants.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTHS = [768, 1024, 1536, 2048];
const manifestPath = path.resolve(
  "apps/dashboard/src/features/public-palworld/data/palworld-static-assets.generated.json"
);

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest.schemaVersion !== 1) {
  throw new Error(`알 수 없는 manifest schemaVersion: ${manifest.schemaVersion}`);
}

const publicRoot = path.resolve("apps/dashboard/public");
let generated = 0;

for (const [world, entry] of Object.entries(manifest.maps ?? {})) {
  const imageUrl = entry?.imageUrl;
  if (typeof imageUrl !== "string" || !imageUrl.endsWith(".webp")) continue;
  const sourcePath = path.join(publicRoot, imageUrl);
  const sourceStat = await fs.stat(sourcePath);
  const variants = [];
  for (const width of WIDTHS) {
    const variantUrl = imageUrl
      .replace("/images/palworld/", "/images/palworld-derived/")
      .replace(/\.webp$/u, `-w${width}.webp`);
    const variantPath = path.join(publicRoot, variantUrl);
    await fs.mkdir(path.dirname(variantPath), { recursive: true });
    const exists = await fs.stat(variantPath).catch(() => null);
    /* 원본이 변형보다 새로우면 다시 만듭니다. 해시 이름이라 사실상 불변입니다. */
    if (!exists || exists.mtimeMs < sourceStat.mtimeMs) {
      const buffer = await sharp(sourcePath)
        .resize(width, width, { fit: "fill" })
        .webp({ quality: 78 })
        .toBuffer();
      await fs.writeFile(variantPath, buffer);
      generated += 1;
      console.log(`[map-variants] ${world} ${width}px → ${(buffer.length / 1024).toFixed(0)}KB`);
    }
    variants.push({ width, imageUrl: variantUrl });
  }
  entry.variants = variants;
}

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[map-variants] 생성 ${generated}건 · manifest 갱신 완료`);
