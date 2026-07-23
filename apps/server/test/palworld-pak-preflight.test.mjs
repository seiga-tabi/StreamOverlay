import assert from "node:assert/strict";
import test from "node:test";
import {
  PalworldPakPreflightError,
  validatePalworldPakMemberName
} from "../dist/data/palworld-pak-preflight.js";

test("Palworld PAK ZIP의 정상 상대 경로를 허용한다", () => {
  assert.equal(
    validatePalworldPakMemberName("Pal/DataTable/Character/DT_PalMonsterParameter_Common.json"),
    "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json"
  );
  assert.equal(
    validatePalworldPakMemberName("L10N/ko/Pal/DataTable/Text/DT_PalNameText_Common.json"),
    "L10N/ko/Pal/DataTable/Text/DT_PalNameText_Common.json"
  );
});

test("Palworld PAK ZIP의 traversal과 absolute path를 차단한다", () => {
  for (const member of [
    "../outside.json",
    "Pal/../../outside.json",
    "/absolute.json",
    "\\\\server\\share.json",
    "C:/absolute.json",
    "Pal\\DataTable\\unsafe.json"
  ]) {
    assert.throws(
      () => validatePalworldPakMemberName(member),
      PalworldPakPreflightError,
      member
    );
  }
});

test("Palworld PAK ZIP의 제어문자와 정규화 우회 경로를 차단한다", () => {
  for (const member of [
    "Pal/DataTable/./unsafe.json",
    "Pal/DataTable//unsafe.json",
    "Pal/DataTable/unsafe\u0000.json",
    "Pal/DataTable/unsafe\n.json"
  ]) {
    assert.throws(
      () => validatePalworldPakMemberName(member),
      PalworldPakPreflightError,
      member
    );
  }
});
