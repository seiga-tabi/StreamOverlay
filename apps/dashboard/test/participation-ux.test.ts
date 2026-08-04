import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("시청자 참여 화면은 직접 세션·내 상태·단계·규칙을 우선하고 신청 확인 모달을 제거한다", async () => {
  const source = await readFile(
    new URL("../src/pages/PublicLolPage.tsx", import.meta.url),
    "utf8"
  );
  const css = await readFile(
    new URL("../src/styles/pages/public-lol/05-overrides.css", import.meta.url),
    "utf8"
  );
  const i18n = await readFile(
    new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /directSessionLink/u);
  assert.match(source, /public-participation-my-status/u);
  assert.match(source, /<ol className="public-participation-timeline">/u);
  assert.match(source, /aria-current=\{current \? "step"/u);
  assert.match(source, /public-participation-rules-title/u);
  assert.doesNotMatch(source, /setPendingAction\("join"\)/u);
  assert.match(source, /parseRiotIdDetailed/u);
  assert.match(css, /env\(safe-area-inset-bottom\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(i18n, /Riot ID는 게임이름#태그 형식으로 입력해주세요/u);
  assert.match(i18n, /Riot IDはゲーム名#タグの形式で入力してください/u);
});

test("스트리머 참여 화면은 빠른 시작·단일 다음 행동·그룹 대기열을 제공한다", async () => {
  const source = await readFile(
    new URL("../src/features/yoro-dashboard/ParticipationManagementPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /getStreamerNextAction/u);
  assert.match(source, /participation-management-next-action/u);
  assert.match(source, /participation-management-advanced/u);
  assert.match(source, /participation-management-current/u);
  assert.match(source, /participation-management-history/u);
  assert.match(source, /시청자 참여를 시작하세요/u);
  assert.match(source, /視聴者参加を始めましょう/u);
});
