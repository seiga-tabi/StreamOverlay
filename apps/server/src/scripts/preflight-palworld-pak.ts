import path from "node:path";
import { inspectPalworldPakArchive, PalworldPakPreflightError } from "../data/palworld-pak-preflight.js";

function archiveArgument(argv: string[]): string {
  if (argv.length !== 2 || argv[0] !== "--archive" || !argv[1]) {
    throw new PalworldPakPreflightError(
      "사용법: npm run preflight:palworld-pak -- --archive <Content.zip>"
    );
  }
  return path.resolve(argv[1]);
}

try {
  const report = await inspectPalworldPakArchive(archiveArgument(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.gates.inputPrerequisitesSatisfied) {
    process.exitCode = 2;
  }
} catch (error) {
  const code = error instanceof PalworldPakPreflightError
    ? error.code
    : "PALWORLD_PAK_PREFLIGHT_UNEXPECTED";
  const message = error instanceof Error ? error.message : "알 수 없는 PAK export 사전검증 오류";
  process.stderr.write(`[${code}] ${message}\n`);
  process.exitCode = 1;
}
