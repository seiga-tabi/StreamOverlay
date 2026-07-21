import type { InternalEvent } from "@streamops/shared";
import type { Store } from "./store.js";

type FollowerStore = Pick<Store, "recordFollower" | "recordFollowerActivity">;

export type FollowerEventRecorderFailure =
  | {
      type: "scope_missing";
      eventType: InternalEvent["type"];
    }
  | {
      type: "profile_image_lookup_failed";
      eventType: "twitch.follow";
      userId: string;
      error: unknown;
    };

export type FollowerEventRecorderDependencies = {
  store: FollowerStore;
  getProfileImageUrl?: (userId: string) => Promise<string | undefined>;
  onStateChanged?: () => void;
  onFailure?: (failure: FollowerEventRecorderFailure) => void;
};

function broadcasterUserId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && /^\d{1,32}$/.test(normalized) ? normalized : undefined;
}

export function recordFollowerManagementEvent(
  event: InternalEvent,
  dependencies: FollowerEventRecorderDependencies
): void {
  if (event.type === "twitch.follow") {
    const ownerId = broadcasterUserId(event.broadcasterUserId);
    if (!ownerId) {
      dependencies.onFailure?.({ type: "scope_missing", eventType: event.type });
      return;
    }
    dependencies.store.recordFollower({
      broadcasterUserId: ownerId,
      userId: event.userId,
      userName: event.userName,
      followedAt: event.followedAt ?? event.createdAt,
      source: "eventsub"
    });
    if (!dependencies.getProfileImageUrl) return;
    void dependencies.getProfileImageUrl(event.userId)
      .then((profileImageUrl) => {
        if (!profileImageUrl) return;
        dependencies.store.recordFollower({
          broadcasterUserId: ownerId,
          userId: event.userId,
          userName: event.userName,
          profileImageUrl,
          followedAt: event.followedAt ?? event.createdAt,
          source: "eventsub"
        });
        dependencies.onStateChanged?.();
      })
      .catch((error) => {
        dependencies.onFailure?.({
          type: "profile_image_lookup_failed",
          eventType: event.type,
          userId: event.userId,
          error
        });
      });
    return;
  }

  if (event.type === "twitch.chatMessage") {
    const ownerId = broadcasterUserId(event.broadcasterUserId);
    if (!ownerId) {
      dependencies.onFailure?.({ type: "scope_missing", eventType: event.type });
      return;
    }
    dependencies.store.recordFollowerActivity({
      broadcasterUserId: ownerId,
      userId: event.chatterUserId,
      userName: event.chatterUserName,
      kind: "chat",
      genre: "채팅 참여"
    });
    return;
  }

  if (event.type === "participation.entryCreated") {
    const ownerId = broadcasterUserId(event.streamerId);
    if (!ownerId) {
      dependencies.onFailure?.({ type: "scope_missing", eventType: event.type });
      return;
    }
    dependencies.store.recordFollowerActivity({
      broadcasterUserId: ownerId,
      userId: event.twitchUserId,
      userName: event.twitchUserName,
      kind: "participation",
      genre: "League of Legends 시참",
      riotGameName: event.riotGameName,
      riotTagLine: event.riotTagLine,
      riotPuuid: event.riotPuuid
    });
  }
}
