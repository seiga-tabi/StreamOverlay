import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TWITCH_EXTENSION_SETTINGS,
  parseTwitchExtensionSettingsInput
} from "../dist/twitch-extension.js";

test("Twitch Extension 설정 parser는 exact object와 필드별 boolean만 허용한다", () => {
  const parsed = parseTwitchExtensionSettingsInput(DEFAULT_TWITCH_EXTENSION_SETTINGS);
  assert.deepEqual(parsed, DEFAULT_TWITCH_EXTENSION_SETTINGS);
  assert.equal(parseTwitchExtensionSettingsInput({
    ...DEFAULT_TWITCH_EXTENSION_SETTINGS,
    unexpected: true
  }), undefined);
  assert.equal(parseTwitchExtensionSettingsInput({
    ...DEFAULT_TWITCH_EXTENSION_SETTINGS,
    display: { ...DEFAULT_TWITCH_EXTENSION_SETTINGS.display, game: "true" }
  }), undefined);
});

test("Twitch Extension 설정 parser는 enum 밖 inactive/type을 거부한다", () => {
  assert.equal(parseTwitchExtensionSettingsInput({
    ...DEFAULT_TWITCH_EXTENSION_SETTINGS,
    inactiveBehavior: "redirect"
  }), undefined);
  assert.equal(parseTwitchExtensionSettingsInput({
    ...DEFAULT_TWITCH_EXTENSION_SETTINGS,
    extensionType: "script"
  }), undefined);
});
