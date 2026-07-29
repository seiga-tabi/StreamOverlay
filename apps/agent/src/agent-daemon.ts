import path from "node:path";
import {
  parsePalworldAgentStatusPayload,
  YORO_AGENT_PAYLOAD_VERSION,
  type PalworldAgentStatusPayload
} from "@streamops/shared";
import { AgentClient, AgentClientError } from "./agent-client.js";
import type { AgentConfig } from "./config.js";
import { CredentialStore, type AgentCredentialRecord } from "./credential-store.js";
import { AgentHealth, AgentHealthServer } from "./health.js";
import { agentEvent } from "./logger.js";
import { OfflineBuffer } from "./offline-buffer.js";
import { AgentScheduler } from "./scheduler.js";
import { SafeFileError } from "./safe-files.js";
import {
  PalworldAdapterError,
  PalworldRestStatusAdapter,
  type PalworldStatusAdapter
} from "./adapters/palworld-status-adapter.js";
import { MockPalworldStatusAdapter } from "./adapters/mock-status-adapter.js";

const CREDENTIAL_LIFETIME_MS = 90 * 24 * 60 * 60 * 1_000;
const CREDENTIAL_EXPIRING_MS = 7 * 24 * 60 * 60 * 1_000;

export type AgentDaemonDependencies = Readonly<{
  client?: AgentClient;
  adapter?: PalworldStatusAdapter;
  credentialStore?: CredentialStore;
  offlineBuffer?: OfflineBuffer;
  health?: AgentHealth;
  healthServer?: AgentHealthServer;
  now?: () => number;
  random?: () => number;
}>;

export class AgentDaemon {
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly health: AgentHealth;
  private readonly healthServer: AgentHealthServer;
  private readonly credentialStore: CredentialStore;
  private readonly offlineBuffer: OfflineBuffer;
  private readonly client: AgentClient;
  private readonly adapter: PalworldStatusAdapter;
  private scheduler?: AgentScheduler;
  private credential?: AgentCredentialRecord;
  private buffered?: PalworldAgentStatusPayload;
  private stopping = false;
  private readonly lifetime = new AbortController();

  constructor(
    private readonly config: AgentConfig,
    dependencies: AgentDaemonDependencies = {}
  ) {
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? Math.random;
    this.health = dependencies.health ?? new AgentHealth(config.release.version);
    this.healthServer = dependencies.healthServer
      ?? new AgentHealthServer(this.health, config.healthHost, config.healthPort);
    this.credentialStore = dependencies.credentialStore
      ?? new CredentialStore(config.credentialFile, config.serverOrigin, config.production);
    this.offlineBuffer = dependencies.offlineBuffer
      ?? new OfflineBuffer(path.join(config.stateDirectory, "pending-status.json"), config.production);
    this.client = dependencies.client ?? new AgentClient({
      serverOrigin: config.serverOrigin,
      timeoutMs: config.requestTimeoutMs,
      maximumRetryAttempts: config.maxRetryAttempts,
      agentVersion: config.release.version
    });
    this.adapter = dependencies.adapter ?? (
      config.adapter === "mock"
        ? new MockPalworldStatusAdapter(config.mockState)
        : new PalworldRestStatusAdapter({
            origin: config.palworldOrigin,
            adminPassword: config.adminPassword ?? "",
            timeoutMs: config.palworldTimeoutMs
          })
    );
  }

  async start(): Promise<void> {
    await this.healthServer.start();
    agentEvent("agent.started", { enabled: this.config.enabled, version: this.config.release.version });
    if (!this.config.enabled) {
      this.health.update({ state: "disabled", ready: false, errorCode: "agent_disabled" });
      return;
    }
    try {
      this.buffered = this.offlineBuffer.load(this.now());
      this.credential = this.credentialStore.load();
    } catch (error) {
      const code = error instanceof SafeFileError ? error.code : "agent_state_unreadable";
      this.health.update({ state: "degraded", ready: false, errorCode: code });
      agentEvent("agent.state.failed", { code });
      return;
    }
    if (!this.credential) {
      if (!this.config.bootstrapToken) {
        this.health.update({
          state: "registration_required",
          ready: false,
          errorCode: "bootstrap_token_required"
        });
        return;
      }
      await this.register();
    }
    if (!this.credential || this.stopping) return;
    if (!this.updateCredentialHealth()) return;
    this.scheduler = new AgentScheduler({
      intervalMs: this.config.pushIntervalSeconds * 1_000,
      task: (signal) => this.cycle(signal),
      random: this.random,
      onClockRollback: () => {
        agentEvent("agent.clock_rollback", { code: "system_clock_rollback" });
      },
      onTaskError: () => {
        this.health.update({
          state: "degraded",
          ready: true,
          failure: true,
          errorCode: "cycle_failed"
        });
        agentEvent("agent.cycle.failed", { code: "cycle_failed" });
      }
    });
    this.scheduler.start();
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.lifetime.abort(new Error("agent_stopping"));
    this.health.update({ state: "stopping", ready: false });
    agentEvent("agent.shutdown.started");
    await this.scheduler?.stop();
    await this.healthServer.stop();
    agentEvent("agent.shutdown.completed");
  }

  snapshot() {
    return this.health.snapshot();
  }

  async runOnceForTest(signal: AbortSignal): Promise<void> {
    await this.cycle(signal);
  }

  private async register(): Promise<void> {
    this.health.update({ state: "registering", ready: false });
    agentEvent("agent.registration.started");
    try {
      const response = await this.client.register(
        this.config.bootstrapToken ?? "",
        this.lifetime.signal
      );
      this.credential = this.credentialStore.save(response, new Date(this.now()));
      agentEvent("agent.registration.completed");
      agentEvent("agent.bootstrap_file_removal_required", {
        code: "remove_bootstrap_token_file"
      });
    } catch (error) {
      const code = error instanceof AgentClientError ? error.code : "registration_failed";
      this.health.update({ state: "registration_required", ready: false, errorCode: code });
      agentEvent("agent.registration.failed", { code });
    }
  }

  private updateCredentialHealth(): boolean {
    if (!this.credential) return false;
    const age = this.now() - Date.parse(this.credential.createdAt);
    if (!Number.isFinite(age) || age >= CREDENTIAL_LIFETIME_MS) {
      this.health.update({
        state: "credential_rejected",
        ready: false,
        errorCode: "credential_expired"
      });
      return false;
    }
    if (age >= CREDENTIAL_LIFETIME_MS - CREDENTIAL_EXPIRING_MS) {
      this.health.update({
        state: "credential_expiring",
        ready: true,
        errorCode: "credential_expiring"
      });
      return true;
    }
    this.health.update({ state: "ready", ready: true, resetFailures: true });
    return true;
  }

  private async cycle(signal: AbortSignal): Promise<void> {
    const credential = this.credential;
    if (!credential || this.stopping || !this.updateCredentialHealth()) return;
    if (this.buffered) {
      const sent = await this.send(credential, this.buffered, signal, true);
      if (!sent) return;
      this.offlineBuffer.clear();
      this.buffered = undefined;
    }
    this.health.update({ state: "collecting", ready: true });
    let collected;
    try {
      collected = await this.adapter.collect(signal);
      const collectedAt = new Date(this.now()).toISOString();
      this.health.update({ state: "sending", ready: true, collectedAt });
      agentEvent("agent.collect.succeeded");
    } catch (error) {
      if (signal.aborted) return;
      const code = error instanceof PalworldAdapterError
        ? error.code
        : "palworld_collect_failed";
      this.health.update({
        state: "palworld_unavailable",
        ready: true,
        failure: true,
        errorCode: code
      });
      agentEvent("agent.collect.failed", { code });
      return;
    }
    const payload = parsePalworldAgentStatusPayload({
      payloadVersion: YORO_AGENT_PAYLOAD_VERSION,
      observedAt: new Date(this.now()).toISOString(),
      ...collected
    }, { now: this.now() });
    if (!payload) {
      this.health.update({
        state: "degraded",
        ready: true,
        failure: true,
        errorCode: "local_payload_invalid"
      });
      agentEvent("agent.status.rejected", { code: "local_payload_invalid" });
      return;
    }
    await this.send(credential, payload, signal, false);
  }

  private async send(
    credential: AgentCredentialRecord,
    payload: PalworldAgentStatusPayload,
    signal: AbortSignal,
    fromBuffer: boolean
  ): Promise<boolean> {
    this.health.update({ state: "sending", ready: true });
    try {
      await this.client.sendStatus(credential, payload, signal);
      const sentAt = new Date(this.now()).toISOString();
      this.health.update({
        state: "ready",
        ready: true,
        sentAt,
        resetFailures: true
      });
      agentEvent("agent.status.sent", { payloadVersion: payload.payloadVersion });
      return true;
    } catch (error) {
      if (signal.aborted) return false;
      const safe = error instanceof AgentClientError
        ? error
        : new AgentClientError("network_error", true);
      if (safe.code === "credential_rejected") {
        this.health.update({
          state: "credential_rejected",
          ready: false,
          failure: true,
          errorCode: safe.code
        });
        agentEvent("agent.credential.rejected", { code: safe.code });
        void this.scheduler?.stop();
        return false;
      }
      if (safe.retryable && !fromBuffer) {
        this.offlineBuffer.save(payload, new Date(this.now()));
        this.buffered = payload;
      }
      this.health.update({
        state: "degraded",
        ready: true,
        failure: true,
        errorCode: safe.code
      });
      agentEvent("agent.status.rejected", { code: safe.code });
      return false;
    }
  }
}
