export type FollowerActivityKind = "chat" | "participation";

export type FollowerActivity = {
  chatMessages: number;
  participationEntries: number;
  total: number;
  genres: Record<string, number>;
  lastActivityAt?: string;
};

export type FollowerRecord = {
  userId: string;
  userLogin?: string;
  userName: string;
  profileImageUrl?: string;
  riotGameName?: string;
  riotTagLine?: string;
  riotPuuid?: string;
  riotIdUpdatedAt?: string;
  followedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "following" | "unfollowed";
  unfollowedAt?: string;
  source: "eventsub" | "snapshot";
  activity: FollowerActivity;
};

export type FollowerSnapshot = {
  userId: string;
  userLogin?: string;
  userName: string;
  profileImageUrl?: string;
  followedAt?: string;
};

export type FollowerSnapshotInput = FollowerSnapshot;

export type FollowerManagementState = {
  summary: {
    knownFollowers: number;
    activeFollowers: number;
    unfollowed: number;
    newFollowers7d: number;
    observedGenreFollowers: number;
  };
  followers: FollowerRecord[];
  recentFollowers: FollowerRecord[];
  recentUnfollowers: FollowerRecord[];
  topObservedGenres: Array<{ name: string; count: number }>;
  lastSnapshotAt?: string;
  lastSnapshotTotal?: number;
  lastSnapshotTruncated?: boolean;
  dataNotes: string[];
};

export type FollowerOAuthStatus = {
  state: "connected" | "disconnected" | "missing_scopes" | "token_expired";
  missingScopes: string[];
  tokenExpiresAt?: string;
  error?: string;
};

export type FollowerManagementResponse = FollowerManagementState & {
  oauth: FollowerOAuthStatus;
};
