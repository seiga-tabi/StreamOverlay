import fs from "node:fs/promises";
import path from "node:path";

const baselineRoot = path.resolve("qa/visual-regression/baselines/linux");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const requiredSurfaces = ["public-home", "public-profile", "dashboard", "overlay"];
const requiredProjects = ["desktop-chromium", "mobile-chromium"];

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

const files = await filesUnder(baselineRoot);
const pngFiles = files.filter((file) => file.endsWith(".png"));
const relativePngFiles = pngFiles.map((file) => path.relative(baselineRoot, file));

for (const project of requiredProjects) {
  for (const surface of requiredSurfaces) {
    const expected = path.join(project, `${surface}.png`);
    if (!relativePngFiles.includes(expected)) {
      throw new Error(`${project}/${surface} visual baseline이 없습니다.`);
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

console.log(`[visual] baseline integrity PASS: PNG ${pngFiles.length}개`);
