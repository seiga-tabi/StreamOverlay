import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));

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
const alertRepeatMinutes = positiveNumber(process.env.OPS_ALERT_REPEAT_MINUTES, 60);
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
  let webhook;
  try {
    webhook = new URL(alertWebhookUrl);
  } catch {
    record("alert webhook", false, "OPS_ALERT_WEBHOOK_URL 형식이 올바르지 않습니다.");
    return undefined;
  }
  if (webhook.protocol !== "https:") {
    record("alert webhook", false, "alert webhook은 https:// URL이어야 합니다.");
    return undefined;
  }

  const previousNotifiedAt = Date.parse(previousState?.lastNotifiedAt || "");
  const repeatElapsed = !Number.isFinite(previousNotifiedAt) || Date.now() - previousNotifiedAt >= alertRepeatMinutes * 60_000;
  const changed = typeof previousState?.ok === "boolean" && previousState.ok !== result.ok;
  if (result.ok && !changed) return previousState?.lastNotifiedAt;
  if (!result.ok && !changed && !repeatElapsed) return previousState?.lastNotifiedAt;

  const summary = result.ok
    ? "YORO.gg 운영 상태가 정상으로 복구되었습니다."
    : `YORO.gg 운영 점검 실패: ${result.failures.join(", ")}`;
  try {
    const response = await request(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: summary,
        content: summary,
        service: "YORO.gg",
        ok: result.ok,
        checkedAt: result.checkedAt,
        failures: result.failures
      })
    });
    record("alert webhook", response.ok, `HTTP ${response.status}`);
    return response.ok ? new Date().toISOString() : previousState?.lastNotifiedAt;
  } catch (error) {
    record("alert webhook", false, error instanceof Error ? error.message : "alert 전송 실패");
    return previousState?.lastNotifiedAt;
  }
}

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
    }
  } catch (error) {
    record(endpoint, false, error instanceof Error ? error.message : "요청 실패");
  }
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
const previousState = await readPreviousState();
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
await writeMonitorState({ ok: finalResult.ok, checkedAt, failures: finalFailures, lastNotifiedAt });

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
