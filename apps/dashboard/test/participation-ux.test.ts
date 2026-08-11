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

test("스트리머 참여 화면은 방송인 직접 컨트롤 콕핏(체크인 없음)을 제공한다", async () => {
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
  // 세부 설정은 톱니 버튼 + 접이식 폼(시작 전 화면 유지).
  assert.match(source, /startSettingsOpen/u);
  assert.match(source, /participation-management-visibility/u);
  assert.match(source, /participation-management-history/u);
  assert.match(source, /ParticipationAnnouncementPanel/u);
  assert.match(source, /expectedRevision: state\.revision/u);
  assert.match(source, /시청자 참여를 시작하세요/u);
  assert.match(source, /視聴者参加を始めましょう/u);
  assert.match(source, /전체 공개/u);
  assert.match(source, /視聴者に公開/u);
  assert.match(source, /모집 중지/u);
  assert.match(source, /受付を再開/u);
  // v4.1 운영 모델: 체크인 단계 없음 — 시청자는 신청만, 방송인이 후보를 담아
  // "선정 확정" 한 번으로 배치 선정 + 즉시 자동 체크인(확정) 처리합니다.
  // 서버 제약: 선정은 활성 참가자 0명일 때 배치 1회만 허용, selected 방치 시
  // 60초 뒤 자동 노쇼 — 그래서 확정이 selected 를 곧바로 checked_in 으로 올립니다.
  assert.match(source, /candidateIds/u);
  assert.match(source, /toggleCandidate/u);
  assert.match(source, /selectYoroParticipationEntries\(entryIds, csrfToken, state\?\.revision\)/u);
  assert.match(source, /updateYoroParticipationEntry\(entryId, "checked_in"/u);
  assert.doesNotMatch(source, /checkInExpiresAt/u);
  assert.doesNotMatch(source, /stepCheckin|체크인 대기|チェックイン待ち/u);
  assert.doesNotMatch(source, /nowTick|checkinTimer|checkInRemaining/u);
  // 단계 바는 모집→게임→정산 3칸, 주행동은 액션 줄 한 자리(모바일은 하단 바).
  assert.match(source, /participation-management-steps/u);
  assert.match(source, /\["recruit", "game", "done"\] as const/u);
  assert.match(source, /renderPrimaryAction/u);
  assert.match(source, /participation-management-actions/u);
  assert.match(source, /participation-management-mobile-bar/u);
  // 슬롯 칩: 확정/후보 + 제외(✕). 게임 시작은 확정 전원 in_game 전이.
  assert.match(source, /participation-management-chip-remove/u);
  assert.match(source, /is-candidate/u);
  assert.match(source, /updateYoroParticipationEntry\(entry\.id, "in_game"/u);
  // 복구 불가 세션 종료는 넘침 메뉴로 분리 유지.
  assert.match(source, /participation-management-overflow-menu/u);
  assert.match(source, /className="is-danger"[\s\S]*?mutateSession\("finish"\)/u);
  // 한 줄 제목 줄 — 대형 히어로 제거.
  assert.match(source, /participation-management-titlebar/u);
  assert.doesNotMatch(source, /participation-management-hero/u);
  // CSS: 콕핏 카드 한 몸(단계 바·액션 줄), 대기열은 구분선 리스트, 체크인 링 없음.
  assert.match(css, /participation-management-steps/u);
  assert.match(css, /participation-management-actions/u);
  assert.doesNotMatch(css, /--participation-checkin-progress/u);
  assert.doesNotMatch(css, /"sel main status"/u);
  assert.match(css, /"main status"[\s\S]*?"main actions"/u);
  assert.match(css, /participation-management-mobile-bar[\s\S]*?position:\s*fixed/u);
  assert.match(css, /participation-management-page \{[\s\S]{0,400}--info:\s*hsl\(/u);
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

test("팔로우 목록 자동 로드는 실패해도 무한 재시도하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/pages/PublicLolPage.tsx", import.meta.url),
    "utf8"
  );

  // 요청이 실패하면 followedLol 은 비어 있는 채로 followedLoading 만 false 가 되어
  // effect 가 다시 조건을 통과합니다. 시도 횟수를 세지 않으면 렌더 속도만큼
  // (실측 초당 약 500회) 재요청이 반복되고 메인 스레드가 포화됩니다.
  assert.match(source, /const FOLLOWED_LOL_MAX_ATTEMPTS = \d+;/u);
  assert.match(source, /const FOLLOWED_LOL_RETRY_BASE_MS = [\d_]+;/u);
  assert.match(source, /const FOLLOWED_LOL_RETRY_MAX_MS = [\d_]+;/u);
  assert.match(source, /followedLolAttemptRef/u);

  const effect = source.slice(
    source.indexOf("if (!twitchStatus.connected) {\n      followedLolAttemptRef.current = 0;")
  ).slice(0, 1_400);
  // 시도 상한과 지수 백오프가 함께 있어야 합니다.
  assert.match(effect, /followedLolAttemptRef\.current >= FOLLOWED_LOL_MAX_ATTEMPTS/u);
  assert.match(effect, /Math\.min\(\s*FOLLOWED_LOL_RETRY_MAX_MS/u);
  assert.match(effect, /FOLLOWED_LOL_RETRY_BASE_MS \* 2 \*\* \(attempt - 1\)/u);
  // 연결이 끊기면 다음 연결을 위해 시도 횟수를 되돌립니다.
  assert.match(effect, /followedLolAttemptRef\.current = 0;/u);
  // 예약한 재시도는 정리해야 합니다.
  assert.match(effect, /window\.clearTimeout\(followedLolRetryTimerRef\.current\)/u);
});
