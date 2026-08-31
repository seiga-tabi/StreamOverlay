import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { YoroOrchestrator, type YoroRunRequest } from "../src/YoroOrchestrator.js";
import { CliPreflight } from "../src/executors/CliPreflight.js";
import { FableReviewer } from "../src/executors/FableReviewer.js";
import type { SpawnRunner } from "../src/executors/process.js";
import { PolicyLoader } from "../src/policy/PolicyLoader.js";
import { PendingMachine } from "../src/state/ExecutionStateMachine.js";
import { VerificationEngine } from "../src/verification/VerificationEngine.js";
import {
  PolicyViolationCode,
  PolicyViolationError,
} from "../src/violations/PolicyViolationError.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../../..");
const policyDirectory = path.join(repositoryRoot, ".ai", "policy");
const schemaPath = path.join(repositoryRoot, ".ai", "schemas", "execution-record.yaml");
const policyFiles = ["models.yaml", "executors.yaml", "escalation.yaml", "risk-matrix.yaml", "approval.yaml"];

async function loadPolicies() {
  return new PolicyLoader(policyDirectory).load();
}

async function copyPolicies(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yoro-router-policy-"));
  await Promise.all(policyFiles.map((file) => copyFile(path.join(policyDirectory, file), path.join(directory, file))));
  return directory;
}

function assertViolation(error: unknown, code: PolicyViolationCode): boolean {
  assert.ok(error instanceof PolicyViolationError, "PolicyViolationError가 발생해야 합니다.");
  assert.equal(error.code, code, `정책 위반 코드는 ${code}여야 합니다.`);
  return true;
}

interface TestFixture {
  repositoryRoot: string;
  policyDirectory: string;
  executionSchemaPath: string;
  runsDirectory: string;
  packageDirectory: string;
}

interface ProcessCall {
  command: string;
  args: readonly string[];
  stdin: string;
  cwd?: string;
}

async function createFixture(label: string): Promise<TestFixture> {
  const temporaryRepositoryRoot = await mkdtemp(path.join(tmpdir(), `yoro-router-${label}-`));
  const temporaryPolicyDirectory = await copyPolicies();
  const temporarySchemaPath = path.join(temporaryRepositoryRoot, "execution-record.yaml");
  const temporaryRunsDirectory = path.join(temporaryRepositoryRoot, "runs");
  const packageDirectory = path.join(temporaryRepositoryRoot, "package");
  await Promise.all([
    copyFile(schemaPath, temporarySchemaPath),
    mkdir(temporaryRunsDirectory, { recursive: true }),
    mkdir(packageDirectory, { recursive: true }),
  ]);
  await writeFile(path.join(packageDirectory, "package.json"), JSON.stringify({
    scripts: {
      lint: "mock",
      typecheck: "mock",
      test: "mock",
      build: "mock",
    },
  }), "utf8");
  return {
    repositoryRoot: temporaryRepositoryRoot,
    policyDirectory: temporaryPolicyDirectory,
    executionSchemaPath: temporarySchemaPath,
    runsDirectory: temporaryRunsDirectory,
    packageDirectory,
  };
}

function createPreflight(options: {
  codexAvailable?: boolean;
  claudeAvailable?: boolean;
  reviewerHealthy?: boolean;
} = {}): CliPreflight {
  const {
    codexAvailable = true,
    claudeAvailable = true,
    reviewerHealthy = true,
  } = options;
  return new CliPreflight(async (file, args) => {
    if (file === "/bin/zsh") {
      const command = args.at(-1) ?? "";
      if (command.includes("codex")) {
        return codexAvailable
          ? { stdout: "/mock/codex\n", stderr: "", exitCode: 0 }
          : { stdout: "", stderr: "command not found", exitCode: 1 };
      }
      if (command.includes("claude")) {
        return claudeAvailable
          ? { stdout: "/mock/claude\n", stderr: "", exitCode: 0 }
          : { stdout: "", stderr: "command not found", exitCode: 1 };
      }
    }
    if (args.includes("--version")) {
      return { stdout: "mock-version\n", stderr: "", exitCode: 0 };
    }
    if (args.includes("Respond with exactly: FABLE5_OK")) {
      return reviewerHealthy
        ? { stdout: "FABLE5_OK\n", stderr: "", exitCode: 0 }
        : { stdout: "", stderr: "authentication failed", exitCode: 1 };
    }
    return { stdout: "", stderr: "unexpected preflight command", exitCode: 1 };
  });
}

function createVerificationEngine(
  calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [],
  failedCheck?: string,
): VerificationEngine {
  return new VerificationEngine(async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return {
      stdout: "",
      stderr: failedCheck && args.at(-1) === failedCheck ? `${failedCheck} failed` : "",
      exitCode: failedCheck && args.at(-1) === failedCheck ? 1 : 0,
    };
  });
}

function createRequest(
  fixture: TestFixture,
  overrides: Partial<YoroRunRequest> = {},
): YoroRunRequest {
  return {
    taskId: "router-test",
    domainHint: "CODING",
    proposedRisk: "R0",
    complexity: "LOW",
    tags: [],
    planHash: "plan-low",
    prompt: "테스트 구현 프롬프트",
    verification: {
      packageDirectory: fixture.packageDirectory,
      changeTypes: ["test"],
    },
    ...overrides,
  };
}

function createOrchestrator(
  fixture: TestFixture,
  processRunner: SpawnRunner,
  preflight = createPreflight(),
  verificationEngine = createVerificationEngine(),
): YoroOrchestrator {
  return new YoroOrchestrator({
    repositoryRoot: fixture.repositoryRoot,
    policyDirectory: fixture.policyDirectory,
    executionSchemaPath: fixture.executionSchemaPath,
    runsDirectory: fixture.runsDirectory,
    processRunner,
    preflight,
    verificationEngine,
  });
}

test("14 LOW risk에서는 codex가 선택되고 review가 강제되지 않는다", async () => {
  const fixture = await createFixture("14");
  const processCalls: ProcessCall[] = [];
  const processRunner: SpawnRunner = async (command, args, stdin, cwd) => {
    processCalls.push({ command, args, stdin, ...(cwd ? { cwd } : {}) });
    return { stdout: "구현 완료", stderr: "", exitCode: 0 };
  };
  const result = await createOrchestrator(fixture, processRunner).run(createRequest(fixture));

  assert.equal(result.state, "COMPLETED", "LOW risk 성공 경로는 COMPLETED여야 합니다.");
  assert.deepEqual(result.reviews, [], "review 미대상 실행에는 review 결과가 없어야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/codex").length, 1, "codex는 정확히 한 번 실행되어야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/claude").length, 0, "reviewer subprocess는 실행되면 안 됩니다.");
});

test("15 HIGH risk에서 승인 콜백이 거부하면 AWAITING_APPROVAL에서 멈춘다", async () => {
  const fixture = await createFixture("15");
  const result = await createOrchestrator(
    fixture,
    async () => ({ stdout: "", stderr: "", exitCode: 0 }),
  ).run(createRequest(fixture, {
    taskId: "approval-awaiting",
    proposedRisk: "R2",
    complexity: "HIGH",
    planHash: "plan-awaiting",
    approval: { requestApproval: async () => false },
  }));

  assert.equal(result.state, "AWAITING_APPROVAL", "승인 거부는 실행 단계로 넘어가지 않아야 합니다.");
  assert.equal(result.stateTransitions.at(-1)?.to, "AWAITING_APPROVAL", "마지막 상태 전이는 AWAITING_APPROVAL이어야 합니다.");
});

test("16 HIGH risk에서 승인되지 않으면 executor가 한 번도 호출되지 않는다", async () => {
  const fixture = await createFixture("16");
  let processCallCount = 0;
  const result = await createOrchestrator(fixture, async () => {
    processCallCount += 1;
    return { stdout: "", stderr: "", exitCode: 0 };
  }).run(createRequest(fixture, {
    taskId: "approval-blocks-executor",
    proposedRisk: "R2",
    complexity: "HIGH",
    planHash: "plan-blocked",
    approval: { requestApproval: async () => false },
  }));

  assert.equal(result.state, "AWAITING_APPROVAL", "미승인 HIGH risk는 AWAITING_APPROVAL이어야 합니다.");
  assert.equal(processCallCount, 0, "승인 전에는 executor subprocess가 호출되면 안 됩니다.");
});

test("17 HIGH risk가 승인되면 codex 실행 후 Fable review까지 완료한다", async () => {
  const fixture = await createFixture("17");
  const processCalls: ProcessCall[] = [];
  const processRunner: SpawnRunner = async (command, args, stdin, cwd) => {
    processCalls.push({ command, args, stdin, ...(cwd ? { cwd } : {}) });
    const reviewing = args.includes("--allowedTools");
    return { stdout: reviewing ? "발견 사항 없음" : "구현 완료", stderr: "", exitCode: 0 };
  };
  const result = await createOrchestrator(fixture, processRunner).run(createRequest(fixture, {
    taskId: "approved-review",
    proposedRisk: "R2",
    complexity: "HIGH",
    tags: ["cross_module_change"],
    planHash: "plan-approved",
    approval: { requestApproval: async () => true },
  }));

  assert.equal(result.state, "COMPLETED", "승인·실행·review·verification 성공 후 COMPLETED여야 합니다.");
  assert.ok(result.reviews.length >= 1, "필수 review 결과가 한 개 이상 기록되어야 합니다.");
  assert.match(result.reviews.join("\n"), /발견 사항 없음/u, "review 텍스트가 결과에 포함되어야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/codex").length, 1, "codex 구현 실행이 기록되어야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/claude" && call.args.includes("--allowedTools")).length, 1, "Fable review 실행이 기록되어야 합니다.");
});

test("18 Fable reviewer 인증 health check 실패 시 REVIEWER_UNAVAILABLE로 종료한다", async () => {
  const fixture = await createFixture("18");
  const processCalls: ProcessCall[] = [];
  const verificationCalls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
  const processRunner: SpawnRunner = async (command, args, stdin, cwd) => {
    processCalls.push({ command, args, stdin, ...(cwd ? { cwd } : {}) });
    return { stdout: "구현 완료", stderr: "", exitCode: 0 };
  };
  const result = await createOrchestrator(
    fixture,
    processRunner,
    createPreflight({ reviewerHealthy: false }),
    createVerificationEngine(verificationCalls),
  ).run(createRequest(fixture, {
    taskId: "reviewer-auth-failure",
    proposedRisk: "R2",
    complexity: "HIGH",
    tags: ["cross_module_change"],
    planHash: "plan-reviewer-auth",
    approval: { requestApproval: async () => true },
  }));

  assert.equal(result.state, "REVIEWER_UNAVAILABLE", "reviewer health check 실패는 REVIEWER_UNAVAILABLE이어야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/claude").length, 0, "실제 review subprocess는 health check 실패 후 호출되면 안 됩니다.");
  assert.equal(verificationCalls.length, 0, "필수 review 실패 후 verification에 진입하면 안 됩니다.");
});

test("19 Fable review subprocess 실패는 다른 reviewer로 대체하지 않고 REVIEWER_UNAVAILABLE로 종료한다", async () => {
  const fixture = await createFixture("19");
  const processCalls: ProcessCall[] = [];
  const processRunner: SpawnRunner = async (command, args, stdin, cwd) => {
    processCalls.push({ command, args, stdin, ...(cwd ? { cwd } : {}) });
    return args.includes("--allowedTools")
      ? { stdout: "", stderr: "review failed", exitCode: 1 }
      : { stdout: "구현 완료", stderr: "", exitCode: 0 };
  };
  const result = await createOrchestrator(fixture, processRunner).run(createRequest(fixture, {
    taskId: "review-subprocess-failure",
    proposedRisk: "R2",
    complexity: "HIGH",
    tags: ["cross_module_change"],
    planHash: "plan-review-failure",
    approval: { requestApproval: async () => true },
  }));
  const reviewerCalls = processCalls.filter((call) => call.command === "/mock/claude" && call.args.includes("--allowedTools"));
  const reviewerModels = new Set(reviewerCalls.map((call) => call.args[call.args.indexOf("--model") + 1]));

  assert.equal(result.state, "REVIEWER_UNAVAILABLE", "review subprocess exitCode 실패는 REVIEWER_UNAVAILABLE이어야 합니다.");
  assert.equal(reviewerCalls.length, 1, "review subprocess는 대체 reviewer 재시도 없이 한 번만 실행되어야 합니다.");
  assert.deepEqual([...reviewerModels], ["claude-fable-5"], "정책 reviewer인 coding_review 모델만 사용해야 합니다.");
  assert.equal(processCalls.filter((call) => call.command === "/mock/claude" && !call.args.includes("--allowedTools")).length, 0, "다른 claude reviewer나 delegate로 전환하면 안 됩니다.");
});

test("20 Codex와 fallback executor가 모두 불가능하면 EXECUTOR_UNAVAILABLE로 종료한다", async () => {
  const fixture = await createFixture("20");
  let processCallCount = 0;
  const result = await createOrchestrator(
    fixture,
    async () => {
      processCallCount += 1;
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    createPreflight({ codexAvailable: false, claudeAvailable: false }),
  ).run(createRequest(fixture, { taskId: "all-executors-unavailable" }));

  assert.equal(result.state, "EXECUTOR_UNAVAILABLE", "primary와 fallback preflight 실패는 EXECUTOR_UNAVAILABLE이어야 합니다.");
  assert.equal(processCallCount, 0, "사용 불가능한 executor의 subprocess는 호출되면 안 됩니다.");
});

test("21 verification 실패 시 COMPLETED로 전이되지 않는다", async () => {
  const fixture = await createFixture("21");
  const verificationCalls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];
  const result = await createOrchestrator(
    fixture,
    async () => ({ stdout: "구현 완료", stderr: "", exitCode: 0 }),
    createPreflight(),
    createVerificationEngine(verificationCalls, "typecheck"),
  ).run(createRequest(fixture, { taskId: "verification-failure" }));

  assert.equal(result.state, "VERIFICATION_FAILED", "typecheck 실패는 VERIFICATION_FAILED여야 합니다.");
  assert.notEqual(result.state, "COMPLETED", "실패한 verification 결과로 COMPLETED가 되면 안 됩니다.");
  assert.equal(result.verification?.success, false, "실패한 verification 결과가 반환되어야 합니다.");
  assert.equal(verificationCalls.filter((call) => call.args.at(-1) === "typecheck").length, 1, "실패하도록 구성한 typecheck가 실제 실행되어야 합니다.");
});

test("22 findings 이후 fix와 재검증 및 Fable 재리뷰를 두 번의 run으로 반복할 수 있다", async () => {
  const fixture = await createFixture("22");
  let phase = 1;
  const processCalls: Array<ProcessCall & { phase: number }> = [];
  const processRunner: SpawnRunner = async (command, args, stdin, cwd) => {
    processCalls.push({ command, args, stdin, phase, ...(cwd ? { cwd } : {}) });
    if (args.includes("--allowedTools")) {
      return {
        stdout: phase === 1 ? "Critical: XSS 취약점 발견" : "발견 사항 없음(PASS)",
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: phase === 1 ? "최초 구현 완료" : "XSS 수정 완료", stderr: "", exitCode: 0 };
  };
  const orchestrator = createOrchestrator(fixture, processRunner);
  const commonRequest = {
    taskId: "review-fix-rerun",
    proposedRisk: "R2",
    complexity: "HIGH",
    tags: ["cross_module_change"],
    approval: { requestApproval: async () => true },
  } satisfies Partial<YoroRunRequest>;
  const first = await orchestrator.run(createRequest(fixture, {
    ...commonRequest,
    planHash: "plan-before-fix",
    prompt: "최초 구현을 수행한다",
  }));
  phase = 2;
  const second = await orchestrator.run(createRequest(fixture, {
    ...commonRequest,
    planHash: "plan-after-fix",
    prompt: "Critical XSS findings를 수정한다",
  }));

  // 상태 머신은 review 텍스트 내용을 파싱하지 않는다. findings 유무와 fix 필요 여부 판단은 외부 호출자/Hermes의 책임이다.
  assert.equal(first.state, "COMPLETED", "기술적으로 성공한 1차 review는 findings 텍스트가 있어도 COMPLETED가 됩니다.");
  assert.match(first.reviews.at(-1) ?? "", /Critical: XSS 취약점 발견/u, "1차 review findings가 보존되어야 합니다.");
  assert.equal(second.state, "COMPLETED", "fix 이후 재실행도 verification과 재리뷰를 통과해야 합니다.");
  assert.match(second.reviews.at(-1) ?? "", /발견 사항 없음\(PASS\)/u, "2차 재리뷰 PASS 텍스트가 보존되어야 합니다.");
  for (const currentPhase of [1, 2]) {
    assert.equal(processCalls.filter((call) => call.phase === currentPhase && call.command === "/mock/codex").length, 1, `${currentPhase}차 run에서 codex가 정확히 한 번 실행되어야 합니다.`);
    assert.equal(processCalls.filter((call) => call.phase === currentPhase && call.command === "/mock/claude" && call.args.includes("--allowedTools")).length, 1, `${currentPhase}차 run에서 Fable review가 정확히 한 번 실행되어야 합니다.`);
  }
});

test("23 필수 Fable review 완료 전에는 verification과 COMPLETED에 도달할 수 없다", async () => {
  await createFixture("23");
  const reviewing = PendingMachine.create()
    .classify("plan-review-required")
    .beginApproval(true)
    .approve("plan-review-required", true, "human")
    .startExecution("plan-review-required", true)
    .startReview(true, "coding_review");

  // review 내용의 PASS/FAIL 의미 해석은 외부 책임이지만, review 호출 자체의 완료는 구조적 선행조건이다.
  assert.throws(
    () => reviewing.startVerification(),
    (error) => assertViolation(error, PolicyViolationCode.REQUIRED_REVIEW_SKIPPED),
  );
  assert.equal(reviewing.state, "REVIEWING", "review 미완료 상태는 REVIEWING에 머물러야 합니다.");
});

test("24 read-only Fable reviewer의 파일 write 시도를 e2e 경로에서 즉시 차단한다", async () => {
  const fixture = await createFixture("24");
  const target = path.join(fixture.repositoryRoot, "tracked.ts");
  const before = "export const safe = true;\n";
  const after = "export const unsafeWriteAttempt = true;\n";
  await writeFile(target, before, "utf8");
  let verificationCallCount = 0;
  const processRunner: SpawnRunner = async (_command, args) => {
    if (args.includes("--allowedTools")) {
      await writeFile(target, after, "utf8");
      return { stdout: "발견 사항 없음", stderr: "", exitCode: 0 };
    }
    return { stdout: "구현 완료", stderr: "", exitCode: 0 };
  };
  const result = await createOrchestrator(
    fixture,
    processRunner,
    createPreflight(),
    new VerificationEngine(async () => {
      verificationCallCount += 1;
      return { stdout: "", stderr: "", exitCode: 0 };
    }),
  ).run(createRequest(fixture, {
    taskId: "reviewer-write-attempt-e2e",
    proposedRisk: "R2",
    complexity: "HIGH",
    tags: ["cross_module_change"],
    planHash: "plan-write-guard",
    approval: { requestApproval: async () => true },
  }));

  assert.equal(result.state, "POLICY_VIOLATION", "workspace 변경 감지는 POLICY_VIOLATION으로 종료되어야 합니다.");
  assert.equal(await readFile(target, "utf8"), after, "mock subprocess의 변경이 실제 감지 대상이었음을 확인해야 합니다.");
  assert.equal(result.stateTransitions.some((transition) => transition.to === "VERIFYING"), false, "write 감지 후 verification으로 진행하면 안 됩니다.");
  assert.equal(verificationCallCount, 0, "write 정책 위반 후 verification command는 호출되면 안 됩니다.");
});

test("25 500KB 초과 멀티파일 diff는 파일 단위로 분할하고 이하 diff는 한 번만 리뷰한다", async () => {
  const fixture = await createFixture("25");
  const policies = await loadPolicies();
  const model = policies.models.models.coding_review;
  assert.ok(model, "coding_review 모델 정책이 존재해야 합니다.");
  const codingPolicy = policies.escalation.domains.CODING as Record<string, unknown>;
  const reviewPolicy = codingPolicy.review as Record<string, unknown>;
  const guard = reviewPolicy.review_input_guard as Record<string, unknown>;
  const maxDiffBytes = guard.max_diff_bytes;
  assert.equal(maxDiffBytes, 500_000, "실제 정책의 max_diff_bytes는 500,000이어야 합니다.");

  const largeChunks = ["a.ts", "b.ts", "c.ts"].map((file, index) =>
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${"x".repeat(170_000)}\n+${String(index).repeat(170_000)}\n`,
  );
  const largeDiff = largeChunks.join("");
  assert.ok(Buffer.byteLength(largeDiff, "utf8") > maxDiffBytes, "대형 diff가 정책 임계값을 명백히 초과해야 합니다.");
  const largeInputs: string[] = [];
  const largeReviewer = new FableReviewer("coding_review", model, {
    maxDiffBytes,
    workspaceRoot: fixture.repositoryRoot,
    runner: async (_command, _args, stdin) => {
      largeInputs.push(stdin);
      return { stdout: "분할 review 완료", stderr: "", exitCode: 0 };
    },
  });
  await largeReviewer.review(largeDiff);

  assert.equal(largeInputs.length, largeChunks.length, "runner 호출 횟수는 diff --git 파일 블록 수와 같아야 합니다.");
  for (const input of largeInputs) {
    assert.ok(Buffer.byteLength(input, "utf8") < Buffer.byteLength(largeDiff, "utf8"), "각 stdin 청크는 원본 diff보다 작아야 합니다.");
    assert.match(input, /^diff --git /u, "각 stdin 청크는 diff --git 헤더로 시작해야 합니다.");
  }

  const smallInputs: string[] = [];
  const smallDiff = "diff --git a/small.ts b/small.ts\n--- a/small.ts\n+++ b/small.ts\n@@ -1 +1 @@\n-old\n+new\n";
  assert.ok(Buffer.byteLength(smallDiff, "utf8") <= maxDiffBytes, "대조 diff는 정책 임계값 이하여야 합니다.");
  const smallReviewer = new FableReviewer("coding_review", model, {
    maxDiffBytes,
    workspaceRoot: fixture.repositoryRoot,
    runner: async (_command, _args, stdin) => {
      smallInputs.push(stdin);
      return { stdout: "단일 review 완료", stderr: "", exitCode: 0 };
    },
  });
  await smallReviewer.review(smallDiff);
  assert.equal(smallInputs.length, 1, "500KB 이하 단일 파일 diff는 runner를 정확히 한 번 호출해야 합니다.");
  assert.equal(smallInputs[0], smallDiff, "분할되지 않은 diff 원문이 stdin으로 전달되어야 합니다.");
});
