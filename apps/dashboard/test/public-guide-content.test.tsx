import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PalworldPageGuide } from "../src/features/public-palworld/components/PalworldPageGuide";
import { PublicBotFaq } from "../src/features/public-bot/PublicBotFaq";

test("Palworld 가이드는 페이지 고유 콘텐츠를 ko·ja 로 렌더한다", () => {
  const palsLead = renderToStaticMarkup(<PalworldPageGuide locale="ko" page="pals" section="lead" />);
  assert.match(palsLead, /팰 도감 — 스탯·작업 적성·서식지를 한 곳에서/u);

  const palsDeep = renderToStaticMarkup(<PalworldPageGuide locale="ko" page="pals" section="deep" />);
  assert.match(palsDeep, /이 페이지 사용법/u);
  assert.match(palsDeep, /작업 적성 레벨/u);
  assert.match(palsDeep, /데이터 출처와 갱신 기준/u);
  assert.match(palsDeep, /원본 데이터 미제공/u);
  assert.match(palsDeep, /교배 조합은 어디서 확인하나요\?/u);
  /* FAQ 는 details/summary — 키보드 기본 동작 지원 */
  assert.match(palsDeep, /<details/u);

  const techJa = renderToStaticMarkup(<PalworldPageGuide locale="ja" page="technology" section="deep" />);
  assert.match(techJa, /古代テクノロジーポイント/u);
  const skillsJa = renderToStaticMarkup(<PalworldPageGuide locale="ja" page="skills" section="lead" />);
  assert.match(skillsJa, /スキル辞典/u);
  const itemsKo = renderToStaticMarkup(<PalworldPageGuide locale="ko" page="items" section="deep" />);
  assert.match(itemsKo, /유저 간 거래 시세는 수집하지 않으며/u);

  /* 광고 슬롯 오인 방지 — 빈 컨테이너 div 없이 텍스트 요소만 */
  assert.doesNotMatch(palsDeep, /<div[^>]*><\/div>/u);
});

test("Bot FAQ 는 섹션별 자체 작성 문구를 ko·ja 로 렌더한다", () => {
  const started = renderToStaticMarkup(<PublicBotFaq locale="ko" page="gettingStarted" />);
  assert.match(started, /봇을 초대했는데 명령에 응답하지 않아요\./u);
  assert.match(started, /관리자 권한은 요구하지 않으며/u);

  const commands = renderToStaticMarkup(<PublicBotFaq locale="ja" page="commands" />);
  assert.match(commands, /コマンド入力は常に英語ですが/u);

  const files = renderToStaticMarkup(<PublicBotFaq locale="ko" page="gameFiles" />);
  assert.match(files, /백업해 두는 것을 권합니다/u);
  assert.match(files, /옵션 스키마 기준이며, 임의 항목을 추가하지 않습니다/u);
  assert.match(files, /<details/u);
});
