import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_ALLOWED_PAGES,
  pageVisible,
  type Page
} from "../src/routing/dashboard-routes";

function visiblePages(permissions?: readonly string[]): Page[] {
  return ADMIN_ALLOWED_PAGES.filter((page) => pageVisible(page, permissions));
}

test("full_admin은 관리자 상단바 2행의 다섯 페이지를 모두 본다", () => {
  assert.deepEqual(visiblePages(), [
    "streamerRiotRequests",
    "streamerProfiles",
    "events",
    "supportInbox",
    "settings"
  ]);
});

test("streamer_approval만 가진 서브관리자는 스트리머 승인 페이지만 본다", () => {
  assert.deepEqual(visiblePages(["streamer_approval"]), ["streamerRiotRequests"]);
});

test("서브관리자는 권한 대상 페이지만 보고 전체 관리자 전용 페이지는 보지 않는다", () => {
  assert.deepEqual(visiblePages(["streamer_profiles:write"]), ["streamerProfiles"]);
  assert.deepEqual(
    visiblePages(["streamer_approval", "streamer_profiles:write"]),
    ["streamerRiotRequests", "streamerProfiles"]
  );
});
