import {
  newId,
  nowIso,
  type ParticipationMode,
  type ParticipationPhase,
  type ParticipationState
} from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";

export type ParticipationTrace = {
  traceId: string;
  requestReceivedAt: string;
  riotResolvedAt?: string;
};

type ParticipationSnapshotPublisherInput = {
  store: Store;
  logger?: Partial<Pick<JsonlLogger, "event">>;
};

type PublishParticipationSnapshotOptions = {
  message?: string;
  mode?: ParticipationMode;
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
    emittedAt,
    phase,
    isOpen: state.isOpen,
    mode: options.mode,
    message: options.message,
    completedAt,
    durationMs: elapsedMs(trace.requestReceivedAt, completedAt)
  });

}
