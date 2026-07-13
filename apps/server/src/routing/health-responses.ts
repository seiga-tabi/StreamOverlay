export type ReadinessCheckResult = {
  ok: boolean;
  checks?: Record<string, boolean>;
  errors?: string[];
};

export type ReadinessCheck = () => ReadinessCheckResult;

export type ReadinessSnapshot = {
  ok: boolean;
  status: "ready" | "not_ready";
  checks: Record<string, boolean>;
  errors: string[];
};

export function resolveReadiness(
  readiness: ReadinessCheck | undefined,
  shuttingDown: boolean
): ReadinessSnapshot {
  let result: Required<ReadinessCheckResult> = { ok: true, checks: {}, errors: [] };
  try {
    const checked = readiness?.();
    if (checked) {
      result = {
        ok: checked.ok,
        checks: checked.checks ?? {},
        errors: checked.errors ?? []
      };
    }
  } catch {
    result = { ok: false, checks: {}, errors: ["readiness 검사에 실패했습니다."] };
  }

  const ok = result.ok && !shuttingDown;
  return {
    ok,
    status: ok ? "ready" : "not_ready",
    checks: { ...result.checks, acceptingRequests: !shuttingDown },
    errors: result.errors
  };
}

export function buildLivenessResponse<TBuild>(input: {
  startedAt: string;
  uptimeSeconds: number;
  build: TBuild;
}) {
  return {
    ok: true,
    status: "live" as const,
    startedAt: input.startedAt,
    uptimeSeconds: Math.max(0, Math.floor(input.uptimeSeconds)),
    build: input.build
  };
}

export function buildReadinessResponse<TBuild>(readiness: ReadinessSnapshot, build: TBuild) {
  return {
    ok: readiness.ok,
    status: readiness.status,
    checks: readiness.checks,
    errors: readiness.errors,
    build
  };
}
