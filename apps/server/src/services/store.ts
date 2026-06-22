import fs from "node:fs";
import path from "node:path";
import type {
  BotStatus,
  InternalEvent,
  OverlayChannel,
  OverlayMessageLogEntry,
  OverlayStatus,
  ParticipationDashboardQueueEntry,
  ParticipationEntry,
  ParticipationPublicQueueEntry,
  ParticipationState,
  TwitchChatSendFailure,
  TwitchChatStatus,
  TwitchEventSubStatus,
  TwitchEventSubSubscriptionStatus
} from "@streamops/shared";
import { OVERLAY_CHANNELS, formatRiotId, isActiveParticipationStatus, isWaitingParticipationStatus, newId, normalizeRiotIdKey, nowIso } from "@streamops/shared";

export type QuestionEntry = {
  id: string;
  userName: string;
  question: string;
  translatedQuestion?: string;
  status: "pending" | "answered" | "skipped";
  createdAt: string;
};

export type HighlightEntry = {
  id: string;
  userName?: string;
  reason: string;
  createdAt: string;
};

export type ActionRecord = {
  id: string;
  type: string;
  status: "pending" | "ok" | "failed" | "skipped";
  error?: string;
  createdAt: string;
};

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
  followedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "following" | "unfollowed";
  unfollowedAt?: string;
  source: "eventsub" | "snapshot";
  activity: FollowerActivity;
};

export type FollowerSnapshotInput = {
  userId: string;
  userLogin?: string;
  userName: string;
  followedAt?: string;
};

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

export type StoreOptions = {
  followerStatePath?: string;
};

export type ParticipationDuplicate = {
  reason: "twitch_user" | "riot_id";
  entry: ParticipationEntry;
};

export type ParticipationCheckInResult =
  | { ok: true; entry: ParticipationEntry }
  | { ok: false; reason: "missing" | "expired"; entry?: ParticipationEntry };

export type ParticipationCancelResult =
  | { ok: true; entry: ParticipationEntry }
  | { ok: false; reason: "missing" | "in_game" };

const CANCELLABLE_PARTICIPATION_STATUSES = new Set<ParticipationEntry["status"]>([
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited"
]);
const PARTICIPATION_OVERLAY_VISIBLE_LIMIT = 4;

function isCheckInExpired(entry: ParticipationEntry, now = new Date()): boolean {
  if (!entry.checkInExpiresAt) return false;
  const expiresAt = Date.parse(entry.checkInExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

function toDashboardQueueEntry(entry: ParticipationEntry, position: number): ParticipationDashboardQueueEntry {
  return {
    id: entry.id,
    position,
    twitchUserName: entry.twitchUserName,
    riotId: formatRiotId(entry.riotGameName, entry.riotTagLine),
    preferredRole: entry.preferredRole,
    status: entry.status,
    requestedRole: entry.requestedRole,
    profileStatus: entry.profileStatus,
    mainRole: entry.mainRole,
    mainRoleConfidence: entry.mainRoleConfidence,
    topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined,
    rankedStats: entry.rankedStats,
    verifiedRank: entry.verifiedRank,
    profileAnalyzedAt: entry.profileAnalyzedAt,
    profileFailureReason: entry.profileFailureReason,
    source: entry.source,
    selectedAt: entry.selectedAt,
    checkInExpiresAt: entry.checkInExpiresAt,
    playedAt: entry.playedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function toPublicQueueEntry(entry: ParticipationEntry, position: number): ParticipationPublicQueueEntry {
  return {
    position,
    twitchUserName: entry.twitchUserName,
    preferredRole: entry.preferredRole,
    status: entry.status,
    requestedRole: entry.requestedRole,
    profileStatus: entry.profileStatus,
    mainRole: entry.mainRole,
    mainRoleConfidence: entry.mainRoleConfidence,
    topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined,
    rankedStats: entry.rankedStats
  };
}

function emptyFollowerActivity(): FollowerActivity {
  return {
    chatMessages: 0,
    participationEntries: 0,
    total: 0,
    genres: {}
  };
}

function cloneFollowerRecord(record: FollowerRecord): FollowerRecord {
  return {
    ...record,
    activity: {
      ...record.activity,
      genres: { ...record.activity.genres }
    }
  };
}

function followerSortTime(record: FollowerRecord): number {
  return Date.parse(record.followedAt ?? record.firstSeenAt) || 0;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizedFollowerActivity(value: unknown): FollowerActivity {
  const input = objectRecord(value);
  const rawGenres = objectRecord(input?.genres);
  const genres: Record<string, number> = {};
  for (const [name, count] of Object.entries(rawGenres ?? {})) {
    const safeCount = Number(count);
    if (name && Number.isFinite(safeCount) && safeCount > 0) genres[name] = Math.trunc(safeCount);
  }
  return {
    chatMessages: Math.max(0, Math.trunc(Number(input?.chatMessages) || 0)),
    participationEntries: Math.max(0, Math.trunc(Number(input?.participationEntries) || 0)),
    total: Math.max(0, Math.trunc(Number(input?.total) || 0)),
    genres,
    lastActivityAt: optionalString(input?.lastActivityAt)
  };
}

function normalizedFollowerRecord(value: unknown): FollowerRecord | undefined {
  const input = objectRecord(value);
  const userId = optionalString(input?.userId);
  if (!userId) return undefined;
  const now = nowIso();
  const status = input?.status === "unfollowed" ? "unfollowed" : "following";
  const source = input?.source === "eventsub" ? "eventsub" : "snapshot";
  return {
    userId,
    userLogin: optionalString(input?.userLogin),
    userName: optionalString(input?.userName) ?? userId,
    followedAt: optionalString(input?.followedAt),
    firstSeenAt: optionalString(input?.firstSeenAt) ?? optionalString(input?.followedAt) ?? now,
    lastSeenAt: optionalString(input?.lastSeenAt) ?? now,
    status,
    unfollowedAt: status === "unfollowed" ? optionalString(input?.unfollowedAt) : undefined,
    source,
    activity: normalizedFollowerActivity(input?.activity)
  };
}

export class Store {
  private static readonly maxSeenTwitchMessageIds = 5000;
  private static readonly maxEvents = 200;
  private static readonly maxActions = 200;
  private static readonly maxQuestions = 200;
  private static readonly maxHighlights = 200;
  private readonly seenTwitchMessageIds = new Set<string>();
  private readonly seenTwitchMessageIdOrder: string[] = [];
  private readonly events: InternalEvent[] = [];
  private readonly actions: ActionRecord[] = [];
  private readonly questions: QuestionEntry[] = [];
  private readonly highlights: HighlightEntry[] = [];
  private readonly followers = new Map<string, FollowerRecord>();
  private lastFollowerSnapshotAt?: string;
  private lastFollowerSnapshotTotal?: number;
  private lastFollowerSnapshotTruncated?: boolean;
  private followerPersistTimer?: NodeJS.Timeout;
  private participationQueue: ParticipationEntry[] = [];
  private overlayStatus: OverlayStatus = {
    clientCount: 0,
    clientsByChannel: Object.fromEntries(OVERLAY_CHANNELS.map((channel) => [channel, 0])) as Record<OverlayChannel, number>,
    recentMessages: []
  };
  private twitchEventSubStatus: TwitchEventSubStatus = {
    websocket: "disabled",
    activeSubscriptions: 0,
    failedSubscriptions: [],
    missingScopes: [],
    subscriptions: []
  };
  private twitchChatStatus: TwitchChatStatus = {
    mode: "broadcaster",
    queueSize: 0,
    throttleMs: 1500,
    cooldownMs: 10_000,
    maxMessageLength: 500,
    recentFailures: []
  };
  private status: BotStatus = {
    server: "online",
    twitch: "disabled",
    stream: "unknown",
    bridge: "disconnected",
    obs: "unknown",
    participation: "closed",
    startedAt: nowIso(),
    postStreamReportReady: false
  };

  constructor(private readonly options: StoreOptions = {}) {
    this.loadFollowerState();
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  patchStatus(patch: Partial<BotStatus>): BotStatus {
    this.status = { ...this.status, ...patch };
    return this.getStatus();
  }

  markTwitchMessageSeen(id: string): boolean {
    return this.markTwitchEventSeen([id]);
  }

  markTwitchEventSeen(ids: readonly string[]): boolean {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return true;
    if (uniqueIds.some((id) => this.seenTwitchMessageIds.has(id))) return false;
    for (const id of uniqueIds) {
      this.seenTwitchMessageIds.add(id);
      this.seenTwitchMessageIdOrder.push(id);
    }
    this.pruneSeenTwitchMessageIds();
    return true;
  }

  private pruneSeenTwitchMessageIds(): void {
    while (this.seenTwitchMessageIdOrder.length > Store.maxSeenTwitchMessageIds) {
      const expiredId = this.seenTwitchMessageIdOrder.shift();
      if (expiredId) this.seenTwitchMessageIds.delete(expiredId);
    }
  }

  getTwitchEventSubStatus(): TwitchEventSubStatus {
    return {
      ...this.twitchEventSubStatus,
      failedSubscriptions: this.twitchEventSubStatus.failedSubscriptions.map((subscription) => ({ ...subscription })),
      subscriptions: this.twitchEventSubStatus.subscriptions.map((subscription) => ({ ...subscription })),
      missingScopes: [...this.twitchEventSubStatus.missingScopes]
    };
  }

  patchTwitchEventSubStatus(patch: Partial<TwitchEventSubStatus>): TwitchEventSubStatus {
    this.twitchEventSubStatus = {
      ...this.twitchEventSubStatus,
      ...patch,
      failedSubscriptions: patch.failedSubscriptions
        ? patch.failedSubscriptions.map((subscription) => ({ ...subscription }))
        : this.twitchEventSubStatus.failedSubscriptions,
      subscriptions: patch.subscriptions
        ? patch.subscriptions.map((subscription) => ({ ...subscription }))
        : this.twitchEventSubStatus.subscriptions,
      missingScopes: patch.missingScopes ? [...patch.missingScopes] : this.twitchEventSubStatus.missingScopes
    };
    return this.getTwitchEventSubStatus();
  }

  setTwitchEventSubSubscriptions(subscriptions: TwitchEventSubSubscriptionStatus[]): TwitchEventSubStatus {
    const failedSubscriptions = subscriptions.filter((subscription) => subscription.status === "failed");
    const missingScopes = [...new Set(subscriptions.flatMap((subscription) => subscription.missingScopes))];
    return this.patchTwitchEventSubStatus({
      activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active").length,
      failedSubscriptions,
      missingScopes,
      subscriptions
    });
  }

  getTwitchChatStatus(): TwitchChatStatus {
    return {
      ...this.twitchChatStatus,
      recentFailures: this.twitchChatStatus.recentFailures.map((failure) => ({ ...failure }))
    };
  }

  patchTwitchChatStatus(patch: Partial<TwitchChatStatus>): TwitchChatStatus {
    this.twitchChatStatus = {
      ...this.twitchChatStatus,
      ...patch,
      recentFailures: patch.recentFailures
        ? patch.recentFailures.map((failure) => ({ ...failure }))
        : this.twitchChatStatus.recentFailures
    };
    return this.getTwitchChatStatus();
  }

  addTwitchChatFailure(failure: TwitchChatSendFailure): TwitchChatStatus {
    const recentFailures = [failure, ...this.twitchChatStatus.recentFailures].slice(0, 10);
    return this.patchTwitchChatStatus({
      lastFailureAt: failure.createdAt,
      recentFailures
    });
  }

  getOverlayStatus(): OverlayStatus {
    return {
      clientCount: this.overlayStatus.clientCount,
      clientsByChannel: { ...this.overlayStatus.clientsByChannel },
      recentMessages: this.overlayStatus.recentMessages.map((message) => ({ ...message }))
    };
  }

  patchOverlayClients(clientsByChannel: Record<OverlayChannel, number>): OverlayStatus {
    const clientCount = Object.values(clientsByChannel).reduce((sum, count) => sum + count, 0);
    this.overlayStatus = {
      ...this.overlayStatus,
      clientCount,
      clientsByChannel: { ...clientsByChannel }
    };
    return this.getOverlayStatus();
  }

  addOverlayMessageLog(entry: OverlayMessageLogEntry): OverlayStatus {
    this.overlayStatus = {
      ...this.overlayStatus,
      recentMessages: [entry, ...this.overlayStatus.recentMessages].slice(0, 30)
    };
    return this.getOverlayStatus();
  }

  addEvent(event: InternalEvent): void {
    this.events.unshift(event);
    this.events.length = Math.min(this.events.length, Store.maxEvents);
  }

  recentEvents(limit = 50): InternalEvent[] {
    return this.events.slice(0, limit);
  }

  addAction(record: ActionRecord): void {
    this.actions.unshift(record);
    this.actions.length = Math.min(this.actions.length, Store.maxActions);
  }

  recentActions(limit = 50): ActionRecord[] {
    return this.actions.slice(0, limit);
  }

  addQuestion(input: { userName: string; question: string; translatedQuestion?: string }): QuestionEntry {
    const entry: QuestionEntry = {
      id: newId("question"),
      userName: input.userName,
      question: input.question,
      translatedQuestion: input.translatedQuestion,
      status: "pending",
      createdAt: nowIso()
    };
    this.questions.unshift(entry);
    this.questions.length = Math.min(this.questions.length, Store.maxQuestions);
    return entry;
  }

  getQuestions(): QuestionEntry[] {
    return [...this.questions];
  }

  addHighlight(input: { userName?: string; reason: string }): HighlightEntry {
    const entry: HighlightEntry = {
      id: newId("highlight"),
      userName: input.userName,
      reason: input.reason,
      createdAt: nowIso()
    };
    this.highlights.unshift(entry);
    this.highlights.length = Math.min(this.highlights.length, Store.maxHighlights);
    return entry;
  }

  getHighlights(): HighlightEntry[] {
    return [...this.highlights];
  }

  recordFollower(input: FollowerSnapshotInput & { source: "eventsub" | "snapshot" }): FollowerRecord {
    return this.upsertFollower(input, true);
  }

  private upsertFollower(input: FollowerSnapshotInput & { source: "eventsub" | "snapshot" }, persist: boolean): FollowerRecord {
    const now = nowIso();
    const previous = this.followers.get(input.userId);
    const next: FollowerRecord = {
      userId: input.userId,
      userLogin: input.userLogin ?? previous?.userLogin,
      userName: input.userName || previous?.userName || input.userId,
      followedAt: input.followedAt ?? previous?.followedAt,
      firstSeenAt: previous?.firstSeenAt ?? input.followedAt ?? now,
      lastSeenAt: now,
      status: "following",
      source: input.source,
      activity: previous ? {
        ...previous.activity,
        genres: { ...previous.activity.genres }
      } : emptyFollowerActivity()
    };
    this.followers.set(input.userId, next);
    if (persist) this.persistFollowerState();
    return cloneFollowerRecord(next);
  }

  recordFollowerActivity(input: {
    userId: string;
    userName?: string;
    kind: FollowerActivityKind;
    genre: string;
  }): FollowerRecord | undefined {
    const previous = this.followers.get(input.userId);
    if (!previous || previous.status !== "following") return undefined;
    const now = nowIso();
    previous.userName = input.userName || previous.userName;
    previous.lastSeenAt = now;
    previous.activity.total += 1;
    previous.activity.lastActivityAt = now;
    previous.activity.genres[input.genre] = (previous.activity.genres[input.genre] ?? 0) + 1;
    if (input.kind === "chat") previous.activity.chatMessages += 1;
    if (input.kind === "participation") previous.activity.participationEntries += 1;
    this.queueFollowerStatePersist();
    return cloneFollowerRecord(previous);
  }

  reconcileFollowerSnapshot(input: {
    followers: FollowerSnapshotInput[];
    total?: number;
    truncated?: boolean;
  }): FollowerManagementState {
    const now = nowIso();
    const snapshotIds = new Set<string>();
    for (const follower of input.followers) {
      snapshotIds.add(follower.userId);
      this.upsertFollower({ ...follower, source: "snapshot" }, false);
    }

    if (!input.truncated) {
      for (const record of this.followers.values()) {
        if (record.status !== "following" || snapshotIds.has(record.userId)) continue;
        record.status = "unfollowed";
        record.unfollowedAt = now;
        record.lastSeenAt = now;
      }
    }

    this.lastFollowerSnapshotAt = now;
    this.lastFollowerSnapshotTotal = input.total;
    this.lastFollowerSnapshotTruncated = Boolean(input.truncated);
    this.persistFollowerState();
    return this.getFollowerManagementState();
  }

  getFollowerManagementState(): FollowerManagementState {
    const followers = [...this.followers.values()]
      .map(cloneFollowerRecord)
      .sort((a, b) => followerSortTime(b) - followerSortTime(a));
    const activeFollowers = followers.filter((record) => record.status === "following");
    const recentFollowers = activeFollowers.slice(0, 12);
    const recentUnfollowers = followers
      .filter((record) => record.status === "unfollowed")
      .sort((a, b) => (Date.parse(b.unfollowedAt ?? "") || 0) - (Date.parse(a.unfollowedAt ?? "") || 0))
      .slice(0, 12);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const genreCounts = new Map<string, number>();
    for (const follower of activeFollowers) {
      for (const [name, count] of Object.entries(follower.activity.genres)) {
        genreCounts.set(name, (genreCounts.get(name) ?? 0) + count);
      }
    }

    return {
      summary: {
        knownFollowers: followers.length,
        activeFollowers: activeFollowers.length,
        unfollowed: followers.length - activeFollowers.length,
        newFollowers7d: activeFollowers.filter((record) => (Date.parse(record.followedAt ?? record.firstSeenAt) || 0) >= sevenDaysAgo).length,
        observedGenreFollowers: activeFollowers.filter((record) => Object.keys(record.activity.genres).length > 0).length
      },
      followers,
      recentFollowers,
      recentUnfollowers,
      topObservedGenres: [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count })),
      lastSnapshotAt: this.lastFollowerSnapshotAt,
      lastSnapshotTotal: this.lastFollowerSnapshotTotal,
      lastSnapshotTruncated: this.lastFollowerSnapshotTruncated,
      dataNotes: [
        "새 팔로워는 Twitch EventSub channel.follow 이벤트와 follower snapshot에서 기록합니다.",
        "팔로우 취소는 Twitch가 실시간 이벤트를 제공하지 않아 전체 follower snapshot 비교로만 추정합니다.",
        "첫 follower snapshot 저장 이후 다음 전체 새로고침부터 팔로우 취소 추정이 가능합니다.",
        "일부만 조회됨이 true이면 누락을 언팔로우로 오인하지 않기 위해 팔로우 취소 추정을 하지 않습니다.",
        "시청 장르 이력은 Twitch API가 제공하지 않으므로 StreamOps가 관측한 채팅/시참 활동 기준으로만 표시합니다."
      ]
    };
  }

  private loadFollowerState(): void {
    if (!this.options.followerStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.followerStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const followers = Array.isArray(parsed?.followers) ? parsed.followers : [];
      this.followers.clear();
      for (const follower of followers) {
        const record = normalizedFollowerRecord(follower);
        if (record) this.followers.set(record.userId, record);
      }
      this.lastFollowerSnapshotAt = optionalString(parsed?.lastFollowerSnapshotAt);
      this.lastFollowerSnapshotTotal = typeof parsed?.lastFollowerSnapshotTotal === "number" ? parsed.lastFollowerSnapshotTotal : undefined;
      this.lastFollowerSnapshotTruncated = typeof parsed?.lastFollowerSnapshotTruncated === "boolean" ? parsed.lastFollowerSnapshotTruncated : undefined;
    } catch {
      this.followers.clear();
      this.lastFollowerSnapshotAt = undefined;
      this.lastFollowerSnapshotTotal = undefined;
      this.lastFollowerSnapshotTruncated = undefined;
    }
  }

  private persistFollowerState(): void {
    if (!this.options.followerStatePath) return;
    try {
      const dir = path.dirname(this.options.followerStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = `${this.options.followerStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 1,
        followers: [...this.followers.values()].map(cloneFollowerRecord),
        lastFollowerSnapshotAt: this.lastFollowerSnapshotAt,
        lastFollowerSnapshotTotal: this.lastFollowerSnapshotTotal,
        lastFollowerSnapshotTruncated: this.lastFollowerSnapshotTruncated
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.followerStatePath);
    } catch {
      // 방송 중 파일 저장 실패가 runtime 동작을 막지 않도록 무시합니다.
    }
  }

  private queueFollowerStatePersist(): void {
    if (!this.options.followerStatePath || this.followerPersistTimer) return;
    this.followerPersistTimer = setTimeout(() => {
      this.followerPersistTimer = undefined;
      this.persistFollowerState();
    }, 1000);
    this.followerPersistTimer.unref?.();
  }

  getParticipationQueue(): ParticipationEntry[] {
    return [...this.participationQueue];
  }

  getActiveParticipationQueue(): ParticipationEntry[] {
    return this.participationQueue.filter((entry) => isActiveParticipationStatus(entry.status));
  }

  getWaitingParticipationQueue(): ParticipationEntry[] {
    return this.participationQueue.filter((entry) => isWaitingParticipationStatus(entry.status));
  }

  getParticipationOverlayQueue(limit = PARTICIPATION_OVERLAY_VISIBLE_LIMIT): ParticipationPublicQueueEntry[] {
    return this.getWaitingParticipationQueue()
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map((entry, index) => toPublicQueueEntry(entry, index + 1));
  }

  getNextWaitingParticipationOverlayEntry(): ParticipationPublicQueueEntry | undefined {
    const entry = this.getWaitingParticipationQueue()[0];
    return entry ? toPublicQueueEntry(entry, 1) : undefined;
  }

  getParticipationState(): ParticipationState {
    const activeQueue = this.getActiveParticipationQueue();
    return {
      isOpen: this.status.participation === "open",
      queue: this.participationQueue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      activeQueue: activeQueue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      summary: {
        total: this.participationQueue.length,
        active: activeQueue.length,
        waiting: this.getWaitingParticipationQueue().length,
        selected: this.participationQueue.filter((entry) => entry.status === "selected").length,
        checkedIn: this.participationQueue.filter((entry) => entry.status === "checked_in").length,
        noShow: this.participationQueue.filter((entry) => entry.status === "no_show").length,
        played: this.participationQueue.filter((entry) => entry.status === "played").length
      }
    };
  }

  getActiveParticipationCount(): number {
    return this.getActiveParticipationQueue().length;
  }

  getParticipationEntryById(id: string): ParticipationEntry | undefined {
    const entry = this.participationQueue.find((candidate) => candidate.id === id);
    return entry ? { ...entry, topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined } : undefined;
  }

  findParticipationDuplicate(input: {
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
    riotPuuid?: string;
  }): ParticipationDuplicate | undefined {
    const riotIdKey = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    return this.getActiveParticipationQueue().reduce<ParticipationDuplicate | undefined>((found, candidate) => {
      if (found) return found;
      if (candidate.twitchUserId === input.twitchUserId) return { reason: "twitch_user", entry: candidate };
      if (input.riotPuuid && candidate.riotPuuid && candidate.riotPuuid === input.riotPuuid) return { reason: "riot_id", entry: candidate };
      const candidateRiotIdKey = normalizeRiotIdKey(candidate.riotGameName, candidate.riotTagLine);
      if (candidateRiotIdKey === riotIdKey) return { reason: "riot_id", entry: candidate };
      return undefined;
    }, undefined);
  }

  addParticipation(entry: ParticipationEntry): ParticipationEntry {
    this.participationQueue.push(entry);
    return entry;
  }

  addOrUpdateParticipation(entry: ParticipationEntry): ParticipationEntry {
    const existingIndex = this.participationQueue.findIndex(
      (candidate) =>
        candidate.twitchUserId === entry.twitchUserId ||
        normalizeRiotIdKey(candidate.riotGameName, candidate.riotTagLine) === normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine) ||
        Boolean(entry.riotPuuid && candidate.riotPuuid === entry.riotPuuid)
    );
    if (existingIndex >= 0) {
      const previous = this.participationQueue[existingIndex]!;
      const next = { ...previous, ...entry, id: previous.id, updatedAt: nowIso() };
      this.participationQueue[existingIndex] = next;
      return next;
    }
    this.participationQueue.push(entry);
    return entry;
  }

  setParticipationOpen(open: boolean): void {
    this.patchStatus({ participation: open ? "open" : "closed" });
  }

  selectNextParticipant(checkInSeconds: number): ParticipationEntry | undefined {
    if (this.getPendingSelectedParticipant()) return undefined;
    const next = this.participationQueue.find((entry) => entry.status === "waitlisted" || entry.status === "verified" || entry.status === "pending");
    if (!next) return undefined;
    next.status = "selected";
    next.selectedAt = nowIso();
    next.checkInExpiresAt = new Date(Date.now() + checkInSeconds * 1000).toISOString();
    next.updatedAt = nowIso();
    return next;
  }

  getPendingSelectedParticipant(now = new Date()): ParticipationEntry | undefined {
    return this.participationQueue.find((entry) => entry.status === "selected" && !isCheckInExpired(entry, now));
  }

  markParticipantNoShow(id: string, note?: string): ParticipationEntry | undefined {
    const entry = this.participationQueue.find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = "no_show";
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    return entry;
  }

  markExpiredSelectedNoShows(now = new Date()): ParticipationEntry[] {
    const expired: ParticipationEntry[] = [];
    for (const entry of this.participationQueue) {
      if (entry.status !== "selected" || !isCheckInExpired(entry, now)) continue;
      const marked = this.markParticipantNoShow(entry.id, "참가 확인 시간이 만료되었습니다.");
      if (marked) expired.push(marked);
    }
    return expired;
  }

  checkInSelectedParticipant(twitchUserId: string, now = new Date()): ParticipationCheckInResult {
    const entry = this.participationQueue.find((candidate) => candidate.twitchUserId === twitchUserId && candidate.status === "selected");
    if (!entry) return { ok: false, reason: "missing" };
    if (isCheckInExpired(entry, now)) {
      const marked = this.markParticipantNoShow(entry.id, "만료 후 참가 확인을 시도했습니다.");
      return { ok: false, reason: "expired", entry: marked ?? entry };
    }
    entry.status = "checked_in";
    entry.updatedAt = nowIso();
    return { ok: true, entry };
  }

  checkInParticipant(twitchUserId: string): ParticipationEntry | undefined {
    const result = this.checkInSelectedParticipant(twitchUserId);
    if (!result.ok) return undefined;
    return result.entry;
  }

  cancelParticipationByUser(twitchUserId: string, note?: string): ParticipationCancelResult {
    const entry = this.participationQueue.find((candidate) => candidate.twitchUserId === twitchUserId && isActiveParticipationStatus(candidate.status));
    if (!entry) return { ok: false, reason: "missing" };
    if (!CANCELLABLE_PARTICIPATION_STATUSES.has(entry.status)) return { ok: false, reason: "in_game" };
    entry.status = "cancelled";
    entry.checkInExpiresAt = undefined;
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    return { ok: true, entry };
  }

  markParticipant(id: string, status: ParticipationEntry["status"]): ParticipationEntry | undefined {
    const entry = this.participationQueue.find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = nowIso();
    if (status === "played") entry.playedAt = nowIso();
    return entry;
  }

  markReadyParticipantsInGame(): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueue) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    return entries;
  }

  markVisibleParticipationQueueInGame(limit = PARTICIPATION_OVERLAY_VISIBLE_LIMIT): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    const seenIds = new Set<string>();
    const markInGame = (entry: ParticipationEntry): void => {
      if (seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    };

    for (const entry of this.participationQueue) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      markInGame(entry);
    }

    const maxWaiting = Math.max(0, Math.trunc(limit));
    for (const entry of this.getWaitingParticipationQueue().slice(0, maxWaiting)) {
      markInGame(entry);
    }

    return entries;
  }

  markInGameParticipantsPlayed(): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueue) {
      if (entry.status !== "in_game") continue;
      entry.status = "played";
      entry.playedAt = nowIso();
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    return entries;
  }

  patchParticipationProfile(id: string, patch: Pick<
    Partial<ParticipationEntry>,
    "profileStatus" | "profileFailureReason" | "mainRole" | "mainRoleConfidence" | "topChampions" | "rankedStats" | "verifiedRank" | "profileAnalyzedAt" | "riotPuuid"
  >): ParticipationEntry | undefined {
    const entry = this.participationQueue.find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    Object.assign(entry, {
      ...patch,
      topChampions: patch.topChampions ? patch.topChampions.map((champion) => ({ ...champion })) : patch.topChampions,
      updatedAt: nowIso()
    });
    return { ...entry, topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined };
  }

  setParticipationRequestedRole(id: string, role: ParticipationEntry["preferredRole"]): ParticipationEntry | undefined {
    const entry = this.participationQueue.find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.requestedRole = role;
    entry.preferredRole = role;
    entry.updatedAt = nowIso();
    return { ...entry, topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined };
  }

  makeParticipationEntry(input: Omit<ParticipationEntry, "id" | "createdAt" | "updatedAt">): ParticipationEntry {
    return {
      id: newId("part"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input
    };
  }
}
