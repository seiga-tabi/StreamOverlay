import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const budgets = [
  { name: "dashboard JS total", dir: "apps/dashboard/dist/assets", ext: ".js", max: 740_000, mode: "total" },
  { name: "dashboard JS gzip total", dir: "apps/dashboard/dist/assets", ext: ".js", max: 230_000, mode: "gzip-total" },
  { name: "dashboard JS chunk", dir: "apps/dashboard/dist/assets", ext: ".js", max: 520_000, mode: "largest" },
  { name: "dashboard CSS total", dir: "apps/dashboard/dist/assets", ext: ".css", max: 1_050_000, mode: "total" },
  { name: "overlay JS total", dir: "apps/overlay/dist/assets", ext: ".js", max: 230_000, mode: "total" },
  { name: "overlay CSS total", dir: "apps/overlay/dist/assets", ext: ".css", max: 80_000, mode: "total" }
];

let failed = false;
for (const budget of budgets) {
  if (!fs.existsSync(budget.dir)) {
    console.error(`[budget] ${budget.name}: build artifact가 없습니다.`);
    failed = true;
    continue;
  }
  const files = fs.readdirSync(budget.dir).filter((file) => file.endsWith(budget.ext));
  const sizes = files.map((file) => fs.statSync(path.join(budget.dir, file)).size);
  const actual = budget.mode === "largest"
    ? Math.max(0, ...sizes)
    : budget.mode === "gzip-total"
      ? files.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join(budget.dir, file))).length, 0)
      : sizes.reduce((sum, size) => sum + size, 0);
  const passed = actual <= budget.max;
  console.log(`[budget] ${budget.name}: ${actual}/${budget.max} bytes ${passed ? "PASS" : "FAIL"}`);
  if (!passed) failed = true;
}

const imageRoots = ["apps/dashboard/public", "apps/overlay/public"];
let largestImage = 0;
for (const root of imageRoots) {
  if (!fs.existsSync(root)) continue;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
        largestImage = Math.max(largestImage, fs.statSync(target).size);
      }
    }
  }
}
const imageMax = 1_300_000;
console.log(`[budget] largest public image: ${largestImage}/${imageMax} bytes ${largestImage <= imageMax ? "PASS" : "FAIL"}`);
if (largestImage > imageMax) failed = true;

if (failed) process.exit(1);
