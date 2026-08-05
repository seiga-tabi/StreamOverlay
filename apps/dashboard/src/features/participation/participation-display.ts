import type {
  ParticipationDashboardQueueEntry,
  ParticipationSessionStatus,
  ParticipationState,
  ParticipationStatus
} from "@streamops/shared";

export type ParticipationDisplayPhase =
  | "checking"
  | "waiting"
  | "action_required"
  | "ready"
  | "playing"
  | "completed"
  | "ended";

export type ViewerAvailableActions = {
  canCancel: boolean;
  canCheckIn: boolean;
  canRejoin: boolean;
};

const ACTIVE_VIEWER_STATUSES: readonly ParticipationStatus[] = [
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited",
  "in_game"
];

export function getParticipationDisplayPhase(
  status: ParticipationStatus
): ParticipationDisplayPhase {
  if (status === "pending") return "checking";
  if (status === "verified" || status === "waitlisted") return "waiting";
  if (status === "selected") return "action_required";
  if (status === "checked_in" || status === "invited") return "ready";
  if (status === "in_game") return "playing";
  if (status === "played") return "completed";
  return "ended";
}

export function getCurrentParticipationEntry(
  state: ParticipationState | undefined
): ParticipationDashboardQueueEntry | undefined {
  return state?.queue.find((entry) => (
    entry.status === "selected"
    || entry.status === "checked_in"
    || entry.status === "invited"
    || entry.status === "in_game"
  ));
}

export function getViewerAvailableActions(
  entry: { status: ParticipationStatus } | undefined,
  session: {
    status?: ParticipationSessionStatus;
    isOpen: boolean;
    allowRejoin?: boolean;
  }
): ViewerAvailableActions {
  const status = entry?.status;
  return {
    canCancel: Boolean(status && ACTIVE_VIEWER_STATUSES.includes(status)),
    canCheckIn: status === "selected" && session.status !== "completed",
    canRejoin: (status === "played" || status === "skipped") && session.isOpen && session.allowRejoin !== false
  };
}

export function isViewerParticipationActive(status: ParticipationStatus): boolean {
  return ACTIVE_VIEWER_STATUSES.includes(status);
}
