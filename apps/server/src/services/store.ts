import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  BotStatus,
  CommunityPost,
  CommunityPostCategory,
  CommunityPostComment,
  CommunityPostCommentCreateInput,
  CommunityPostCreateInput,
  CommunityPostReport,
  CommunityPostReportCreateInput,
  CommunityPostModeration,
  CommunityReportReason,
  CommunityModerationSnapshot,
  CommunitySanction,
  InternalEvent,
  LolAutomationSettings,
  OverlayChannel,
  OverlayMessageLogEntry,
  OverlayStatus,
  ParticipationDashboardQueueEntry,
  ParticipationEntry,
  ParticipationPublicQueueEntry,
  ParticipationSession,
  ParticipationState,
  StreamerProfileLink,
  StreamerProfileSnapshot,
  StreamerRiotIdRequest,
  StreamerTournament,
  TournamentMatch,
  TournamentNewsItem,
  TournamentPlayerRole,
  TournamentTeam,
  TournamentTeamPlayer,
  TournamentUpsertInput,
  TwitchChatSendFailure,
  TwitchChatStatus,
  TwitchEventSubStatus,
  TwitchEventSubSubscriptionStatus
} from "@streamops/shared";
import { OVERLAY_CHANNELS, formatRiotId, isActiveParticipationStatus, isWaitingParticipationStatus, newId, normalizeRiotIdKey, nowIso, toSafeErrorMessage, type ParticipationStreamerProfile } from "@streamops/shared";

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

export type FollowerSnapshotInput = {
  userId: string;
  userLogin?: string;
  userName: string;
  profileImageUrl?: string;
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
  streamerRiotIdStatePath?: string;
  tournamentStatePath?: string;
  communityStatePath?: string;
  runtimeStatePath?: string;
  onPersistenceError?: (failure: StorePersistenceFailure) => void;
};

export type StorePersistenceFailure = {
  scope: "followers" | "streamer_riot_ids" | "tournaments" | "community" | "runtime";
  operation: "load" | "save" | "readiness";
  filePath: string;
  error: string;
};

export type StoreReadiness = {
  ok: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export type TwitchStreamLiveStatus = {
  twitchUserId: string;
  isLive: boolean;
  updatedAt: string;
  source: "eventsub" | "snapshot";
};

export type StreamerRiotIdRequestInput = {
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  twitchProfileImageUrl?: string;
  riotGameName: string;
  riotTagLine: string;
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
const PERSISTED_PARTICIPATION_STATUSES = new Set<ParticipationEntry["status"]>([
  "pending", "verified", "waitlisted", "selected", "checked_in", "invited", "in_game", "played",
  "skipped", "cancelled", "no_show", "rejected", "blocked"
]);
const PERSISTED_PARTICIPATION_SOURCES = new Set<ParticipationEntry["source"]>(["chat_command", "channel_point", "dashboard"]);
const PERSISTED_LOL_ROLES = new Set<ParticipationEntry["preferredRole"]>(["top", "jungle", "mid", "adc", "support", "fill", "unknown"]);
const PARTICIPATION_OVERLAY_VISIBLE_LIMIT = 4;
const PARTICIPATION_TOP_CHAMPION_LIMIT = 3;

function cloneParticipationTopChampions(
  topChampions: ParticipationEntry["topChampions"]
): ParticipationEntry["topChampions"] {
  return topChampions
    ?.slice(0, PARTICIPATION_TOP_CHAMPION_LIMIT)
    .map((champion) => ({ ...champion }));
}

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
    topChampions: cloneParticipationTopChampions(entry.topChampions),
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
    topChampions: cloneParticipationTopChampions(entry.topChampions),
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

function optionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizedParticipationEntry(value: unknown): ParticipationEntry | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const twitchUserId = optionalString(input?.twitchUserId);
  const twitchUserName = optionalString(input?.twitchUserName);
  const riotGameName = optionalString(input?.riotGameName);
  const riotTagLine = optionalString(input?.riotTagLine);
  const status = optionalString(input?.status) as ParticipationEntry["status"] | undefined;
  const source = optionalString(input?.source) as ParticipationEntry["source"] | undefined;
  const preferredRole = optionalString(input?.preferredRole) as ParticipationEntry["preferredRole"] | undefined;
  const createdAt = optionalString(input?.createdAt);
  const updatedAt = optionalString(input?.updatedAt);
  if (!id || !twitchUserId || !twitchUserName || !riotGameName || !riotTagLine || !status || !source || !preferredRole || !createdAt || !updatedAt) return undefined;
  if (!PERSISTED_PARTICIPATION_STATUSES.has(status) || !PERSISTED_PARTICIPATION_SOURCES.has(source) || !PERSISTED_LOL_ROLES.has(preferredRole)) return undefined;
  return {
    ...(input as ParticipationEntry),
    id,
    twitchUserId,
    twitchUserName,
    riotGameName,
    riotTagLine,
    status,
    source,
    preferredRole,
    createdAt,
    updatedAt,
    topChampions: Array.isArray(input?.topChampions)
      ? input.topChampions
        .map((champion) => objectRecord(champion))
        .filter((champion): champion is Record<string, unknown> => Boolean(champion))
        .slice(0, PARTICIPATION_TOP_CHAMPION_LIMIT)
        .map((champion) => ({ ...champion })) as ParticipationEntry["topChampions"]
      : undefined
  };
}

function cloneParticipationEntry(entry: ParticipationEntry): ParticipationEntry {
  return {
    ...entry,
    rankedStats: entry.rankedStats ? { ...entry.rankedStats } : undefined,
    topChampions: cloneParticipationTopChampions(entry.topChampions)
  };
}

function cloneParticipationStreamerProfile(profile: ParticipationStreamerProfile | undefined): ParticipationStreamerProfile | undefined {
  return profile ? {
    ...profile,
    topChampions: cloneParticipationTopChampions(profile.topChampions),
    rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
    performanceStats: profile.performanceStats ? { ...profile.performanceStats } : undefined,
    recentMatches: profile.recentMatches?.map((match) => ({ ...match })),
    rankHistory: profile.rankHistory?.map((point) => ({ ...point }))
  } : undefined;
}

function normalizedParticipationSession(value: unknown, streamerId: string): ParticipationSession | undefined {
  const input = objectRecord(value);
  const sessionId = optionalString(input?.sessionId);
  const status = optionalString(input?.status) as ParticipationSession["status"] | undefined;
  const createdAt = optionalString(input?.createdAt);
  const updatedAt = optionalString(input?.updatedAt);
  if (!sessionId || !status || !createdAt || !updatedAt || !["closed", "recruiting", "in_game", "completed"].includes(status)) return undefined;
  const rawSnapshot = objectRecord(input?.profileSnapshot);
  const profileSnapshot = rawSnapshot && optionalString(rawSnapshot.riotGameName) && optionalString(rawSnapshot.riotTagLine)
    ? {
        ...(rawSnapshot as StreamerProfileSnapshot),
        riotGameName: optionalString(rawSnapshot.riotGameName)!,
        riotTagLine: optionalString(rawSnapshot.riotTagLine)!,
        normalizedRiotId: optionalString(rawSnapshot.normalizedRiotId) ?? normalizeRiotIdKey(optionalString(rawSnapshot.riotGameName)!, optionalString(rawSnapshot.riotTagLine)!),
        capturedAt: optionalString(rawSnapshot.capturedAt) ?? createdAt,
        profile: cloneParticipationStreamerProfile(rawSnapshot.profile as ParticipationStreamerProfile | undefined)
      }
    : undefined;
  return {
    streamerId,
    sessionId,
    status,
    profileSnapshot,
    createdAt,
    updatedAt,
    endedAt: optionalString(input?.endedAt)
  };
}

function cloneParticipationSession(session: ParticipationSession | undefined): ParticipationSession | undefined {
  return session ? {
    ...session,
    profileSnapshot: session.profileSnapshot ? {
      ...session.profileSnapshot,
      profile: cloneParticipationStreamerProfile(session.profileSnapshot.profile)
    } : undefined
  } : undefined;
}

function normalizedLolAutomationSettings(value: unknown, streamerId: string): LolAutomationSettings {
  const input = objectRecord(value);
  const pollIntervalMs = Number(input?.pollIntervalMs);
  const gameEndDebounceMs = Number(input?.gameEndDebounceMs);
  return {
    streamerId,
    enabled: typeof input?.enabled === "boolean" ? input.enabled : DEFAULT_LOL_AUTOMATION_SETTINGS.enabled,
    autoSelectNextAfterGame: typeof input?.autoSelectNextAfterGame === "boolean" ? input.autoSelectNextAfterGame : DEFAULT_LOL_AUTOMATION_SETTINGS.autoSelectNextAfterGame,
    announceInChat: typeof input?.announceInChat === "boolean" ? input.announceInChat : DEFAULT_LOL_AUTOMATION_SETTINGS.announceInChat,
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? Math.max(10_000, Math.trunc(pollIntervalMs)) : DEFAULT_LOL_AUTOMATION_SETTINGS.pollIntervalMs,
    gameEndDebounceMs: Number.isFinite(gameEndDebounceMs) ? Math.max(0, Math.trunc(gameEndDebounceMs)) : DEFAULT_LOL_AUTOMATION_SETTINGS.gameEndDebounceMs,
    updatedAt: optionalString(input?.updatedAt) ?? nowIso()
  };
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
    profileImageUrl: optionalString(input?.profileImageUrl),
    riotGameName: optionalString(input?.riotGameName),
    riotTagLine: optionalString(input?.riotTagLine),
    riotPuuid: optionalString(input?.riotPuuid),
    riotIdUpdatedAt: optionalString(input?.riotIdUpdatedAt),
    followedAt: optionalString(input?.followedAt),
    firstSeenAt: optionalString(input?.firstSeenAt) ?? optionalString(input?.followedAt) ?? now,
    lastSeenAt: optionalString(input?.lastSeenAt) ?? now,
    status,
    unfollowedAt: status === "unfollowed" ? optionalString(input?.unfollowedAt) : undefined,
    source,
    activity: normalizedFollowerActivity(input?.activity)
  };
}

function cloneStreamerProfileLinks(links: StreamerProfileLink[] | undefined): StreamerProfileLink[] | undefined {
  return links?.map((link) => ({ ...link }));
}

function normalizedStreamerProfileLinks(value: unknown, legacyUrl?: string, legacyLabel?: string): StreamerProfileLink[] | undefined {
  const links: StreamerProfileLink[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const input = objectRecord(item);
      const url = optionalString(input?.url);
      if (!url) continue;
      const label = optionalString(input?.label) || legacyLabel || url;
      links.push({
        id: optionalString(input?.id) || newId("plink"),
        url,
        label,
        platform: optionalString(input?.platform)
      });
    }
  }
  if (!links.length && legacyUrl) {
    links.push({
      id: newId("plink"),
      url: legacyUrl,
      label: legacyLabel || legacyUrl
    });
  }
  return links.length ? links : undefined;
}

function firstStreamerProfileLink(links: StreamerProfileLink[] | undefined): StreamerProfileLink | undefined {
  return links?.find((link) => link.url);
}

function cloneStreamerRiotIdRequest(request: StreamerRiotIdRequest): StreamerRiotIdRequest {
  return { ...request, profileLinks: cloneStreamerProfileLinks(request.profileLinks) };
}

function streamerOverlaySlug(twitchLogin: string, twitchUserId?: string): string {
  const slug = twitchLogin.trim().toLowerCase().replace(/[^a-z0-9_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || `streamer-${twitchUserId ?? "unknown"}`;
}

function newStreamerOverlayKey(): string {
  return `sok_${crypto.randomBytes(24).toString("base64url")}`;
}

function ensureApprovedStreamerOverlayAccess(request: StreamerRiotIdRequest): void {
  if (request.status !== "approved") return;
  request.overlaySlug = request.overlaySlug || streamerOverlaySlug(request.twitchLogin, request.twitchUserId);
  request.overlayKey = request.overlayKey || newStreamerOverlayKey();
}

function normalizedStreamerRiotIdRequest(value: unknown): StreamerRiotIdRequest | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const twitchUserId = optionalString(input?.twitchUserId);
  const twitchLogin = optionalString(input?.twitchLogin);
  const twitchDisplayName = optionalString(input?.twitchDisplayName);
  const riotGameName = optionalString(input?.riotGameName);
  const riotTagLine = optionalString(input?.riotTagLine);
  if (!id || !twitchUserId || !twitchLogin || !twitchDisplayName || !riotGameName || !riotTagLine) return undefined;
  const status = input?.status === "approved" || input?.status === "rejected" ? input.status : "pending";
  const requestedAt = optionalString(input?.requestedAt) ?? nowIso();
  const updatedAt = optionalString(input?.updatedAt) ?? requestedAt;
  const profileLinkUrl = optionalString(input?.profileLinkUrl);
  const profileLinkLabel = optionalString(input?.profileLinkLabel);
  const profileLinks = normalizedStreamerProfileLinks(input?.profileLinks, profileLinkUrl, profileLinkLabel);
  const primaryProfileLink = firstStreamerProfileLink(profileLinks);
  const request: StreamerRiotIdRequest = {
    id,
    twitchUserId,
    twitchLogin,
    twitchDisplayName,
    twitchProfileImageUrl: optionalString(input?.twitchProfileImageUrl),
    riotGameName,
    riotTagLine,
    normalizedRiotId: normalizeRiotIdKey(riotGameName, riotTagLine),
    overlaySlug: optionalString(input?.overlaySlug) ?? streamerOverlaySlug(twitchLogin, twitchUserId),
    overlayKey: optionalString(input?.overlayKey),
    profileLinkUrl: primaryProfileLink?.url ?? profileLinkUrl,
    profileLinkLabel: primaryProfileLink?.label ?? profileLinkLabel,
    profileLinks,
    status,
    dashboardEnabled: status === "approved" && input?.dashboardEnabled === true,
    requestedAt,
    updatedAt,
    reviewedAt: optionalString(input?.reviewedAt),
    reviewer: optionalString(input?.reviewer),
    note: optionalString(input?.note)
  };
  ensureApprovedStreamerOverlayAccess(request);
  return request;
}

function optionalInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

function normalizedTournamentVisibility(value: unknown): "draft" | "public" {
  return value === "public" ? "public" : "draft";
}

function normalizedTournamentMatchStatus(value: unknown): "scheduled" | "live" | "completed" {
  if (value === "live" || value === "completed") return value;
  return "scheduled";
}

function normalizedTournamentPlayerRole(value: unknown): TournamentPlayerRole {
  if (value === "TOP" || value === "JUNGLE" || value === "MID" || value === "ADC" || value === "SUPPORT") return value;
  return "TOP";
}

function tournamentSlugPart(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || "tournament";
}

function cloneTournamentTeamPlayer(player: TournamentTeamPlayer): TournamentTeamPlayer {
  return { ...player };
}

function cloneTournamentTeam(team: TournamentTeam): TournamentTeam {
  return {
    ...team,
    players: team.players?.map(cloneTournamentTeamPlayer)
  };
}

function cloneTournamentMatch(match: TournamentMatch): TournamentMatch {
  return {
    ...match,
    recordMatchIds: match.recordMatchIds ? [...match.recordMatchIds] : undefined
  };
}

function cloneTournamentNewsItem(item: TournamentNewsItem): TournamentNewsItem {
  return { ...item };
}

function cloneStreamerTournament(tournament: StreamerTournament): StreamerTournament {
  return {
    ...tournament,
    teams: tournament.teams.map(cloneTournamentTeam),
    matches: tournament.matches.map(cloneTournamentMatch),
    news: tournament.news.map(cloneTournamentNewsItem)
  };
}

function normalizedTournamentTeam(value: unknown, index: number): TournamentTeam | undefined {
  const input = objectRecord(value);
  const name = optionalString(input?.name);
  if (!name) return undefined;
  const players = Array.isArray(input?.players)
    ? input.players.map(normalizedTournamentTeamPlayer).filter((player): player is TournamentTeamPlayer => Boolean(player))
    : undefined;
  return {
    id: optionalString(input?.id) || newId("team"),
    name,
    seed: optionalInteger(input?.seed) ?? index + 1,
    avatarUrl: optionalString(input?.avatarUrl),
    twitchLogin: optionalString(input?.twitchLogin),
    riotId: optionalString(input?.riotId),
    players
  };
}

function normalizedTournamentTeamPlayer(value: unknown): TournamentTeamPlayer | undefined {
  const input = objectRecord(value);
  const riotId = optionalString(input?.riotId);
  if (!riotId) return undefined;
  return {
    id: optionalString(input?.id) || newId("player"),
    role: normalizedTournamentPlayerRole(input?.role),
    riotId,
    leader: input?.leader === true
  };
}

function normalizedTournamentMatch(value: unknown): TournamentMatch | undefined {
  const input = objectRecord(value);
  const teamAId = optionalString(input?.teamAId);
  const teamBId = optionalString(input?.teamBId);
  const round = optionalString(input?.round) || "round";
  if (!teamAId && !teamBId) return undefined;
  const recordMatchIds = Array.isArray(input?.recordMatchIds)
    ? input.recordMatchIds.map(optionalString).filter((id): id is string => Boolean(id))
    : undefined;
  return {
    id: optionalString(input?.id) || newId("match"),
    round,
    teamAId,
    teamBId,
    scoreA: optionalInteger(input?.scoreA),
    scoreB: optionalInteger(input?.scoreB),
    scheduledAt: optionalString(input?.scheduledAt),
    format: optionalString(input?.format),
    status: normalizedTournamentMatchStatus(input?.status),
    winnerTeamId: optionalString(input?.winnerTeamId),
    recordMatchIds
  };
}

function normalizedTournamentNewsItem(value: unknown): TournamentNewsItem | undefined {
  const input = objectRecord(value);
  const title = optionalString(input?.title);
  if (!title) return undefined;
  return {
    id: optionalString(input?.id) || newId("tnews"),
    title,
    body: optionalString(input?.body) || "",
    publishedAt: optionalString(input?.publishedAt) || nowIso()
  };
}

function normalizedStreamerTournament(value: unknown): StreamerTournament | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const ownerTwitchUserId = optionalString(input?.ownerTwitchUserId);
  const ownerTwitchLogin = optionalString(input?.ownerTwitchLogin);
  const ownerDisplayName = optionalString(input?.ownerDisplayName);
  const title = optionalString(input?.title);
  if (!id || !ownerTwitchUserId || !ownerTwitchLogin || !ownerDisplayName || !title) return undefined;
  const createdAt = optionalString(input?.createdAt) || nowIso();
  const teams = Array.isArray(input?.teams)
    ? input.teams.map((team, index) => normalizedTournamentTeam(team, index)).filter((team): team is TournamentTeam => Boolean(team))
    : [];
  const matches = Array.isArray(input?.matches)
    ? input.matches.map(normalizedTournamentMatch).filter((match): match is TournamentMatch => Boolean(match))
    : [];
  const news = Array.isArray(input?.news)
    ? input.news.map(normalizedTournamentNewsItem).filter((item): item is TournamentNewsItem => Boolean(item))
    : [];
  return {
    id,
    slug: optionalString(input?.slug) || tournamentSlugPart(`${title}-${ownerTwitchLogin}`),
    ownerTwitchUserId,
    ownerTwitchLogin,
    ownerDisplayName,
    ownerProfileImageUrl: optionalString(input?.ownerProfileImageUrl),
    title,
    description: optionalString(input?.description) || "",
    startsAt: optionalString(input?.startsAt),
    endsAt: optionalString(input?.endsAt),
    formatLabel: optionalString(input?.formatLabel),
    prizeLabel: optionalString(input?.prizeLabel),
    visibility: normalizedTournamentVisibility(input?.visibility),
    teams,
    matches,
    news,
    createdAt,
    updatedAt: optionalString(input?.updatedAt) || createdAt,
    publishedAt: optionalString(input?.publishedAt)
  };
}

function cloneCommunityPost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    tags: [...post.tags],
    comments: post.comments.map((comment) => ({ ...comment })),
    moderation: post.moderation ? { ...post.moderation } : undefined
  };
}

function cloneCommunityReport(report: CommunityPostReport): CommunityPostReport {
  return { ...report };
}

function cloneCommunitySanction(sanction: CommunitySanction): CommunitySanction {
  return { ...sanction };
}

function normalizedCommunityTags(value: unknown): string[] {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const tags: string[] = [];
  for (const rawTag of rawTags) {
    if (typeof rawTag !== "string") continue;
    const tag = rawTag.trim().replace(/^#+/, "").slice(0, 20);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= 5) break;
  }
  return tags;
}

function normalizedCommunityCategory(value: unknown): CommunityPostCategory {
  return value === "party" ? "party" : "server";
}

function normalizedCommunityComment(value: unknown): CommunityPostComment | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const body = optionalString(input?.body);
  const authorTwitchUserId = optionalString(input?.authorTwitchUserId);
  const authorTwitchLogin = optionalString(input?.authorTwitchLogin);
  const authorDisplayName = optionalString(input?.authorDisplayName);
  const createdAt = optionalString(input?.createdAt) || nowIso();
  if (!id || !body || !authorTwitchUserId || !authorTwitchLogin || !authorDisplayName) return undefined;
  return {
    id,
    body,
    authorTwitchUserId,
    authorTwitchLogin,
    authorDisplayName,
    authorProfileImageUrl: optionalString(input?.authorProfileImageUrl),
    createdAt
  };
}

function normalizedCommunityComments(value: unknown): CommunityPostComment[] {
  return Array.isArray(value)
    ? value.map(normalizedCommunityComment).filter((comment): comment is CommunityPostComment => Boolean(comment))
    : [];
}

function normalizedCommunityPost(value: unknown): CommunityPost | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const title = optionalString(input?.title);
  const body = optionalString(input?.body);
  const authorTwitchUserId = optionalString(input?.authorTwitchUserId);
  const authorTwitchLogin = optionalString(input?.authorTwitchLogin);
  const authorDisplayName = optionalString(input?.authorDisplayName);
  if (!id || !title || !body || !authorTwitchUserId || !authorTwitchLogin || !authorDisplayName) return undefined;
  const createdAt = optionalString(input?.createdAt) || nowIso();
  const moderationInput = objectRecord(input?.moderation);
  const moderationUpdatedAt = optionalString(moderationInput?.updatedAt);
  const moderationUpdatedBy = optionalString(moderationInput?.updatedBy);
  const moderation: CommunityPostModeration | undefined = moderationUpdatedAt && moderationUpdatedBy
    ? {
        visibility: moderationInput?.visibility === "hidden" ? "hidden" : "visible",
        reason: optionalString(moderationInput?.reason),
        updatedAt: moderationUpdatedAt,
        updatedBy: moderationUpdatedBy
      }
    : undefined;
  return {
    id,
    category: normalizedCommunityCategory(input?.category),
    title,
    body,
    riotGameName: optionalString(input?.riotGameName),
    riotTagLine: optionalString(input?.riotTagLine),
    tags: normalizedCommunityTags(input?.tags),
    imageUrl: optionalString(input?.imageUrl),
    imageAlt: optionalString(input?.imageAlt),
    partyTier: optionalString(input?.partyTier),
    partyRole: optionalString(input?.partyRole),
    partyMode: optionalString(input?.partyMode),
    partyVoice: optionalString(input?.partyVoice),
    partyCapacity: optionalNumber(input?.partyCapacity),
    authorTwitchUserId,
    authorTwitchLogin,
    authorDisplayName,
    authorProfileImageUrl: optionalString(input?.authorProfileImageUrl),
    authorRiotGameName: optionalString(input?.authorRiotGameName),
    authorRiotTagLine: optionalString(input?.authorRiotTagLine),
    comments: normalizedCommunityComments(input?.comments),
    moderation,
    createdAt,
    updatedAt: optionalString(input?.updatedAt) || createdAt
  };
}

function normalizedCommunityReportReason(value: unknown): CommunityReportReason {
  return value === "harassment" || value === "privacy" || value === "other" ? value : "spam";
}

function normalizedCommunityReport(value: unknown): CommunityPostReport | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const postId = optionalString(input?.postId);
  const reporterTwitchUserId = optionalString(input?.reporterTwitchUserId);
  const reporterTwitchLogin = optionalString(input?.reporterTwitchLogin);
  const reporterDisplayName = optionalString(input?.reporterDisplayName);
  if (!id || !postId || !reporterTwitchUserId || !reporterTwitchLogin || !reporterDisplayName) return undefined;
  return {
    id,
    postId,
    reason: normalizedCommunityReportReason(input?.reason),
    detail: optionalString(input?.detail),
    reporterTwitchUserId,
    reporterTwitchLogin,
    reporterDisplayName,
    status: input?.status === "resolved" ? "resolved" : "open",
    createdAt: optionalString(input?.createdAt) || nowIso(),
    resolvedAt: optionalString(input?.resolvedAt),
    resolvedBy: optionalString(input?.resolvedBy),
    resolutionNote: optionalString(input?.resolutionNote)
  };
}

function normalizedCommunitySanction(value: unknown): CommunitySanction | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const twitchUserId = optionalString(input?.twitchUserId);
  const reason = optionalString(input?.reason);
  const createdBy = optionalString(input?.createdBy);
  if (!id || !twitchUserId || !reason || !createdBy) return undefined;
  return {
    id,
    twitchUserId,
    twitchLogin: optionalString(input?.twitchLogin),
    action: "posting_suspension",
    reason,
    createdAt: optionalString(input?.createdAt) || nowIso(),
    createdBy,
    expiresAt: optionalString(input?.expiresAt),
    revokedAt: optionalString(input?.revokedAt),
    revokedBy: optionalString(input?.revokedBy)
  };
}

type CommunityPostAuthorInput = {
  authorTwitchUserId: string;
  authorTwitchLogin: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  authorRiotGameName?: string;
  authorRiotTagLine?: string;
  riotGameName?: string;
  riotTagLine?: string;
  tags?: string[] | string;
  imageUrl?: string;
  imageAlt?: string;
  partyTier?: string;
  partyRole?: string;
  partyMode?: string;
  partyVoice?: string;
  partyCapacity?: number;
};

type CommunityPostCommentAuthorInput = {
  authorTwitchUserId: string;
  authorTwitchLogin: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
};

type ScopedParticipationRuntime = {
  isOpen: boolean;
  queue: ParticipationEntry[];
  streamerProfile?: ParticipationStreamerProfile;
  session?: ParticipationSession;
};

const DEFAULT_LOL_AUTOMATION_SETTINGS = {
  enabled: false,
  autoSelectNextAfterGame: true,
  announceInChat: true,
  pollIntervalMs: 45_000,
  gameEndDebounceMs: 90_000
} as const;

export class Store {
  private static readonly maxSeenTwitchMessageIds = 5000;
  private static readonly maxEvents = 200;
  private static readonly maxActions = 200;
  private static readonly maxQuestions = 200;
  private static readonly maxHighlights = 200;
  private static readonly maxPartyCommunityPostsPerDay = 2;
  private static readonly partyCommunityPostTtlMs = 24 * 60 * 60 * 1000;
  private static readonly communityCleanupIntervalMs = 24 * 60 * 60 * 1000;
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
  private participationStreamerProfile?: ParticipationStreamerProfile;
  private readonly participationByStreamer = new Map<string, ScopedParticipationRuntime>();
  private readonly lolAutomationByStreamer = new Map<string, LolAutomationSettings>();
  private streamerRiotIdRequests: StreamerRiotIdRequest[] = [];
  private tournaments: StreamerTournament[] = [];
  private communityPosts: CommunityPost[] = [];
  private communityReports: CommunityPostReport[] = [];
  private communitySanctions: CommunitySanction[] = [];
  private communityCleanupTimer?: NodeJS.Timeout;
  private readonly persistenceFailures = new Map<string, StorePersistenceFailure>();
  private readonly twitchStreamLiveStatusByUserId = new Map<string, TwitchStreamLiveStatus>();
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
    this.loadStreamerRiotIdState();
    this.loadTournamentState();
    this.loadCommunityState();
    this.loadRuntimeState();
    this.cleanupExpiredPartyCommunityPosts();
    this.startCommunityCleanupTimer();
  }

  private scopedParticipationRuntime(streamerId: string, create = true): ScopedParticipationRuntime | undefined {
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) return undefined;
    const existing = this.participationByStreamer.get(normalizedStreamerId);
    if (existing || !create) return existing;
    const runtime: ScopedParticipationRuntime = { isOpen: false, queue: [] };
    this.participationByStreamer.set(normalizedStreamerId, runtime);
    return runtime;
  }

  private participationQueueFor(streamerId?: string): ParticipationEntry[] {
    if (!streamerId) return this.participationQueue;
    return this.scopedParticipationRuntime(streamerId)?.queue ?? [];
  }

  private participationOpenFor(streamerId?: string): boolean {
    if (!streamerId) return this.status.participation === "open";
    return this.scopedParticipationRuntime(streamerId, false)?.isOpen === true;
  }

  private ownedParticipationEntry(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    if (!streamerId) return entry;
    const runtime = this.scopedParticipationRuntime(streamerId);
    return {
      ...entry,
      streamerId,
      sessionId: entry.sessionId ?? runtime?.session?.sessionId
    };
  }

  private reportPersistenceFailure(failure: StorePersistenceFailure): void {
    this.persistenceFailures.set(failure.scope, failure);
    this.options.onPersistenceError?.(failure);
  }

  private clearPersistenceFailure(scope: StorePersistenceFailure["scope"]): void {
    this.persistenceFailures.delete(scope);
  }

  private isMissingStateFile(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
  }

  getReadiness(): StoreReadiness {
    const paths = [
      ["followers", this.options.followerStatePath],
      ["streamer_riot_ids", this.options.streamerRiotIdStatePath],
      ["tournaments", this.options.tournamentStatePath],
      ["community", this.options.communityStatePath],
      ["runtime", this.options.runtimeStatePath]
    ].filter((entry): entry is [StorePersistenceFailure["scope"], string] => Boolean(entry[1]));
    let statePathsWritable = true;
    for (const [scope, filePath] of paths) {
      try {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (error) {
        statePathsWritable = false;
        this.reportPersistenceFailure({
          scope,
          operation: "readiness",
          filePath,
          error: toSafeErrorMessage(error)
        });
      }
    }
    const errors = [...this.persistenceFailures.values()].map((failure) => `${failure.scope}:${failure.operation}`);
    return {
      ok: statePathsWritable && errors.length === 0,
      checks: {
        statePathsConfigured: paths.length > 0,
        statePathsWritable,
        persistenceHealthy: errors.length === 0
      },
      errors
    };
  }

  flush(): void {
    if (this.followerPersistTimer) {
      clearTimeout(this.followerPersistTimer);
      this.followerPersistTimer = undefined;
    }
    this.persistFollowerState();
    this.persistStreamerRiotIdState();
    this.persistTournamentState();
    this.persistCommunityState();
    this.persistRuntimeState();
  }

  close(): void {
    if (this.communityCleanupTimer) {
      clearInterval(this.communityCleanupTimer);
      this.communityCleanupTimer = undefined;
    }
    this.flush();
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  patchStatus(patch: Partial<BotStatus>): BotStatus {
    this.status = { ...this.status, ...patch };
    return this.getStatus();
  }

  setTwitchStreamLiveStatus(input: {
    twitchUserId: string;
    isLive: boolean;
    source: "eventsub" | "snapshot";
    updatedAt?: string;
  }): TwitchStreamLiveStatus | undefined {
    const twitchUserId = input.twitchUserId.trim();
    if (!/^\d{1,32}$/.test(twitchUserId)) return undefined;
    const status: TwitchStreamLiveStatus = {
      twitchUserId,
      isLive: input.isLive,
      source: input.source,
      updatedAt: input.updatedAt ?? nowIso()
    };
    this.twitchStreamLiveStatusByUserId.set(twitchUserId, status);
    return { ...status };
  }

  getTwitchStreamLiveStatus(twitchUserId: string | undefined): TwitchStreamLiveStatus | undefined {
    const safeTwitchUserId = twitchUserId?.trim();
    if (!safeTwitchUserId) return undefined;
    const status = this.twitchStreamLiveStatusByUserId.get(safeTwitchUserId);
    return status ? { ...status } : undefined;
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
      profileImageUrl: input.profileImageUrl ?? previous?.profileImageUrl,
      riotGameName: previous?.riotGameName,
      riotTagLine: previous?.riotTagLine,
      riotPuuid: previous?.riotPuuid,
      riotIdUpdatedAt: previous?.riotIdUpdatedAt,
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
    riotGameName?: string;
    riotTagLine?: string;
    riotPuuid?: string;
  }): FollowerRecord | undefined {
    const previous = this.followers.get(input.userId);
    if (!previous || previous.status !== "following") return undefined;
    const now = nowIso();
    previous.userName = input.userName || previous.userName;
    previous.lastSeenAt = now;
    if (input.riotGameName && input.riotTagLine) {
      previous.riotGameName = input.riotGameName;
      previous.riotTagLine = input.riotTagLine;
      previous.riotPuuid = input.riotPuuid || previous.riotPuuid;
      previous.riotIdUpdatedAt = now;
    }
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
      this.clearPersistenceFailure("followers");
    } catch (error) {
      this.followers.clear();
      this.lastFollowerSnapshotAt = undefined;
      this.lastFollowerSnapshotTotal = undefined;
      this.lastFollowerSnapshotTruncated = undefined;
      if (!this.isMissingStateFile(error)) {
        this.reportPersistenceFailure({ scope: "followers", operation: "load", filePath: this.options.followerStatePath, error: toSafeErrorMessage(error) });
      }
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
      this.clearPersistenceFailure("followers");
    } catch (error) {
      this.reportPersistenceFailure({ scope: "followers", operation: "save", filePath: this.options.followerStatePath, error: toSafeErrorMessage(error) });
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

  private loadStreamerRiotIdState(): void {
    if (!this.options.streamerRiotIdStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.streamerRiotIdStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const requests = Array.isArray(parsed?.requests) ? parsed.requests : [];
      this.streamerRiotIdRequests = requests
        .map(normalizedStreamerRiotIdRequest)
        .filter((request): request is StreamerRiotIdRequest => Boolean(request));
      this.clearPersistenceFailure("streamer_riot_ids");
    } catch (error) {
      this.streamerRiotIdRequests = [];
      if (!this.isMissingStateFile(error)) {
        this.reportPersistenceFailure({ scope: "streamer_riot_ids", operation: "load", filePath: this.options.streamerRiotIdStatePath, error: toSafeErrorMessage(error) });
      }
    }
  }

  private persistStreamerRiotIdState(): void {
    if (!this.options.streamerRiotIdStatePath) return;
    try {
      const dir = path.dirname(this.options.streamerRiotIdStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = `${this.options.streamerRiotIdStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 1,
        requests: this.streamerRiotIdRequests.map(cloneStreamerRiotIdRequest)
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.streamerRiotIdStatePath);
      this.clearPersistenceFailure("streamer_riot_ids");
    } catch (error) {
      this.reportPersistenceFailure({ scope: "streamer_riot_ids", operation: "save", filePath: this.options.streamerRiotIdStatePath, error: toSafeErrorMessage(error) });
    }
  }

  private loadTournamentState(): void {
    if (!this.options.tournamentStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.tournamentStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const tournaments = Array.isArray(parsed?.tournaments) ? parsed.tournaments : [];
      this.tournaments = tournaments
        .map(normalizedStreamerTournament)
        .filter((tournament): tournament is StreamerTournament => Boolean(tournament));
      this.clearPersistenceFailure("tournaments");
    } catch (error) {
      this.tournaments = [];
      if (!this.isMissingStateFile(error)) {
        this.reportPersistenceFailure({ scope: "tournaments", operation: "load", filePath: this.options.tournamentStatePath, error: toSafeErrorMessage(error) });
      }
    }
  }

  private persistTournamentState(): void {
    if (!this.options.tournamentStatePath) return;
    try {
      const dir = path.dirname(this.options.tournamentStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = `${this.options.tournamentStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 1,
        tournaments: this.tournaments.map(cloneStreamerTournament)
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.tournamentStatePath);
      this.clearPersistenceFailure("tournaments");
    } catch (error) {
      this.reportPersistenceFailure({ scope: "tournaments", operation: "save", filePath: this.options.tournamentStatePath, error: toSafeErrorMessage(error) });
    }
  }

  private loadCommunityState(): void {
    if (!this.options.communityStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.communityStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const posts = Array.isArray(parsed?.posts) ? parsed.posts : [];
      this.communityPosts = posts
        .map(normalizedCommunityPost)
        .filter((post): post is CommunityPost => Boolean(post));
      const reports = Array.isArray(parsed?.reports) ? parsed.reports : [];
      this.communityReports = reports
        .map(normalizedCommunityReport)
        .filter((report): report is CommunityPostReport => Boolean(report));
      const sanctions = Array.isArray(parsed?.sanctions) ? parsed.sanctions : [];
      this.communitySanctions = sanctions
        .map(normalizedCommunitySanction)
        .filter((sanction): sanction is CommunitySanction => Boolean(sanction));
      this.clearPersistenceFailure("community");
    } catch (error) {
      this.communityPosts = [];
      this.communityReports = [];
      this.communitySanctions = [];
      if (!this.isMissingStateFile(error)) {
        this.reportPersistenceFailure({ scope: "community", operation: "load", filePath: this.options.communityStatePath, error: toSafeErrorMessage(error) });
      }
    }
  }

  private persistCommunityState(): void {
    if (!this.options.communityStatePath) return;
    try {
      const dir = path.dirname(this.options.communityStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = `${this.options.communityStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 2,
        posts: this.communityPosts.map(cloneCommunityPost),
        reports: this.communityReports.map(cloneCommunityReport),
        sanctions: this.communitySanctions.map(cloneCommunitySanction)
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.communityStatePath);
      this.clearPersistenceFailure("community");
    } catch (error) {
      this.reportPersistenceFailure({ scope: "community", operation: "save", filePath: this.options.communityStatePath, error: toSafeErrorMessage(error) });
    }
  }

  private loadRuntimeState(): void {
    if (!this.options.runtimeStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.runtimeStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const participation = objectRecord(parsed?.participation);
      const queue = Array.isArray(participation?.queue) ? participation.queue : [];
      this.participationQueue = queue
        .map(normalizedParticipationEntry)
        .filter((entry): entry is ParticipationEntry => Boolean(entry))
        .slice(-2000);
      this.status.participation = participation?.isOpen === true ? "open" : "closed";
      const streamerProfile = objectRecord(participation?.streamerProfile);
      this.participationStreamerProfile = streamerProfile
        ? cloneParticipationStreamerProfile(streamerProfile as ParticipationStreamerProfile)
        : undefined;
      this.participationByStreamer.clear();
      const scopedParticipation = objectRecord(parsed?.participationByStreamer);
      for (const [streamerId, rawRuntime] of Object.entries(scopedParticipation ?? {})) {
        const runtime = objectRecord(rawRuntime);
        if (!streamerId.trim() || !runtime) continue;
        const scopedQueue = (Array.isArray(runtime.queue) ? runtime.queue : [])
          .map(normalizedParticipationEntry)
          .filter((entry): entry is ParticipationEntry => Boolean(entry))
          .slice(-2000)
          .map((entry) => ({ ...entry, streamerId }));
        const scopedProfile = objectRecord(runtime.streamerProfile);
        this.participationByStreamer.set(streamerId, {
          isOpen: runtime.isOpen === true,
          queue: scopedQueue,
          streamerProfile: scopedProfile ? cloneParticipationStreamerProfile(scopedProfile as ParticipationStreamerProfile) : undefined,
          session: normalizedParticipationSession(runtime.session, streamerId)
        });
      }
      this.lolAutomationByStreamer.clear();
      const automationByStreamer = objectRecord(parsed?.lolAutomationByStreamer);
      for (const [streamerId, rawSettings] of Object.entries(automationByStreamer ?? {})) {
        if (!streamerId.trim()) continue;
        this.lolAutomationByStreamer.set(streamerId, normalizedLolAutomationSettings(rawSettings, streamerId));
      }
      this.clearPersistenceFailure("runtime");
    } catch (error) {
      this.participationQueue = [];
      this.participationStreamerProfile = undefined;
      this.participationByStreamer.clear();
      this.lolAutomationByStreamer.clear();
      this.status.participation = "closed";
      if (!this.isMissingStateFile(error)) {
        this.reportPersistenceFailure({ scope: "runtime", operation: "load", filePath: this.options.runtimeStatePath, error: toSafeErrorMessage(error) });
      }
    }
  }

  private persistRuntimeState(): void {
    if (!this.options.runtimeStatePath) return;
    try {
      const dir = path.dirname(this.options.runtimeStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = `${this.options.runtimeStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 2,
        participation: {
          isOpen: this.status.participation === "open",
          queue: this.participationQueue.map(cloneParticipationEntry),
          streamerProfile: cloneParticipationStreamerProfile(this.participationStreamerProfile)
        },
        participationByStreamer: Object.fromEntries([...this.participationByStreamer.entries()].map(([streamerId, runtime]) => [streamerId, {
          isOpen: runtime.isOpen,
          queue: runtime.queue.map((entry) => cloneParticipationEntry({ ...entry, streamerId })),
          streamerProfile: cloneParticipationStreamerProfile(runtime.streamerProfile),
          session: cloneParticipationSession(runtime.session)
        }])),
        lolAutomationByStreamer: Object.fromEntries([...this.lolAutomationByStreamer.entries()].map(([streamerId, settings]) => [streamerId, { ...settings }]))
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.runtimeStatePath);
      this.clearPersistenceFailure("runtime");
    } catch (error) {
      this.reportPersistenceFailure({ scope: "runtime", operation: "save", filePath: this.options.runtimeStatePath, error: toSafeErrorMessage(error) });
    }
  }

  private startCommunityCleanupTimer(): void {
    if (this.communityCleanupTimer) return;
    this.communityCleanupTimer = setInterval(() => {
      this.cleanupExpiredPartyCommunityPosts();
    }, Store.communityCleanupIntervalMs);
    this.communityCleanupTimer.unref?.();
  }

  private isExpiredPartyCommunityPost(post: CommunityPost, referenceMs = Date.now()): boolean {
    if (post.category !== "party") return false;
    const createdMs = Date.parse(post.createdAt);
    return !Number.isFinite(createdMs) || referenceMs - createdMs >= Store.partyCommunityPostTtlMs;
  }

  private cleanupExpiredPartyCommunityPosts(referenceMs = Date.now()): boolean {
    const nextPosts = this.communityPosts.filter((post) => !this.isExpiredPartyCommunityPost(post, referenceMs));
    if (nextPosts.length === this.communityPosts.length) return false;
    this.communityPosts = nextPosts;
    this.persistCommunityState();
    return true;
  }

  listCommunityPosts(limit = 50, category?: CommunityPostCategory): CommunityPost[] {
    this.cleanupExpiredPartyCommunityPosts();
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 50)));
    return this.communityPosts
      .filter((post) => post.moderation?.visibility !== "hidden" && (!category || post.category === category))
      .map(cloneCommunityPost)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, safeLimit);
  }

  getCommunityPostByAuthor(twitchUserId: string | undefined, category?: CommunityPostCategory): CommunityPost | undefined {
    this.cleanupExpiredPartyCommunityPosts();
    const safeUserId = twitchUserId?.trim();
    if (!safeUserId) return undefined;
    const post = this.communityPosts.find((item) => item.authorTwitchUserId === safeUserId && (!category || item.category === category));
    return post ? cloneCommunityPost(post) : undefined;
  }

  countCommunityPostsByAuthor(twitchUserId: string | undefined, category?: CommunityPostCategory): number {
    this.cleanupExpiredPartyCommunityPosts();
    const safeUserId = twitchUserId?.trim();
    if (!safeUserId) return 0;
    return this.communityPosts.filter((item) => item.authorTwitchUserId === safeUserId && (!category || item.category === category)).length;
  }

  getCommunityPostById(postId: string | undefined): CommunityPost | undefined {
    this.cleanupExpiredPartyCommunityPosts();
    const safePostId = postId?.trim();
    if (!safePostId) return undefined;
    const post = this.communityPosts.find((item) => item.id === safePostId && item.moderation?.visibility !== "hidden");
    return post ? cloneCommunityPost(post) : undefined;
  }

  getCommunityModerationSnapshot(limit = 200): CommunityModerationSnapshot {
    this.cleanupExpiredPartyCommunityPosts();
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(Number(limit) || 200)));
    return {
      posts: this.communityPosts
        .map(cloneCommunityPost)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, safeLimit),
      reports: this.communityReports
        .map(cloneCommunityReport)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, safeLimit),
      sanctions: this.communitySanctions
        .map(cloneCommunitySanction)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, safeLimit)
    };
  }

  isCommunityUserSanctioned(twitchUserId: string | undefined, referenceMs = Date.now()): boolean {
    const safeUserId = twitchUserId?.trim();
    if (!safeUserId) return false;
    return this.communitySanctions.some((sanction) => {
      if (sanction.twitchUserId !== safeUserId || sanction.revokedAt) return false;
      if (!sanction.expiresAt) return true;
      const expiresAt = Date.parse(sanction.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > referenceMs;
    });
  }

  reportCommunityPost(input: CommunityPostReportCreateInput & {
    postId: string;
    reporterTwitchUserId: string;
    reporterTwitchLogin: string;
    reporterDisplayName: string;
  }): CommunityPostReport | undefined {
    const postId = input.postId.trim();
    const reporterTwitchUserId = input.reporterTwitchUserId.trim();
    const reporterTwitchLogin = input.reporterTwitchLogin.trim();
    const reporterDisplayName = input.reporterDisplayName.trim();
    const post = this.communityPosts.find((item) => item.id === postId && item.moderation?.visibility !== "hidden");
    if (!post || !reporterTwitchUserId || !reporterTwitchLogin || !reporterDisplayName) return undefined;
    const duplicate = this.communityReports.find((report) => (
      report.postId === postId &&
      report.reporterTwitchUserId === reporterTwitchUserId &&
      report.status === "open"
    ));
    if (duplicate) return cloneCommunityReport(duplicate);
    const report: CommunityPostReport = {
      id: newId("community_report"),
      postId,
      reason: normalizedCommunityReportReason(input.reason),
      detail: input.detail?.trim().slice(0, 500) || undefined,
      reporterTwitchUserId,
      reporterTwitchLogin,
      reporterDisplayName,
      status: "open",
      createdAt: nowIso()
    };
    this.communityReports = [report, ...this.communityReports].slice(0, 2000);
    this.persistCommunityState();
    return cloneCommunityReport(report);
  }

  setCommunityPostVisibility(input: {
    postId: string;
    visibility: "visible" | "hidden";
    reason?: string;
    updatedBy: string;
  }): CommunityPost | undefined {
    const postId = input.postId.trim();
    const updatedBy = input.updatedBy.trim();
    const postIndex = this.communityPosts.findIndex((post) => post.id === postId);
    const post = this.communityPosts[postIndex];
    if (postIndex < 0 || !post || !updatedBy) return undefined;
    const updatedAt = nowIso();
    const updatedPost: CommunityPost = {
      ...post,
      moderation: {
        visibility: input.visibility,
        reason: input.reason?.trim().slice(0, 300) || undefined,
        updatedAt,
        updatedBy
      },
      updatedAt
    };
    this.communityPosts = this.communityPosts.map((item, index) => index === postIndex ? updatedPost : item);
    this.communityReports = this.communityReports.map((report) => (
      report.postId === postId && report.status === "open"
        ? {
            ...report,
            status: "resolved",
            resolvedAt: updatedAt,
            resolvedBy: updatedBy,
            resolutionNote: input.reason?.trim().slice(0, 300) || input.visibility
          }
        : report
    ));
    this.persistCommunityState();
    return cloneCommunityPost(updatedPost);
  }

  setCommunityUserSanction(input: {
    twitchUserId: string;
    twitchLogin?: string;
    active: boolean;
    reason?: string;
    expiresAt?: string;
    updatedBy: string;
  }): CommunitySanction | undefined {
    const twitchUserId = input.twitchUserId.trim();
    const updatedBy = input.updatedBy.trim();
    if (!twitchUserId || !updatedBy) return undefined;
    const now = nowIso();
    if (!input.active) {
      let revoked: CommunitySanction | undefined;
      this.communitySanctions = this.communitySanctions.map((sanction) => {
        if (sanction.twitchUserId !== twitchUserId || sanction.revokedAt) return sanction;
        const next = { ...sanction, revokedAt: now, revokedBy: updatedBy };
        revoked ??= next;
        return next;
      });
      if (revoked) this.persistCommunityState();
      return revoked ? cloneCommunitySanction(revoked) : undefined;
    }
    const activeSanction = this.communitySanctions.find((sanction) => (
      sanction.twitchUserId === twitchUserId && !sanction.revokedAt && (!sanction.expiresAt || Date.parse(sanction.expiresAt) > Date.now())
    ));
    if (activeSanction) return cloneCommunitySanction(activeSanction);
    const sanction: CommunitySanction = {
      id: newId("community_sanction"),
      twitchUserId,
      twitchLogin: input.twitchLogin?.trim() || undefined,
      action: "posting_suspension",
      reason: input.reason?.trim().slice(0, 300) || "community moderation",
      createdAt: now,
      createdBy: updatedBy,
      expiresAt: input.expiresAt?.trim() || undefined
    };
    this.communitySanctions = [sanction, ...this.communitySanctions].slice(0, 1000);
    this.persistCommunityState();
    return cloneCommunitySanction(sanction);
  }

  createCommunityPost(input: CommunityPostCreateInput & CommunityPostAuthorInput): CommunityPost | undefined {
    const title = input.title.trim();
    const body = input.body.trim();
    const category = normalizedCommunityCategory(input.category);
    const authorTwitchUserId = input.authorTwitchUserId.trim();
    const authorTwitchLogin = input.authorTwitchLogin.trim();
    const authorDisplayName = input.authorDisplayName.trim();
    if (!title || !body || !authorTwitchUserId || !authorTwitchLogin || !authorDisplayName || this.isCommunityUserSanctioned(authorTwitchUserId)) return undefined;
    this.cleanupExpiredPartyCommunityPosts();
    if (category === "party") {
      if (this.countCommunityPostsByAuthor(authorTwitchUserId, category) >= Store.maxPartyCommunityPostsPerDay) return undefined;
    } else if (this.communityPosts.some((item) => item.authorTwitchUserId === authorTwitchUserId && item.category === category)) {
      return undefined;
    }
    const now = nowIso();
    const post: CommunityPost = {
      id: newId("post"),
      category,
      title,
      body,
      riotGameName: input.riotGameName?.trim() || undefined,
      riotTagLine: input.riotTagLine?.trim() || undefined,
      tags: normalizedCommunityTags(input.tags),
      imageUrl: input.imageUrl?.trim() || undefined,
      imageAlt: input.imageAlt?.trim() || undefined,
      partyTier: input.partyTier?.trim() || undefined,
      partyRole: input.partyRole?.trim() || undefined,
      partyMode: input.partyMode?.trim() || undefined,
      partyVoice: input.partyVoice?.trim() || undefined,
      partyCapacity: input.partyCapacity && input.partyCapacity > 0 ? Math.max(1, Math.min(5, Math.trunc(input.partyCapacity))) : undefined,
      authorTwitchUserId,
      authorTwitchLogin,
      authorDisplayName,
      authorProfileImageUrl: input.authorProfileImageUrl?.trim() || undefined,
      authorRiotGameName: input.authorRiotGameName?.trim() || undefined,
      authorRiotTagLine: input.authorRiotTagLine?.trim() || undefined,
      comments: [],
      createdAt: now,
      updatedAt: now
    };
    this.communityPosts = [post, ...this.communityPosts].slice(0, 500);
    this.persistCommunityState();
    return cloneCommunityPost(post);
  }

  updateCommunityPost(postId: string, input: CommunityPostCreateInput & {
    riotGameName?: string;
    riotTagLine?: string;
    tags?: string[] | string;
  }): CommunityPost | undefined {
    this.cleanupExpiredPartyCommunityPosts();
    const safePostId = postId.trim();
    const title = input.title.trim();
    const body = input.body.trim();
    if (!safePostId || !title || !body) return undefined;
    const postIndex = this.communityPosts.findIndex((item) => item.id === safePostId);
    if (postIndex < 0) return undefined;
    const post = this.communityPosts[postIndex];
    if (!post) return undefined;
    const updatedPost: CommunityPost = {
      ...post,
      title,
      body,
      riotGameName: input.riotGameName?.trim() || undefined,
      riotTagLine: input.riotTagLine?.trim() || undefined,
      tags: normalizedCommunityTags(input.tags),
      imageUrl: input.imageUrl !== undefined ? input.imageUrl.trim() || undefined : post.imageUrl,
      imageAlt: input.imageAlt !== undefined ? input.imageAlt.trim() || undefined : post.imageAlt,
      updatedAt: nowIso()
    };
    this.communityPosts = this.communityPosts.map((item, index) => (index === postIndex ? updatedPost : item));
    this.persistCommunityState();
    return cloneCommunityPost(updatedPost);
  }

  addCommunityPostComment(postId: string, input: CommunityPostCommentCreateInput & CommunityPostCommentAuthorInput): CommunityPost | undefined {
    this.cleanupExpiredPartyCommunityPosts();
    const safePostId = postId.trim();
    const body = input.body.trim();
    const authorTwitchUserId = input.authorTwitchUserId.trim();
    const authorTwitchLogin = input.authorTwitchLogin.trim();
    const authorDisplayName = input.authorDisplayName.trim();
    if (!safePostId || !body || !authorTwitchUserId || !authorTwitchLogin || !authorDisplayName || this.isCommunityUserSanctioned(authorTwitchUserId)) return undefined;
    const postIndex = this.communityPosts.findIndex((item) => item.id === safePostId);
    if (postIndex < 0) return undefined;
    const post = this.communityPosts[postIndex];
    if (!post || post.category !== "party" || post.moderation?.visibility === "hidden") return undefined;
    const comment: CommunityPostComment = {
      id: newId("comment"),
      body,
      authorTwitchUserId,
      authorTwitchLogin,
      authorDisplayName,
      authorProfileImageUrl: input.authorProfileImageUrl?.trim() || undefined,
      createdAt: nowIso()
    };
    const updatedPost: CommunityPost = {
      ...post,
      comments: [...post.comments, comment],
      updatedAt: comment.createdAt
    };
    this.communityPosts = this.communityPosts.map((item, index) => (index === postIndex ? updatedPost : item));
    this.persistCommunityState();
    return cloneCommunityPost(updatedPost);
  }

  private uniqueTournamentSlug(base: string, existingId?: string): string {
    const cleanBase = tournamentSlugPart(base);
    let slug = cleanBase;
    let suffix = 2;
    while (this.tournaments.some((tournament) => tournament.id !== existingId && tournament.slug === slug)) {
      slug = `${cleanBase}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  listPublicTournaments(): StreamerTournament[] {
    return this.tournaments
      .filter((tournament) => tournament.visibility === "public")
      .map(cloneStreamerTournament)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  getPublicTournamentBySlug(slug: string): StreamerTournament | undefined {
    const tournament = this.tournaments.find((candidate) => candidate.visibility === "public" && candidate.slug === slug);
    return tournament ? cloneStreamerTournament(tournament) : undefined;
  }

  listDashboardTournaments(input: { role: "admin" | "streamer"; twitchUserId?: string }): StreamerTournament[] {
    return this.tournaments
      .filter((tournament) => input.role === "admin" || tournament.ownerTwitchUserId === input.twitchUserId)
      .map(cloneStreamerTournament)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  upsertStreamerTournament(input: TournamentUpsertInput, owner: StreamerRiotIdRequest): StreamerTournament | undefined {
    if (owner.status !== "approved") return undefined;
    const title = input.title?.trim();
    if (!title) return undefined;
    const now = nowIso();
    const existing = input.id ? this.tournaments.find((candidate) => candidate.id === input.id) : undefined;
    if (existing && existing.ownerTwitchUserId !== owner.twitchUserId) return undefined;
    const previous = existing ? cloneStreamerTournament(existing) : undefined;
    const teams = Array.isArray(input.teams)
      ? input.teams.map((team, index) => normalizedTournamentTeam(team, index)).filter((team): team is TournamentTeam => Boolean(team))
      : previous?.teams ?? [];
    const matches = Array.isArray(input.matches)
      ? input.matches.map(normalizedTournamentMatch).filter((match): match is TournamentMatch => Boolean(match))
      : previous?.matches ?? [];
    const news = Array.isArray(input.news)
      ? input.news.map(normalizedTournamentNewsItem).filter((item): item is TournamentNewsItem => Boolean(item))
      : previous?.news ?? [];
    const visibility = normalizedTournamentVisibility(input.visibility ?? previous?.visibility);
    const tournament: StreamerTournament = {
      id: previous?.id ?? newId("tour"),
      slug: previous?.slug ?? this.uniqueTournamentSlug(`${title}-${owner.twitchLogin}`),
      ownerTwitchUserId: owner.twitchUserId,
      ownerTwitchLogin: owner.twitchLogin,
      ownerDisplayName: owner.twitchDisplayName,
      ownerProfileImageUrl: owner.twitchProfileImageUrl,
      title,
      description: input.description?.trim() ?? previous?.description ?? "",
      startsAt: input.startsAt?.trim() || undefined,
      endsAt: input.endsAt?.trim() || undefined,
      formatLabel: input.formatLabel?.trim() || undefined,
      prizeLabel: input.prizeLabel?.trim() || undefined,
      visibility,
      teams,
      matches,
      news,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      publishedAt: visibility === "public" ? previous?.publishedAt ?? now : undefined
    };
    if (existing) {
      Object.assign(existing, tournament);
    } else {
      this.tournaments.unshift(tournament);
    }
    this.persistTournamentState();
    return cloneStreamerTournament(tournament);
  }

  deleteStreamerTournament(id: string, owner: StreamerRiotIdRequest): boolean {
    if (owner.status !== "approved") return false;
    const index = this.tournaments.findIndex((tournament) => tournament.id === id && tournament.ownerTwitchUserId === owner.twitchUserId);
    if (index < 0) return false;
    this.tournaments.splice(index, 1);
    this.persistTournamentState();
    return true;
  }

  listStreamerRiotIdRequests(): StreamerRiotIdRequest[] {
    return this.streamerRiotIdRequests
      .map(cloneStreamerRiotIdRequest)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  listApprovedStreamerRiotIds(): StreamerRiotIdRequest[] {
    return this.listStreamerRiotIdRequests().filter((request) => request.status === "approved");
  }

  upsertStreamerRiotIdRequest(input: StreamerRiotIdRequestInput): StreamerRiotIdRequest {
    const now = nowIso();
    const normalizedRiotId = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    const approvedSame = this.streamerRiotIdRequests.find((request) =>
      request.twitchUserId === input.twitchUserId &&
      request.normalizedRiotId === normalizedRiotId &&
      request.status === "approved"
    );
    if (approvedSame) {
      Object.assign(approvedSame, {
        twitchLogin: input.twitchLogin,
        twitchDisplayName: input.twitchDisplayName,
        twitchProfileImageUrl: input.twitchProfileImageUrl,
        overlaySlug: approvedSame.overlaySlug || streamerOverlaySlug(input.twitchLogin, input.twitchUserId),
        updatedAt: now
      });
      ensureApprovedStreamerOverlayAccess(approvedSame);
      this.persistStreamerRiotIdState();
      return cloneStreamerRiotIdRequest(approvedSame);
    }

    const existing = this.streamerRiotIdRequests.find((request) => request.twitchUserId === input.twitchUserId && request.status === "pending")
      ?? this.streamerRiotIdRequests.find((request) =>
        request.twitchUserId === input.twitchUserId &&
        request.normalizedRiotId === normalizedRiotId &&
        request.status === "rejected"
      );
    if (existing) {
      Object.assign(existing, {
        twitchLogin: input.twitchLogin,
        twitchDisplayName: input.twitchDisplayName,
        twitchProfileImageUrl: input.twitchProfileImageUrl,
        riotGameName: input.riotGameName,
        riotTagLine: input.riotTagLine,
        normalizedRiotId,
        status: "pending" as const,
        dashboardEnabled: false,
        updatedAt: now,
        reviewedAt: undefined,
        reviewer: undefined,
        note: undefined
      });
      this.persistStreamerRiotIdState();
      return cloneStreamerRiotIdRequest(existing);
    }

    const request: StreamerRiotIdRequest = {
      id: newId("riotreq"),
      twitchUserId: input.twitchUserId,
      twitchLogin: input.twitchLogin,
      twitchDisplayName: input.twitchDisplayName,
      twitchProfileImageUrl: input.twitchProfileImageUrl,
      riotGameName: input.riotGameName,
      riotTagLine: input.riotTagLine,
      normalizedRiotId,
      status: "pending",
      dashboardEnabled: false,
      requestedAt: now,
      updatedAt: now
    };
    this.streamerRiotIdRequests.unshift(request);
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  resolveStreamerRiotIdRequest(input: {
    requestId: string;
    decision: "approved" | "rejected";
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    const request = this.streamerRiotIdRequests.find((candidate) => candidate.id === input.requestId);
    if (!request) return undefined;
    const now = nowIso();
    request.status = input.decision;
    request.dashboardEnabled = false;
    request.updatedAt = now;
    request.reviewedAt = now;
    request.reviewer = input.reviewer;
    request.note = input.note;
    if (input.decision === "approved") {
      const previousApproved = this.streamerRiotIdRequests.find((candidate) =>
        candidate.id !== request.id &&
        candidate.twitchUserId === request.twitchUserId &&
        candidate.status === "approved"
      );
      request.overlaySlug = request.overlaySlug || previousApproved?.overlaySlug;
      request.overlayKey = request.overlayKey || previousApproved?.overlayKey;
      request.dashboardEnabled = previousApproved?.dashboardEnabled === true;
      request.profileLinks = request.profileLinks?.length
        ? cloneStreamerProfileLinks(request.profileLinks)
        : cloneStreamerProfileLinks(previousApproved?.profileLinks);
      const primaryProfileLink = firstStreamerProfileLink(request.profileLinks);
      request.profileLinkUrl = request.profileLinkUrl || primaryProfileLink?.url || previousApproved?.profileLinkUrl;
      request.profileLinkLabel = request.profileLinkLabel || primaryProfileLink?.label || previousApproved?.profileLinkLabel;
      request.profileLinks = normalizedStreamerProfileLinks(request.profileLinks, request.profileLinkUrl, request.profileLinkLabel);
      ensureApprovedStreamerOverlayAccess(request);
      for (const candidate of this.streamerRiotIdRequests) {
        if (candidate.id === request.id || candidate.twitchUserId !== request.twitchUserId || candidate.status !== "approved") continue;
        candidate.status = "rejected";
        candidate.dashboardEnabled = false;
        candidate.updatedAt = now;
        candidate.reviewedAt = now;
        candidate.reviewer = input.reviewer;
        candidate.note = "새 Riot ID 승인으로 이전 승인 기록을 비활성화했습니다.";
      }
    }
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  setStreamerRiotIdDashboardEnabled(input: {
    requestId: string;
    dashboardEnabled: boolean;
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    const request = this.streamerRiotIdRequests.find((candidate) => candidate.id === input.requestId);
    if (!request || request.status !== "approved") return undefined;
    const now = nowIso();
    request.dashboardEnabled = input.dashboardEnabled;
    request.updatedAt = now;
    request.reviewedAt = now;
    request.reviewer = input.reviewer;
    request.note = input.note;
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  updateApprovedStreamerProfileLink(input: {
    twitchUserId: string;
    profileLinkUrl?: string;
    profileLinkLabel?: string;
    profileLinks?: StreamerProfileLink[];
  }): StreamerRiotIdRequest | undefined {
    const request = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === input.twitchUserId &&
      candidate.status === "approved"
    );
    if (!request) return undefined;
    const profileLinks = normalizedStreamerProfileLinks(input.profileLinks, input.profileLinkUrl, input.profileLinkLabel);
    const primaryProfileLink = firstStreamerProfileLink(profileLinks);
    request.profileLinks = profileLinks;
    request.profileLinkUrl = primaryProfileLink?.url;
    request.profileLinkLabel = primaryProfileLink ? primaryProfileLink.label : undefined;
    request.updatedAt = nowIso();
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  updateApprovedStreamerRiotId(input: {
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
  }): StreamerRiotIdRequest | undefined {
    const request = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === input.twitchUserId &&
      candidate.status === "approved"
    );
    if (!request) return undefined;
    request.riotGameName = input.riotGameName;
    request.riotTagLine = input.riotTagLine;
    request.normalizedRiotId = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    request.updatedAt = nowIso();
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  getParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).map(cloneParticipationEntry);
  }

  setParticipationStreamerProfile(profile: ParticipationStreamerProfile | undefined, streamerId?: string): ParticipationStreamerProfile | undefined {
    if (streamerId) {
      const runtime = this.scopedParticipationRuntime(streamerId);
      if (!runtime) return undefined;
      runtime.streamerProfile = cloneParticipationStreamerProfile(profile);
    } else {
      this.participationStreamerProfile = cloneParticipationStreamerProfile(profile);
    }
    this.persistRuntimeState();
    return this.getParticipationStreamerProfile(streamerId);
  }

  getParticipationStreamerProfile(streamerId?: string): ParticipationStreamerProfile | undefined {
    const profile = streamerId
      ? this.scopedParticipationRuntime(streamerId, false)?.streamerProfile
      : this.participationStreamerProfile;
    return cloneParticipationStreamerProfile(profile);
  }

  getActiveParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).filter((entry) => isActiveParticipationStatus(entry.status));
  }

  getWaitingParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).filter((entry) => isWaitingParticipationStatus(entry.status));
  }

  getParticipationOverlayQueue(limit = PARTICIPATION_OVERLAY_VISIBLE_LIMIT, streamerId?: string): ParticipationPublicQueueEntry[] {
    return this.getWaitingParticipationQueue(streamerId)
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map((entry, index) => toPublicQueueEntry(entry, index + 1));
  }

  getNextWaitingParticipationOverlayEntry(streamerId?: string): ParticipationPublicQueueEntry | undefined {
    const entry = this.getWaitingParticipationQueue(streamerId)[0];
    return entry ? toPublicQueueEntry(entry, 1) : undefined;
  }

  getParticipationState(streamerId?: string): ParticipationState {
    const queue = this.participationQueueFor(streamerId);
    const activeQueue = this.getActiveParticipationQueue(streamerId);
    return {
      streamerId,
      session: streamerId ? cloneParticipationSession(this.scopedParticipationRuntime(streamerId, false)?.session) : undefined,
      isOpen: this.participationOpenFor(streamerId),
      queue: queue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      activeQueue: activeQueue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      summary: {
        total: queue.length,
        active: activeQueue.length,
        waiting: this.getWaitingParticipationQueue(streamerId).length,
        selected: queue.filter((entry) => entry.status === "selected").length,
        checkedIn: queue.filter((entry) => entry.status === "checked_in").length,
        noShow: queue.filter((entry) => entry.status === "no_show").length,
        played: queue.filter((entry) => entry.status === "played").length
      }
    };
  }

  getActiveParticipationCount(streamerId?: string): number {
    return this.getActiveParticipationQueue(streamerId).length;
  }

  getParticipationEntryById(id: string, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    return entry ? cloneParticipationEntry(entry) : undefined;
  }

  findReusableParticipationProfile(input: {
    riotGameName: string;
    riotTagLine: string;
    riotPuuid?: string;
  }, streamerId?: string): ParticipationEntry | undefined {
    const riotIdKey = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    const reusable = this.participationQueueFor(streamerId)
      .filter((candidate) => {
        if (isActiveParticipationStatus(candidate.status)) return false;
        if (!candidate.profileStatus && !candidate.rankedStats && !candidate.topChampions?.length) return false;
        if (input.riotPuuid && candidate.riotPuuid && candidate.riotPuuid === input.riotPuuid) return true;
        return normalizeRiotIdKey(candidate.riotGameName, candidate.riotTagLine) === riotIdKey;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    return reusable ? cloneParticipationEntry(reusable) : undefined;
  }

  findParticipationDuplicate(input: {
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
    riotPuuid?: string;
  }, streamerId?: string): ParticipationDuplicate | undefined {
    const riotIdKey = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    return this.getActiveParticipationQueue(streamerId).reduce<ParticipationDuplicate | undefined>((found, candidate) => {
      if (found) return found;
      if (candidate.twitchUserId === input.twitchUserId) return { reason: "twitch_user", entry: candidate };
      if (input.riotPuuid && candidate.riotPuuid && candidate.riotPuuid === input.riotPuuid) return { reason: "riot_id", entry: candidate };
      const candidateRiotIdKey = normalizeRiotIdKey(candidate.riotGameName, candidate.riotTagLine);
      if (candidateRiotIdKey === riotIdKey) return { reason: "riot_id", entry: candidate };
      return undefined;
    }, undefined);
  }

  addParticipation(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    queue.push(ownedEntry);
    this.persistRuntimeState();
    return cloneParticipationEntry(ownedEntry);
  }

  reactivateReusableParticipation(entry: ParticipationEntry, streamerId?: string): { entry: ParticipationEntry; reused: boolean } {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    const reusable = queue
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.twitchUserId === entry.twitchUserId && !isActiveParticipationStatus(candidate.status))
      .sort((a, b) => Date.parse(b.candidate.updatedAt) - Date.parse(a.candidate.updatedAt))[0];

    if (!reusable) {
      queue.push(ownedEntry);
      this.persistRuntimeState();
      return { entry: cloneParticipationEntry(ownedEntry), reused: false };
    }

    const previous = reusable.candidate;
    const sameRiotIdentity = Boolean(entry.riotPuuid && previous.riotPuuid && entry.riotPuuid === previous.riotPuuid)
      || normalizeRiotIdKey(previous.riotGameName, previous.riotTagLine) === normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine);
    const profileFallback = sameRiotIdentity ? previous : undefined;
    const reactivated: ParticipationEntry = {
      ...previous,
      ...ownedEntry,
      id: previous.id,
      createdAt: previous.createdAt,
      riotPuuid: ownedEntry.riotPuuid ?? profileFallback?.riotPuuid,
      verifiedRank: ownedEntry.verifiedRank ?? profileFallback?.verifiedRank,
      rankedStats: ownedEntry.rankedStats ?? profileFallback?.rankedStats,
      profileStatus: ownedEntry.profileStatus ?? profileFallback?.profileStatus,
      profileFailureReason: ownedEntry.profileFailureReason ?? profileFallback?.profileFailureReason,
      mainRole: ownedEntry.mainRole ?? profileFallback?.mainRole,
      mainRoleConfidence: ownedEntry.mainRoleConfidence ?? profileFallback?.mainRoleConfidence,
      topChampions: ownedEntry.topChampions ?? profileFallback?.topChampions,
      profileAnalyzedAt: ownedEntry.profileAnalyzedAt ?? profileFallback?.profileAnalyzedAt,
      selectedAt: undefined,
      checkInExpiresAt: undefined,
      playedAt: undefined,
      updatedAt: nowIso()
    };
    queue[reusable.index] = reactivated;
    this.persistRuntimeState();
    return { entry: reactivated, reused: true };
  }

  addOrUpdateParticipation(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    const existingIndex = queue.findIndex(
      (candidate) =>
        candidate.twitchUserId === ownedEntry.twitchUserId ||
        normalizeRiotIdKey(candidate.riotGameName, candidate.riotTagLine) === normalizeRiotIdKey(ownedEntry.riotGameName, ownedEntry.riotTagLine) ||
        Boolean(ownedEntry.riotPuuid && candidate.riotPuuid === ownedEntry.riotPuuid)
    );
    if (existingIndex >= 0) {
      const previous = queue[existingIndex]!;
      const next = { ...previous, ...ownedEntry, id: previous.id, updatedAt: nowIso() };
      queue[existingIndex] = next;
      this.persistRuntimeState();
      return next;
    }
    queue.push(ownedEntry);
    this.persistRuntimeState();
    return cloneParticipationEntry(ownedEntry);
  }

  setParticipationOpen(open: boolean, streamerId?: string): void {
    if (streamerId) {
      const runtime = this.scopedParticipationRuntime(streamerId);
      if (!runtime) return;
      runtime.isOpen = open;
      if (open && !runtime.session) {
        const timestamp = nowIso();
        runtime.session = {
          streamerId,
          sessionId: newId("partsession"),
          status: "recruiting",
          createdAt: timestamp,
          updatedAt: timestamp
        };
      } else if (runtime.session) {
        runtime.session.status = open ? "recruiting" : "closed";
        runtime.session.updatedAt = nowIso();
        if (!open) runtime.session.endedAt = nowIso();
      }
    } else {
      this.patchStatus({ participation: open ? "open" : "closed" });
    }
    this.persistRuntimeState();
  }

  getLolAutomationSettings(streamerId: string): LolAutomationSettings {
    const normalizedStreamerId = streamerId.trim();
    return {
      ...normalizedLolAutomationSettings(this.lolAutomationByStreamer.get(normalizedStreamerId), normalizedStreamerId)
    };
  }

  listLolAutomationSettings(): LolAutomationSettings[] {
    return [...this.lolAutomationByStreamer.keys()]
      .map((streamerId) => this.getLolAutomationSettings(streamerId));
  }

  setLolAutomationSettings(
    streamerId: string,
    patch: Partial<Omit<LolAutomationSettings, "streamerId" | "updatedAt">>
  ): LolAutomationSettings {
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) throw new Error("스트리머 식별자가 필요합니다.");
    const current = this.getLolAutomationSettings(normalizedStreamerId);
    const next = normalizedLolAutomationSettings({
      ...current,
      ...patch,
      updatedAt: nowIso()
    }, normalizedStreamerId);
    this.lolAutomationByStreamer.set(normalizedStreamerId, next);
    this.persistRuntimeState();
    return { ...next };
  }

  getParticipationSession(streamerId: string): ParticipationSession | undefined {
    return cloneParticipationSession(this.scopedParticipationRuntime(streamerId, false)?.session);
  }

  listParticipationSessions(): ParticipationSession[] {
    return [...this.participationByStreamer.values()]
      .map((runtime) => cloneParticipationSession(runtime.session))
      .filter((session): session is ParticipationSession => Boolean(session));
  }

  startParticipationSession(streamerId: string, profileSnapshot?: StreamerProfileSnapshot): ParticipationSession {
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) throw new Error("스트리머 식별자가 필요합니다.");
    const runtime = this.scopedParticipationRuntime(normalizedStreamerId);
    if (!runtime) throw new Error("시참 세션을 생성할 수 없습니다.");
    const timestamp = nowIso();
    const snapshot = profileSnapshot ? {
      ...profileSnapshot,
      profile: cloneParticipationStreamerProfile(profileSnapshot.profile)
    } : undefined;
    runtime.session = {
      streamerId: normalizedStreamerId,
      sessionId: newId("partsession"),
      status: "recruiting",
      profileSnapshot: snapshot,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    runtime.isOpen = true;
    this.persistRuntimeState();
    return cloneParticipationSession(runtime.session)!;
  }

  updateParticipationSessionStatus(
    streamerId: string,
    status: ParticipationSession["status"]
  ): ParticipationSession | undefined {
    const runtime = this.scopedParticipationRuntime(streamerId, false);
    if (!runtime?.session) return undefined;
    runtime.session.status = status;
    runtime.session.updatedAt = nowIso();
    if (status === "recruiting") runtime.isOpen = true;
    if (status === "closed" || status === "completed") {
      runtime.isOpen = false;
      runtime.session.endedAt = nowIso();
    }
    this.persistRuntimeState();
    return cloneParticipationSession(runtime.session);
  }

  endParticipationSession(streamerId: string): ParticipationSession | undefined {
    return this.updateParticipationSessionStatus(streamerId, "completed");
  }

  selectNextParticipant(checkInSeconds: number, streamerId?: string): ParticipationEntry | undefined {
    if (this.getPendingSelectedParticipant(new Date(), streamerId)) return undefined;
    const next = this.participationQueueFor(streamerId).find((entry) => entry.status === "waitlisted" || entry.status === "verified" || entry.status === "pending");
    if (!next) return undefined;
    next.status = "selected";
    next.selectedAt = nowIso();
    next.checkInExpiresAt = new Date(Date.now() + checkInSeconds * 1000).toISOString();
    next.updatedAt = nowIso();
    this.persistRuntimeState();
    return next;
  }

  getPendingSelectedParticipant(now = new Date(), streamerId?: string): ParticipationEntry | undefined {
    return this.participationQueueFor(streamerId).find((entry) => entry.status === "selected" && !isCheckInExpired(entry, now));
  }

  markParticipantNoShow(id: string, note?: string, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = "no_show";
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    this.persistRuntimeState();
    return entry;
  }

  markExpiredSelectedNoShows(now = new Date(), streamerId?: string): ParticipationEntry[] {
    const expired: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (entry.status !== "selected" || !isCheckInExpired(entry, now)) continue;
      const marked = this.markParticipantNoShow(entry.id, "참가 확인 시간이 만료되었습니다.", streamerId);
      if (marked) expired.push(marked);
    }
    return expired;
  }

  checkInSelectedParticipant(twitchUserId: string, now = new Date(), streamerId?: string): ParticipationCheckInResult {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.twitchUserId === twitchUserId && candidate.status === "selected");
    if (!entry) return { ok: false, reason: "missing" };
    if (isCheckInExpired(entry, now)) {
      const marked = this.markParticipantNoShow(entry.id, "만료 후 참가 확인을 시도했습니다.", streamerId);
      return { ok: false, reason: "expired", entry: marked ?? entry };
    }
    entry.status = "checked_in";
    entry.updatedAt = nowIso();
    this.persistRuntimeState();
    return { ok: true, entry };
  }

  checkInParticipant(twitchUserId: string, streamerId?: string): ParticipationEntry | undefined {
    const result = this.checkInSelectedParticipant(twitchUserId, new Date(), streamerId);
    if (!result.ok) return undefined;
    return result.entry;
  }

  cancelParticipationByUser(twitchUserId: string, note?: string, streamerId?: string): ParticipationCancelResult {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.twitchUserId === twitchUserId && isActiveParticipationStatus(candidate.status));
    if (!entry) return { ok: false, reason: "missing" };
    if (!CANCELLABLE_PARTICIPATION_STATUSES.has(entry.status)) return { ok: false, reason: "in_game" };
    entry.status = "cancelled";
    entry.checkInExpiresAt = undefined;
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    this.persistRuntimeState();
    return { ok: true, entry };
  }

  markParticipant(id: string, status: ParticipationEntry["status"], streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = nowIso();
    if (status === "selected") {
      entry.selectedAt = entry.selectedAt ?? nowIso();
    } else {
      entry.selectedAt = undefined;
      entry.checkInExpiresAt = undefined;
    }
    if (status === "played") {
      entry.playedAt = nowIso();
    } else {
      entry.playedAt = undefined;
    }
    this.persistRuntimeState();
    return entry;
  }

  markReadyParticipantsInGame(streamerId?: string): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  markVisibleParticipationQueueInGame(
    input: number | { limit?: number; participantPuuids?: Iterable<string | undefined> } = PARTICIPATION_OVERLAY_VISIBLE_LIMIT,
    streamerId?: string
  ): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    const seenIds = new Set<string>();
    const limit = typeof input === "number" ? input : input.limit ?? PARTICIPATION_OVERLAY_VISIBLE_LIMIT;
    const participantPuuids = typeof input === "number"
      ? undefined
      : new Set(Array.from(input.participantPuuids ?? []).filter((puuid): puuid is string => typeof puuid === "string" && puuid.length > 0));
    const markInGame = (entry: ParticipationEntry): void => {
      if (seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    };

    for (const entry of this.participationQueueFor(streamerId)) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      markInGame(entry);
    }

    if (participantPuuids && participantPuuids.size > 0) {
      for (const entry of this.getWaitingParticipationQueue(streamerId)) {
        if (!entry.riotPuuid || !participantPuuids.has(entry.riotPuuid)) continue;
        markInGame(entry);
      }
      if (entries.length > 0) this.persistRuntimeState();
      return entries;
    }

    const maxWaiting = Math.max(0, Math.trunc(limit));
    for (const entry of this.getWaitingParticipationQueue(streamerId).slice(0, maxWaiting)) {
      markInGame(entry);
    }

    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  markInGameParticipantsPlayed(streamerId?: string): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (entry.status !== "in_game") continue;
      entry.status = "played";
      entry.playedAt = nowIso();
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  patchParticipationProfile(id: string, patch: Pick<
    Partial<ParticipationEntry>,
    "profileStatus" | "profileFailureReason" | "mainRole" | "mainRoleConfidence" | "topChampions" | "rankedStats" | "verifiedRank" | "profileAnalyzedAt" | "riotPuuid"
  >, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    Object.assign(entry, {
      ...patch,
      topChampions: cloneParticipationTopChampions(patch.topChampions),
      updatedAt: nowIso()
    });
    this.persistRuntimeState();
    return cloneParticipationEntry(entry);
  }

  setParticipationRequestedRole(id: string, role: ParticipationEntry["preferredRole"], streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.requestedRole = role;
    entry.preferredRole = role;
    entry.updatedAt = nowIso();
    this.persistRuntimeState();
    return cloneParticipationEntry(entry);
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
