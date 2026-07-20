import {
  newId,
  nowIso,
  type ParticipationPhase,
  type ParticipationPublicQueueEntry,
  type ParticipationSnapshotStatus,
  type ParticipationState
} from "@streamops/shared";
import type { ActionDispatcher } from "../core/action-dispatcher.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";

export type ParticipationTrace = {
  traceId: string;
  requestReceivedAt: string;
  riotResolvedAt?: string;
};

type ParticipationSnapshotPublisherInput = {
  store: Store;
  actions: ActionDispatcher;
  logger?: Partial<Pick<JsonlLogger, "event" | "error">>;
};

type PublishParticipationSnapshotOptions = {
  message?: string;
  mode?: ParticipationSnapshotStatus["mode"];
  nextCandidate?: ParticipationPublicQueueEntry;
  phase?: ParticipationPhase;
  reason: string;
  streamerId?: string;
  trace?: ParticipationTrace;
};

function inferredPhase(input: ParticipationState): ParticipationPhase {
  if (input.session?.status === "in_game") return "in_game";
  if (input.session?.status === "completed") return "game_ended";
  return input.isOpen ? "recruiting" : "closed";
}

function elapsedMs(startedAt: string, completedAt: string): number {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  return Number.isFinite(started) && Number.isFinite(completed)
    ? Math.max(0, completed - started)
    : 0;
}

export function createParticipationTrace(): ParticipationTrace {
  return {
    traceId: newId("participation_trace"),
    requestReceivedAt: nowIso()
  };
}

export async function publishParticipationSnapshot(
  input: ParticipationSnapshotPublisherInput,
  options: PublishParticipationSnapshotOptions
): Promise<void> {
  const trace = options.trace ?? createParticipationTrace();
  const revision = input.store.advanceParticipationRevision(options.streamerId);

  await input.store.flushRuntimeState();
  const persistedAt = nowIso();

  const state = input.store.getParticipationState(options.streamerId);
  const streamerId = options.streamerId ?? state.streamerId ?? "global";
  const sessionId = state.session?.sessionId ?? `legacy:${streamerId}`;
  const phase = options.phase ?? inferredPhase(state);
  const emittedAt = nowIso();
  const status = {
    isOpen: state.isOpen,
    mode: options.mode,
    phase,
    message: options.message,
    nextCandidate: options.nextCandidate
      ?? input.store.getNextWaitingParticipationOverlayEntry(options.streamerId),
    streamerProfile: input.store.getParticipationStreamerProfile(options.streamerId)
  };
  const queue = input.store.getParticipationOverlaySnapshotQueue(undefined, options.streamerId);

  await input.actions.dispatchOne({
    type: "overlay.participationSnapshot",
    streamerId,
    sessionId,
    revision,
    status,
    queue,
    emittedAt,
    traceId: trace.traceId,
    source: options.reason
  }, { user: "dashboard", input: "" }, options.reason);

  const broadcastAt = nowIso();
  const completedAt = nowIso();
  input.logger?.event?.({
    type: "participation.snapshot_trace",
    traceId: trace.traceId,
    streamerId,
    sessionId,
    revision,
    reason: options.reason,
    requestReceivedAt: trace.requestReceivedAt,
    riotResolvedAt: trace.riotResolvedAt,
    persistedAt,
    broadcastAt,
    completedAt,
    durationMs: elapsedMs(trace.requestReceivedAt, completedAt)
  });

  // 원자적 snapshot을 먼저 전송한 뒤 구형 호환 메시지는 서로 병렬로 완료한다.
  const legacyResults = await Promise.allSettled([
    input.actions.dispatchOne({
      type: "overlay.participationStatus",
      streamerId,
      sessionId,
      revision,
      ...status,
      source: options.reason
    }, { user: "dashboard", input: "" }, options.reason),
    input.actions.dispatchOne({
      type: "overlay.participationQueue",
      streamerId,
      sessionId,
      revision,
      isOpen: state.isOpen,
      queue,
      source: options.reason
    }, { user: "dashboard", input: "" }, options.reason)
  ]);
  const legacyFailure = legacyResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (legacyFailure) {
    input.logger?.error?.({
      type: "participation.legacy_overlay_broadcast_failed",
      traceId: trace.traceId,
      streamerId,
      revision,
      reason: options.reason,
      error: legacyFailure.reason instanceof Error
        ? legacyFailure.reason.message
        : String(legacyFailure.reason)
    });
  }
}
