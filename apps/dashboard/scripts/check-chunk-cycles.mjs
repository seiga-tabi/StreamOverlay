import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { loadConfigFromFile } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));

try {
  // 빌드와 같은 설정에서 출력 경로를 읽고 모든 청크를 검사합니다.
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    path.join(root, "vite.config.ts"),
    root
  );
  if (!loaded) throw new Error("빌드 설정을 읽을 수 없습니다.");
  const assets = path.resolve(root, loaded.config.build?.outDir ?? "dist", "assets");
  const files = (await readdir(assets)).filter((file) => file.endsWith(".js")).sort();
  if (!files.length) throw new Error(`검사할 JavaScript 청크가 없습니다: ${assets}`);
  const fileSet = new Set(files);
  // 공개 API로 구문 오류를 검사합니다. 의존성 해석과 타입 검사는 수행하지 않습니다.
  // 파일 읽기·구문 분석·그래프 검사 오류는 아래 catch에서 실패로 처리합니다.
  const program = ts.createProgram(files.map((file) => path.join(assets, file)), {
    allowJs: true,
    noResolve: true,
    noLib: true,
    noEmit: true,
    target: ts.ScriptTarget.Latest
  });
  const graph = new Map();
  let dynamicCount = 0;
  for (const file of files) {
    const source = program.getSourceFile(path.join(assets, file));
    if (!source) throw new Error(`청크 읽기 실패: ${file}`);
    if (program.getSyntacticDiagnostics(source).length) throw new Error(`청크 구문 분석 실패: ${file}`);
    const edges = new Set();
    // 문자열·주석 속 가짜 import는 제외하고 부수 효과 import와 재수출도 포함합니다.
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.text));
          if (target.endsWith(".js")) {
            if (!fileSet.has(target)) throw new Error(`청크 참조 대상 누락: ${file} → ${target}`);
            edges.add(target);
          }
        }
      }
    }
    // import()는 비동기 경계이므로 정적 초기화 순환의 간선으로 취급하지 않습니다.
    function countDynamic(node) {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicCount++;
      ts.forEachChild(node, countDynamic);
    }
    countDynamic(source);
    graph.set(file, edges);
  }
  // Tarjan SCC로 그룹 여부와 경로 길이에 관계없이 모든 다중 청크 순환을 찾습니다.
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let nextIndex = 0;
  function visit(file) {
    indices.set(file, nextIndex);
    lowLinks.set(file, nextIndex++);
    stack.push(file);
    onStack.add(file);
    for (const target of graph.get(file)) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(file, Math.min(lowLinks.get(file), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(file, Math.min(lowLinks.get(file), indices.get(target)));
      }
    }
    if (lowLinks.get(file) === indices.get(file)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== file);
      if (component.length >= 2) cycles.push(component.sort());
    }
  }
  for (const file of files) {
    if (!indices.has(file)) visit(file);
  }
  if (cycles.length) {
    console.error(`[청크 순환 검사] 실패: 정적 참조 순환 SCC ${cycles.length}건`);
    for (const component of cycles.sort((a, b) => a[0].localeCompare(b[0]))) {
      console.error(`  SCC (${component.length}개 청크): ${component.join(", ")}`);
      const members = new Set(component);
      for (const file of component) {
        for (const target of [...graph.get(file)].filter((target) => members.has(target)).sort()) {
          console.error(`    ${file} → ${target}`);
        }
      }
    }
    console.error("보고된 청크의 정적 의존성과 청크 배치를 수정하세요.");
    process.exitCode = 1;
  } else {
    console.log(`[청크 순환 검사] 통과: ${files.length}개 청크, 정적 참조 순환 SCC 0건 (동적 import ${dynamicCount}개 제외)`);
  }
} catch (error) {
  console.error(`[청크 순환 검사] 실패: ${error.message}`);
  process.exitCode = 1;
}
