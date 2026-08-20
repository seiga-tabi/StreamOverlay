import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeHeader } from "../src/features/public-home/components/HomeHeader";
import { LolBottomTabBar } from "../src/features/public-home/components/HomeTabBar";
import {
  LolHomeHero,
  LolParticipationBanner,
  LolSubnav
} from "../src/features/public-home/components/LolHomeSections";
import { homeI18n } from "../src/features/public-home/i18n/home-i18n";
import { lolHomeI18n } from "../src/features/public-home/i18n/lol-home-i18n";

/* LoL 홈(/lol) 리디자인 — 목업 캔버스 page-2 의 구조 계약을 단언합니다.
 * localStorage·fetch 의존은 전부 effect 안에 있으므로 SSR 로 골격을 검증합니다. */

const noop = () => undefined;

test("LoL 홈 헤더의 게임 트리거는 '리그 오브 레전드' 활성 상태(꼬리 밑줄)로 렌더한다", () => {
  const html = renderToStaticMarkup(
    <HomeHeader
      activeGame="lol"
      connected={false}
      locale="ko"
      onDashboard={noop}
      onLocale={noop}
      onLoginOpen={noop}
      onLogout={noop}
      onToggleTheme={noop}
      text={homeI18n.ko}
    />
  );
  assert.match(html, /yoro-home-games-trigger-name/u);
  assert.match(html, /리그 오브 레전드/u);
  assert.match(html, /yoro-home-games-trigger-tail/u);
  /* 게임 홈에서는 상단 '홈' 링크가 활성이 아닙니다. */
  assert.doesNotMatch(html, /aria-current="page"/u);
});

test("2행 LoL 메뉴는 실제 5항목(홈·스트리머·시청자 참여·증강 칼바람·패치노트)이고 홈은 LoL 홈으로 간다", () => {
  const html = renderToStaticMarkup(<LolSubnav text={lolHomeI18n.ko} />);
  assert.match(html, /yoro-lol-subnav/u);
  assert.match(html, /yoro-lol-subnav-tail/u);
  /* 홈 버튼은 LoL 홈(/lol)으로 갑니다(2026-08-20 변경) — 메인 홈 출구는 1행 헤더가 담당. */
  assert.match(html, /href="\/ko\/lol"/u);
  assert.match(html, />홈</u);
  assert.match(html, /\/follow/u);
  assert.match(html, /스트리머/u);
  assert.match(html, /\/participation/u);
  assert.match(html, /시청자 참여/u);
  assert.match(html, /\/lol\/aram/u);
  assert.match(html, /증강 칼바람/u);
  assert.match(html, /\/patch-notes/u);
  assert.match(html, /패치노트/u);
});

test("LoL 히어로는 LoL 단일 검색(탭 없음)·서버 선택·퀵 칩을 갖춘다", () => {
  const ko = renderToStaticMarkup(
    <LolHomeHero homeText={homeI18n.ko} locale="ko" text={lolHomeI18n.ko} />
  );
  assert.match(ko, /LoL 전적, 검색 한 번/u);
  assert.match(ko, /yoro-home-mark-word/u);
  assert.match(ko, /소환사명#태그/u);
  assert.match(ko, /<option[^>]*>KR<\/option>/u);
  assert.match(ko, /<option[^>]*>JP<\/option>/u);
  assert.match(ko, /증강 칼바람/u);
  assert.match(ko, /시청자 참여/u);
  /* 팰 도감 탭은 LoL 홈에 없습니다(LoL 단일 검색). */
  assert.doesNotMatch(ko, /yoro-home-search-tab\b/u);
  assert.doesNotMatch(ko, /팰 도감/u);

  const ja = renderToStaticMarkup(
    <LolHomeHero homeText={homeI18n.ja} locale="ja" text={lolHomeI18n.ja} />
  );
  assert.match(ja, /LoL戦績、検索ひとつで/u);
  assert.match(ja, /サモナー名#タグ/u);
  assert.match(ja, /オーグメントARAM/u);
});

test("시청자 참여 배너는 노리개 표식과 참여 페이지 링크를 갖춘다", () => {
  const html = renderToStaticMarkup(<LolParticipationBanner text={lolHomeI18n.ko} />);
  assert.match(html, /yoro-lol-participation/u);
  assert.match(html, /시청자 참여/u);
  assert.match(html, /대기열에 등록하고/u);
  assert.match(html, /\/participation/u);
  assert.match(html, /참여 페이지로/u);
});

test("LoL 모바일 하단 탭바는 실서비스 5탭 구성(축약 라벨)으로 렌더하고 홈은 메인 홈으로 나간다", () => {
  const html = renderToStaticMarkup(<LolBottomTabBar text={lolHomeI18n.ko} />);
  assert.match(html, /yoro-home-tabbar--five/u);
  /* 모바일에선 헤더 nav 가 숨겨지므로 홈 탭이 메인 홈(/)으로 가는 유일한 경로입니다. */
  assert.match(html, /href="\/ko\/"/u);
  assert.match(html, />홈</u);
  assert.match(html, /스트리머/u);
  /* 모바일 탭은 실서비스 탭바와 같은 축약 라벨(참여·칼바람)을 씁니다. */
  assert.match(html, />참여</u);
  assert.match(html, />칼바람</u);
  assert.match(html, /패치노트/u);
  assert.match(html, /\/lol/u);
  assert.match(html, /\/follow/u);
  assert.match(html, /\/participation/u);
  assert.match(html, /\/lol\/aram/u);
  assert.match(html, /\/patch-notes/u);
});

test("LoL 홈 i18n 은 ko·ja·en 세 로케일에 같은 키를 제공한다", () => {
  const koKeys = Object.keys(lolHomeI18n.ko).sort();
  assert.deepEqual(Object.keys(lolHomeI18n.ja).sort(), koKeys);
  assert.deepEqual(Object.keys(lolHomeI18n.en).sort(), koKeys);
});
