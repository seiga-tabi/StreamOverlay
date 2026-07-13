import test from "node:test";
import assert from "node:assert/strict";

const {
  CommunityModerationService,
  CommunityModerationServiceError
} = await import("../dist/services/community-moderation-service.js");

test("moderation 저장소 기능이 없을 때 안전한 빈 snapshot을 반환한다", () => {
  const service = new CommunityModerationService({});
  assert.deepEqual(service.snapshot(), { posts: [], reports: [], sanctions: [] });
  assert.equal(service.isUserSanctioned("viewer-1"), false);
});

test("신고 저장소가 없으면 공개 가능한 503 오류로 변환한다", () => {
  const service = new CommunityModerationService({});
  assert.throws(
    () => service.reportPost({
      postId: "post-1",
      reason: "spam",
      reporterTwitchUserId: "viewer-1",
      reporterTwitchLogin: "viewer",
      reporterDisplayName: "Viewer"
    }),
    (error) => error instanceof CommunityModerationServiceError && error.status === 503
  );
});

test("저장소가 반환한 신고 결과를 변경하지 않는다", () => {
  const expected = {
    id: "report-1",
    postId: "post-1",
    reason: "spam",
    reporterTwitchUserId: "viewer-1",
    reporterTwitchLogin: "viewer",
    reporterDisplayName: "Viewer",
    status: "open",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z"
  };
  const service = new CommunityModerationService({ reportCommunityPost: () => expected });
  assert.equal(service.reportPost({
    postId: "post-1",
    reason: "spam",
    reporterTwitchUserId: "viewer-1",
    reporterTwitchLogin: "viewer",
    reporterDisplayName: "Viewer"
  }), expected);
});
