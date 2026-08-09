import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../src/routes/http-api.ts", import.meta.url), "utf8");
const riot = await readFile(new URL("../src/services/riot-api.ts", import.meta.url), "utf8");

test("Riot participant 타입은 증강 여섯 필드를 모두 읽는다", () => {
  // 실측 결과 playerAugment 는 4개가 아니라 6개입니다.
  for (let i = 1; i <= 6; i += 1) {
    assert.match(riot, new RegExp(`playerAugment${i}\\?: number;`, "u"));
  }
  assert.equal(/playerAugment7/u.test(riot), false);
});

test("증강 id 는 0 을 버리고 없으면 응답에서 생략한다", () => {
  assert.match(routes, /function participantAugmentIds/u);
  // 값 0 은 "고르지 않음"이라 남기면 안 됩니다.
  assert.match(routes, /\(id as number\) > 0/u);
  assert.match(routes, /ids\.length > 0 \? ids : undefined/u);
  // 증강이 없는 모드에서 빈 배열을 내려보내지 않습니다.
  assert.match(routes, /\.\.\.\(augmentIds \? \{ augmentIds \} : \{\}\)/u);
  assert.match(routes, /augmentIds\?: number\[\];/u);
});
