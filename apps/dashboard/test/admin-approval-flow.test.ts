import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../src/pages/StreamerRiotRequestsPage.tsx", import.meta.url),
  "utf8"
);
const dialog = await readFile(
  new URL("../src/components/AdminConfirmDialog.tsx", import.meta.url),
  "utf8"
);
const css = await readFile(
  new URL("../src/styles/pages/account/33-admin-console.css", import.meta.url),
  "utf8"
);

test("승인·거절은 확인 단계를 거친다", () => {
  // 버튼이 곧바로 API 를 부르지 않습니다.
  assert.equal(/onClick=\{\(\) => void resolveRequest\(/u.test(page), false);
  assert.match(page, /setPendingAction\(\{ request, decision: "approved" \}\)/u);
  assert.match(page, /setPendingAction\(\{ request, decision: "rejected" \}\)/u);
  assert.match(page, /AdminConfirmDialog/u);
});

test("거절에는 사유가 필수이고 서버 상한 300자를 지킨다", () => {
  assert.match(page, /confirmDisabled=\{pendingAction\.decision === "rejected" && !reason\.trim\(\)\}/u);
  assert.match(page, /maxLength=\{300\}/u);
  // 사유는 note 로 전송됩니다. 서버가 이미 받는 필드입니다.
  assert.match(page, /\.\.\.\(note \? \{ note \} : \{\}\)/u);
});

test("상태별로 가능한 조작만 노출한다", () => {
  // 거절된 요청에 "승인"이 그대로 활성이던 것을 바꿉니다.
  assert.match(page, /request\.status === "approved" \? null : \(/u);
  assert.match(page, /request\.status === "rejected" \? null : \(/u);
  assert.match(page, /request\.status === "rejected" \? t\.reapprove : t\.approve/u);
});

test("full_admin에게만 관리자 권한 부여·회수 조작을 노출한다", () => {
  assert.match(page, /const isFullAdmin = permissions === undefined/u);
  assert.match(page, /isFullAdmin && request\.status === "approved" && request\.accountRole !== "sub" && !request\.isAdmin/u);
  assert.match(page, /isFullAdmin && request\.isAdmin === true/u);
});

test("관리자 권한 조작은 확인 후 정확한 API 경로로 전송한다", () => {
  assert.match(page, /setPendingAdminAction\(\{ request, granting: true \}\)/u);
  assert.match(page, /setPendingAdminAction\(\{ request, granting: false \}\)/u);
  assert.match(page, /granting \? "grant-admin" : "revoke-admin"/u);
  assert.match(page, /onConfirm=\{\(\) => void confirmPendingAdminAction\(\)\}/u);
});

test("저장된 거절 사유를 목록에 보여 준다", () => {
  assert.match(page, /request\.note \?/u);
  assert.match(page, /yoro-ar-note/u);
});

test("확인 모달은 접근성 기본을 갖춘다", () => {
  assert.match(dialog, /role="dialog"/u);
  assert.match(dialog, /aria-modal="true"/u);
  assert.match(dialog, /aria-labelledby="yoro-ac-title"/u);
  // 위험한 조작이라 기본 초점은 취소입니다.
  assert.match(dialog, /cancelRef\.current\?\.focus\(\)/u);
  // Escape 로 닫히고 Tab 이 모달 밖으로 나가지 않습니다.
  assert.match(dialog, /event\.key === "Escape"/u);
  assert.match(dialog, /event\.key !== "Tab"/u);
});

test("목록 도구는 이미 받은 데이터 안에서만 좁힌다", () => {
  // 서버 pagination 이 아직 없으므로 클라이언트에서 필터합니다.
  assert.match(page, /const visibleRequests = useMemo/u);
  assert.match(page, /statusFilter/u);
  assert.match(page, /yoro-ar-search/u);
});

test("관리자 CSS는 pages layer에서 !important 없이 44px를 지킨다", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(rules, /@layer pages \{/u);
  assert.equal(rules.includes("!important"), false);
  for (const selector of [
    /\.yoro-ac-button\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-ac-preset\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-ar-filter\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.yoro-ar-search\s*\{[\s\S]*?min-height:\s*44px/u,
    /\.streamer-riot-request-actions \.compact-button[\s\S]*?min-height:\s*44px/u
  ]) {
    assert.match(rules, selector);
  }
});

test("한국어·일본어 문구를 함께 관리한다", () => {
  for (const [ko, ja] of [
    ["거절 사유 (필수)", "拒否理由 (必須)"],
    ["승인으로 변경", "承認に変更"],
    ["승인합니다", "承認します"],
    ["거절합니다", "拒否します"],
    ["Twitch 또는 Riot ID 검색", "Twitch または Riot ID を検索"],
    ["관리자 권한 부여", "管理者権限を付与"],
    ["관리자 권한 회수", "管理者権限を剥奪"],
    ["스트리머 직접 등록", "配信者を直接登録"],
    ["등록 중", "登録中"]
  ]) {
    assert.equal(page.includes(ko), true, ko);
    assert.equal(page.includes(ja), true, ja);
  }
});

test("관리자 직접 등록 폼은 검증된 Riot ID를 신규 API로 전송하고 승인 목록을 표시한다", () => {
  assert.match(page, /parseRiotIdDetailed\(directRiotId\)/u);
  assert.match(page, /\/api\/participation\/streamer-riot-id-requests\/admin-register/u);
  assert.match(page, /twitchLogin: directTwitchLogin\.trim\(\)\.toLowerCase\(\)/u);
  assert.match(page, /riotGameName: parsedRiotId\.gameName/u);
  assert.match(page, /riotTagLine: parsedRiotId\.tagLine/u);
  assert.match(page, /setStatusFilter\("approved"\)/u);
  assert.match(page, /htmlFor="yoro-ar-twitch-login"/u);
  assert.match(page, /htmlFor="yoro-ar-riot-id"/u);
  assert.match(css, /\.yoro-ar-register-submit[\s\S]*?min-height:\s*44px/u);
});
