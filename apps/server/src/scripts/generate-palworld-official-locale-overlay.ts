import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldActiveSkillLocaleEvidenceArtifact,
  assertPalworldOfficialLocaleCompatibilityArtifact,
  assertPalworldOfficialLocaleCoverageArtifact,
  assertPalworldOfficialLocaleManifest,
  assertPalworldOfficialLocaleSourceFieldsArtifact,
  buildPalworldOfficialLocaleOverlay,
  serializePalworldOfficialLocaleOverlayArtifact,
} from "../data/palworld-official-locale-overlay.js";

type Arguments = {
  activeReleaseRoot: string;
  candidateRoot: string;
  outputRoot: string;
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  activeSkillMappingFile: string;
};

const OUTPUT_FILES = [
  "locales/official-source-fields.json",
  "locales/official-active-skill-evidence.json",
  "locales/official-locale-compatibility.json",
  "locales/ko.json",
  "locales/ja.json",
  "locales/ko-coverage.json",
  "locales/ja-coverage.json",
  "locales/manifest.json",
] as const;

function usage(): never {
  throw new Error(
    "사용법: npm run generate:palworld-official-locale-overlay -- "
      + "--active-root <active-release-directory> "
      + "--candidate-root <candidate-directory> "
      + "--output <새 staging-directory> "
      + "--reviewed-at <고정 RFC3339 UTC 시각> "
      + "--reviewer <번역 호환성 검수자 ID> "
      + "--evidence-checksum <번역 호환성 검수 증거 SHA-256> "
      + "--active-skill-mapping <versioned active skill locale mapping JSON>",
  );
}

function parseArguments(argv: string[]): Arguments {
  if (argv.length === 0 || argv.length % 2 !== 0) usage();
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      key === undefined
      || value === undefined
      || !key.startsWith("--")
      || value.startsWith("--")
      || values.has(key)
    ) {
      usage();
    }
    values.set(key, value);
  }
  const allowed = new Set([
    "--active-root",
    "--candidate-root",
    "--output",
    "--reviewed-at",
    "--reviewer",
    "--evidence-checksum",
    "--active-skill-mapping",
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) usage();
  const activeReleaseRoot = values.get("--active-root");
  const candidateRoot = values.get("--candidate-root");
  const outputRoot = values.get("--output");
  const reviewedAt = values.get("--reviewed-at");
  const reviewer = values.get("--reviewer");
  const evidenceChecksum = values.get("--evidence-checksum");
  const activeSkillMappingFile = values.get("--active-skill-mapping");
  if (
    activeReleaseRoot === undefined
    || candidateRoot === undefined
    || outputRoot === undefined
    || reviewedAt === undefined
    || reviewer === undefined
    || evidenceChecksum === undefined
    || activeSkillMappingFile === undefined
  ) {
    usage();
  }
  return {
    activeReleaseRoot: path.resolve(activeReleaseRoot),
    candidateRoot: path.resolve(candidateRoot),
    outputRoot: path.resolve(outputRoot),
    reviewedAt,
    reviewer,
    evidenceChecksum,
    activeSkillMappingFile: path.resolve(activeSkillMappingFile),
  };
}

async function assertCanonicalDirectory(directory: string, label: string): Promise<string> {
  const resolved = await realpath(directory);
  const info = await lstat(resolved);
  if (info.isSymbolicLink() || !info.isDirectory() || resolved !== path.resolve(directory)) {
    throw new Error(`${label}는 symlink가 아닌 canonical directory여야 합니다.`);
  }
  return resolved;
}

function assertSafeOutput(
  outputRoot: string,
  activeRoot: string,
  candidateRoot: string,
): void {
  const parent = path.dirname(outputRoot);
  if (
    outputRoot === activeRoot
    || outputRoot === candidateRoot
    || outputRoot === parent
    || path.relative(activeRoot, outputRoot).split(path.sep)[0] !== ".."
    || path.relative(candidateRoot, outputRoot).split(path.sep)[0] !== ".."
  ) {
    throw new Error("output은 active/candidate와 분리된 새 staging directory여야 합니다.");
  }
}

async function writeExclusive(filePath: string, text: string): Promise<void> {
  const handle = await open(
    filePath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644,
  );
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function existingOutputMatches(
  outputRoot: string,
  expected: ReadonlyMap<string, string>,
): Promise<boolean> {
  try {
    const info = await lstat(outputRoot);
    if (!info.isDirectory() || info.isSymbolicLink()) return false;
    for (const fileName of OUTPUT_FILES) {
      if (await readFile(path.join(outputRoot, fileName), "utf8") !== expected.get(fileName)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

const args = parseArguments(process.argv.slice(2));
let temporaryRoot: string | undefined;
try {
  const [activeReleaseRoot, candidateRoot, outputParent] = await Promise.all([
    assertCanonicalDirectory(args.activeReleaseRoot, "active root"),
    assertCanonicalDirectory(args.candidateRoot, "candidate root"),
    assertCanonicalDirectory(path.dirname(args.outputRoot), "output parent"),
  ]);
  assertSafeOutput(args.outputRoot, activeReleaseRoot, candidateRoot);
  const artifacts = await buildPalworldOfficialLocaleOverlay({
    activeReleaseRoot,
    candidateRoot,
    reviewedAt: args.reviewedAt,
    reviewer: args.reviewer,
    evidenceChecksum: args.evidenceChecksum,
    activeSkillMappingFile: args.activeSkillMappingFile,
  });
  const texts = new Map<string, string>([
    [
      "locales/official-source-fields.json",
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.officialSourceFields),
    ],
    [
      "locales/official-active-skill-evidence.json",
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.activeSkillEvidence),
    ],
    [
      "locales/official-locale-compatibility.json",
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.compatibility),
    ],
    ["locales/ko.json", serializePalworldOfficialLocaleOverlayArtifact(artifacts.snapshots.ko)],
    ["locales/ja.json", serializePalworldOfficialLocaleOverlayArtifact(artifacts.snapshots.ja)],
    [
      "locales/ko-coverage.json",
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.coverage.ko),
    ],
    [
      "locales/ja-coverage.json",
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.coverage.ja),
    ],
    ["locales/manifest.json", serializePalworldOfficialLocaleOverlayArtifact(artifacts.manifest)],
  ]);
  if (await existingOutputMatches(args.outputRoot, texts)) {
    process.stdout.write(`${JSON.stringify({
      status: "unchanged",
      output: path.relative(process.cwd(), args.outputRoot),
      sourceProvided: artifacts.officialSourceFields.counts.byLocale,
      activationEligible: false,
    }, null, 2)}\n`);
    process.exit(0);
  }
  try {
    await lstat(args.outputRoot);
    throw new Error("다른 내용의 output이 이미 존재하여 덮어쓰지 않습니다.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  temporaryRoot = path.join(
    outputParent,
    `.${path.basename(args.outputRoot)}.${randomBytes(12).toString("hex")}.tmp`,
  );
  await mkdir(path.join(temporaryRoot, "locales"), {
    recursive: true,
    mode: 0o755,
  });
  for (const fileName of OUTPUT_FILES) {
    await writeExclusive(path.join(temporaryRoot, fileName), texts.get(fileName)!);
  }
  const [sourceFieldsRaw, activeSkillEvidenceRaw, compatibilityRaw, manifestRaw] = await Promise.all([
    readFile(path.join(temporaryRoot, "locales", "official-source-fields.json"), "utf8"),
    readFile(
      path.join(temporaryRoot, "locales", "official-active-skill-evidence.json"),
      "utf8",
    ),
    readFile(path.join(temporaryRoot, "locales", "official-locale-compatibility.json"), "utf8"),
    readFile(path.join(temporaryRoot, "locales", "manifest.json"), "utf8"),
  ]);
  assertPalworldOfficialLocaleSourceFieldsArtifact(JSON.parse(sourceFieldsRaw));
  assertPalworldActiveSkillLocaleEvidenceArtifact(
    JSON.parse(activeSkillEvidenceRaw),
  );
  assertPalworldOfficialLocaleManifest(JSON.parse(manifestRaw));
  assertPalworldOfficialLocaleCoverageArtifact(
    JSON.parse(texts.get("locales/ko-coverage.json")!),
  );
  assertPalworldOfficialLocaleCoverageArtifact(
    JSON.parse(texts.get("locales/ja-coverage.json")!),
  );
  assertPalworldOfficialLocaleCompatibilityArtifact(
    JSON.parse(compatibilityRaw),
    {
      officialSourceFields: sourceFieldsRaw,
      activeSkillEvidence: activeSkillEvidenceRaw,
      ko: texts.get("locales/ko.json")!,
      ja: texts.get("locales/ja.json")!,
      manifest: manifestRaw,
    },
  );
  await rename(temporaryRoot, args.outputRoot);
  temporaryRoot = undefined;
  process.stdout.write(`${JSON.stringify({
    status: "created",
    output: path.relative(process.cwd(), args.outputRoot),
    sourceProvided: artifacts.officialSourceFields.counts.byLocale,
    unresolved: artifacts.compatibility.counts.officialUnresolved,
    unjoined: artifacts.compatibility.counts.officialUnjoined,
    candidateRuntimeActivationGranted: false,
    rightsVerified: false,
  }, null, 2)}\n`);
} catch (error) {
  if (temporaryRoot !== undefined) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
  }
  const message = error instanceof Error
    ? error.message
    : "알 수 없는 공식 locale overlay 생성 오류";
  process.stderr.write(`[PALWORLD_OFFICIAL_LOCALE_OVERLAY_FAILED] ${message}\n`);
  process.exitCode = 1;
}
