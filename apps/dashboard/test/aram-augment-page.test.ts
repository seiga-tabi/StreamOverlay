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

test("등급을 색 띠로 구분하고 숫자 등급도 미리 받는다", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(rules, /\.public-aram-card::before/u);
  for (const selector of [
    /\.rarity-silver::before,\s*\n\s*\.public-aram-card\.rarity-0::before/u,
    /\.rarity-gold::before,\s*\n\s*\.public-aram-card\.rarity-1::before/u,
    /\.rarity-prismatic::before,\s*\n\s*\.public-aram-card\.rarity-2::before/u,
    /\.rarity-legend::before,\s*\n\s*\.public-aram-card\.rarity-4::before/u
  ]) {
    assert.match(rules, selector);
  }
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
