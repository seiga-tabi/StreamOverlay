export type TournamentVisibility = "draft" | "public";

export type TournamentMatchStatus = "scheduled" | "live" | "completed";

export type TournamentPlayerRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

export type TournamentTeamPlayer = {
  id: string;
  role: TournamentPlayerRole;
  riotId: string;
  leader?: boolean;
};

export type TournamentTeam = {
  id: string;
  name: string;
  seed?: number;
  avatarUrl?: string;
  twitchLogin?: string;
  riotId?: string;
  players?: TournamentTeamPlayer[];
};

export type TournamentMatch = {
  id: string;
  round: string;
  teamAId?: string;
  teamBId?: string;
  scoreA?: number;
  scoreB?: number;
  scheduledAt?: string;
  format?: string;
  status: TournamentMatchStatus;
  winnerTeamId?: string;
  recordMatchIds?: string[];
};

export type TournamentNewsItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type StreamerTournament = {
  id: string;
  slug: string;
  ownerTwitchUserId: string;
  ownerTwitchLogin: string;
  ownerDisplayName: string;
  ownerProfileImageUrl?: string;
  title: string;
  description: string;
  startsAt?: string;
  endsAt?: string;
  formatLabel?: string;
  prizeLabel?: string;
  visibility: TournamentVisibility;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  news: TournamentNewsItem[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type TournamentUpsertInput = {
  id?: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  formatLabel?: string;
  prizeLabel?: string;
  visibility?: TournamentVisibility;
  teams?: TournamentTeam[];
  matches?: TournamentMatch[];
  news?: TournamentNewsItem[];
};
