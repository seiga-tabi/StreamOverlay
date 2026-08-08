import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(
  new URL("../src/features/yoro-dashboard/ParticipationAnnouncementPanel.tsx", import.meta.url),
  "utf8"
);
const css = await readFile(
  new URL("../src/styles/pages/account/32-participation-announcement.css", import.meta.url),
  "utf8"
);
const page = await readFile(
  new URL("../src/features/yoro-dashboard/ParticipationManagementPage.tsx", import.meta.url),
  "utf8"
);

test("참여 알림 패널은 한국어·일본어 문구를 함께 관리한다", () => {
  for (const [ko, ja] of [
    ["참여 모집 Discord 알림", "参加募集のDiscord通知"],
    ["알림 채널", "通知チャンネル"],
    ["멘션할 역할", "メンションするロール"],
    ["멘션 안 함", "メンションしない"],
    ["Bot이 설치된 Discord 서버가 없습니다", "Botが導入されたDiscordサーバーがありません"],
    ["쓰기 권한 없음", "書き込み権限がありません"],
    ["Bot이 제거됨", "Botが削除されました"]
  ]) {
    assert.equal(panel.includes(ko), true, ko);
    assert.equal(panel.includes(ja), true, ja);
  }
});

test("패널은 후보 밖 채널을 입력할 경로를 만들지 않는다", () => {
  // 채널·역할은 서버가 준 후보에서만 고릅니다. 자유 입력 칸을 두지 않습니다.
  assert.equal(/type="(?:text|search|url)"/u.test(panel), false);
  // JSX 화살표 함수의 ">" 때문에 요소 단위 정규식은 신뢰할 수 없습니다.
  // input 이 전부 checkbox 인지 개수로 확인합니다.
  const inputs = panel.match(/<input\b/gu) ?? [];
  const checkboxes = panel.match(/type="checkbox"/gu) ?? [];
  assert.equal(inputs.length, checkboxes.length, "input 은 토글 checkbox 뿐이어야 합니다.");
  assert.match(panel, /<select/u);
  // @everyone 을 만드는 경로가 없어야 합니다.
  assert.equal(panel.includes("@everyone·@here는 사용하지 않습니다"), true);
  assert.equal(/mentionRoleId:\s*"everyone"/u.test(panel), false);
});

test("패널은 로딩·빈 상태·차단·실패를 각각 다르게 처리한다", () => {
  // 후보를 다 불러오기 전에는 토글을 렌더링하지 않습니다.
  assert.match(panel, /if \(!settings && !loadFailed\)/u);
  // 고를 수 있는 서버가 없으면 토글 대신 안내와 이동 버튼만 둡니다.
  assert.match(panel, /available\.length === 0/u);
  assert.equal(panel.includes("yoro-pa-empty"), true);
  // 길드가 막았으면 선택 칸 대신 사유를 보여 줍니다.
  assert.match(panel, /blocked \? \(/u);
  // 중단된 요청을 실패로 세지 않습니다.
  assert.match(panel, /AbortError/u);
  // 저장 실패해도 사용자가 고른 값을 지우지 않습니다.
  assert.equal(/catch[\s\S]{0,120}setDrafts\(\[\]\)/u.test(panel), false);
});

test("패널 CSS는 pages layer에서 !important 없이 44px 조작 요소를 지킨다", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(rules, /@layer pages \{/u);
  assert.equal(rules.includes("!important"), false);
  // legacy 이름을 건드리지 않습니다.
  assert.equal(/\.participation-management-/u.test(rules), false);
  for (const selector of [
    /\.yoro-pa-action\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-pa-toggle\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-pa-fields select\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-pa-alert button\s*\{[\s\S]*?min-height:\s*44px/u
  ]) {
    assert.match(rules, selector);
  }
});

test("참여 관리 화면은 링크만 있던 aside를 실제 설정 패널로 교체했다", () => {
  assert.match(page, /<ParticipationAnnouncementPanel csrfToken=\{csrfToken\} locale=\{locale\} \/>/u);
  assert.equal(page.includes('className="participation-management-bot"'), false);
});
