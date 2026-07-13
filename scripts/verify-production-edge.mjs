import fs from "node:fs/promises";
import path from "node:path";
import { buildAlertPayload, sendAlertWebhook, validateAlertWebhookConfig } from "./lib/alert-webhook.mjs";

const args = new Set(process.argv.slice(2));
const testAlertOption = [...args].find((arg) => arg === "--test-alert" || arg.startsWith("--test-alert="));
const testAlertMode = testAlertOption
  ? testAlertOption.includes("=") ? testAlertOption.split("=", 2)[1] : "all"
  : "";

function readOption(name, fallback = "") {
  const prefix = `${name}=`;
  const match = [...args].find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const baseUrlValue = readOption("--base-url", process.env.PRODUCTION_BASE_URL || process.env.STAGING_BASE_URL || "");
const reportPath = readOption("--report");
const timeoutMs = positiveNumber(process.env.OPS_HTTP_TIMEOUT_MS, 10_000);
const backupDir = process.env.STREAMOPS_BACKUP_DIR || "";
const backupMaxAgeHours = positiveNumber(process.env.OPS_BACKUP_MAX_AGE_HOURS, 26);
const diskPath = process.env.OPS_DISK_PATH || "";
const diskUsedPercentMax = positiveNumber(process.env.OPS_DISK_USED_PERCENT_MAX, 85);
const monitorStateFile = process.env.OPS_MONITOR_STATE_FILE || "";
const alertWebhookUrl = process.env.OPS_ALERT_WEBHOOK_URL || "";
const alertWebhookSecret = process.env.OPS_ALERT_WEBHOOK_SECRET || "";
const alertRepeatMinutes = positiveNumber(process.env.OPS_ALERT_REPEAT_MINUTES, 60);
const restartAlertEnabled = process.env.OPS_RESTART_ALERT_ENABLED === "true";
const checks = [];

function record(name, ok, detail) {
  const result = { name, ok, detail };
  checks.push(result);
  console.log(`[edge] ${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  return result;
}

async function request(url, init = {}) {
  return fetch(url, {
    ...init,
    redirect: init.redirect || "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function checkStatic(origin, pathname) {
  try {
    const response = await request(new URL(pathname, origin), { method: "HEAD" });
    record(pathname, response.ok, `HTTP ${response.status}`);
  } catch (error) {
    record(pathname, false, error instanceof Error ? error.message : "요청 실패");
  }
}

async function checkBackupFreshness() {
  if (!backupDir) return;
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("state-")) continue;
      const manifestPath = path.join(backupDir, entry.name, "manifest.json");
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        const createdAt = Date.parse(manifest?.createdAt || "");
        if (manifest?.formatVersion === 1 && Number.isFinite(createdAt)) manifests.push({ createdAt, manifestPath });
      } catch {
        record(`backup manifest ${entry.name}`, false, "manifest를 읽거나 검증할 수 없습니다.");
      }
    }
    if (!manifests.length) {
      record("backup freshness", false, "검증 가능한 backup이 없습니다.");
      return;
    }
    manifests.sort((left, right) => right.createdAt - left.createdAt);
    const ageHours = (Date.now() - manifests[0].createdAt) / 3_600_000;
    record("backup freshness", ageHours <= backupMaxAgeHours, `최근 backup ${ageHours.toFixed(1)}시간 전`);
  } catch (error) {
    record("backup freshness", false, error instanceof Error ? error.message : "backup 경로 확인 실패");
  }
}

async function checkDiskUsage() {
  if (!diskPath) return;
  try {
    const stat = await fs.statfs(diskPath);
    const usedPercent = stat.blocks > 0 ? ((stat.blocks - stat.bfree) / stat.blocks) * 100 : 0;
    record("disk usage", usedPercent < diskUsedPercentMax, `${usedPercent.toFixed(1)}% 사용`);
  } catch (error) {
    record("disk usage", false, error instanceof Error ? error.message : "disk 사용량 확인 실패");
  }
}

async function readPreviousState() {
  if (!monitorStateFile) return undefined;
  try {
    return JSON.parse(await fs.readFile(monitorStateFile, "utf8"));
  } catch {
    return undefined;
  }
}

async function writeMonitorState(state) {
  if (!monitorStateFile) return;
  await fs.mkdir(path.dirname(monitorStateFile), { recursive: true, mode: 0o700 });
  const temporaryPath = `${monitorStateFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, monitorStateFile);
}

async function notifyIfNeeded(result, previousState) {
  if (!alertWebhookUrl) return undefined;
  const validation = validateAlertWebhookConfig(alertWebhookUrl, alertWebhookSecret);
  if (!validation.ok) {
    record("alert webhook", false, validation.error);
    return undefined;
  }

  const previousNotifiedAt = Date.parse(previousState?.lastNotifiedAt || "");
  const repeatElapsed = !Number.isFinite(previousNotifiedAt) || Date.now() - previousNotifiedAt >= alertRepeatMinutes * 60_000;
  const changed = typeof previousState?.ok === "boolean" && previousState.ok !== result.ok;
  if (result.ok && !changed) return previousState?.lastNotifiedAt;
  if (!result.ok && !changed && !repeatElapsed) return previousState?.lastNotifiedAt;

  const delivery = await sendAlertWebhook({
    url: alertWebhookUrl,
    secret: alertWebhookSecret,
    payload: buildAlertPayload(result),
    timeoutMs
  });
  record("alert webhook", delivery.ok, delivery.status ? `HTTP ${delivery.status}` : delivery.error);
  return delivery.ok ? new Date().toISOString() : previousState?.lastNotifiedAt;
}

async function sendTestAlert(ok) {
  if (!alertWebhookUrl) {
    console.error("[edge] OPS_ALERT_WEBHOOK_URL이 필요합니다.");
    return false;
  }
  const validation = validateAlertWebhookConfig(alertWebhookUrl, alertWebhookSecret);
  if (!validation.ok) {
    console.error(`[edge] ${validation.error}`);
    return false;
  }
  const checkedAt = new Date().toISOString();
  const delivery = await sendAlertWebhook({
    url: alertWebhookUrl,
    secret: alertWebhookSecret,
    payload: buildAlertPayload({
      ok,
      checkedAt,
      failures: ok ? [] : ["의도된 운영 실패 알림 검증"],
      test: true
    }),
    timeoutMs
  });
  const label = ok ? "정상" : "실패";
  console.log(`[edge] ${delivery.ok ? "PASS" : "FAIL"} ${label} alert webhook test: ${delivery.status ? `HTTP ${delivery.status}` : delivery.error}`);
  return delivery.ok;
}

if (testAlertMode) {
  if (!["all", "success", "failure"].includes(testAlertMode)) {
    console.error("[edge] --test-alert는 success, failure, all 중 하나여야 합니다.");
    process.exitCode = 1;
  } else {
    const results = [];
    if (testAlertMode === "all" || testAlertMode === "success") results.push(await sendTestAlert(true));
    if (testAlertMode === "all" || testAlertMode === "failure") results.push(await sendTestAlert(false));
    if (results.some((ok) => !ok)) process.exitCode = 1;
  }
} else {

  if (!baseUrlValue) {
    console.error("[edge] --base-url=https://host 또는 PRODUCTION_BASE_URL이 필요합니다.");
    process.exit(1);
  }

let baseUrl;
try {
  baseUrl = new URL(baseUrlValue);
} catch {
  console.error("[edge] base URL 형식이 올바르지 않습니다.");
  process.exit(1);
}

record("production URL scheme", baseUrl.protocol === "https:", baseUrl.protocol);
const origin = baseUrl.origin;
const previousState = await readPreviousState();
let observedInstanceStartedAt = "";

try {
  const httpUrl = new URL(origin);
  httpUrl.protocol = "http:";
  const response = await request(httpUrl, { method: "HEAD" });
  const location = response.headers.get("location");
  const redirectUrl = location ? new URL(location, httpUrl) : undefined;
  const redirected = [301, 302, 307, 308].includes(response.status) && redirectUrl?.protocol === "https:";
  record("HTTP to HTTPS redirect", redirected, `HTTP ${response.status}`);
} catch (error) {
  record("HTTP to HTTPS redirect", false, error instanceof Error ? error.message : "요청 실패");
}

try {
  const response = await request(origin, { method: "HEAD" });
  record("HTTPS root", response.ok, `HTTP ${response.status}`);
  const hsts = response.headers.get("strict-transport-security") || "";
  const maxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
  record("HSTS", maxAge > 0, hsts || "header 없음");
} catch (error) {
  record("HTTPS root", false, error instanceof Error ? error.message : "요청 실패");
}

for (const endpoint of ["/health/live", "/health/ready"]) {
  try {
    const response = await request(new URL(endpoint, origin));
    const body = await responseJson(response);
    record(endpoint, response.ok && body?.ok === true, `HTTP ${response.status}`);
    if (endpoint === "/health/live" && response.ok) {
      const gitSha = typeof body?.build?.gitSha === "string" ? body.build.gitSha : "";
      record("build metadata", Boolean(gitSha && gitSha !== "unknown"), gitSha ? "Git SHA 확인" : "Git SHA 없음");
      observedInstanceStartedAt = typeof body?.startedAt === "string" ? body.startedAt : "";
      record("instance metadata", Boolean(Date.parse(observedInstanceStartedAt)), observedInstanceStartedAt ? "startedAt 확인" : "startedAt 없음");
    }
  } catch (error) {
    record(endpoint, false, error instanceof Error ? error.message : "요청 실패");
  }
}

if (restartAlertEnabled) {
  const previousInstanceStartedAt = typeof previousState?.instanceStartedAt === "string" ? previousState.instanceStartedAt : "";
  const restarted = Boolean(previousInstanceStartedAt && observedInstanceStartedAt && previousInstanceStartedAt !== observedInstanceStartedAt);
  record(
    "server restart",
    Boolean(observedInstanceStartedAt) && !restarted,
    restarted ? "이전 점검 이후 instance startedAt이 변경되었습니다." : "instance 변경 없음"
  );
}

try {
  const response = await request(new URL("/dashboard/config.js", origin));
  const body = await response.text();
  const cacheControl = response.headers.get("cache-control") || "";
  const cdnCacheControl = response.headers.get("cloudflare-cdn-cache-control") || response.headers.get("cdn-cache-control") || "";
  record("runtime config response", response.ok, `HTTP ${response.status}`);
  record("runtime config cache", /no-store/i.test(cacheControl) && /no-store/i.test(cdnCacheControl), `Cache-Control=${cacheControl || "없음"}`);
  record("legal runtime config", /["']?configured["']?\s*:\s*true/.test(body), "configured=true 확인");
} catch (error) {
  record("runtime config response", false, error instanceof Error ? error.message : "요청 실패");
}

for (const pathname of ["/privacy", "/terms", "/favicon.png", "/robots.txt", "/sitemap.xml"]) {
  await checkStatic(origin, pathname);
}
await checkBackupFreshness();
await checkDiskUsage();

const failuresBeforeAlert = checks.filter((check) => !check.ok).map((check) => check.name);
const checkedAt = new Date().toISOString();
const result = { ok: failuresBeforeAlert.length === 0, checkedAt, failures: failuresBeforeAlert };
const lastNotifiedAt = await notifyIfNeeded(result, previousState);
const finalFailures = checks.filter((check) => !check.ok).map((check) => check.name);
const finalResult = {
  ok: finalFailures.length === 0,
  checkedAt,
  origin,
  failures: finalFailures,
  checks
};
await writeMonitorState({
  ok: finalResult.ok,
  checkedAt,
  failures: finalFailures,
  lastNotifiedAt,
  instanceStartedAt: observedInstanceStartedAt || previousState?.instanceStartedAt
});

if (reportPath) {
  const absolutePath = path.resolve(reportPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolutePath, `${JSON.stringify(finalResult, null, 2)}\n`, { mode: 0o600 });
  console.log(`[edge] report 저장: ${absolutePath}`);
}

  if (finalFailures.length) {
    console.error(`[edge] 운영 점검 실패: ${finalFailures.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("[edge] 운영 edge, health, 정적 파일 점검을 통과했습니다.");
  }
}
