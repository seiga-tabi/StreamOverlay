export type CommunityPost = {
  id: string;
  title: string;
  body: string;
  authorTwitchUserId: string;
  authorTwitchLogin: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  authorRiotGameName?: string;
  authorRiotTagLine?: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityPostCreateInput = {
  title: string;
  body: string;
};
