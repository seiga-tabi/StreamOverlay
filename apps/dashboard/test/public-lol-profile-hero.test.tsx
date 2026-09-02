import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileHeroRank, type ProfileHeroRankQueue, type ProfileHeroRankText, type ProfileHeroRankTrend } from "../src/features/public-lol/components/ProfileHeroRank";
import { ProfilePerformanceRadar, type ProfilePerformanceMetric, type ProfilePerformanceRadarText } from "../src/features/public-lol/components/ProfilePerformanceRadar";

/* 전적 프로필 히어로 — docs/mockups/profile-hero-tabs-performance-v1.html (v3) 의
 * 구조 계약을 단언합니다. 랭크 3열 병렬 카드 → 탭 전환(좌우 반반 패널) 이행과
 * 퍼포먼스 지표 패널(6축 레이더 + 중앙 평점 + 막대 7행)이 대상입니다. */

const HERO_CSS = readFileSync(
  fileURLToPath(new URL("../src/styles/pages/public-lol/23-profile-hero.css", import.meta.url)),
  "utf8",
);

const rankText: ProfileHeroRankText = {
  queueSwitcherLabel: "랭크 큐 선택",
  unrankedTitle: "언랭크",
  viewRecentMatchesLabel: "최근 게임 보기",
  lpTrendLabel: "LP 추이 · 30일",
  lpTrendTitle: "LP 추이",
  lpTrendAfterPlacementNote: "랭크 배치를 마치면 LP 추이가 여기에 표시됩니다.",
  lpTrendNoSamplesNote: "LP 추이를 그릴 기록이 아직 부족합니다.",
  winRateLabel: "승률",
};

function rankedQueue(id: string, label: string, tierKey: string): ProfileHeroRankQueue {
  return {
    id,
    label,
    ranked: true,
    tierKey,
    tierFallbackLabel: tierKey.slice(0, 1).toUpperCase(),
    segmentValue: "48 LP",
    rankLabel: "에메랄드 II",
    leaguePointsLabel: "48 LP",
    wins: 62,
    losses: 51,
    winsLabel: "승",
    lossesLabel: "패",
    winRate: 55,
    recordCaption: "113게임 · 승률 55%",
    goal: { label: "다이아몬드까지 52 LP", percent: 48 },
  };
}

function unrankedQueue(id: string, label: string): ProfileHeroRankQueue {
  return {
    id,
    label,
    ranked: false,
    tierKey: "unranked",
    tierFallbackLabel: "U",
    segmentValue: "언랭크",
    rankLabel: "언랭크",
    wins: 0,
    losses: 0,
    winsLabel: "승",
    lossesLabel: "패",
    winRate: 0,
    recordCaption: "기록 없음",
    unrankedDescription: "이번 시즌 배치 경기 기록이 없습니다.",
  };
}

const queues = [
  rankedQueue("solo", "솔로랭크", "emerald"),
  rankedQueue("flex", "자유랭크", "platinum"),
  unrankedQueue("ranked5v5", "5v5 랭크"),
];

const trend: ProfileHeroRankTrend = {
  ariaLabel: "LP 추이 30일",
  changeLabel: "+64 LP",
  changeTone: "up",
  points: [
    { value: 12, tierKey: "platinum" },
    { value: 58, tierKey: "platinum" },
    { value: 96, tierKey: "emerald" },
  ],
};

function renderRank(
  activeQueueId: string,
  rankQueues = queues,
  rankTrend: ProfileHeroRankTrend | null = trend,
) {
  return renderToStaticMarkup(
    <ProfileHeroRank
      activeQueueId={activeQueueId}
      onSelectQueue={() => undefined}
      onViewRecentMatches={() => undefined}
      queues={rankQueues}
      text={rankText}
      trend={rankTrend ?? undefined}
    />
  );
}

test("랭크 영역은 3열 병렬 카드가 아니라 tablist 로 렌더하고 탭에는 큐 이름만 둔다", () => {
  const html = renderRank("solo");
  assert.match(html, /role="tablist"/u);
  assert.equal(html.match(/role="tab"/gu)?.length, 3);
  assert.equal(html.match(/role="tabpanel"/gu)?.length, 3);
  /* 3열 병렬 카드 격자는 사라졌습니다. */
  assert.doesNotMatch(html, /public-profile-hero-rank--cards/u);
  assert.match(html, /public-profile-hero-rank--tabs/u);
  /* 탭 버튼은 큐 이름 한 줄 — LP 를 다시 적으면 같은 화면에 같은 숫자가 두 번 나옵니다(§1-B). */
  const tabRow = html.slice(html.indexOf("public-hero-rank-tablist"), html.indexOf("public-hero-rank-panels"));
  assert.match(tabRow, /솔로랭크/u);
  assert.match(tabRow, /자유랭크/u);
  assert.doesNotMatch(tabRow, /48 LP/u);
  /* 터치 타깃을 줄이지 않습니다. */
  assert.match(HERO_CSS, /\.public-hero-rank-tab \{[^}]*min-height: var\(--yoro-size-touch-target\)/u);
  /* v4 — 점과 큐 이름 사이 여백은 gap 하나로만 넓힙니다(.4rem → .625rem).
     padding 과 점 지름은 그대로여야 점의 x 좌표가 움직이지 않습니다. */
  assert.match(HERO_CSS, /\.public-hero-rank-tab \{[^}]*gap: \.625rem/u);
  assert.match(HERO_CSS, /\.public-hero-rank-tab \{[^}]*padding: \.3rem \.6rem/u);
  assert.match(HERO_CSS, /\.public-hero-rank-tab > i \{[^}]*width: \.5rem/u);
});

/** 선택된 탭의 큐 id — 렌더 결과에서 aria-selected="true" 인 버튼 하나를 찾습니다. */
function selectedTabId(html: string): string | undefined {
  return /aria-selected="true"[^>]*id="[^"]*rank-tab-([a-z0-9]+)"/u.exec(html)?.[1];
}

/** 해당 큐 패널의 마크업만 잘라 냅니다(숨은 패널까지 함께 매칭되는 것을 막습니다). */
function panelMarkup(html: string, queueId: string): string {
  /* aria-controls 도 같은 id 를 참조하므로 tabpanel 쪽만 골라냅니다. */
  const chunk = html
    .split('class="public-hero-rank-panel"')
    .find((part) => part.includes(`rank-panel-${queueId}" role="tabpanel"`));
  assert.ok(chunk, `${queueId} 패널을 찾지 못했습니다`);
  return chunk;
}

test("탭 선택은 activeQueueId 를 따라가고 모든 랭크 큐에서 표본이 있으면 그래프를 그린다", () => {
  const solo = renderRank("solo");
  assert.equal(selectedTabId(solo), "solo");
  /* 비활성 패널은 hidden, 활성 패널은 hidden 없이 나옵니다. */
  assert.match(solo, /class="public-hero-rank-panel"[^>]*hidden=""[^>]*id="[^"]*rank-panel-flex"/u);
  assert.doesNotMatch(solo, /class="public-hero-rank-panel"[^>]*hidden=""[^>]*id="[^"]*rank-panel-solo"/u);

  const flex = renderRank("flex");
  assert.equal(selectedTabId(flex), "flex");
  assert.match(flex, /class="public-hero-rank-panel"[^>]*hidden=""[^>]*id="[^"]*rank-panel-solo"/u);
  /* trend는 선택된 큐의 데이터이므로 컴포넌트가 큐 종류로 다시 제한하지 않습니다. */
  assert.match(panelMarkup(solo, "solo"), /public-profile-hero-sparkline/u);
  assert.match(panelMarkup(flex, "flex"), /public-profile-hero-sparkline/u);

  const ranked5v5 = renderRank("ranked5v5", [
    queues[0]!,
    queues[1]!,
    rankedQueue("ranked5v5", "5v5 랭크", "gold"),
  ]);
  assert.match(panelMarkup(ranked5v5, "ranked5v5"), /public-profile-hero-sparkline/u);
});

test("탭 패널은 좌우 반반이고 승률 도넛 대신 승률 텍스트를 쓴다", () => {
  const html = panelMarkup(renderRank("solo"), "solo");
  assert.match(html, /public-hero-rank-split/u);
  assert.match(html, /public-hero-rank-main/u);
  assert.match(html, /public-hero-rank-side/u);
  /* 왼쪽 절반은 v4 에서 4블록입니다 — 크레스트 / [티어명 · LP] / [승패 · 승률] / 게이지. */
  assert.match(html, /public-hero-rank-lp[^>]*>48 LP/u);
  assert.match(html, /승률 55%/u);
  assert.match(html, /public-profile-hero-goal-track/u);
  /* 도넛은 뺐습니다 — 왼쪽 열 폭에서 크레스트 아래 도넛까지 넣으면 세로가 터집니다(§1-A). */
  assert.doesNotMatch(html, /public-profile-hero-donut/u);
  /* 구분은 새 배경색이 아니라 헤어라인 하나로. */
  assert.match(HERO_CSS, /\.public-hero-rank-side \{[^}]*border-inline-start: \.5px solid/u);
  /* 좌우 반반 격자와, 좁은 폭에서 세로로 풀리는 규칙이 함께 있어야 합니다. */
  assert.match(HERO_CSS, /\.public-hero-rank-split \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/u);
  assert.match(HERO_CSS, /@container profile-hero \(max-width: 47rem\)[^@]*\.public-hero-rank-split \{ grid-template-columns: minmax\(0, 1fr\)/u);
});

/** 왼쪽 절반(크레스트~게이지)만 잘라 냅니다 — 오른쪽 절반의 "LP 추이 · 30일" 이
 *  구분점 단언에 섞이지 않도록 하기 위함입니다. */
function mainHalf(panel: string): string {
  const start = panel.indexOf("public-hero-rank-main");
  const end = panel.indexOf("public-hero-rank-side");
  assert.ok(start >= 0 && end > start, "왼쪽 절반을 찾지 못했습니다");
  return panel.slice(start, end);
}

test("v4 — 왼쪽 절반은 [크레스트][티어명·LP][승패·승률][게이지] 4블록 순서다", () => {
  const main = mainHalf(panelMarkup(renderRank("solo"), "solo"));
  /* 블록 순서 자체를 고정합니다. */
  assert.match(
    main,
    /public-profile-hero-crest[\s\S]*public-hero-rank-line is-tier[\s\S]*public-hero-rank-line public-hero-rank-record[\s\S]*public-profile-hero-goal/u,
  );
  /* ② 티어명과 LP 는 래퍼 하나 안의 형제입니다(별도 줄이 아님). */
  assert.match(main, /class="public-hero-rank-line is-tier"><b class="public-hero-rank-card-tier">에메랄드 II<\/b><span class="public-hero-rank-lp">48 LP<\/span><\/span>/u);
  /* ③ 승패와 승률도 래퍼 하나 안의 형제입니다. */
  assert.match(main, /class="public-hero-rank-line public-hero-rank-record">.*62승.*51패.*승률 55%.*<\/span><\/span>/u);
  /* 구분점(·)은 로케일 문자열이 아니라 CSS ::before 여야 폭에 따라 켜고 끌 수 있습니다. */
  assert.doesNotMatch(main, /·/u);
  assert.match(HERO_CSS, /\.public-hero-rank-line > \* \+ \*::before \{[^}]*content: "·"/u);
  /* ① 크레스트는 4.5rem → 5.75rem(92px). */
  assert.match(HERO_CSS, /\.public-hero-rank-main \.public-profile-hero-crest \{ width: 5\.75rem; height: 5\.75rem; \}/u);
  /* 줄 수가 줄어든 만큼 블록 간격을 되돌립니다(.3rem → .6rem). */
  assert.match(HERO_CSS, /\.public-hero-rank-main \{[^}]*gap: \.6rem/u);
});

test("v4 — 값이 하나뿐인 언랭크 큐에서는 구분점이 매칭되지 않는다", () => {
  const main = mainHalf(panelMarkup(renderRank("ranked5v5"), "ranked5v5"));
  /* 언랭크는 LP 형제가 없으므로 * + * 가 걸리지 않아 점이 자동으로 사라집니다. */
  assert.match(main, /class="public-hero-rank-line is-tier"><b class="public-hero-rank-card-tier">언랭크<\/b><\/span>/u);
  assert.doesNotMatch(main, /public-hero-rank-lp/u);
  /* 승패·승률 줄도 없고 설명 한 줄만 남습니다. */
  assert.doesNotMatch(main, /public-hero-rank-record/u);
  assert.match(main, /이번 시즌 배치 경기 기록이 없습니다/u);
});

test("v4 — 스트리머 좁은 폭 분기는 마크업이 아니라 CSS 로만 갈린다", () => {
  /* 같은 컴포넌트가 폭에 따라 다른 마크업을 내지 않습니다 — 컴포넌트에 폭 조건이 없어야 합니다. */
  const source = readFileSync(
    fileURLToPath(new URL("../src/features/public-lol/components/ProfileHeroRank.tsx", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(source, /matchMedia|ResizeObserver|clientWidth|offsetWidth/u);

  /* 스트리머(has-cast)에서만 승패·승률이 두 줄로 갈리고 티어 줄의 점이 빠집니다(§5-A). */
  assert.match(HERO_CSS, /\.public-profile-hero-top\.has-cast \.public-hero-rank-record \{ flex-direction: column/u);
  assert.match(HERO_CSS, /\.public-profile-hero-top\.has-cast \.public-hero-rank-line\.is-tier > \* \+ \*::before \{ content: none; \}/u);
  assert.match(HERO_CSS, /\.public-profile-hero-top\.has-cast \.public-hero-rank-main \.public-profile-hero-crest \{ width: 4\.25rem; height: 4\.25rem; \}/u);

  /* 붕괴점에서 반반이 풀려 폭이 회복되면 다시 한 줄 구성으로 되돌립니다. */
  assert.match(
    HERO_CSS,
    /@container profile-hero \(max-width: 47rem\)[^@]*\.public-profile-hero-top\.has-cast \.public-hero-rank-record \{ flex-direction: row/u,
  );
  /* container query 는 specificity 를 더하지 않으므로, 복원 규칙은 compact 규칙과
     똑같은 선택자여야 뒤 순서로 덮입니다(.is-tier 를 빠뜨리면 점이 안 돌아옵니다). */
  assert.match(
    HERO_CSS,
    /@container profile-hero \(max-width: 47rem\)[^@]*\.public-profile-hero-top\.has-cast \.public-hero-rank-line\.is-tier > \* \+ \*::before,\s*\.public-profile-hero-top\.has-cast \.public-hero-rank-record > \* \+ \*::before \{ content: "·"/u,
  );
});

test("언랭크 탭은 오른쪽 절반을 비우지 않고 '아직 없음' 사유와 최근 게임 보기를 둔다", () => {
  const rendered = renderRank("ranked5v5", queues, null);
  assert.equal(selectedTabId(rendered), "ranked5v5");
  const html = panelMarkup(rendered, "ranked5v5");
  assert.match(html, /랭크 배치를 마치면 LP 추이가 여기에 표시됩니다/u);
  assert.match(html, /public-profile-hero-ghost[^>]*>최근 게임 보기/u);
  /* "없음"과 "아직 없음"은 다른 문구여야 합니다(§1-A). */
  assert.doesNotMatch(html, /솔로랭크에서만 제공됩니다/u);
});

const perfText: ProfilePerformanceRadarText = {
  title: "퍼포먼스 지표",
  scope: "최근 20경기 · 큐 구분 없음",
  scoreLabel: "평점 / 10",
  scoreScaleSuffix: "/ 10",
  emptyTitle: "표본이 부족합니다",
  emptyDescription: "최근 3경기 이상부터 퍼포먼스 지표를 표시합니다",
  radarAriaLabel: "퍼포먼스 지표 레이더 차트",
  emptyRadarAriaLabel: "퍼포먼스 지표 없음",
  footNote: "레이더는 6축(평점 제외)",
};

function metrics(overrides: Record<string, undefined> = {}): ProfilePerformanceMetric[] {
  const base: Array<[string, string, number, number, string]> = [
    ["kill-participation", "킬 관여율", 58.4, 100, "58%"],
    ["damage-share", "팀 피해 비중", 27.3, 40, "27.3%"],
    ["damage-per-minute", "DPM", 812, 1200, "812"],
    ["cs-per-minute", "분당 CS", 7.4, 10, "7.4"],
    ["gold-per-minute", "GPM", 421, 600, "421"],
    ["vision-score-per-minute", "VSPM", .96, 2, "0.96"],
  ];
  return [
    { key: "score", label: "평점", lead: true, max: 100, value: 72, display: "7.2" },
    ...base.map(([key, label, value, max, display]) => ({
      key,
      label,
      max,
      display: key in overrides ? "—" : display,
      ...(key in overrides ? {} : { value }),
    })),
  ];
}

test("퍼포먼스 패널은 6축 레이더 + 중앙 평점 + 막대 7행이고 평점은 축이 아니다", () => {
  const html = renderToStaticMarkup(<ProfilePerformanceRadar metrics={metrics()} text={perfText} />);
  /* 축은 6개(평점 제외) — 축 라벨·꼭짓점이 각각 6개여야 합니다. */
  assert.equal(html.match(/class="axis-label"/gu)?.length, 6);
  assert.equal(html.match(/class="vertex"/gu)?.length, 6);
  assert.match(html, /class="shape"/u);
  /* 막대는 평점 포함 7행이고 평점은 첫 줄(is-lead)입니다(§8). */
  /* 컨테이너(-bars)와 겹치지 않게 행 클래스만 셉니다. */
  assert.equal(html.match(/public-hero-performance-bar(?![s-])/gu)?.length, 7);
  assert.match(html, /public-hero-performance-bar is-lead/u);
  /* 중앙 평점은 10점 만점 표기 + 보조 라벨. */
  assert.match(html, /public-hero-performance-score/u);
  assert.match(html, />7\.2</u);
  assert.match(html, />평점 \/ 10</u);
});

test("레이더 중앙 평점에는 배경 판이 없고 text-shadow 헤일로로만 읽힌다", () => {
  const scoreRule = HERO_CSS.slice(HERO_CSS.indexOf(".public-hero-performance-score {"));
  const scoreBlock = scoreRule.slice(0, scoreRule.indexOf("}"));
  assert.match(scoreBlock, /background: none;/u);
  /* v2 의 원형 배경(표면색 74% + backdrop blur)은 v3 에서 전부 제거됐습니다(§3-4). */
  assert.doesNotMatch(scoreRule.slice(0, scoreRule.indexOf(".public-hero-performance-empty")), /backdrop-filter|border-radius: var\(--yoro-radius-circle\)/u);
  assert.match(HERO_CSS, /\.public-hero-performance-score > b,\s*\.public-hero-performance-score > small \{\s*text-shadow:/u);
});

test("결측 지표는 0 이 아니라 축 제외로 처리하고 막대에는 점선 트랙으로 남는다", () => {
  const html = renderToStaticMarkup(
    <ProfilePerformanceRadar metrics={metrics({ "vision-score-per-minute": undefined })} text={perfText} />
  );
  /* VSPM 축만 빠져 5각형이 됩니다 — 0(중심)으로 찍으면 "그 지표를 못했다"는 거짓말이 됩니다. */
  assert.equal(html.match(/class="axis-label"/gu)?.length, 5);
  assert.equal(html.match(/class="vertex"/gu)?.length, 5);
  assert.doesNotMatch(html, /VSPM<\/text>/u);
  /* 막대 목록에서는 7행을 유지하고 값만 "—" 입니다. */
  /* 컨테이너(-bars)와 겹치지 않게 행 클래스만 셉니다. */
  assert.equal(html.match(/public-hero-performance-bar(?![s-])/gu)?.length, 7);
  assert.match(html, /public-hero-performance-bar is-empty/u);
  assert.match(html, /VSPM<\/span><b>—<\/b>/u);
  assert.match(HERO_CSS, /\.public-hero-performance-bar\.is-empty > i \{\s*background: repeating-linear-gradient/u);
});

test("가용 축이 3개 미만이면 다각형을 그리지 않고 점선 링 + 안내문만 남긴다", () => {
  const html = renderToStaticMarkup(
    <ProfilePerformanceRadar
      metrics={metrics({
        "damage-per-minute": undefined,
        "cs-per-minute": undefined,
        "gold-per-minute": undefined,
        "vision-score-per-minute": undefined,
      })}
      text={perfText}
    />
  );
  assert.doesNotMatch(html, /class="shape"/u);
  assert.doesNotMatch(html, /class="vertex"/u);
  assert.match(html, /class="ring is-empty"/u);
  assert.match(html, /표본이 부족합니다/u);
  /* 중앙 평점 숫자도 띄우지 않습니다 — 그릴 근거가 없는 화면이기 때문입니다. */
  assert.doesNotMatch(html, /public-hero-performance-score/u);
  assert.match(html, /aria-label="퍼포먼스 지표 없음"/u);
});
