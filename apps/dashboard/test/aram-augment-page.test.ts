import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../src/features/public-lol/pages/PublicAramPage.tsx", import.meta.url),
  "utf8"
);
const css = await readFile(
  new URL("../src/styles/pages/public-lol/34-aram-augments.css", import.meta.url),
  "utf8"
);
const i18n = await readFile(
  new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
  "utf8"
);

test("증강 이름·설명은 legacy !important를 피하는 새 이름을 쓴다", () => {
  // 04-followers.css:671·690 의 `.public-dashboard-shell .yoro-card__{title,description}`
  // !important 에 걸리면 카드 배경과 같은 밝기가 됩니다(실측 1.03:1).
  assert.equal(page.includes("<CardDescription>"), false);
  assert.equal(page.includes("<CardTitle"), false);
  assert.match(page, /className="yoro-aram-name"/u);
  assert.match(page, /className="yoro-aram-desc"/u);
});

test("등급 배지는 원문이 아니라 현지화된 이름을 보여 준다", () => {
  // 이전에는 "silver" 같은 API 원문이 그대로 노출됐습니다.
  assert.equal(page.includes("{augment.rarity}</Badge>"), false);
  assert.match(page, /rarityLabel\(augment\.rarity\)/u);
  assert.match(page, /function rarityLabel/u);
});

test("이 페이지에서 다른 기능으로 나가는 경로를 둔다", () => {
  // 본문 링크가 개인정보·약관·문의 셋뿐이었습니다.
  assert.match(page, /function AramExits/u);
  /* LoL 홈은 /lol 입니다(루트는 그리로 넘깁니다) — 상수로 참조합니다. */
  assert.match(page, /localizedPublicUrlForCurrentLocale\(PUBLIC_LOL_HOME_PATH\)/u);
  for (const path of ['"/participation"', '"/follow"']) {
    assert.match(page, new RegExp(`localizedPublicUrlForCurrentLocale\\(${path}\\)`, "u"));
  }
  // 데이터가 준비 중일 때도 빈손으로 돌아가지 않게 합니다.
  assert.match(page, /catalog\?\.status === "preparing" \? <AramExits \/> : null/u);
});

test("등급색은 표식 외곽선·글자로 말하고 숫자 등급도 미리 받는다", () => {
  /* 수묵 전환(§2-3): 4px 좌측 색 레일은 은퇴 — 등급 표식이 같은 정보를 말합니다.
     문자열·숫자 등급 페어는 계속 함께 둡니다(실데이터가 0/1/2/4 네 단계). */
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.equal(rules.includes(".public-aram-card::before"), false);
  for (const selector of [
    /\.rarity-silver,\s*\n\s*\.public-aram-card\.rarity-0 \{ --aram-r: var\(--aram-r-silver\); \}/u,
    /\.rarity-gold,\s*\n\s*\.public-aram-card\.rarity-1 \{ --aram-r: var\(--aram-r-gold\); \}/u,
    /\.rarity-prismatic,\s*\n\s*\.public-aram-card\.rarity-2 \{ --aram-r: var\(--aram-r-prismatic\); \}/u,
    /\.rarity-legend,\s*\n\s*\.public-aram-card\.rarity-4 \{ --aram-r: var\(--aram-r-legend\); \}/u
  ]) {
    assert.match(rules, selector);
  }
  /* 라이트 단계(§2-3 신규) — 흰 카드 위 4.5:1 을 넘는 값이 네 등급 모두 있어야 합니다. */
  assert.match(rules, /\.theme-light \.public-aram-page[\s\S]*?--aram-r-silver:[\s\S]*?--aram-r-gold:[\s\S]*?--aram-r-prismatic:[\s\S]*?--aram-r-legend:/u);
});

test("보정 CSS는 pages layer에서 !important 없이 44px를 지킨다", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(rules, /@layer pages \{/u);
  assert.equal(rules.includes("!important"), false);
  assert.match(rules, /\.yoro-aram-exit\s*\{[\s\S]*?min-height:\s*44px/u);
  // 존재하지 않는 --space-* 대신 실제 토큰 이름을 씁니다.
  assert.equal(/var\(--space-\d/u.test(rules), false);
});

test("한국어·일본어 문구를 함께 관리한다", () => {
  for (const [ko, ja] of [
    ["이어서 볼 만한 것", "あわせて見る"],
    ["칼바람 전적", "ランダムミッドの戦績"],
    ["시청자 참여", "視聴者参加"],
    ["스트리머", "ストリーマー"]
  ]) {
    assert.equal(i18n.includes(`"${ko}"`), true, ko);
    assert.equal(i18n.includes(`"${ja}"`), true, ja);
  }
});
