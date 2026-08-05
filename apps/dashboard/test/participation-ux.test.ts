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
  const legacyCss = await readFile(
    new URL("../src/styles/pages/public-lol/02-legacy.css", import.meta.url),
    "utf8"
  );
  const finalCss = await readFile(
    new URL("../src/styles/pages/public-lol/10-final-overrides.css", import.meta.url),
    "utf8"
  );
  const i18n = await readFile(
    new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /directSessionLink/u);
  assert.match(source, /public-participation-my-status/u);
  assert.match(source, /<details className="public-participation-timeline-card">/u);
  assert.match(source, /<ol className="public-participation-timeline">/u);
  assert.match(source, /aria-current=\{current \? "step"/u);
  assert.match(source, /public-participation-rules-title/u);
  assert.match(source, /className="public-participation-rejoin-icon"/u);
  assert.doesNotMatch(source, /className="public-participation-rejoin-note"[^>]*>[\s\S]{0,160}<Badge/u);
  assert.match(source, /className="public-participation-queue-status"/u);
  assert.match(source, /<ol className="public-participation-queue-list"/u);
  assert.match(source, /className="public-participation-queue-profile"/u);
  assert.match(source, /className="public-participation-queue-viewer"/u);
  assert.match(source, /queue\.slice\(start, start \+ 5\)/u);
  assert.match(source, /aria-expanded=\{queueExpanded\}/u);
  assert.match(source, /<details className="public-participation-rules">/u);
  assert.doesNotMatch(source, /setPendingAction\("join"\)/u);
  assert.match(source, /parseRiotIdDetailed/u);
  assert.match(css, /env\(safe-area-inset-bottom\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(finalCss, /public-participation-queue-tags \.public-participation-queue-status/u);
  assert.match(finalCss, /public-participation-queue-row:not\(\.yoro-card\)/u);
  assert.match(finalCss, /public-participation-queue-profile/u);
  assert.match(finalCss, /public-participation-queue-tags \.public-participation-queue-viewer/u);
  assert.doesNotMatch(legacyCss, /\.public-participation-queue-tags span\s*\{/u);
  assert.match(legacyCss, /\.public-participation-queue-tags > :is\(\.yoro-status, \.yoro-badge\)/u);
  assert.match(i18n, /Riot ID는 게임이름#태그 형식으로 입력해주세요/u);
  assert.match(i18n, /Riot IDはゲーム名#タグの形式で入力してください/u);
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
  assert.match(source, /className="is-danger"[\s\S]*?mutateSession\("finish"\)/u);
  assert.match(css, /grid-template-areas:[\s\S]*?"position participant status"[\s\S]*?"position actions actions"/u);
  assert.match(css, /color:\s*var\(--yoro-color-text-on-dark-strong\)/u);
});

test("모바일 공개 검색 결과는 두 항목 이후 목록 내부에서 스크롤한다", async () => {
  const lolCss = await readFile(
    new URL("../src/styles/pages/public-lol/05-overrides.css", import.meta.url),
    "utf8"
  );
  const palworldCss = await readFile(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8"
  );

  assert.match(lolCss, /public-home-shared-search \.public-suggestion-list[\s\S]*?max-height:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
  assert.match(lolCss, /public-search-wrap \.public-suggestion-list[\s\S]*?max-height:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
  assert.match(palworldCss, /\.palworld-autocomplete[\s\S]*?max-block-size:[\s\S]*?--yoro-size-touch-target[\s\S]*?--yoro-size-touch-target[\s\S]*?overflow-y:\s*auto/u);
});
