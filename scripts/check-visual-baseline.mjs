import fs from "node:fs/promises";
import path from "node:path";

const baselineRoot = path.resolve("qa/visual-regression/baselines");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const requiredSurfaces = ["public-home", "public-profile", "dashboard", "overlay"];
const requiredProjects = ["desktop-chromium", "mobile-chromium"];
const currentPlatform = process.platform === "darwin"
  ? "darwin"
  : process.platform === "linux"
    ? "linux"
    : process.platform;
const requiredPlatforms = [...new Set(["linux", currentPlatform])];

async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(absolutePath));
    else files.push(absolutePath);
  }
  return files;
}

let totalPngFiles = 0;
for (const platform of requiredPlatforms) {
  const platformRoot = path.join(baselineRoot, platform);
  const files = await filesUnder(platformRoot);
  const pngFiles = files.filter((file) => file.endsWith(".png"));
  const relativePngFiles = pngFiles.map((file) => path.relative(platformRoot, file));

  for (const project of requiredProjects) {
    for (const surface of requiredSurfaces) {
      const expected = path.join(project, `${surface}.png`);
      if (!relativePngFiles.includes(expected)) {
        throw new Error(`${platform}/${project}/${surface} visual baseline이 없습니다.`);
      }
    }
  }

  for (const file of pngFiles) {
    const handle = await fs.open(file, "r");
    try {
      const header = Buffer.alloc(pngSignature.length);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      const stat = await handle.stat();
      const isPng = bytesRead === pngSignature.length && header.equals(pngSignature);
      if (!isPng || stat.size < 1024) {
        throw new Error(`손상되었거나 비어 있는 visual baseline: ${path.relative(baselineRoot, file)}`);
      }
    } finally {
      await handle.close();
    }
  }

  totalPngFiles += pngFiles.length;
  console.log(`[visual] ${platform} baseline integrity PASS: PNG ${pngFiles.length}개`);
}

console.log(`[visual] baseline integrity PASS: PNG ${totalPngFiles}개`);
