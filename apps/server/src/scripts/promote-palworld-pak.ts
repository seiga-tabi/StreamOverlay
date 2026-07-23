import path from "node:path";
import {
  promotePalworldPakRuntime
} from "../data/palworld-pak-promotion.js";

function usage(): never {
  throw new Error(
    "사용법: npm run promote:palworld-pak -- "
      + "--staging <검증된 ready candidate directory> "
      + "--data-root <Palworld runtime data root>"
  );
}

function parseArguments(argv: string[]): {
  stagingRoot: string;
  dataRoot: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      (key !== "--staging" && key !== "--data-root")
      || value === undefined
      || value.startsWith("--")
      || values.has(key)
    ) {
      usage();
    }
    values.set(key, value);
    index += 1;
  }
  const stagingRoot = values.get("--staging");
  const dataRoot = values.get("--data-root");
  if (stagingRoot === undefined || dataRoot === undefined || values.size !== 2) {
    usage();
  }
  return {
    stagingRoot: path.resolve(stagingRoot),
    dataRoot: path.resolve(dataRoot)
  };
}

try {
  const result = await promotePalworldPakRuntime(
    parseArguments(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify({
    release: result.active.release,
    format: result.active.format,
    releaseDirectory: result.active.releaseDirectory,
    previousRelease: result.previous?.release ?? null
  }, null, 2)}\n`);
} catch (error) {
  const code = error instanceof Error && "code" in error
    ? String((error as { code: unknown }).code)
    : "PALWORLD_PAK_PROMOTION_UNEXPECTED";
  const message = code.startsWith("PALWORLD_") && error instanceof Error
    ? error.message
    : (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "ready runtime manifest가 없어 candidate를 활성화할 수 없습니다."
      : "Palworld PAK promotion 검증에 실패했습니다.";
  process.stderr.write(`[${code}] ${message}\n`);
  process.exitCode = 1;
}
