import test from "node:test";
import assert from "node:assert/strict";
import {
  isBotManagementRole,
  isPalworldServerRegion,
  parseCreatePalworldGameServerInput
} from "../dist/bot-management.js";

test("Palworld 게임 서버 생성 입력은 exact schema와 region allowlist를 사용한다", () => {
  assert.deepEqual(
    parseCreatePalworldGameServerInput({ displayName: "  우리 서버  ", region: "asia" }),
    { displayName: "우리 서버", region: "asia" }
  );
  assert.equal(
    parseCreatePalworldGameServerInput({
      displayName: "우리 서버",
      region: "asia",
      organizationId: "위조"
    }),
    undefined
  );
  assert.equal(
    parseCreatePalworldGameServerInput({ displayName: "우리 서버", region: "unknown" }),
    undefined
  );
  assert.equal(
    parseCreatePalworldGameServerInput({ displayName: "잘못된\u0000이름", region: "asia" }),
    undefined
  );
});

test("Organization role과 Palworld region은 allowlist만 허용한다", () => {
  assert.equal(isBotManagementRole("owner"), true);
  assert.equal(isBotManagementRole("admin"), false);
  assert.equal(isPalworldServerRegion("oceania"), true);
  assert.equal(isPalworldServerRegion("global"), false);
});
