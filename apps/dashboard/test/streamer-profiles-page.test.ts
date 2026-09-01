import assert from "node:assert/strict";
import test from "node:test";
import { parseStreamerHandleInput } from "../src/features/public-streamers/utils/official-profile-input";

test("Twitch 채널 URL은 핸들과 플랫폼으로 자동 파싱한다", () => {
  assert.deepEqual(parseStreamerHandleInput("https://www.twitch.tv/example_login"), {
    handle: "example_login",
    platform: "twitch"
  });
  assert.deepEqual(parseStreamerHandleInput("twitch.tv/example_login"), {
    handle: "example_login",
    platform: "twitch"
  });
});

test("URL의 플랫폼이 현재 선택과 달라도 파싱 결과로 갱신할 수 있다", () => {
  assert.deepEqual(parseStreamerHandleInput("https://www.youtube.com/@ExampleChannel"), {
    handle: "examplechannel",
    platform: "youtube"
  });
});

test("순수 계정명과 파싱할 수 없는 입력은 원문을 유지한다", () => {
  assert.deepEqual(parseStreamerHandleInput("example_login"), { handle: "example_login" });
  assert.deepEqual(parseStreamerHandleInput("https://tw"), { handle: "https://tw" });
});
