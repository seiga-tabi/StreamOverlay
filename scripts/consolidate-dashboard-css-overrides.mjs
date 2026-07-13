import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postcss from "postcss";

const projectRoot = process.cwd();
const styleEntry = path.join(projectRoot, "apps/dashboard/src/styles/index.css");
const write = process.argv.includes("--write");

function importPath(params) {
  const match = params.match(/^["']([^"']+)["']/);
  return match?.[1] ?? null;
}

function atRuleContext(rule) {
  const context = [];
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule") {
      context.unshift(`@${parent.name} ${parent.params}`.trim());
    }
    parent = parent.parent;
  }
  return context.join("|");
}

function isInsideKeyframes(rule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && /keyframes$/i.test(parent.name)) return true;
    parent = parent.parent;
  }
  return false;
}

function hasKeepMarker(declaration) {
  if (declaration.raws.before?.includes("yoro-keep-override")) return true;
  const previous = declaration.prev();
  return previous?.type === "comment" && previous.text.includes("yoro-keep-override");
}

function canBeSuperseded(earlier, later) {
  if (earlier.declaration.parent === later.declaration.parent) return false;
  if (earlier.declaration.important && !later.declaration.important) return false;
  return true;
}

const entryCss = await fs.readFile(styleEntry, "utf8");
const entryRoot = postcss.parse(entryCss, { from: styleEntry });
const orderedFiles = [];

entryRoot.walkAtRules("import", (rule) => {
  const relativePath = importPath(rule.params);
  if (!relativePath) return;
  const resolved = path.resolve(path.dirname(styleEntry), relativePath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.includes(`${path.sep}styles${path.sep}legacy${path.sep}`)
    || relative.includes(`${path.sep}styles${path.sep}pages${path.sep}`)) {
    orderedFiles.push(resolved);
  }
});

const parsedFiles = [];
const declarationsByKey = new Map();
let order = 0;

for (const file of orderedFiles) {
  const source = await fs.readFile(file, "utf8");
  const root = postcss.parse(source, { from: file });
  parsedFiles.push({ file, source, root });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    const selector = rule.selector.trim();
    const context = atRuleContext(rule);
    rule.each((node) => {
      if (node.type !== "decl" || node.prop.startsWith("--") || hasKeepMarker(node)) return;
      const key = `${context}\u0000${selector}\u0000${node.prop.toLowerCase()}`;
      const declarations = declarationsByKey.get(key) ?? [];
      declarations.push({ declaration: node, file, order: order += 1 });
      declarationsByKey.set(key, declarations);
    });
  });
}

const removals = [];
for (const declarations of declarationsByKey.values()) {
  for (let index = 0; index < declarations.length - 1; index += 1) {
    const current = declarations[index];
    const later = declarations.slice(index + 1).find((candidate) => canBeSuperseded(current, candidate));
    if (!later) continue;
    removals.push({ ...current, supersededBy: later });
  }
}

const removalsByFile = new Map();
for (const removal of removals) {
  const list = removalsByFile.get(removal.file) ?? [];
  list.push(removal);
  removalsByFile.set(removal.file, list);
}

if (removals.length === 0) {
  console.log("[css-overrides] 중복 override 없음");
  process.exit(0);
}

for (const [file, fileRemovals] of removalsByFile) {
  const relative = path.relative(projectRoot, file);
  console.log(`[css-overrides] ${relative}: ${fileRemovals.length}개 선언`);
}
console.log(`[css-overrides] 총 ${removals.length}개 선언이 뒤 override에 의해 무효화됩니다.`);

if (!write) {
  console.error("[css-overrides] npm run fix:css-overrides 실행 후 변경 내용을 검토하세요.");
  process.exit(1);
}

for (const removal of removals) removal.declaration.remove();

for (const { file, source, root } of parsedFiles) {
  const output = root.toString();
  if (output !== source) await fs.writeFile(file, output, "utf8");
}

console.log("[css-overrides] 안전하게 무효화된 선언을 제거했습니다.");
