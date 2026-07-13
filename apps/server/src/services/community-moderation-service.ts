import type {
  CommunityModerationSnapshot,
  CommunityPost,
  CommunityPostReport,
  CommunityPostReportCreateInput,
  CommunitySanction
} from "@streamops/shared";
import type { Store } from "./store.js";

type CommunityReportInput = CommunityPostReportCreateInput & {
  postId: string;
  reporterTwitchUserId: string;
  reporterTwitchLogin: string;
  reporterDisplayName: string;
};

type CommunityVisibilityInput = {
  postId: string;
  visibility: "visible" | "hidden";
  reason?: string;
  updatedBy: string;
};

type CommunitySanctionInput = {
  twitchUserId: string;
  twitchLogin?: string;
  active: boolean;
  reason?: string;
  expiresAt?: string;
  updatedBy: string;
};

type ModerationStore = Store & {
  getCommunityModerationSnapshot?: (limit?: number) => CommunityModerationSnapshot;
  isCommunityUserSanctioned?: (userId: string | undefined) => boolean;
  reportCommunityPost?: (body: CommunityReportInput) => CommunityPostReport | undefined;
  setCommunityPostVisibility?: (body: CommunityVisibilityInput) => CommunityPost | undefined;
  setCommunityUserSanction?: (body: CommunitySanctionInput) => CommunitySanction | undefined;
};

export class CommunityModerationServiceError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "CommunityModerationServiceError";
  }
}

export class CommunityModerationService {
  private readonly store: ModerationStore;

  constructor(store: Store) {
    this.store = store as ModerationStore;
  }

  snapshot(limit = 300): CommunityModerationSnapshot {
    return this.store.getCommunityModerationSnapshot?.(limit) ?? { posts: [], reports: [], sanctions: [] };
  }

  isUserSanctioned(twitchUserId: string | undefined): boolean {
    return this.store.isCommunityUserSanctioned?.(twitchUserId) ?? false;
  }

  reportPost(input: CommunityReportInput): CommunityPostReport {
    if (!this.store.reportCommunityPost) {
      throw new CommunityModerationServiceError(503, "커뮤니티 신고 저장소를 사용할 수 없습니다.");
    }
    const report = this.store.reportCommunityPost(input);
    if (!report) throw new CommunityModerationServiceError(404, "신고할 게시글을 찾을 수 없습니다.");
    return report;
  }

  setPostVisibility(input: CommunityVisibilityInput): CommunityPost {
    if (!this.store.setCommunityPostVisibility) {
      throw new CommunityModerationServiceError(503, "커뮤니티 관리 저장소를 사용할 수 없습니다.");
    }
    const post = this.store.setCommunityPostVisibility(input);
    if (!post) throw new CommunityModerationServiceError(404, "처리할 게시글을 찾을 수 없습니다.");
    return post;
  }

  setUserSanction(input: CommunitySanctionInput): CommunitySanction | undefined {
    if (!this.store.setCommunityUserSanction) {
      throw new CommunityModerationServiceError(503, "커뮤니티 제재 저장소를 사용할 수 없습니다.");
    }
    return this.store.setCommunityUserSanction(input);
  }
}
