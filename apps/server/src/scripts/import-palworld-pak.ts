import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importPalworldPakCandidate,
  loadPalworldPakCandidateMappings,
  readPalworldPakExportMetadataFile
} from "../data/palworld-pak-import.js";

type CliArguments = {
  archive: string;
  expectedSha256: string;
  output: string;
  legacyCatalog: string;
  metadata?: string;
  includeAssets: boolean;
};

function usage(): never {
  throw new Error(
    "사용법: npm run import:palworld-pak -- "
      + "--archive <Content.zip> --expected-sha256 <sha256> --output <candidate-dir> "
      + "--legacy-catalog <검증된 기존 catalog.json> "
      + "[--metadata <palworld-export-metadata.json>] [--skip-assets]"
  );
}

function parseArguments(argv: string[]): CliArguments {
  const values = new Map<string, string>();
  let includeAssets = true;
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--skip-assets") {
      includeAssets = false;
      continue;
    }
    if (!key?.startsWith("--") || index + 1 >= argv.length) usage();
    const value = argv[index + 1];
    if (!value || value.startsWith("--") || values.has(key)) usage();
    values.set(key, value);
    index += 1;
  }
  const allowed = new Set([
    "--archive",
    "--expected-sha256",
    "--output",
    "--legacy-catalog",
    "--metadata"
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) usage();
  const archive = values.get("--archive");
  const expectedSha256 = values.get("--expected-sha256");
  const output = values.get("--output");
  const legacyCatalog = values.get("--legacy-catalog");
  if (!archive || !expectedSha256 || !output || !legacyCatalog) usage();
  return {
    archive: path.resolve(archive),
    expectedSha256,
    output: path.resolve(output),
    legacyCatalog: path.resolve(legacyCatalog),
    ...(values.get("--metadata") === undefined
      ? {}
      : { metadata: path.resolve(values.get("--metadata")!) }),
    includeAssets
  };
}

const args = parseArguments(process.argv.slice(2));
const dataRoot = fileURLToPath(new URL("../../src/data/", import.meta.url));
try {
  const mappings = await loadPalworldPakCandidateMappings({
    publicIdMapPath: path.join(dataRoot, "palworld-mappings/public-id-map.json"),
    aliasesPath: path.join(dataRoot, "palworld-pak-mappings/id-aliases.json"),
    palIconOverridesPath: path.join(dataRoot, "palworld-pak-mappings/pal-icon-overrides.json"),
    elementIconMapPath: path.join(dataRoot, "palworld-pak-mappings/element-icon-map.json"),
    workIconMapPath: path.join(dataRoot, "palworld-pak-mappings/work-icon-map.json"),
    skillIconMapPath: path.join(dataRoot, "palworld-pak-mappings/skill-icon-map.json"),
    publicActiveSkillAllowlistPath: path.join(
      dataRoot,
      "palworld-pak-mappings/public-active-skill-allowlist.json"
    ),
    exclusionsPath: path.join(dataRoot, "palworld-pak-mappings/exclusions.json"),
    legacySkillCatalogPath: args.legacyCatalog
  });
  const metadata = args.metadata === undefined
    ? undefined
    : await readPalworldPakExportMetadataFile(args.metadata);
  const result = await importPalworldPakCandidate({
    archivePath: args.archive,
    expectedArchiveSha256: args.expectedSha256,
    outputDirectory: args.output,
    ...(metadata === undefined ? {} : { metadata }),
    mappings,
    includeAssets: args.includeAssets
  });
  process.stdout.write(`${JSON.stringify({
    candidateId: result.candidateId,
    outputDirectoryName: path.basename(result.outputDirectory),
    activationEligible: result.activationEligible,
    blockers: result.blockers,
    counts: result.counts,
    localeCoverage: result.localeCoverage,
    imageCoverage: result.imageCoverage
  }, null, 2)}\n`);
  process.exitCode = result.activationEligible ? 0 : 2;
} catch (error) {
  const code = error instanceof Error && "code" in error
    ? String((error as { code: unknown }).code)
    : "PALWORLD_PAK_IMPORT_UNEXPECTED";
  const message = error instanceof Error ? error.message : "알 수 없는 Palworld PAK candidate import 오류";
  process.stderr.write(`[${code}] ${message}\n`);
  process.exitCode = 1;
}
