import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChampionFilterSelect } from "../src/features/public-lol/components/ChampionFilterSelect";
import { ProfileTopPanel } from "../src/features/public-lol/components/ProfileTopPanel";
import { RecentMatchRow } from "../src/features/public-lol/components/RecentMatchRow";
import { Button } from "../src/shared/ui/Button";
import { StatusPill } from "../src/shared/ui/Status";

test("Shared Button loading 상태가 중복 클릭 방지와 접근성 속성을 함께 출력한다", () => {
  const html = renderToStaticMarkup(<Button loading loadingLabel="검색 중">검색</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /data-loading="true"/);
  assert.match(html, /검색 중/);
});

test("Shared Status가 tone과 size 계약을 마크업에 유지한다", () => {
  const html = renderToStaticMarkup(<StatusPill tone="live" size="sm">LIVE</StatusPill>);
  assert.match(html, /data-tone="live"/);
  assert.match(html, /data-size="sm"/);
  assert.match(html, />LIVE</);
});

test("챔피언 필터가 선택된 챔피언 이미지와 목록형 선택 접근성 정보를 출력한다", () => {
  const html = renderToStaticMarkup(
    <ChampionFilterSelect
      allLabel="모든 챔피언"
      label="챔피언 필터"
      labelJa="チャンピオンフィルター"
      labelKo="챔피언 필터"
      onChange={() => undefined}
      options={[{
        value: "266",
        label: "아트록스",
        iconUrl: "https://example.com/aatrox.png",
        fallbackLabel: "아"
      }]}
      value="266"
    />
  );

  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /src="https:\/\/example\.com\/aatrox\.png"/);
  assert.match(html, />아트록스</);
});

test("Profile 상단은 상세 정보를 접고 최근 경기 바로가기를 먼저 제공한다", () => {
  const html = renderToStaticMarkup(
    <ProfileTopPanel
      favoriteActionLabel="즐겨찾기"
      favoriteActive={false}
      favoriteAriaLabel="즐겨찾기 추가"
      fetchedAtText="방금 전"
      gameName="YORO"
      loading={false}
      metricStrip={<div id="metric-strip">상세 지표</div>}
      onRefresh={() => undefined}
      onToggleFavorite={() => undefined}
      primaryRankLabel="Platinum I"
      primaryRankTone="info"
      profileLinks={<div />}
      refreshButtonLabel="전적 갱신"
      refreshCooldownLabel=""
      refreshCoolingDown={false}
      refreshDisabled={false}
      refreshTitle="전적 갱신"
      searchForm={<div>검색</div>}
      seasonBadges={<div>시즌</div>}
      tagLine="JP1"
      text={{
        ranking: "랭킹",
        cachedRanking: { label: "캐시", ko: "캐시", ja: "キャッシュ" },
        liveDataNotice: { label: "실시간", ko: "실시간", ja: "リアルタイム" },
        profileLinksLabel: { label: "프로필 링크", ko: "프로필 링크", ja: "プロフィールリンク" },
        serverLabel: "JP",
        searching: "검색 중",
        showDetails: { label: "상세 보기", ko: "상세 보기", ja: "詳細を見る" },
        hideDetails: { label: "상세 접기", ko: "상세 접기", ja: "詳細を閉じる" },
        recentMatches: { label: "최근 경기", ko: "최근 경기", ja: "最近の試合" },
      }}
    />
  );

  assert.match(html, /details-collapsed/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /최근 경기/);
  assert.doesNotMatch(html, /id="metric-strip"/);
});

test("최근 전적 행이 모바일 카드에 필요한 다국어 정보와 로드아웃을 유지한다", () => {
  const html = renderToStaticMarkup(
    <RecentMatchRow
      aiScore={91}
      aiScoreText={{ label: "MVP", ko: "MVP", ja: "MVP" }}
      badges={<span>MVP</span>}
      championFallback="제"
      championIconUrl="https://example.com/champion.png"
      championName="제드"
      championRoleLevel="미드 · Lv.18"
      csLabel="CS 210"
      csPerMinuteMetric="7.8 CS/분"
      expanded={false}
      expandAriaLabel="경기 상세 펼치기"
      highlightClass="highlight-mvp"
      itemSlots={Array.from({ length: 6 }, (_, index) => ({ key: `item-${index}`, content: `아이템${index}` }))}
      itemsLabel="아이템"
      kdaMetric="Perfect"
      kdaScore={<><span>9</span><i>/</i><span className="deaths">0</span><i>/</i><span>6</span></>}
      killParticipationMetric="킬 관여 70%"
      onToggleExpand={() => undefined}
      queueLabel="솔로랭크"
      relativeLabel="13시간 전"
      result="win"
      resultDurationLabel="26:50"
      resultLabel="승리"
      scoreClassName="metric-tone-excellent"
      spellItems={Array.from({ length: 4 }, (_, index) => ({ key: `loadout-${index}`, content: `로드아웃${index}` }))}
      startedAtLabel="2026. 7. 14."
      summonerSpellsLabel="소환사 주문과 룬"
    />
  );

  assert.match(html, /public-match-row win highlight-mvp/);
  assert.match(html, /data-ko="MVP" data-ja="MVP"/);
  assert.equal((html.match(/로드아웃\d/g) ?? []).length, 4);
  assert.equal((html.match(/아이템\d/g) ?? []).length, 6);
  assert.match(html, /class="deaths">0/);
});
