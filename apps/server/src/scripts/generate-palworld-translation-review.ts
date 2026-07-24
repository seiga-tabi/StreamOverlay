import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPalworldTranslationReviewArtifacts,
  serializePalworldTranslationReviewArtifact,
} from "../data/palworld-translation-review.js";

type Arguments = {
  candidateRoot: string;
  preparedAt: string;
  sourceGroupLimit: number;
};

const SERVER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ACTIVE_RELEASE_ROOT = path.join(SERVER_ROOT, "data", "palworld", "1.0.1");
const CANDIDATES_ROOT = path.join(SERVER_ROOT, "data", "palworld", "candidates");
const OUTPUT_ROOT = path.join(
  ACTIVE_RELEASE_ROOT,
  "locales",
  "review-queues",
);

function usage(): never {
  throw new Error(
    "사용법: npm run generate:palworld-translation-review -- "
      + "--candidate <candidate-directory> "
      + "--prepared-at <고정 RFC3339 UTC 시각> "
      + "[--source-group-limit 1..150]",
  );
}

function parseArguments(argv: string[]): Arguments {
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
    "--candidate",
    "--prepared-at",
    "--source-group-limit",
  ]);
  if ([...values.keys()].some((key) => !allowed.has(key))) usage();
  const candidate = values.get("--candidate");
  const preparedAt = values.get("--prepared-at");
  if (candidate === undefined || preparedAt === undefined) usage();
  const rawLimit = values.get("--source-group-limit") ?? "25";
  if (!/^(?:[1-9]|[1-9]\d|1[0-4]\d|150)$/u.test(rawLimit)) usage();
  return {
    candidateRoot: path.resolve(candidate),
    preparedAt,
    sourceGroupLimit: Number(rawLimit),
  };
}

async function assertExistingDirectoryWithin(
  inputPath: string,
  rootPath: string,
): Promise<string> {
  const [resolvedRoot, resolvedInput] = await Promise.all([
    realpath(rootPath),
    realpath(inputPath),
  ]);
  const relative = path.relative(resolvedRoot, resolvedInput);
  if (
    relative === ""
    || relative.startsWith("..")
    || path.isAbsolute(relative)
    || relative.includes(path.sep)
  ) {
    throw new Error("candidate 경로는 Palworld candidates root의 직접 하위여야 합니다.");
  }
  const inputInfo = await lstat(inputPath);
  if (inputInfo.isSymbolicLink() || !inputInfo.isDirectory()) {
    throw new Error("candidate 경로는 symlink가 아닌 directory여야 합니다.");
  }
  return resolvedInput;
}

async function writeImmutableFile(
  filePath: string,
  content: string,
): Promise<"created" | "unchanged"> {
  try {
    const existing = await readFile(filePath, "utf8");
    if (existing === content) return "unchanged";
    throw new Error(
      `${path.basename(filePath)}에 다른 검수 artifact가 이미 존재합니다. 기존 batch를 덮어쓰지 않습니다.`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const handle = await open(
    temporaryPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644,
  );
  try {
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(temporaryPath, filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        const existing = await readFile(filePath, "utf8");
        if (existing === content) return "unchanged";
        throw new Error(
          `${path.basename(filePath)}가 동시에 다른 내용으로 생성되었습니다.`,
        );
      }
      throw error;
    }
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return "created";
}

const args = parseArguments(process.argv.slice(2));
try {
  await access(ACTIVE_RELEASE_ROOT, fsConstants.R_OK);
  const candidateRoot = await assertExistingDirectoryWithin(
    args.candidateRoot,
    CANDIDATES_ROOT,
  );
  const artifacts = await buildPalworldTranslationReviewArtifacts({
    activeReleaseRoot: ACTIVE_RELEASE_ROOT,
    candidateRoot,
    preparedAt: args.preparedAt,
    sourceGroupLimit: args.sourceGroupLimit,
  });
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o755 });
  const summaryResult = await writeImmutableFile(
    path.join(OUTPUT_ROOT, "review-summary.json"),
    serializePalworldTranslationReviewArtifact(artifacts.summary),
  );
  const batchResult = await writeImmutableFile(
    path.join(OUTPUT_ROOT, "source-anomaly-0001.json"),
    serializePalworldTranslationReviewArtifact(artifacts.sourceAnomalyBatch),
  );
  process.stdout.write(`${JSON.stringify({
    status: "pending_operator_review",
    output: "data/palworld/1.0.1/locales/review-queues",
    files: {
      summary: summaryResult,
      sourceAnomalyBatch: batchResult,
    },
    machineAssisted: artifacts.summary.counts.machineAssisted,
    officialExact: artifacts.summary.counts.officialExact,
    sourceAnomalies: artifacts.summary.counts.sourceAnomalies,
    firstBatch: artifacts.sourceAnomalyBatch.counts,
    activationEligible:
      artifacts.summary.source.candidate.activationEligible,
    activationBlockers:
      artifacts.summary.source.candidate.activationBlockers,
  }, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : "알 수 없는 Palworld 번역 검수 생성 오류";
  process.stderr.write(`[PALWORLD_TRANSLATION_REVIEW_FAILED] ${message}\n`);
  process.exitCode = 1;
}
