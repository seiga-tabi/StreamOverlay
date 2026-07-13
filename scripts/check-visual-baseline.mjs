import fs from "node:fs/promises";
import path from "node:path";

const baselineRoot = path.resolve("qa/visual-baseline");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
const requiredGroups = [
  { label: "Public desktop", pattern: /desktop-public-(home|profile)/ },
  { label: "Public mobile", pattern: /mobile-public-(home|profile)/ },
  { label: "Dashboard desktop", pattern: /desktop-dashboard/ },
  { label: "Dashboard mobile", pattern: /mobile-dashboard/ },
  { label: "Overlay desktop", pattern: /desktop-overlay-(manager|editor)/ },
  { label: "Overlay mobile", pattern: /mobile-overlay-(manager|editor)/ }
];

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
const jsonFiles = files.filter((file) => file.endsWith(".json"));
const relativePngFiles = pngFiles.map((file) => path.relative(baselineRoot, file));

for (const group of requiredGroups) {
  if (!relativePngFiles.some((file) => group.pattern.test(path.basename(file)))) {
    throw new Error(`${group.label} visual baseline이 없습니다.`);
  }
}

for (const file of pngFiles) {
  const handle = await fs.open(file, "r");
  try {
    const header = Buffer.alloc(pngSignature.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const stat = await handle.stat();
    const isPng = bytesRead === pngSignature.length && header.equals(pngSignature);
    const isJpeg = bytesRead >= jpegSignature.length && header.subarray(0, jpegSignature.length).equals(jpegSignature);
    if ((!isPng && !isJpeg) || stat.size < 1024) {
      throw new Error(`손상되었거나 비어 있는 visual baseline: ${path.relative(baselineRoot, file)}`);
    }
  } finally {
    await handle.close();
  }
}

for (const file of jsonFiles) {
  JSON.parse(await fs.readFile(file, "utf8"));
}

console.log(`[visual] baseline integrity PASS: PNG ${pngFiles.length}개, JSON ${jsonFiles.length}개`);
