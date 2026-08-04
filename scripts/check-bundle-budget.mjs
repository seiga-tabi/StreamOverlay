import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const budgets = [
  { name: "dashboard JS chunk", dir: "apps/dashboard/dist/assets", ext: ".js", max: 520_000, mode: "largest" },
  { name: "dashboard CSS gzip total", dir: "apps/dashboard/dist/assets", ext: ".css", max: 180_000, mode: "gzip-total" },
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

const dashboardHtml = "apps/dashboard/dist/index.html";
const dashboardAssets = "apps/dashboard/dist/assets";
if (!fs.existsSync(dashboardHtml)) {
  console.error("[budget] dashboard initial JS: index.html이 없습니다.");
  failed = true;
} else {
  const html = fs.readFileSync(dashboardHtml, "utf8");
  const scripts = [...html.matchAll(/<script[^>]+type="module"[^>]+src="[^"]*\/([^/"?]+\.js)"/g)];
  const entry = scripts.at(-1)?.[1];
  const initialFiles = new Set();
  const visitStaticImports = (file) => {
    if (!file || initialFiles.has(file)) return;
    const target = path.join(dashboardAssets, file);
    if (!fs.existsSync(target)) {
      console.error(`[budget] dashboard initial JS: ${file} 파일이 없습니다.`);
      failed = true;
      return;
    }
    initialFiles.add(file);
    const source = fs.readFileSync(target, "utf8");
    for (const match of source.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
      visitStaticImports(match[1]);
    }
  };
  if (!entry) {
    console.error("[budget] dashboard initial JS: module entry를 찾을 수 없습니다.");
    failed = true;
  } else {
    visitStaticImports(entry);
  }
  const initialBuffers = [...initialFiles].map((file) => fs.readFileSync(path.join(dashboardAssets, file)));
  const initialBytes = initialBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const initialGzipBytes = initialBuffers.reduce((sum, buffer) => sum + gzipSync(buffer).length, 0);
  const initialMax = 300_000;
  const initialGzipMax = 100_000;
  console.log(`[budget] dashboard initial JS: ${initialBytes}/${initialMax} bytes ${initialBytes <= initialMax ? "PASS" : "FAIL"}`);
  console.log(`[budget] dashboard initial JS gzip: ${initialGzipBytes}/${initialGzipMax} bytes ${initialGzipBytes <= initialGzipMax ? "PASS" : "FAIL"}`);
  if (initialBytes > initialMax || initialGzipBytes > initialGzipMax) failed = true;
}

const imageRoots = ["apps/dashboard/public", "apps/overlay/public"];
let largestImage = 0;
let largestMapImage = 0;
for (const root of imageRoots) {
  if (!fs.existsSync(root)) continue;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
        const size = fs.statSync(target).size;
        if (target.split(path.sep).includes("maps")) largestMapImage = Math.max(largestMapImage, size);
        else largestImage = Math.max(largestImage, size);
      }
    }
  }
}
const imageMax = 1_300_000;
console.log(`[budget] largest public image: ${largestImage}/${imageMax} bytes ${largestImage <= imageMax ? "PASS" : "FAIL"}`);
if (largestImage > imageMax) failed = true;
const mapImageMax = 1_600_000;
console.log(`[budget] largest interactive map image: ${largestMapImage}/${mapImageMax} bytes ${largestMapImage <= mapImageMax ? "PASS" : "FAIL"}`);
if (largestMapImage > mapImageMax) failed = true;

if (failed) process.exit(1);
