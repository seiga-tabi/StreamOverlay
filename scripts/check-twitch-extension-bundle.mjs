/**
 * Twitch Extension 번들 검증 — zip 업로드 전 제약을 확인합니다.
 * - 필수 파일 존재(panel/video_overlay/config)
 * - 절대 경로 자산 참조 금지(Twitch CDN 하위 경로에서 서빙)
 * - 허용 외 외부 origin 참조 금지(Twitch Helper + EBS origin 만)
 * - zip 1MB 상한(Twitch 업로드 제한)
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "dist-twitch-extension");
const zipPath = path.resolve(process.cwd(), "twitch-extension.zip");
const failures = [];

for (const name of ["panel.html", "video_overlay.html", "video_component.html", "mobile.html", "config.html"]) {
  try {
    statSync(path.join(root, name));
  } catch {
    failures.push(`missing file: ${name}`);
  }
}

const ALLOWED_EXTERNAL = [
  "https://extension-files.twitch.tv/helper/",
  "https://yoro.gg",
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(root)) {
  if (!/\.(html|js|css)$/u.test(file)) continue;
  const body = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  if (/\.html$/u.test(file)) {
    for (const match of body.matchAll(/(?:src|href)="(\/[^"]*)"/gu)) {
      failures.push(`${relative}: absolute asset path ${match[1]}`);
    }
  }
  for (const match of body.matchAll(/https:\/\/[a-z0-9.-]+[^"'\s)]*/gu)) {
    const url = match[0];
    if (url.startsWith("https://yoro.gg/")) continue;
    if (ALLOWED_EXTERNAL.some((allowed) => url.startsWith(allowed))) continue;
    if (url.startsWith("https://www.w3.org/")) continue; /* SVG namespace */
    /* React 프로덕션 번들의 오류 문서 링크 — fetch 되지 않는 안내 문자열입니다. */
    if (url.startsWith("https://reactjs.org/") || url.startsWith("https://react.dev/")) continue;
    failures.push(`${relative}: unexpected external URL ${url}`);
  }
}

try {
  const size = statSync(zipPath).size;
  if (size > 1_000_000) failures.push(`zip too large: ${size} bytes (limit 1,000,000)`);
  console.log(`[twitch-extension] zip: ${size.toLocaleString()} bytes / 1,000,000`);
} catch {
  failures.push("missing twitch-extension.zip");
}

if (failures.length > 0) {
  console.error("[twitch-extension] FAIL");
  for (const failure of failures) console.error(" -", failure);
  process.exit(1);
}
console.log("[twitch-extension] bundle checks PASS");
