import fs from "node:fs/promises";
import path from "node:path";

const managedTargets = [
  "apps/dashboard/src/shared/ui",
  "apps/dashboard/src/pages/CommunityModerationPage.css",
  "apps/dashboard/src/styles/pages/public-lol/10-final-overrides.css",
];

const rawValuePattern = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|(?:linear|radial)-gradient\(|drop-shadow\(|(?<![a-zA-Z0-9_-])\d+(?:\.\d+)?px\b/g;

async function cssFilesUnder(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith(".css") ? [target] : [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await cssFilesUnder(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(entryPath);
  }
  return files;
}

const files = (await Promise.all(managedTargets.map(cssFilesUnder))).flat().sort();
const violations = [];

for (const file of files) {
  const lines = (await fs.readFile(file, "utf8")).split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = [...line.matchAll(rawValuePattern)].map((match) => match[0]);
    if (matches.length) violations.push(`${file}:${index + 1} ${matches.join(", ")}`);
  });
}

if (violations.length) {
  console.error("[tokens] 관리 대상 CSS에 raw design value가 있습니다.");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`[tokens] compliance PASS: CSS ${files.length}개`);
