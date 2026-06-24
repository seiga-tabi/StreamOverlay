import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { appConfig, assertRuntimeConfig, originAllowed } from "./config.js";
import { EventBus } from "./core/event-bus.js";
import { ActionDispatcher } from "./core/action-dispatcher.js";
import { JsonlLogger } from "./logging/jsonl-logger.js";
import { Store } from "./services/store.js";
import { OverlayHub } from "./services/overlay-hub.js";
import { DashboardHub } from "./services/dashboard-hub.js";
import { BridgeManager } from "./services/bridge-manager.js";
import { TwitchApiClient } from "./services/twitch-api.js";
import { TwitchEventSubClient } from "./services/twitch-eventsub-client.js";
import { TwitchAuthChatTokenProvider, TwitchChatService } from "./services/twitch-chat-service.js";
import { TwitchAuthService, TwitchOAuthStateStore } from "./services/twitch-auth.js";
import { LocalJsonTwitchTokenStore } from "./services/twitch-token-store.js";
import { RiotApiClient } from "./services/riot-api.js";
import { LocalJsonRiotApiKeyStore } from "./services/riot-api-key-store.js";
import { DataDragonService } from "./services/data-dragon.js";
import { LolProfileEnrichmentService } from "./services/lol-profile-enrichment.js";
import { LocalJsonLolProfileRepository } from "./services/lol-profile-store.js";
import { LocalTtsService } from "./services/local-tts-service.js";
import { createHttpHandler } from "./routes/http-api.js";
import { DashboardSessionStore, authenticateDashboardRequest, clientIp, tokenMatches } from "./security/auth.js";
import { websocketLimiter } from "./security/rate-limit.js";
import { getEnabledModules } from "./modules/index.js";
import { refreshLolProfileForEntry } from "./modules/lol-profile-enrichment.module.js";
import { newId, nowIso, toSafeErrorMessage } from "@streamops/shared";

assertRuntimeConfig();

const logger = new JsonlLogger(appConfig.paths.logs);
const store = new Store({ followerStatePath: `${appConfig.paths.state}/followers.json` });
const sessions = new DashboardSessionStore();
const events = new EventBus();
const dashboard = new DashboardHub(store);
const overlay = new OverlayHub(logger, store, () => dashboard.broadcastSnapshot());
const bridge = new BridgeManager(logger, store, dashboard);
const twitchTokenStore = new LocalJsonTwitchTokenStore(appConfig.twitch.tokenStorePath);
const twitchAuth = new TwitchAuthService(twitchTokenStore, new TwitchOAuthStateStore());
const twitch = new TwitchApiClient(twitchAuth);
const twitchChat = new TwitchChatService(new TwitchAuthChatTokenProvider(twitchAuth), logger, store);
const riotApiKeyStore = new LocalJsonRiotApiKeyStore();
const riot = new RiotApiClient(riotApiKeyStore);
logger.event({ type: "riot.config", ...riot.routingStatus() });
const dataDragon = new DataDragonService();
const lolProfileRepository = new LocalJsonLolProfileRepository(`${appConfig.paths.state}/lol-profiles.json`);
const lolProfileEnrichment = new LolProfileEnrichmentService(riot, dataDragon, lolProfileRepository, logger);
const localTts = new LocalTtsService(logger);
const actions = new ActionDispatcher(bridge, twitchChat, overlay, store, logger, () => dashboard.broadcastSnapshot(), localTts);

const moduleContext = { events, actions, logger, store, overlay, dashboard, twitch, riot, lolProfileEnrichment };
for (const module of getEnabledModules()) {
  await module.setup(moduleContext);
  logger.event({ type: "module.loaded", module: module.name });
}

events.onAny((event) => {
  store.addEvent(event);
  if (event.type === "twitch.follow") {
    store.recordFollower({
      userId: event.userId,
      userName: event.userName,
      followedAt: event.followedAt ?? event.createdAt,
      source: "eventsub"
    });
  }
  if (event.type === "twitch.chatMessage") {
    store.recordFollowerActivity({
      userId: event.chatterUserId,
      userName: event.chatterUserName,
      kind: "chat",
      genre: "채팅 참여"
    });
  }
  if (event.type === "participation.entryCreated") {
    store.recordFollowerActivity({
      userId: event.twitchUserId,
      userName: event.twitchUserName,
      kind: "participation",
      genre: "League of Legends 시참"
    });
  }
  logger.event({ eventType: event.type, event });
  dashboard.broadcastSnapshot();
});

events.onHandlerError(({ type, error }) => {
  logger.error({ type: "event.handler_error", eventType: type, error: toSafeErrorMessage(error) });
});

const twitchEventSub = new TwitchEventSubClient(events, twitch, store, logger);
const server = http.createServer(createHttpHandler({
  store,
  actions,
  twitch,
  riot,
  dataDragon,
  twitchAuth,
  eventSub: twitchEventSub,
  refreshLolProfile: (entryId) => refreshLolProfileForEntry(moduleContext, entryId),
  sessions
}));

const bridgeWss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const overlayWss = new WebSocketServer({ noServer: true });

function tokenFromAuthorization(req: http.IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}

function headerToken(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function legacyQueryToken(url: URL): string | undefined {
  if (!appConfig.security.allowLegacyWsQueryAuth || appConfig.nodeEnv === "production") return undefined;
  return url.searchParams.get("token") ?? url.searchParams.get("secret") ?? undefined;
}

function hasDashboardWsAuth(req: http.IncomingMessage, url: URL): boolean {
  return Boolean(authenticateDashboardRequest(req, sessions))
    || tokenMatches(appConfig.security.dashboardAuthToken, legacyQueryToken(url));
}

function hasBridgeWsAuth(req: http.IncomingMessage, url: URL): boolean {
  return tokenMatches(appConfig.bridge.sharedSecret, tokenFromAuthorization(req))
    || tokenMatches(appConfig.bridge.sharedSecret, headerToken(req.headers["x-streamops-bridge-secret"]))
    || tokenMatches(appConfig.bridge.sharedSecret, legacyQueryToken(url));
}

function wsOriginAllowed(req: http.IncomingMessage): boolean {
  const origin = headerToken(req.headers.origin);
  if (!origin) return true;
  return originAllowed(origin);
}

function writeUpgradeError(socket: Duplex, status: 401 | 403 | 429): void {
  const text = status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Too Many Requests";
  socket.write(`HTTP/1.1 ${status} ${text}\r\n\r\n`);
  socket.destroy();
}

function rateLimitUpgrade(req: http.IncomingMessage, pathname: string): boolean {
  const result = websocketLimiter.check(`${clientIp(req)}:${pathname}`);
  return result.ok;
}

function attachOverlayAfterAuthentication(socket: import("ws").WebSocket, channel: string | null): void {
  if (!appConfig.security.overlayAccessToken) {
    overlay.add(socket, channel);
    return;
  }

  const timer = setTimeout(() => {
    socket.close(1008, "authentication required");
  }, 5000);

  const authenticate = (raw: import("ws").RawData) => {
    try {
      const parsed = JSON.parse(raw.toString()) as { type?: unknown; token?: unknown };
      if (parsed.type !== "overlay.auth" || typeof parsed.token !== "string" || !tokenMatches(appConfig.security.overlayAccessToken, parsed.token)) {
        socket.close(1008, "authentication failed");
        return;
      }
      clearTimeout(timer);
      socket.off("message", authenticate);
      overlay.add(socket, channel);
    } catch {
      socket.close(1008, "authentication failed");
    }
  };

  socket.on("message", authenticate);
}

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (!rateLimitUpgrade(req, url.pathname)) {
    writeUpgradeError(socket, 429);
    return;
  }
  if (url.pathname === "/bridge") {
    if (!hasBridgeWsAuth(req, url)) {
      writeUpgradeError(socket, 401);
      return;
    }
    bridgeWss.handleUpgrade(req, socket, head, (ws) => bridgeWss.emit("connection", ws, req));
    return;
  }
  if (url.pathname === "/ws/dashboard") {
    if (!wsOriginAllowed(req)) {
      writeUpgradeError(socket, 403);
      return;
    }
    if (!hasDashboardWsAuth(req, url)) {
      writeUpgradeError(socket, 401);
      return;
    }
    dashboardWss.handleUpgrade(req, socket, head, (ws) => dashboardWss.emit("connection", ws, req));
    return;
  }
  if (url.pathname === "/ws/overlay") {
    if (!wsOriginAllowed(req)) {
      writeUpgradeError(socket, 403);
      return;
    }
    overlayWss.handleUpgrade(req, socket, head, (ws) => overlayWss.emit("connection", ws, req));
    return;
  }
  socket.destroy();
});

bridgeWss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const name = url.searchParams.get("name") ?? "broadcast-pc";
  bridge.attach(socket, name);
  events.emit({ type: "bridge.connected", id: newId("event"), createdAt: nowIso(), payload: { name } });
});

dashboardWss.on("connection", (socket) => dashboard.add(socket));
overlayWss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const channel = url.searchParams.get("channel") ?? url.searchParams.get("mode");
  const legacyToken = legacyQueryToken(url);
  if (legacyToken && tokenMatches(appConfig.security.overlayAccessToken, legacyToken)) {
    overlay.add(socket, channel);
    return;
  }
  attachOverlayAfterAuthentication(socket, channel);
});

twitchEventSub.start();

server.listen(appConfig.port, () => {
  logger.event({ type: "server.started", port: appConfig.port });
  console.log(`StreamOps server listening on http://localhost:${appConfig.port}`);
  console.log(`Bridge WS: ws://localhost:${appConfig.port}/bridge?name=main`);
});
