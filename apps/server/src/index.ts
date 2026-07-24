import http from "node:http";
import type { Socket } from "node:net";
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
import { PublicTwitchAuthService, PublicTwitchViewerSessionStore } from "./services/public-twitch-auth.js";
import { LocalJsonTwitchTokenStore } from "./services/twitch-token-store.js";
import { LocalJsonStreamerFollowerTokenStore } from "./services/streamer-follower-token-store.js";
import { StreamerFollowerAuthService } from "./services/streamer-follower-auth.js";
import { RiotApiClient } from "./services/riot-api.js";
import { LocalJsonRiotApiKeyStore } from "./services/riot-api-key-store.js";
import { DataDragonService } from "./services/data-dragon.js";
import { LolProfileEnrichmentService } from "./services/lol-profile-enrichment.js";
import { LocalJsonLolProfileRepository } from "./services/lol-profile-store.js";
import { LocalTtsService } from "./services/local-tts-service.js";
import { SupportMailboxStore } from "./services/support-mailbox-store.js";
import { loadPalworldDataService, type PalworldDataService } from "./services/palworld-data.js";
import { PalworldPaldexValidationError } from "./data/palworld-paldex-artifact.js";
import {
  loadPalworldActiveRuntime,
  PalworldActiveRuntimeError
} from "./data/palworld-active-runtime.js";
import {
  loadPalworldMapMarkerProvider,
  PalworldMapMarkerArtifactError,
  type PalworldMapMarkerProvider
} from "./data/palworld-map-marker-artifact.js";
import { PalworldServerClient } from "./services/palworld-server-client.js";
import {
  PalworldServerConnectionStore,
  PalworldServerConnectionStoreError
} from "./services/palworld-server-connection-store.js";
import { PalworldServerMonitor } from "./services/palworld-server-monitor.js";
import {
  PalworldServerStatusConfigError,
  loadPalworldServerStatusConfig,
  palworldServerStatusAvailabilityCode
} from "./services/palworld-server-status-config.js";
import { recordFollowerManagementEvent } from "./services/follower-event-recorder.js";
import { createHttpHandler } from "./routes/http-api.js";
import { DashboardSessionStore, authenticateDashboardRequest, clientIp, tokenMatches, type DashboardRole } from "./security/auth.js";
import { websocketLimiter } from "./security/rate-limit.js";
import { getEnabledModules } from "./modules/index.js";
import { refreshLolProfileForEntry } from "./modules/lol-profile-enrichment.module.js";
import { closeLolGameMonitors } from "./modules/lol-game-monitor.module.js";
import {
  PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
  newId,
  nowIso,
  toSafeErrorMessage,
  type PalworldServerAvailabilityErrorCode,
  type PalworldServerRegistrationPolicy
} from "@streamops/shared";

assertRuntimeConfig();

const logger = new JsonlLogger(appConfig.paths.logs, appConfig.logging);
let palworldDataService: PalworldDataService | undefined;
let palworldMapMarkerProvider: PalworldMapMarkerProvider | undefined;
try {
  palworldDataService = await loadPalworldDataService({
    dashboardStaticRoot: appConfig.paths.dashboardStatic,
    onTranslationState(locale, state) {
      const entry = {
        type: "palworld_translation.runtime_state",
        locale,
        status: state.status,
        ...(state.errorCode === undefined ? {} : { errorCode: state.errorCode }),
        staleSourceHash: state.staleSourceHash
      };
      if (state.status === "loaded") logger.event(entry);
      else logger.error(entry);
    },
    onBreedingState(state) {
      const entry = {
        type: "palworld_breeding.runtime_state",
        release: state.release,
        status: state.status,
        ...(state.errorCode === undefined ? {} : { errorCode: state.errorCode }),
        ...(state.artifactChecksum === undefined ? {} : {
          artifactChecksum: state.artifactChecksum
        })
      };
      if (state.status === "loaded") logger.event(entry);
      else logger.error(entry);
    }
  });
  const meta = palworldDataService.meta();
  logger.event({
    type: "palworld_data.runtime_ready",
    gameVersion: meta.metadata.gameVersion,
    sourceRevision: meta.metadata.sourceRevision,
    pals: meta.counts.pals,
    breedingPairs: meta.counts.breedingPairs,
    breedingDomain: meta.domains.breeding.status,
    dataIntegrityGate: meta.gates.dataIntegrity.status,
    imageAssetGate: meta.gates.imageAssets.status,
    fallbackPals: meta.gates.imageAssets.fallbackPals
  });
  try {
    const activeRuntime = await loadPalworldActiveRuntime();
    palworldMapMarkerProvider = await loadPalworldMapMarkerProvider({
      releaseRoot: activeRuntime.releaseRoot,
      dashboardStaticRoot: appConfig.paths.dashboardStatic,
      palworldDataService
    });
    const mainMap = palworldMapMarkerProvider.response("main", meta.metadata);
    logger.event({
      type: "palworld_map_markers.runtime_state",
      status: mainMap.state,
      world: "main",
      markers: mainMap.markers.length,
      ...(mainMap.overlay === undefined
        ? {}
        : {
            archiveSha256: mainMap.overlay.archiveSha256,
            transformRevision: mainMap.overlay.transformRevision
          })
    });
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "PALWORLD_MAP_MARKER_ARTIFACT_MISSING"
      : error instanceof PalworldMapMarkerArtifactError
        ? error.code
        : "PALWORLD_MAP_MARKER_INITIALIZATION_FAILED";
    logger.event({
      type: "palworld_map_markers.runtime_state",
      status: "data_unavailable",
      errorCode
    });
  }
} catch (error) {
  const errorCode = error instanceof PalworldPaldexValidationError
    ? error.code
    : error instanceof PalworldActiveRuntimeError
      ? error.code
    : error instanceof SyntaxError
      ? "PALWORLD_DATA_JSON_INVALID"
      : (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "PALWORLD_DATA_ARTIFACT_MISSING"
        : "PALWORLD_DATA_INITIALIZATION_FAILED";
  logger.error({
    type: "palworld_data.runtime_unavailable",
    errorCode
  });
}
const supportMailbox = appConfig.supportMailbox.enabled
  ? new SupportMailboxStore({
      filePath: appConfig.supportMailbox.statePath,
      encryptionKey: appConfig.supportMailbox.encryptionKey,
      retentionDays: appConfig.supportMailbox.retentionDays,
      maxMessages: appConfig.supportMailbox.maxMessages
    })
  : undefined;

const palworldReusedSecrets = [
  appConfig.security.dashboardAuthToken,
  appConfig.security.overlayAccessToken,
  appConfig.bridge.sharedSecret,
  appConfig.twitch.clientSecret,
  appConfig.twitch.userAccessToken,
  appConfig.riot.apiKey,
  appConfig.supportMailbox.webhookSecret,
  appConfig.supportMailbox.encryptionKey
].filter((value): value is string => Boolean(value));

let palworldServerMonitor: PalworldServerMonitor | undefined;
let palworldServerUnavailableCode: PalworldServerAvailabilityErrorCode | undefined;
let palworldServerRegistrationPolicy: PalworldServerRegistrationPolicy = {
  ...PALWORLD_SERVER_SAFE_REGISTRATION_POLICY
};
try {
  const palworldConfig = loadPalworldServerStatusConfig({
    configDir: appConfig.paths.config,
    stateDir: appConfig.paths.state,
    reusedSecrets: palworldReusedSecrets
  });
  if (!palworldConfig.enabled) {
    palworldServerUnavailableCode = "disabled";
  } else if (!palworldConfig.encryptionKey) {
    palworldServerUnavailableCode = "key_missing";
  } else {
    palworldServerRegistrationPolicy = {
      publicHttpsSelfService: palworldConfig.publicHttpsSelfService,
      publicHttpsPort: 443,
      privateNetworkRequiresOperatorApproval: true
    };
    palworldServerMonitor = new PalworldServerMonitor({
      store: new PalworldServerConnectionStore({
        filePath: palworldConfig.statePath,
        encryptionKey: palworldConfig.encryptionKey
      }),
      client: new PalworldServerClient({
        allowedOrigins: palworldConfig.allowedOrigins,
        allowedCidrs: palworldConfig.allowedCidrs,
        publicHttpsSelfService: palworldConfig.publicHttpsSelfService,
        timeoutMs: palworldConfig.timeoutMs
      }),
      enabled: true,
      pollIntervalMs: palworldConfig.pollIntervalMs,
      registrationPolicy: palworldServerRegistrationPolicy,
      logger
    });
    logger.event({ type: "palworld_server.subsystem_ready" });
  }
} catch (error) {
  const safeInternalCode = error instanceof PalworldServerConnectionStoreError
    ? error.code
    : error instanceof PalworldServerStatusConfigError
      ? error.code
      : "initialization_failed";
  palworldServerUnavailableCode = error instanceof PalworldServerConnectionStoreError
    ? "key_invalid"
    : palworldServerStatusAvailabilityCode(error);
  logger.error({
    type: "palworld_server.subsystem_unavailable",
    errorCode: safeInternalCode,
    publicStatus: palworldServerUnavailableCode
  });
}
const store = new Store({
  followerStatePath: `${appConfig.paths.state}/followers.json`,
  streamerRiotIdStatePath: `${appConfig.paths.state}/streamer-riot-ids.json`,
  tournamentStatePath: `${appConfig.paths.state}/tournaments.json`,
  communityStatePath: `${appConfig.paths.state}/community-posts.json`,
  runtimeStatePath: `${appConfig.paths.state}/runtime-state.json`,
  onPersistenceError: (failure) => {
    logger.error({ type: "store.persistence_failed", ...failure });
  }
});
const sessions = new DashboardSessionStore();
const events = new EventBus();
const dashboard = new DashboardHub(store);
const overlay = new OverlayHub(logger, store, () => dashboard.broadcastSnapshot());
const bridge = new BridgeManager(logger, store, dashboard);
const twitchTokenStore = new LocalJsonTwitchTokenStore(appConfig.twitch.tokenStorePath);
const twitchAuth = new TwitchAuthService(twitchTokenStore, new TwitchOAuthStateStore());
const streamerFollowerTokenStore = new LocalJsonStreamerFollowerTokenStore(
  `${appConfig.paths.state}/streamer-follower-oauth-tokens.json`
);
const streamerFollowerAuth = new StreamerFollowerAuthService(
  streamerFollowerTokenStore,
  new TwitchOAuthStateStore()
);
const publicTwitchAuth = new PublicTwitchAuthService(new PublicTwitchViewerSessionStore(), new TwitchOAuthStateStore());
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
const loggedMissingFollowerScopes = new Set<string>();

const moduleContext = { events, actions, logger, store, overlay, dashboard, twitch, riot, lolProfileEnrichment };
for (const module of getEnabledModules()) {
  await module.setup(moduleContext);
  logger.event({ type: "module.loaded", module: module.name });
}

events.onAny((event) => {
  store.addEvent(event);
  recordFollowerManagementEvent(event, {
    store,
    getProfileImageUrl: (userId) => twitch.getUserProfileImageUrl(userId),
    onStateChanged: () => dashboard.broadcastSnapshot(),
    onFailure: (failure) => {
      if (failure.type === "scope_missing") {
        if (loggedMissingFollowerScopes.has(failure.eventType)) return;
        loggedMissingFollowerScopes.add(failure.eventType);
        logger.error({ type: "followers.event_scope_missing", eventType: failure.eventType });
        return;
      }
      logger.error({
        type: "followers.profile_image_lookup_failed",
        userId: failure.userId,
        error: toSafeErrorMessage(failure.error)
      });
    }
  });
  logger.event({ eventType: event.type, event });
  dashboard.broadcastSnapshot();
});

events.onHandlerError(({ type, error }) => {
  logger.error({ type: "event.handler_error", eventType: type, error: toSafeErrorMessage(error) });
});

const twitchEventSub = new TwitchEventSubClient(events, twitch, store, logger);
let shuttingDown = false;
const server = http.createServer(createHttpHandler({
  store,
  actions,
  twitch,
  riot,
  dataDragon,
  profileRepository: lolProfileRepository,
  twitchAuth,
  streamerFollowerAuth,
  publicTwitchAuth,
  eventSub: twitchEventSub,
  logger,
  refreshLolProfile: (entryId, streamerId) => refreshLolProfileForEntry(moduleContext, entryId, streamerId),
  sessions,
  disconnectStreamerDashboard: (twitchUserId) => dashboard.disconnectStreamer(twitchUserId),
  overlayStatusForStreamer: (twitchUserId) => overlay.statusForStreamer(twitchUserId),
  supportMailbox,
  palworldDataService,
  palworldMapMarkerProvider,
  palworldServerMonitor,
  palworldServerUnavailableCode,
  readiness: () => store.getReadiness(),
  isShuttingDown: () => shuttingDown,
  connectionStatus: () => ({
    http: httpSockets.size,
    dashboardWebSocket: dashboard.count(),
    overlayWebSocket: overlay.count(),
    bridge: bridge.isConnected()
  })
}));

const bridgeWss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const overlayWss = new WebSocketServer({ noServer: true });
const httpSockets = new Set<Socket>();

server.on("connection", (socket) => {
  httpSockets.add(socket);
  socket.once("close", () => httpSockets.delete(socket));
});

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

function dashboardWsRoleFromUrl(url: URL): DashboardRole {
  return url.searchParams.get("surface") === "streamer" ? "streamer" : "admin";
}

function dashboardStreamerTenantMatches(url: URL, request: import("@streamops/shared").StreamerRiotIdRequest): boolean {
  const slug = url.searchParams.get("streamerSlug");
  const key = url.searchParams.get("dashboardKey");
  if (slug === null && key === null) return true;
  if (slug === null || key === null) return false;
  const expectedSlug = request.dashboardSlug?.trim().toLowerCase();
  const expectedKey = request.dashboardKey?.trim();
  return Boolean(
    expectedSlug &&
    expectedKey &&
    slug.trim().toLowerCase() === expectedSlug &&
    tokenMatches(expectedKey, key.trim())
  );
}

function hasDashboardWsAuth(req: http.IncomingMessage, url: URL): boolean {
  const role = dashboardWsRoleFromUrl(url);
  const principal = authenticateDashboardRequest(req, sessions, role);
  if (role === "streamer") {
    if (principal?.type !== "DASHBOARD_ADMIN" || principal.role !== "streamer" || !principal.twitchUserId) return false;
    const request = store.listApprovedStreamerRiotIds().find((candidate) =>
      candidate.twitchUserId === principal.twitchUserId && candidate.dashboardEnabled === true
    );
    return Boolean(request && dashboardStreamerTenantMatches(url, request));
  }
  return Boolean(principal)
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

function overlayStreamerSlugFromUrl(url: URL): string | undefined {
  const raw = url.searchParams.get("streamer") ?? undefined;
  return raw?.trim().toLowerCase() || undefined;
}

type OverlayAccessIdentity = {
  streamerId?: string;
};

function approvedOverlayStreamer(streamerSlug?: string) {
  if (!streamerSlug) return undefined;
  return store.listApprovedStreamerRiotIds().find((request) => {
    const slug = (request.overlaySlug ?? request.twitchLogin).trim().toLowerCase();
    return slug === streamerSlug || request.twitchLogin.trim().toLowerCase() === streamerSlug;
  });
}

function resolveOverlayAccess(token: string | undefined, streamerSlug?: string): OverlayAccessIdentity | undefined {
  if (!token) return undefined;
  if (tokenMatches(appConfig.security.overlayAccessToken, token)) {
    return { streamerId: approvedOverlayStreamer(streamerSlug)?.twitchUserId };
  }
  const request = store.listApprovedStreamerRiotIds().find((candidate) => {
    if (!candidate.overlayKey || !tokenMatches(candidate.overlayKey, token)) return false;
    if (!streamerSlug) return true;
    const slug = (candidate.overlaySlug ?? candidate.twitchLogin).trim().toLowerCase();
    return slug === streamerSlug || candidate.twitchLogin.trim().toLowerCase() === streamerSlug;
  });
  return request ? { streamerId: request.twitchUserId } : undefined;
}

function attachOverlayAfterAuthentication(socket: import("ws").WebSocket, channel: string | null, streamerSlug?: string): void {
  if (!appConfig.security.overlayAccessToken && store.listApprovedStreamerRiotIds().every((request) => !request.overlayKey)) {
    overlay.add(socket, channel, approvedOverlayStreamer(streamerSlug)?.twitchUserId);
    return;
  }

  const timer = setTimeout(() => {
    socket.close(1008, "authentication required");
  }, 5000);

  const authenticate = (raw: import("ws").RawData) => {
    try {
      const parsed = JSON.parse(raw.toString()) as { type?: unknown; token?: unknown };
      const identity = parsed.type === "overlay.auth" && typeof parsed.token === "string"
        ? resolveOverlayAccess(parsed.token, streamerSlug)
        : undefined;
      if (!identity) {
        socket.close(1008, "authentication failed");
        return;
      }
      clearTimeout(timer);
      socket.off("message", authenticate);
      overlay.add(socket, channel, identity.streamerId);
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
  const streamerId = url.searchParams.get("streamerId")?.trim() || undefined;
  if (url.searchParams.getAll("name").length > 1 || url.searchParams.getAll("streamerId").length > 1) {
    socket.close(1008, "Bridge 식별자 중복");
    return;
  }
  if (streamerId) {
    const configuredBroadcasterId = appConfig.twitch.broadcasterId.trim().toLowerCase();
    const normalizedStreamerId = streamerId.toLowerCase();
    const isRegistered = configuredBroadcasterId === normalizedStreamerId
      || store.listApprovedStreamerRiotIds().some((request) => request.twitchUserId.toLowerCase() === normalizedStreamerId);
    if (!isRegistered) {
      logger.error({ type: "bridge.streamer_unapproved", streamerId: normalizedStreamerId });
      socket.close(1008, "등록되지 않은 Bridge 스트리머");
      return;
    }
  }
  try {
    bridge.attach(socket, name, streamerId);
    events.emit({ type: "bridge.connected", id: newId("event"), createdAt: nowIso(), payload: { name, streamerId } });
  } catch (error) {
    logger.error({ type: "bridge.identity_invalid", error: toSafeErrorMessage(error) });
    socket.close(1008, "잘못된 Bridge 식별자");
  }
});

dashboardWss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const roleHint = dashboardWsRoleFromUrl(url);
  const principal = authenticateDashboardRequest(req, sessions, roleHint);
  const role = principal?.type === "DASHBOARD_ADMIN"
    ? principal.role
    : roleHint === "admin" && tokenMatches(appConfig.security.dashboardAuthToken, legacyQueryToken(url))
      ? "admin"
      : roleHint;
  dashboard.add(socket, {
    role,
    ...(principal?.type === "DASHBOARD_ADMIN" && principal.twitchUserId
      ? { twitchUserId: principal.twitchUserId }
      : {})
  });
});
overlayWss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const channel = url.searchParams.get("channel") ?? url.searchParams.get("mode");
  const streamerSlug = overlayStreamerSlugFromUrl(url);
  const legacyToken = legacyQueryToken(url);
  const identity = resolveOverlayAccess(legacyToken, streamerSlug);
  if (identity) {
    overlay.add(socket, channel, identity.streamerId);
    return;
  }
  attachOverlayAfterAuthentication(socket, channel, streamerSlug);
});

twitchEventSub.start();
palworldServerMonitor?.start();

function closeWebSocketServer(wss: WebSocketServer): void {
  for (const client of wss.clients) client.close(1001, "server shutdown");
  wss.close();
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.event({ type: "server.shutdown_started", signal });
  twitchEventSub.stop();
  palworldServerMonitor?.stop();
  closeLolGameMonitors();
  closeWebSocketServer(bridgeWss);
  closeWebSocketServer(dashboardWss);
  closeWebSocketServer(overlayWss);
  let forceTimer: NodeJS.Timeout;
  server.close((error) => {
    clearTimeout(forceTimer);
    void store.closeAsync()
      .then(() => {
        if (error) {
          logger.error({ type: "server.shutdown_failed", signal, error: toSafeErrorMessage(error) });
          process.exitCode = 1;
          return;
        }
        logger.event({ type: "server.shutdown_completed", signal });
        process.exitCode = 0;
      })
      .catch((closeError: unknown) => {
        logger.error({
          type: "server.shutdown_persistence_failed",
          signal,
          error: toSafeErrorMessage(closeError)
        });
        process.exitCode = 1;
      });
  });
  server.closeIdleConnections?.();

  forceTimer = setTimeout(() => {
    for (const socket of httpSockets) socket.destroy();
    server.closeAllConnections?.();
    store.close();
    logger.error({ type: "server.shutdown_timeout", signal });
    process.exit(1);
  }, 25_000);
  forceTimer.unref();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

server.listen(appConfig.port, () => {
  logger.event({ type: "server.started", port: appConfig.port, build: appConfig.build });
  console.log(`StreamOps server listening on http://localhost:${appConfig.port}`);
  console.log(`Bridge WS: ws://localhost:${appConfig.port}/bridge?name=main`);
});
