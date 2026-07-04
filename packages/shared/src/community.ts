export type CommunityPostCategory = "server" | "party";

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
