import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));

function readOption(name, fallback = "") {
  const prefix = `${name}=`;
  const match = [...args].find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const baseUrlValue = readOption("--base-url", process.env.STAGING_BASE_URL || "");
const reportPath = readOption("--report");
const timeoutMs = Number(process.env.STAGING_HTTP_TIMEOUT_MS || 15_000);
const riotId = process.env.STAGING_RIOT_ID || "";
const dashboardToken = process.env.STAGING_DASHBOARD_TOKEN || "";
const requireIntegrations = args.has("--require-integrations");
const requireObs = args.has("--require-obs");
const allowHttp = args.has("--allow-http");
const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`[staging] ${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function request(url, init = {}) {
  return fetch(url, {
    ...init,
    redirect: init.redirect || "manual",
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000)
  });
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function checkPage(origin, pathname) {
  try {
    const response = await request(new URL(pathname, origin), { method: "HEAD" });
    record(`page ${pathname}`, response.ok, `HTTP ${response.status}`);
  } catch (error) {
    record(`page ${pathname}`, false, error instanceof Error ? error.message : "요청 실패");
  }
}

async function checkJson(origin, pathname, predicate = (body) => body !== undefined) {
  try {
    const response = await request(new URL(pathname, origin));
    const body = await json(response);
    record(`API ${pathname.split("?")[0]}`, response.ok && predicate(body), `HTTP ${response.status}`);
    return body;
  } catch (error) {
    record(`API ${pathname.split("?")[0]}`, false, error instanceof Error ? error.message : "요청 실패");
    return undefined;
  }
}

if (!baseUrlValue) {
  console.error("[staging] --base-url=https://host 또는 STAGING_BASE_URL이 필요합니다.");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(baseUrlValue);
} catch {
  console.error("[staging] base URL 형식이 올바르지 않습니다.");
  process.exit(1);
}

if (!allowHttp && baseUrl.protocol !== "https:") {
  console.error("[staging] staging URL은 https://를 사용해야 합니다. 로컬 점검만 --allow-http를 사용하세요.");
  process.exit(1);
}

const origin = baseUrl.origin;
await checkJson(origin, "/health/live", (body) => body?.ok === true && Boolean(body?.build?.gitSha) && body.build.gitSha !== "unknown");
await checkJson(origin, "/health/ready", (body) => body?.ok === true && body?.checks?.acceptingRequests === true);

for (const pathname of ["/", "/privacy", "/terms", "/lol/tournaments"]) {
  await checkPage(origin, pathname);
}

await checkJson(origin, "/api/public/locale", (body) => body?.locale === "ko" || body?.locale === "ja");
await checkJson(origin, "/api/public/tournaments", (body) => Array.isArray(body?.tournaments));
await checkJson(origin, "/api/public/community/posts?limit=1", (body) => Array.isArray(body?.posts));
await checkJson(origin, "/api/public/participation/state", (body) => Boolean(body && typeof body === "object"));
await checkJson(origin, "/api/public/twitch/status", (body) => Boolean(body && typeof body === "object"));

try {
  const response = await request(new URL("/api/public/twitch/auth/start", origin));
  const location = response.headers.get("location");
  const target = location ? new URL(location, origin) : undefined;
  record("Twitch OAuth redirect", [301, 302, 303, 307, 308].includes(response.status) && target?.hostname === "id.twitch.tv", `HTTP ${response.status}`);
} catch (error) {
  record("Twitch OAuth redirect", false, error instanceof Error ? error.message : "요청 실패");
}

if (riotId) {
  await checkJson(origin, `/api/lol/profile?riotId=${encodeURIComponent(riotId)}`, (body) => Boolean(body?.profile || body?.summoner || body?.riotId));
} else {
  record("Riot production profile", !requireIntegrations, "STAGING_RIOT_ID 미설정");
}

if (dashboardToken) {
  const headers = { Authorization: `Bearer ${dashboardToken}` };
  try {
    const statusResponse = await request(new URL("/api/status", origin), { headers });
    const status = await json(statusResponse);
    const statusOk = statusResponse.ok && Boolean(status && typeof status === "object");
    record("dashboard authenticated status", statusOk, `HTTP ${statusResponse.status}`);
    if (requireObs) {
      record("OBS bridge", status?.bridge === "connected", `bridge=${status?.bridge || "unknown"}`);
      record("OBS connection", status?.obs === "connected", `obs=${status?.obs || "unknown"}`);
    }
  } catch (error) {
    record("dashboard authenticated status", false, error instanceof Error ? error.message : "요청 실패");
  }

  try {
    const overlayResponse = await request(new URL("/api/overlay/status", origin), { headers });
    const overlay = await json(overlayResponse);
    record("overlay status", overlayResponse.ok && Boolean(overlay?.clientsByChannel), `HTTP ${overlayResponse.status}`);
  } catch (error) {
    record("overlay status", false, error instanceof Error ? error.message : "요청 실패");
  }
} else {
  record("dashboard and overlay auth", !requireIntegrations && !requireObs, "STAGING_DASHBOARD_TOKEN 미설정");
}

const report = {
  checkedAt: new Date().toISOString(),
  origin,
  ok: checks.every((check) => check.ok),
  checks,
  manualChecksRequired: [
    "Twitch 운영 계정으로 OAuth 로그인과 scope 확인",
    "EventSub 실제 follow/subscription/cheer 이벤트 수신",
    "OBS Browser Source 렌더와 WebSocket 재연결",
    "시청자 참여 신청·취소·체크인 전체 흐름"
  ]
};

if (reportPath) {
  const absolutePath = path.resolve(reportPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[staging] report 저장: ${absolutePath}`);
}

if (!report.ok) {
  console.error(`[staging] smoke 실패: ${checks.filter((check) => !check.ok).map((check) => check.name).join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("[staging] 자동 smoke를 통과했습니다. 운영 계정 상호작용 항목은 수동 검증이 필요합니다.");
}
