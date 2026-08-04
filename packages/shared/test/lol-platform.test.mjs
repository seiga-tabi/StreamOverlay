import assert from "node:assert/strict";
import test from "node:test";
import {
  LOL_PLATFORM_IDS,
  lolPlatformSlug,
  lolRegionalRouteForPlatform,
  lolRoutingContext,
  normalizeLolPlatformId
} from "../dist/index.js";

test("공식 LoL 플랫폼을 고정 allowlist와 지역 라우팅으로 변환한다", () => {
  assert.equal(LOL_PLATFORM_IDS.length, 16);
  assert.deepEqual(lolRoutingContext("kr"), { lolPlatform: "kr", accountRegion: "asia" });
  assert.deepEqual(lolRoutingContext("na"), { lolPlatform: "na1", accountRegion: "americas" });
  assert.deepEqual(lolRoutingContext("euw"), { lolPlatform: "euw1", accountRegion: "europe" });
  assert.deepEqual(lolRoutingContext("oce"), { lolPlatform: "oc1", accountRegion: "sea" });
});

test("플랫폼 slug를 결정적으로 변환하고 임의 host 입력을 거부한다", () => {
  assert.equal(lolPlatformSlug("jp1"), "jp");
  assert.equal(normalizeLolPlatformId("EUNE"), "eun1");
  assert.equal(normalizeLolPlatformId("https://evil.example"), undefined);
  assert.equal(lolRoutingContext("kr.api.riotgames.com"), undefined);
  assert.equal(lolRegionalRouteForPlatform("vn2"), "sea");
});
