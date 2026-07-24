import path from "node:path";
import { inspectPalworldPakArchive, PalworldPakPreflightError } from "../data/palworld-pak-preflight.js";

function argumentsFrom(argv: string[]): {
  archive: string;
  officialEnLocale: "required" | "optional";
} {
  if (
    (argv.length !== 2 && argv.length !== 4)
    || argv[0] !== "--archive"
    || !argv[1]
    || (
      argv.length === 4
      && (
        argv[2] !== "--official-en"
        || (argv[3] !== "required" && argv[3] !== "optional")
      )
    )
  ) {
    throw new PalworldPakPreflightError(
      "사용법: npm run preflight:palworld-pak -- --archive <Content.zip> "
        + "[--official-en required|optional]"
    );
  }
  return {
    archive: path.resolve(argv[1]),
    officialEnLocale: argv[3] === "optional" ? "optional" : "required"
  };
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const report = await inspectPalworldPakArchive(args.archive, {
    officialEnLocale: args.officialEnLocale
  });
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
