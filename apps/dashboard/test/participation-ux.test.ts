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
  // 세부 설정은 <details> 대신 톱니 버튼 + 접이식 폼으로 바뀌었습니다 — 진입점이
  // 항상 보이는 게임 정보/정원 미리보기 뒤로 한 단계 더 숨어 기본 흐름을 덜 가립니다.
  assert.match(source, /startSettingsOpen/u);
  assert.match(source, /participation-management-visibility/u);
  assert.match(source, /participation-management-current/u);
  assert.match(source, /participation-management-history/u);
  // 링크만 있던 Bot 연동 aside 는 실제 알림 설정 패널로 교체했습니다.
  assert.match(source, /ParticipationAnnouncementPanel/u);
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
  // v2 콕핏: 운영 루프(모집→체크인→게임→완료)가 파이프라인 스테퍼로 드러나고,
  // 각 단계의 주행동이 활성 단계 안에 고정됩니다. 메트릭 dl 은 스테퍼에 흡수됩니다.
  assert.match(source, /participation-management-pipe/u);
  assert.doesNotMatch(source, /participation-management-metrics/u);
  // 서버가 주는 checkInExpiresAt 을 카운트다운으로 사용합니다. 만료 처리(노쇼)는
  // 자동이 아니라 방송인의 명시 클릭입니다 — 자동 상태 변경 금지(방송 안정성 원칙).
  assert.match(source, /checkInExpiresAt/u);
  assert.match(source, /participation-management-chip-ring/u);
  assert.doesNotMatch(source, /mutateEntry\([^)]*"no_show"\)[^;]*setInterval/u);
  // LoL(정원 소형)은 빈 슬롯 카드 대신 가로 스트립 칩, Palworld(대형)는 압축 목록 유지.
  assert.match(source, /participation-management-strip/u);
  assert.match(source, /viewerSeats > COMPACT_SEAT_THRESHOLD/u);
  assert.doesNotMatch(source, /renderSeat\(/u);
  // 복구 불가능한 세션 종료는 넘침 메뉴로 분리하고, 모바일은 하단 고정 주행동 바.
  assert.match(source, /participation-management-overflow-menu/u);
  assert.match(source, /className="is-danger"[\s\S]*?mutateSession\("finish"\)/u);
  assert.match(source, /participation-management-mobile-bar/u);
  assert.doesNotMatch(source, /mutateSession\("select_next"\)/u);
  // v3(실화면 결함 수정): 대기열 행은 한 줄 그리드 — 2줄 areas 유산이 선정 버튼을
  // 우하단에 고립시키고(데스크톱), 모바일에선 행 하나를 6줄로 쌓던 원인이었습니다.
  assert.doesNotMatch(css, /"position participant status"/u);
  assert.doesNotMatch(css, /"position"[\s\S]{0,40}"participant"[\s\S]{0,40}"status"/u);
  // 모바일은 2줄 콤팩트(sel·main·status / sel·main·actions), 신청 시각·순번은 숨김.
  assert.match(css, /"sel main status"[\s\S]*?"sel main actions"/u);
  assert.match(css, /participation-management-participant-main small[\s\S]{0,40}display:\s*none/u);
  // 라이트용 전역 상태색을 다크 화면용으로 페이지 스코프에서 재정의(뿌연 상태색 방지).
  assert.match(css, /participation-management-page \{[\s\S]{0,400}--info:\s*hsl\(/u);
  // 유령 스텝 방지 — 비활성 스텝은 opacity 가 아니라 배경·글자색으로 구분합니다.
  assert.doesNotMatch(css, /participation-management-pipe-step \{[\s\S]{0,400}opacity:/u);
  assert.match(css, /--participation-checkin-progress/u);
  assert.match(css, /participation-management-mobile-bar[\s\S]*?position:\s*fixed/u);
  // 잠긴 선정은 잠금 사유와 함께(고장처럼 보이지 않게), 체크인 단계 CTA 공백은 안내문으로.
  assert.match(source, /queueLockedNote/u);
  assert.match(source, /stepCheckinHint/u);
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
