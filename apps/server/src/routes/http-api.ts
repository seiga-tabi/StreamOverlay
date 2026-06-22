import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import type { Store } from "../services/store.js";
import type { ActionDispatcher } from "../core/action-dispatcher.js";
import { normalizeLolRole, parseRiotIdDetailed, toSafeErrorMessage, validateBotAction, type BotAction } from "@streamops/shared";
import type { TwitchAuthService } from "../services/twitch-auth.js";
import type { TwitchApiClient } from "../services/twitch-api.js";
import type { RiotApiClient } from "../services/riot-api.js";
import { appConfig } from "../config.js";
import type { TwitchEventSubClient } from "../services/twitch-eventsub-client.js";
import { getRewardMappingSummaries } from "../modules/rewards.module.js";
import { loadGameMonitorConfig, restartActiveLolGameMonitor, saveGameMonitorConfig, type LolGameMonitorConfig } from "../modules/lol-game-monitor.module.js";
import {
  ALERT_OVERLAY_KEYS,
  alertAssetRoot,
  isAlertOverlayKey,
  isSafeAlertMediaUrl,
  listAlertGifAssets,
  loadAlertOverlayConfig,
  saveAlertOverlayPreset,
  type AlertOverlayKey
} from "../services/alert-overlay-config.js";
import {
  DashboardSessionStore,
  authenticateDashboardRequest,
  authorizeHttpRequest,
  clearDashboardSessionCookie,
  clientIp,
  dashboardSessionCookie,
  dashboardSessionIdFromRequest
} from "../security/auth.js";
import { dashboardApiLimiter, dashboardLoginLimiter, oauthLimiter } from "../security/rate-limit.js";

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_ALERT_GIF_BYTES = 5_000_000;
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
};

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: Record<string, unknown>
  ) {
    super(String(payload.error ?? "request error"));
    this.name = "HttpRequestError";
  }
}

async function readRawBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new HttpRequestError(413, { error: "request body가 너무 큽니다." });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<string> {
  return (await readRawBody(req, maxBytes)).toString("utf8");
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw.trim()) throw new HttpRequestError(400, { error: "JSON body가 필요합니다." });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpRequestError(400, { error: "올바른 JSON body가 아닙니다." });
  }
}

function isDevLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
}

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const requestHeaders = req.headers ?? {};
  const origin = requestHeaders.origin;
  const responseHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-StreamOps-Dashboard-Token, X-StreamOps-CSRF",
    "Vary": "Origin"
  };
  if (typeof origin === "string") {
    const allowed = appConfig.security.corsOrigins.includes(origin) || (appConfig.nodeEnv !== "production" && isDevLocalOrigin(origin));
    if (allowed) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
      responseHeaders["Access-Control-Allow-Credentials"] = "true";
    }
  }
  return responseHeaders;
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store"
  };
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, payload: unknown, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...SECURITY_HEADERS,
    ...noStoreHeaders(),
    ...corsHeaders(req),
    ...headers
  });
  if (req.method === "HEAD" || status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { ...SECURITY_HEADERS, Location: location });
  res.end();
}

function originFor(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "'self'";
  }
}

function wsOriginFor(value: string): string {
  try {
    const url = new URL(value);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return "'self'";
  }
}

function cspForStaticApp(mountPath: "/dashboard" | "/overlay"): string {
  if (mountPath === "/dashboard") {
    return [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https:",
      `connect-src 'self' ${originFor(appConfig.publicBaseUrl)} ${wsOriginFor(appConfig.publicBaseUrl)}`,
      `frame-src 'self' ${originFor(appConfig.overlayBaseUrl)}`,
      "frame-ancestors 'self'",
      "form-action 'self'"
    ].join("; ");
  }
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    `connect-src 'self' ${originFor(appConfig.publicBaseUrl)} ${wsOriginFor(appConfig.publicBaseUrl)}`,
    "frame-ancestors 'self'",
    "form-action 'none'"
  ].join("; ");
}

function staticSecurityHeaders(filePath: string): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  if (appConfig.nodeEnv === "production" && appConfig.publicBaseUrl.startsWith("https://")) {
    headers["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";
  }
  if (filePath.endsWith("index.html")) {
    if (filePath.includes(`${path.sep}dashboard${path.sep}`)) headers["Content-Security-Policy"] = cspForStaticApp("/dashboard");
    if (filePath.includes(`${path.sep}overlay${path.sep}`)) headers["Content-Security-Policy"] = cspForStaticApp("/overlay");
  }
  return headers;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsString(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function publicWsBaseUrl(): string {
  return appConfig.publicBaseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

function dashboardRuntimeConfig(): string {
  return `window.__STREAMOPS_CONFIG__ = {
  apiBase: ${escapeJsString(appConfig.publicBaseUrl)},
  wsBase: ${escapeJsString(publicWsBaseUrl())},
  overlayBase: ${escapeJsString(appConfig.overlayBaseUrl)},
  dashboardAuthRequired: ${appConfig.security.localNoAuth ? "false" : "true"}
};\n`;
}

function overlayRuntimeConfig(): string {
  return `window.__STREAMOPS_CONFIG__ = {
  wsBase: ${escapeJsString(publicWsBaseUrl())}
};\n`;
}

function tokenMatchesDashboardAuth(candidate: string): boolean {
  if (appConfig.security.localNoAuth) return true;
  const token = appConfig.security.dashboardAuthToken;
  if (!token) return false;
  const candidateBuffer = Buffer.from(candidate);
  const tokenBuffer = Buffer.from(token);
  if (candidateBuffer.byteLength !== tokenBuffer.byteLength) return false;
  return crypto.timingSafeEqual(candidateBuffer, tokenBuffer);
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
}

type MultipartPart = {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
};

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function parseContentDisposition(value: string | undefined): { name?: string; filename?: string } {
  if (!value) return {};
  const name = /(?:^|;\s*)name="([^"]*)"/i.exec(value)?.[1];
  const filename = /(?:^|;\s*)filename="([^"]*)"/i.exec(value)?.[1];
  return { name, filename };
}

function parseMultipartBody(req: IncomingMessage, body: Buffer): MultipartPart[] {
  const contentType = Array.isArray(req.headers["content-type"]) ? req.headers["content-type"][0] : req.headers["content-type"];
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new HttpRequestError(400, { error: "multipart boundary가 필요합니다." });

  const raw = body.toString("latin1");
  const chunks = raw.split(`--${boundary}`);
  const parts: MultipartPart[] = [];
  for (const chunk of chunks.slice(1, -1)) {
    const normalized = chunk.startsWith("\r\n") ? chunk.slice(2) : chunk;
    const headerEnd = normalized.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headerLines = normalized.slice(0, headerEnd).split("\r\n");
    const headers = Object.fromEntries(headerLines.map((line) => {
      const index = line.indexOf(":");
      return index < 0 ? ["", ""] : [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
    }).filter(([key]) => key)) as Record<string, string>;
    const disposition = parseContentDisposition(headerValue(headers, "content-disposition"));
    if (!disposition.name) continue;
    let data = normalized.slice(headerEnd + 4);
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    parts.push({
      name: disposition.name,
      filename: disposition.filename,
      contentType: headerValue(headers, "content-type"),
      data: Buffer.from(data, "latin1")
    });
  }
  return parts;
}

function isGifBytes(data: Buffer): boolean {
  const signature = data.subarray(0, 6).toString("ascii");
  return signature === "GIF87a" || signature === "GIF89a";
}

function multipartText(parts: MultipartPart[], name: string): string | undefined {
  const part = parts.find((item) => item.name === name && !item.filename);
  return part ? part.data.toString("utf8").trim() : undefined;
}

function alertConfigResponse() {
  return {
    keys: ALERT_OVERLAY_KEYS,
    config: loadAlertOverlayConfig()
  };
}

function staticEtag(size: number, mtimeMs: number): string {
  return `"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;
}

function isNotModified(req: IncomingMessage, etag: string, mtime: Date): boolean {
  const ifNoneMatch = req.headers?.["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch.split(",").map((value) => value.trim()).includes(etag)) return true;
  const ifModifiedSince = req.headers?.["if-modified-since"];
  if (typeof ifModifiedSince !== "string") return false;
  const since = Date.parse(ifModifiedSince);
  return Number.isFinite(since) && mtime.getTime() <= since;
}

async function sendStaticFile(req: IncomingMessage, res: ServerResponse, filePath: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not found");
    const etag = staticEtag(stat.size, stat.mtimeMs);
    const lastModified = stat.mtime.toUTCString();
    const cacheControl = filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable";
    const baseHeaders = {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": cacheControl,
      "ETag": etag,
      "Last-Modified": lastModified,
      ...staticSecurityHeaders(filePath)
    };
    if (isNotModified(req, etag, stat.mtime)) {
      res.writeHead(304, baseHeaders);
      res.end();
      return;
    }
    const body = await fs.readFile(filePath);
    res.writeHead(200, baseHeaders);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
  }
}

async function sendStaticApp(req: IncomingMessage, res: ServerResponse, pathname: string, mountPath: "/dashboard" | "/overlay", staticDir: string): Promise<boolean> {
  if (pathname !== mountPath && !pathname.startsWith(`${mountPath}/`)) return false;
  if (pathname === `${mountPath}/config.js`) {
    const body = mountPath === "/dashboard" ? dashboardRuntimeConfig() : overlayRuntimeConfig();
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache", ...SECURITY_HEADERS });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(body);
    return true;
  }
  const relative = pathname === mountPath || pathname === `${mountPath}/`
    ? "index.html"
    : decodeURIComponent(pathname.slice(mountPath.length + 1));
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(staticDir, normalized);
  const root = path.resolve(staticDir);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

async function sendOverlayAlertAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith("/alerts/")) return false;
  const uploadPrefix = "/alerts/uploads/";
  const root = pathname.startsWith(uploadPrefix)
    ? path.resolve(alertAssetRoot())
    : path.resolve(appConfig.paths.overlayStatic, "alerts");
  const relative = decodeURIComponent(pathname.slice(pathname.startsWith(uploadPrefix) ? uploadPrefix.length : "/alerts/".length));
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

async function sendLocalTtsAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const configuredPath = appConfig.localTts.publicPath.trim().replace(/\/+$/, "") || "/tts";
  const publicPath = configuredPath.startsWith("/") ? configuredPath : `/${configuredPath}`;
  if (pathname !== publicPath && !pathname.startsWith(`${publicPath}/`)) return false;
  const relative = decodeURIComponent(pathname.slice(publicPath.length + 1));
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const root = path.resolve(appConfig.localTts.cacheDir);
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

function sendSafeOAuthHtml(res: ServerResponse, status: number, title: string, message: string): void {
  const dashboardUrl = escapeHtml(appConfig.dashboardBaseUrl);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
  res.end(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #1f2937; }
      main { max-width: 560px; margin: 12vh auto; padding: 28px; background: #fff; border: 1px solid #e4e7ec; border-radius: 8px; }
      a { color: #2563eb; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p><a href="${dashboardUrl}">대시보드로 돌아가기</a></p>
    </main>
  </body>
</html>`);
}

export function createHttpHandler(input: {
  store: Store;
  actions: ActionDispatcher;
  twitch?: TwitchApiClient;
  riot?: RiotApiClient;
  twitchAuth: TwitchAuthService;
  eventSub?: TwitchEventSubClient;
  refreshLolProfile?: (entryId: string) => Promise<boolean>;
  sessions?: DashboardSessionStore;
}) {
  const sessions = input.sessions ?? new DashboardSessionStore();

  async function getTwitchStatus() {
    const status = await input.twitchAuth.getStatus();
    return {
      ...status,
      eventSub: input.store.getTwitchEventSubStatus(),
      chat: input.store.getTwitchChatStatus()
    };
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) return sendJson(req, res, 404, { error: "not found" });
    if (req.method === "OPTIONS") return sendJson(req, res, 204, {});
    const url = new URL(req.url, "http://localhost");
    const ip = clientIp(req);

    try {
      if (req.method === "GET" || req.method === "HEAD") {
        if (url.pathname === "/dashborad" || url.pathname === "/dashborad/") return sendRedirect(res, "/");
        if (url.pathname === "/") {
          await sendStaticFile(req, res, path.resolve(appConfig.paths.dashboardStatic, "index.html"));
          return;
        }
      }
      if ((req.method === "GET" || req.method === "HEAD") && await sendOverlayAlertAsset(req, res, url.pathname)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendLocalTtsAsset(req, res, url.pathname)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendStaticApp(req, res, url.pathname, "/dashboard", appConfig.paths.dashboardStatic)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendStaticApp(req, res, url.pathname, "/overlay", appConfig.paths.overlayStatic)) return;

      if (url.pathname.startsWith("/api/")) {
        const limitKey = `${ip}:${url.pathname}`;
        const limiter = url.pathname.startsWith("/api/dashboard/auth/") ? dashboardLoginLimiter : url.pathname.startsWith("/api/twitch/auth/") ? oauthLimiter : dashboardApiLimiter;
        const limited = limiter.check(limitKey);
        if (!limited.ok) return sendJson(req, res, 429, { error: "rate limit exceeded" }, { "Retry-After": String(limited.retryAfterSeconds) });
      }

      const auth = authorizeHttpRequest(req, url.pathname, sessions);
      if (!auth.ok) {
        return sendJson(req, res, auth.status, { error: auth.message, code: auth.code });
      }

      if (req.method === "GET" && url.pathname === "/health") return sendJson(req, res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/health/live") return sendJson(req, res, 200, { ok: true, status: "live" });
      if (req.method === "GET" && url.pathname === "/health/ready") return sendJson(req, res, 200, { ok: true, status: "ready" });
      if (req.method === "GET" && url.pathname === "/api/dashboard/auth/status") {
        const principal = authenticateDashboardRequest(req, sessions);
        return sendJson(req, res, 200, {
          required: !appConfig.security.localNoAuth,
          configured: appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
          authenticated: Boolean(principal),
          csrfToken: principal?.type === "DASHBOARD_ADMIN" && principal.method === "session" ? principal.csrfToken : undefined
        });
      }
      if (req.method === "POST" && url.pathname === "/api/dashboard/auth/check") {
        const body = await readJsonBody<{ token?: unknown }>(req);
        const token = typeof body.token === "string" ? body.token : "";
        const authenticated = tokenMatchesDashboardAuth(token);
        if (!authenticated) {
          return sendJson(req, res, 401, {
            required: !appConfig.security.localNoAuth,
            configured: appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
            authenticated: false
          });
        }
        const session = sessions.create();
        return sendJson(req, res, 200, {
          required: !appConfig.security.localNoAuth,
          configured: appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
          authenticated: true,
          csrfToken: session.csrfToken,
          expiresAt: new Date(session.expiresAt).toISOString()
        }, { "Set-Cookie": dashboardSessionCookie(session) });
      }
      if (req.method === "POST" && url.pathname === "/api/dashboard/auth/logout") {
        sessions.revoke(dashboardSessionIdFromRequest(req));
        return sendJson(req, res, 200, { ok: true }, { "Set-Cookie": clearDashboardSessionCookie() });
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/auth/start") {
        const forceVerify = url.searchParams.get("force_verify") === "1" || url.searchParams.get("force_verify") === "true";
        return sendRedirect(res, input.twitchAuth.createAuthorizationUrl(forceVerify));
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/auth/callback") {
        const error = url.searchParams.get("error");
        if (error) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "Twitch 권한 승인이 완료되지 않았습니다. 대시보드에서 다시 시도해주세요.");
        if (!input.twitchAuth.verifyState(url.searchParams.get("state"))) {
          return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth state 검증에 실패했습니다. 대시보드에서 다시 연결을 시작해주세요.");
        }
        const code = url.searchParams.get("code");
        if (!code) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth callback에 필요한 code가 없습니다.");
        try {
          await input.twitchAuth.connectWithCode(code);
          input.eventSub?.reconnect("twitch.oauth.connected");
        } catch {
          return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "Twitch token 교환 또는 방송자 정보 조회에 실패했습니다. 서버 설정을 확인한 뒤 다시 시도해주세요.");
        }
        return sendRedirect(res, `${appConfig.dashboardBaseUrl}?twitch=connected`);
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/status") return sendJson(req, res, 200, await getTwitchStatus());
      if (req.method === "GET" && url.pathname === "/api/twitch/scopes") return sendJson(req, res, 200, input.twitchAuth.getScopes());
      if (req.method === "GET" && url.pathname === "/api/status") return sendJson(req, res, 200, input.store.getStatus());
      if (req.method === "GET" && url.pathname === "/api/overlay/status") return sendJson(req, res, 200, input.store.getOverlayStatus());
      if (req.method === "GET" && url.pathname === "/api/rewards/mappings") return sendJson(req, res, 200, getRewardMappingSummaries());
      if (req.method === "GET" && url.pathname === "/api/alerts/config") {
        return sendJson(req, res, 200, {
          ...alertConfigResponse(),
          assets: await listAlertGifAssets()
        });
      }
      if (req.method === "POST" && url.pathname === "/api/alerts/config") {
        const body = await readJsonBody<{ eventType?: unknown; mediaUrl?: unknown; mediaAlt?: unknown }>(req);
        if (typeof body.eventType !== "string" || !isAlertOverlayKey(body.eventType)) {
          return sendJson(req, res, 400, { error: "eventType이 허용 목록에 없습니다." });
        }
        if (typeof body.mediaUrl !== "string" || !isSafeAlertMediaUrl(body.mediaUrl)) {
          return sendJson(req, res, 400, { error: "mediaUrl은 안전한 /alerts/... 경로여야 합니다." });
        }
        if (body.mediaAlt !== undefined && (typeof body.mediaAlt !== "string" || body.mediaAlt.length > 120)) {
          return sendJson(req, res, 400, { error: "mediaAlt는 120자 이하 문자열이어야 합니다." });
        }
        await saveAlertOverlayPreset(body.eventType, {
          mediaUrl: body.mediaUrl,
          mediaAlt: typeof body.mediaAlt === "string" ? body.mediaAlt : `${body.eventType} alert`
        });
        return sendJson(req, res, 200, {
          ...alertConfigResponse(),
          assets: await listAlertGifAssets()
        });
      }
      if (req.method === "POST" && url.pathname === "/api/alerts/assets") {
        const parts = parseMultipartBody(req, await readRawBody(req, MAX_ALERT_GIF_BYTES + 200_000));
        const file = parts.find((part) => part.name === "file" && part.filename);
        if (!file) return sendJson(req, res, 400, { error: "file 필드가 필요합니다." });
        if (file.data.byteLength < 6 || file.data.byteLength > MAX_ALERT_GIF_BYTES) {
          return sendJson(req, res, 400, { error: "GIF 파일은 1바이트 이상 5MB 이하여야 합니다." });
        }
        if (!isGifBytes(file.data)) return sendJson(req, res, 400, { error: "GIF 파일만 등록할 수 있습니다." });
        const rawEventType = multipartText(parts, "eventType") ?? "alert";
        const eventType: AlertOverlayKey | "alert" = isAlertOverlayKey(rawEventType) ? rawEventType : "alert";
        const fileName = `${eventType}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.gif`;
        const root = alertAssetRoot();
        await fs.mkdir(root, { recursive: true });
        const filePath = path.join(root, fileName);
        await fs.writeFile(filePath, file.data, { mode: 0o644 });
        return sendJson(req, res, 200, {
          fileName,
          url: `/alerts/uploads/${fileName}`,
          size: file.data.byteLength
        });
      }
      if (req.method === "GET" && url.pathname === "/api/events/recent") return sendJson(req, res, 200, input.store.recentEvents(50));
      if (req.method === "GET" && url.pathname === "/api/actions/recent") return sendJson(req, res, 200, input.store.recentActions(50));
      if (req.method === "GET" && url.pathname === "/api/questions") return sendJson(req, res, 200, input.store.getQuestions());
      if (req.method === "GET" && url.pathname === "/api/highlights") return sendJson(req, res, 200, input.store.getHighlights());
      if (req.method === "GET" && url.pathname === "/api/followers") return sendJson(req, res, 200, input.store.getFollowerManagementState());
      if (req.method === "GET" && url.pathname === "/api/riot/settings") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        return sendJson(req, res, 200, input.riot.credentialStatus());
      }
      if (req.method === "GET" && url.pathname === "/api/participation/queue") return sendJson(req, res, 200, input.store.getParticipationQueue());
      if (req.method === "GET" && url.pathname === "/api/participation/state") return sendJson(req, res, 200, input.store.getParticipationState());
      if (req.method === "GET" && url.pathname === "/api/participation/game-monitor") return sendJson(req, res, 200, loadGameMonitorConfig());

      if (req.method === "POST" && url.pathname === "/api/participation/game-monitor") {
        const body = await readJsonBody<Partial<LolGameMonitorConfig>>(req);
        const patch: Partial<LolGameMonitorConfig> = {};
        if (body.streamerRiotId !== undefined) {
          if (typeof body.streamerRiotId !== "string") return sendJson(req, res, 400, { error: "streamerRiotId는 문자열이어야 합니다." });
          const streamerRiotId = body.streamerRiotId.trim();
          if (streamerRiotId) {
            const parsed = parseRiotIdDetailed(streamerRiotId);
            if (!parsed.ok) return sendJson(req, res, 400, { error: parsed.message });
            patch.streamerRiotId = `${parsed.gameName}#${parsed.tagLine}`;
          } else {
            patch.streamerRiotId = "";
          }
        }
        for (const key of ["enabled", "autoSelectNextAfterGame", "announceInChat"] as const) {
          if (body[key] === undefined) continue;
          if (typeof body[key] !== "boolean") return sendJson(req, res, 400, { error: `${key}는 boolean이어야 합니다.` });
          patch[key] = body[key];
        }
        const saved = saveGameMonitorConfig(patch);
        await restartActiveLolGameMonitor(saved);
        return sendJson(req, res, 200, saved);
      }

      if (req.method === "POST" && url.pathname === "/api/participation/profile/refresh") {
        const body = await readJsonBody<{ entryId?: string }>(req);
        if (!body.entryId) return sendJson(req, res, 400, { error: "entryId가 필요합니다." });
        const refreshed = await input.refreshLolProfile?.(body.entryId);
        if (!refreshed) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없거나 refresh를 사용할 수 없습니다." });
        return sendJson(req, res, 200, input.store.getParticipationState());
      }

      if (req.method === "POST" && url.pathname === "/api/followers/refresh") {
        if (!input.twitch) return sendJson(req, res, 503, { error: "Twitch API client를 사용할 수 없습니다." });
        const limit = Number(url.searchParams.get("limit") ?? "5000");
        let snapshot: Awaited<ReturnType<TwitchApiClient["getChannelFollowers"]>>;
        try {
          snapshot = await input.twitch.getChannelFollowers(Number.isFinite(limit) ? limit : 5000);
        } catch (error) {
          return sendJson(req, res, 400, { error: toSafeErrorMessage(error) });
        }
        const state = input.store.reconcileFollowerSnapshot({
          followers: snapshot.followers,
          total: snapshot.total,
          truncated: snapshot.truncated
        });
        return sendJson(req, res, 200, state);
      }

      if (req.method === "POST" && url.pathname === "/api/riot/api-key") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        const body = await readJsonBody<{ apiKey?: unknown }>(req);
        if (typeof body.apiKey !== "string") return sendJson(req, res, 400, { error: "Riot API key는 문자열이어야 합니다." });
        try {
          return sendJson(req, res, 200, input.riot.setRuntimeApiKey(body.apiKey));
        } catch (error) {
          return sendJson(req, res, 400, { error: toSafeErrorMessage(error) });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/riot/api-key/delete") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        return sendJson(req, res, 200, input.riot.clearRuntimeApiKey());
      }

      if (req.method === "POST" && url.pathname === "/api/participation/role-override") {
        const body = await readJsonBody<{ entryId?: string; role?: string }>(req);
        if (!body.entryId || !body.role) return sendJson(req, res, 400, { error: "entryId와 role이 필요합니다." });
        const role = normalizeLolRole(body.role);
        if (role === "unknown") return sendJson(req, res, 400, { error: "허용되지 않은 role입니다." });
        const updated = input.store.setParticipationRequestedRole(body.entryId, role);
        if (!updated) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        await input.actions.dispatchOne({
          type: "overlay.participationQueue",
          isOpen: input.store.getStatus().participation === "open",
          queue: input.store.getParticipationOverlayQueue()
        }, {}, "dashboard.role_override");
        return sendJson(req, res, 200, input.store.getParticipationState());
      }

      if (req.method === "POST" && url.pathname === "/api/actions/test") {
        const body = await readJsonBody<{ action: BotAction }>(req);
        const validation = validateBotAction(body.action);
        if (!validation.ok) return sendJson(req, res, 400, validation);
        await input.actions.dispatchOne(body.action, { user: "dashboard", input: "" }, "dashboard.test");
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/auth/disconnect") {
        await input.twitchAuth.disconnect();
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/token/refresh") {
        await input.twitchAuth.refreshStoredToken();
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/eventsub/reconnect") {
        input.eventSub?.reconnect("dashboard.admin");
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      return sendJson(req, res, 404, { error: "not found" });
    } catch (error) {
      if (error instanceof HttpRequestError) return sendJson(req, res, error.status, error.payload);
      void error;
      return sendJson(req, res, 500, { error: "서버 내부 오류" });
    }
  };
}
