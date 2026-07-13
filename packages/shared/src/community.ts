export type CommunityPostCategory = "server" | "party";

export type CommunityReportReason = "spam" | "harassment" | "privacy" | "other";
export type CommunityReportStatus = "open" | "resolved";
export type CommunityPostVisibility = "visible" | "hidden";

export type CommunityPostModeration = {
  visibility: CommunityPostVisibility;
  reason?: string;
  updatedAt: string;
  updatedBy: string;
};

export type CommunityPostReport = {
  id: string;
  postId: string;
  reason: CommunityReportReason;
  detail?: string;
  reporterTwitchUserId: string;
  reporterTwitchLogin: string;
  reporterDisplayName: string;
  status: CommunityReportStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
};

export type CommunitySanction = {
  id: string;
  twitchUserId: string;
  twitchLogin?: string;
  action: "posting_suspension";
  reason: string;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
};

export type CommunityPostComment = {
  id: string;
  body: string;
  authorTwitchUserId: string;
  authorTwitchLogin: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  category: CommunityPostCategory;
  title: string;
  body: string;
  riotGameName?: string;
  riotTagLine?: string;
  tags: string[];
  imageUrl?: string;
  imageAlt?: string;
  partyTier?: string;
  partyRole?: string;
  partyMode?: string;
  partyVoice?: string;
  partyCapacity?: number;
  authorTwitchUserId: string;
  authorTwitchLogin: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  authorRiotGameName?: string;
  authorRiotTagLine?: string;
  comments: CommunityPostComment[];
  moderation?: CommunityPostModeration;
  createdAt: string;
  updatedAt: string;
};

export type CommunityPostCreateInput = {
  category?: CommunityPostCategory;
  title: string;
  body: string;
  riotId?: string;
  tags?: string[] | string;
  imageUrl?: string;
  imageAlt?: string;
  partyTier?: string;
  partyRole?: string;
  partyMode?: string;
  partyVoice?: string;
  partyCapacity?: number;
};

export type CommunityPostCommentCreateInput = {
  body: string;
};

export type CommunityPostReportCreateInput = {
  reason: CommunityReportReason;
  detail?: string;
};

export type CommunityModerationSnapshot = {
  posts: CommunityPost[];
  reports: CommunityPostReport[];
  sanctions: CommunitySanction[];
};
