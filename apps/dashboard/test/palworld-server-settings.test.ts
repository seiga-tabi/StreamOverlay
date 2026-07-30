import assert from "node:assert/strict";
import test from "node:test";
import {
  changedPalworldSettingKeys,
  createDefaultPalworldSettingValues,
  generatePalworldSettingsIni,
  palworldSettingDefinitions,
  validatePalworldSetting,
  validatePalworldSettingValues,
} from "../src/features/public-bot/palworld-server-settings";

function definition(key: string) {
  const found = palworldSettingDefinitions.find((item) => item.key === key);
  assert.ok(found, `${key} 설정 정의가 필요합니다.`);
  return found;
}

test("기본값은 override를 만들지 않고 변경한 설정만 안정된 순서로 생성한다", () => {
  const values = createDefaultPalworldSettingValues();
  assert.deepEqual(changedPalworldSettingKeys(values), []);
  assert.equal(
    generatePalworldSettingsIni(values),
    "[/Script/Pal.PalGameWorldSettings]\nOptionSettings=()\n",
  );

  values.DayTimeSpeedRate = "2";
  values.ServerName = "YORO Pal";
  values.RESTAPIEnabled = "true";

  assert.deepEqual(changedPalworldSettingKeys(values), [
    "DayTimeSpeedRate",
    "ServerName",
    "RESTAPIEnabled",
  ]);
  assert.equal(
    generatePalworldSettingsIni(values),
    [
      "[/Script/Pal.PalGameWorldSettings]",
      "OptionSettings=(DayTimeSpeedRate=2.000000,ServerName=\"YORO Pal\",RESTAPIEnabled=True)",
      "",
    ].join("\n"),
  );
});

test("문자열은 INI 구분자를 깨지 않게 인용하고 비밀번호 미리보기는 원문을 숨긴다", () => {
  const values = createDefaultPalworldSettingValues();
  values.ServerName = "YORO, \"Pal\" \\\\ Server";
  values.AdminPassword = "secret-value";

  const raw = generatePalworldSettingsIni(values);
  const preview = generatePalworldSettingsIni(values, { redactSecrets: true });

  assert.match(raw, /ServerName="YORO, \\"Pal\\" \\\\\\\\ Server"/u);
  assert.match(raw, /AdminPassword="secret-value"/u);
  assert.doesNotMatch(preview, /secret-value/u);
  assert.match(preview, /AdminPassword="••••••••"/u);
});

test("숫자 범위, 정수, select, IP와 제어 문자를 fail-closed로 검증한다", () => {
  assert.equal(validatePalworldSetting(definition("PublicPort"), "0"), "min_exceeded");
  assert.equal(validatePalworldSetting(definition("PublicPort"), "8211.5"), "integer_required");
  assert.equal(validatePalworldSetting(definition("PalCaptureRate"), "3"), "max_exceeded");
  assert.equal(validatePalworldSetting(definition("CrossplayPlatforms"), "(Unknown)"), "unsupported_value");
  assert.equal(validatePalworldSetting(definition("PublicIP"), "example.com"), "invalid_format");
  assert.equal(validatePalworldSetting(definition("ServerName"), "unsafe\nname"), "control_character");
});

test("유효하지 않은 override가 있으면 파일 생성을 차단한다", () => {
  const values = createDefaultPalworldSettingValues();
  values.RESTAPIPort = "70000";

  assert.deepEqual(validatePalworldSettingValues(values), [
    { key: "RESTAPIPort", code: "max_exceeded" },
  ]);
  assert.throws(
    () => generatePalworldSettingsIni(values),
    /palworld_settings_invalid:RESTAPIPort/u,
  );
});
