import type {
  ParticipationEntry,
  ParticipationSession,
  ParticipationState
} from "@streamops/shared";
import type { Store } from "./store.js";

export interface ParticipationRepository {
  getSession(publicSessionId: string): ParticipationSession | undefined;
  getState(streamerId: string): ParticipationState;
  getQueue(streamerId: string): ParticipationEntry[];
  getActiveQueue(streamerId: string): ParticipationEntry[];
  listSessions(): ParticipationSession[];
  cancel(twitchUserId: string, streamerId: string): ReturnType<Store["cancelParticipationByUser"]>;
  checkIn(twitchUserId: string, streamerId: string): ReturnType<Store["checkInSelectedParticipant"]>;
}

export function storeParticipationRepository(store: Store): ParticipationRepository {
  return {
    getSession: (publicSessionId) => store.getParticipationSessionByPublicId(publicSessionId),
    getState: (streamerId) => store.getParticipationState(streamerId),
    getQueue: (streamerId) => store.getParticipationQueue(streamerId),
    getActiveQueue: (streamerId) => store.getActiveParticipationQueue(streamerId),
    listSessions: () => store.listParticipationSessions(),
    cancel: (twitchUserId, streamerId) => store.cancelParticipationByUser(
      twitchUserId,
      "시청자가 공개 참여 세션에서 참가를 취소했습니다.",
      streamerId
    ),
    checkIn: (twitchUserId, streamerId) => store.checkInSelectedParticipant(
      twitchUserId,
      new Date(),
      streamerId
    )
  };
}
