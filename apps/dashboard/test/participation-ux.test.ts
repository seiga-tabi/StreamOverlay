import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("시청자 참여 화면은 신청·취소 두 동작만 두고 체크인 흐름을 제거한다", async () => {
  const source = await readFile(
    new URL("../src/pages/PublicLolPage.tsx", import.meta.url),
    "utf8"
  );
  const panels = await readFile(
    new URL("../src/features/public-lol/components/ParticipationPanels.tsx", import.meta.url),
    "utf8"
  );
  const css = await readFile(
    new URL("../src/styles/pages/public-lol/26-participation.css", import.meta.url),
    "utf8"
  );
  const display = await readFile(
    new URL("../src/features/participation/participation-display.ts", import.meta.url),
    "utf8"
  );
  const i18n = await readFile(
    new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
    "utf8"
  );

  // 체크인·건너뛰기는 공개 화면에서 완전히 빠집니다. 서버 endpoint 는 그대로 둡니다.
  for (const removed of [
    "postPublicParticipationCheckIn",
    "postPublicParticipationSkip",
    "checkInPublicParticipation",
    "skipPublicParticipation",
    "publicParticipationCheckingIn",
    "publicParticipationSkipping",
    "checkInExpiresAt",
    "participationCheckInRemaining",
    "participationSkipTurn",
  ]) {
    assert.doesNotMatch(source, new RegExp(removed, "u"), `${removed} 는 공개 참여 화면에서 제거되어야 합니다.`);
  }
  assert.doesNotMatch(panels, /checkIn|Skip/u);

  // 뷰어 상태는 네 갈래로 접힙니다. selected·checked_in·invited 는 하나로 묶습니다.
  assert.match(display, /export function getViewerQueuePhase/u);
  assert.match(display, /status === "selected" \|\| status === "checked_in" \|\| status === "invited"\) return "soon"/u);
  assert.match(display, /export function canCancelViewerQueue/u);

  // 설명문은 두지 않습니다.
  for (const dropped of [
    "followJoinSubtitle",
    "participationStreamerSubtitle",
    "participationSelectStreamerDescription",
    "participationRiotIdExample",
    "participationAutoRefresh",
    "participationNotificationsDescription",
    "participationJourneyTitle",
    "participationRulesTitle",
  ]) {
    assert.doesNotMatch(source, new RegExp(`t\\(\\)\\.${dropped}`, "u"), `${dropped} 문구는 화면에서 빠져야 합니다.`);
  }

  // 남는 동작은 신청과 취소뿐입니다.
  assert.match(source, /t\(\)\.participationSubmit/u);
  assert.match(source, /t\(\)\.participationCancel\b/u);

  // 대기열을 접어도 내 순번은 반드시 보입니다.
  assert.match(source, /PUBLIC_PARTICIPATION_QUEUE_WINDOW/u);
  assert.match(source, /queue\.findIndex\(\(item\) => item\.isViewer\)/u);

  // legacy 의 .public-participation-queue-row 는 !important 로 걸려 있어
  // 같은 이름을 쓰면 pages layer 가 집니다. 새 이름을 씁니다.
  assert.doesNotMatch(panels, /public-participation-queue-row/u);
  assert.match(panels, /public-participation-qrow/u);
  assert.doesNotMatch(css, /[a-z-]+:[^;{}]*!important/u);
  assert.match(css, /@layer pages/u);
  assert.match(css, /container-name:\s*participation/u);

  // 조작 요소는 44×44 이상입니다.
  for (const rule of [
    "public-participation-mini-button",
    "public-participation-cancel",
    "public-participation-submit",
    "public-participation-role",
    "public-participation-qtoggle",
  ]) {
    assert.match(
      css,
      new RegExp(`\\.${rule}\\s*\\{[\\s\\S]*?min-(height|width):\\s*var\\(--yoro-size-touch-target\\)`, "u"),
      `${rule} 은 44px 터치 타깃을 지켜야 합니다.`
    );
  }

  // 신규 문구는 한국어·일본어를 함께 둡니다.
  for (const [ko, ja] of [
    ["곧 내 차례", "まもなく順番"],
    ["내 앞 \\{count\\}명", "前に\\{count\\}人"],
    ["더 보기 \\{count\\}", "もっと見る \\{count\\}"],
    ["무관", "指定なし"],
  ]) {
    assert.match(i18n, new RegExp(ko, "u"));
    assert.match(i18n, new RegExp(ja, "u"));
  }
});

test("스트리머 참여 화면은 공개 범위·직접 동작·그룹 대기열을 제공한다", async () => {
  const source = await readFile(
    new URL("../src/features/yoro-dashboard/ParticipationManagementPage.tsx", import.meta.url),
    "utf8"
  );
  const css = await readFile(
    new URL("../src/styles/pages/account/19-participation-management.css", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /getStreamerNextAction/u);
  assert.doesNotMatch(source, /participation-management-next-action/u);
  assert.doesNotMatch(source, /copyPublicUrl/u);
  assert.doesNotMatch(source, /participation-management-public-link/u);
  assert.doesNotMatch(source, /participation-management-more/u);
  assert.match(source, /participation-management-advanced/u);
  assert.match(source, /participation-management-visibility/u);
  assert.match(source, /participation-management-current/u);
  assert.match(source, /participation-management-history/u);
  assert.match(source, /participation-management-bot/u);
  assert.match(source, /expectedRevision: state\.revision/u);
  assert.match(source, /시청자 참여를 시작하세요/u);
  assert.match(source, /視聴者参加を始めましょう/u);
  assert.match(source, /전체 공개/u);
  assert.match(source, /視聴者に公開/u);
  assert.match(source, /모집 중지/u);
  assert.match(source, /受付を再開/u);
  assert.match(source, /selectedWaitingEntryIds/u);
  assert.match(source, /type="checkbox"/u);
  assert.match(source, /selectYoroParticipationEntries/u);
  assert.match(source, /selectedWaitingEntries\.map\(\(entry\) => entry\.id\)/u);
  assert.match(source, /currentEntries\.map\(\(entry\) => renderParticipantRow\(entry\)\)/u);
  assert.doesNotMatch(source, /mutateSession\("select_next"\)/u);
  assert.match(source, /className="is-danger"[\s\S]*?mutateSession\("finish"\)/u);
  assert.match(css, /grid-template-areas:[\s\S]*?"position participant status"[\s\S]*?"position actions actions"/u);
  assert.match(css, /color:\s*var\(--yoro-color-text-on-dark-strong\)/u);
});

test("모바일 공개 검색 결과는 두 항목 이후 목록 내부에서 스크롤한다", async () => {
  const lolCss = await readFile(
    new URL("../src/styles/pages/public-lol/05-overrides.css", import.meta.url),
    "utf8"
  );
  const lolFinalCss = await readFile(
    new URL("../src/styles/pages/public-lol/10-final-overrides.css", import.meta.url),
    "utf8"
  );
  const palworldCss = await readFile(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8"
  );

  assert.match(lolCss, /public-home-shared-search \.public-suggestion-list[\s\S]*?max-height:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
  assert.match(lolFinalCss, /public-suggestion-list button[\s\S]*?grid-template-rows:[\s\S]*?min-height:[\s\S]*?--yoro-size-touch-target/u);
  assert.match(lolCss, /public-search-wrap \.public-suggestion-list[\s\S]*?max-height:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
  assert.match(palworldCss, /\.palworld-autocomplete[\s\S]*?max-block-size:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
  assert.match(palworldCss, /\.palworld-autocomplete-copy[\s\S]*?\.palworld-autocomplete-heading strong/u);
});
