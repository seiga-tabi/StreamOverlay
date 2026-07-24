import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  PalworldBreedingPair,
  PalworldItemReference,
  PalworldMapMarker,
  PalworldPalListFacets,
  PalworldSkillDetail,
  PalworldSkillSummary,
} from "@streamops/shared";
import { PALWORLD_WORK_SUITABILITY_TYPES } from "@streamops/shared";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../src/features/public-palworld/components/PalworldHome";
import { ItemCard, PalCard } from "../src/features/public-palworld/components/PalworldCards";
import { PalworldItemReferenceButton } from "../src/features/public-palworld/components/PalworldItemReferenceButton";
import { isLocalPalworldImageUrl, PalworldMedia } from "../src/features/public-palworld/components/PalworldMedia";
import {
  clampPalworldMapView,
  focusPalworldMapViewAt,
  isLocalPalworldMapUrl,
  PALWORLD_WORLD_MAP_IMAGE_URL,
  PalworldBossMarkerLayer,
  PalworldMapPage,
  PalworldSpawnAreaLayer,
  zoomPalworldMapViewAt,
} from "../src/features/public-palworld/components/PalworldMapPage";
import {
  PalworldPalsAppliedFilters,
  PalworldPalsDesktopFilterPanel,
  PalworldPalsResultToolbar,
} from "../src/features/public-palworld/components/PalworldPalsFilters";
import { PalworldAutoLoadControl } from "../src/features/public-palworld/components/PalworldAutoLoadControl";
import { PalworldItemsPage } from "../src/features/public-palworld/components/PalworldItemsPage";
import { PalworldSourceFooter } from "../src/features/public-palworld/components/PalworldSourceFooter";
import { PalworldStreamersPage } from "../src/features/public-palworld/components/PalworldStreamersPage";
import { PalworldSkillCard, PalworldSkillDetailView, PalworldSkillsPage } from "../src/features/public-palworld/components/PalworldSkillsPage";
import { PalworldElementBadge } from "../src/features/public-palworld/components/PalworldElementBadge";
import { PalworldPalStatsGraph } from "../src/features/public-palworld/components/PalworldPalStatsGraph";
import { PalworldPalPicker } from "../src/features/public-palworld/components/PalworldPalPicker";
import { BreedingModeTabs } from "../src/features/public-palworld/components/PalworldBreedingControls";
import {
  BreedingGenderAlternativeCard,
  BreedingRequestStatus,
  DirectBreedingResult,
  ReverseBreedingPairCard,
  ReverseBreedingTargetSummary,
} from "../src/features/public-palworld/components/PalworldBreedingResults";
import { PalworldNotFoundPage } from "../src/features/public-palworld/components/PalworldNotFoundPage";
import { PalworldPageErrorBoundary } from "../src/features/public-palworld/components/PalworldPageErrorBoundary";
import {
  filterPalworldBossMarkers,
  PalworldPalLocationMap,
} from "../src/features/public-palworld/components/PalworldPalLocationMap";
import { PalworldWorkSuitabilityBadge } from "../src/features/public-palworld/components/PalworldWorkSuitabilityBadge";
import generatedStaticAssets from "../src/features/public-palworld/data/palworld-static-assets.generated.json";
import { palworldI18n } from "../src/features/public-palworld/i18n/palworld-i18n";
import { isLocalPalworldElementImageUrl, PALWORLD_ELEMENT_IMAGES } from "../src/features/public-palworld/utils/element-images";
import { workSuitabilityIconUrl } from "../src/features/public-palworld/utils/work-suitability-icons";

const gameAssetUrl = (fileName: string) => new URL(`../public/images/games/${fileName}`, import.meta.url);

function assertPngAsset(fileName: string, width: number, height: number): void {
  const data = readFileSync(gameAssetUrl(fileName));
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(data.readUInt32BE(16), width);
  assert.equal(data.readUInt32BE(20), height);
}

test("게임 선택 메뉴에는 LoL과 펠월드 두 항목만 표시한다", () => {
  setActivePublicLocale("ko");
  const html = renderToStaticMarkup(<PublicGameSelector activePage="palworld" onPage={() => undefined} mode="tray" />);
  assert.equal((html.match(/role="option"/g) ?? []).length, 2);
  assert.match(html, /리그 오브 레전드/);
  assert.match(html, /펠월드/);
  assert.match(html, /src="\/images\/games\/league-of-legends-f01a628bbea2\.png"/);
  assert.match(html, /src="\/images\/games\/palworld-a88d83f86cfe\.png"/);
  assert.doesNotMatch(html, /src="\/images\/games\/(?:league-of-legends|palworld)\.png"/);
  assert.equal((html.match(/class="public-game-selector-logo is-(?:league-of-legends|palworld)"[^>]*alt=""[^>]*aria-hidden="true"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /발로란트|마인크래프트/);

  assertPngAsset("league-of-legends-f01a628bbea2.png", 48, 48);
  assertPngAsset("palworld-a88d83f86cfe.png", 256, 256);
  assert.equal(existsSync(gameAssetUrl("league-of-legends.png")), false);
  assert.equal(existsSync(gameAssetUrl("palworld.png")), false);
  assert.equal(existsSync(gameAssetUrl("palworld.svg")), false);
});

test("비정규 Palworld 경로와 page 오류 경계는 원문 오류 없이 한국어·일본어 복구 UI를 제공한다", () => {
  const notFound = renderToStaticMarkup(<PalworldNotFoundPage locale="ja" />);
  assert.match(notFound, /ページが見つかりません/u);
  assert.match(notFound, /data-ko="페이지를 찾을 수 없습니다\."/u);
  assert.match(notFound, /data-ja="ページが見つかりません。"/u);

  const boundary = new PalworldPageErrorBoundary({ children: <span>정상 화면</span> });
  boundary.state = { failed: true };
  const failed = renderToStaticMarkup(<>{boundary.render()}</>);
  assert.match(failed, /Palworld 페이지를 표시할 수 없습니다/u);
  assert.match(failed, /data-ja="Palworld ページを表示できません。"/u);
  assert.match(failed, /다시 시도/u);
  assert.match(failed, /페이지 새로고침/u);
  assert.doesNotMatch(failed, /stack|Error:/u);
});

test("펠월드 홈 헤더에는 상단 검색이 없고 하위 페이지에는 표시한다", () => {
  setActivePublicLocale("ko");
  const home = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="home" />);
  const child = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="pals" searchContent={<div data-testid="header-search">검색</div>} />);
  assert.doesNotMatch(home, /data-testid="header-search"/);
  assert.match(child, /data-testid="header-search"/);
  assert.match(child, /data-testid="palworld-secondary-nav"/);
  assert.match(child, /aria-current="page"[^>]*data-ko="Pal 도감"/);
  assert.match(home, /class="public-brand-mark public-brand-mobile-logo" src="\/images\/yorogg-home-logo\.webp" alt="" aria-hidden="true"/);
  assert.doesNotMatch(home, /src="\/images\/yorogg-mark\.png"/);
});

test("Palworld 2행 메뉴는 한국어·일본어 7개 순서와 스트리머 활성 상태를 유지한다", () => {
  const korean = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="streamers" searchContent={<div data-testid="header-search">검색</div>} />);
  const japanese = renderToStaticMarkup(<PalworldHeader locale="ja" onLocale={() => undefined} page="home" />);
  const skills = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="skills" searchContent={<div data-testid="header-search">검색</div>} />);
  const map = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="map" searchContent={<div data-testid="header-search">검색</div>} />);
  assert.equal((korean.match(/<nav[^>]*data-testid="palworld-secondary-nav"[\s\S]*?<button/gu) ?? []).length > 0, true);
  assert.equal((korean.match(/data-ko="(?:홈|스트리머|Pal 도감|교배 조합|아이템|스킬|지도)"/gu) ?? []).length, 7);
  assert.match(korean, /홈[\s\S]*스트리머[\s\S]*Pal 도감[\s\S]*교배 조합[\s\S]*아이템[\s\S]*스킬[\s\S]*지도/u);
  assert.match(korean, /aria-current="page"[^>]*data-ko="스트리머"/u);
  assert.match(japanese, /ホーム[\s\S]*配信者[\s\S]*パル図鑑[\s\S]*配合組み合わせ[\s\S]*アイテム[\s\S]*スキル[\s\S]*マップ/u);
  assert.match(skills, /aria-current="page"[^>]*data-ko="스킬"/u);
  assert.match(map, /aria-current="page"[^>]*data-ko="지도"/u);
});

test("스킬 카드와 상세는 설명·수치·관련 Pal과 영어 원문 fallback을 다국어로 표시한다", () => {
  const metadata = {
    gameVersion: "1.0.1.100619",
    sourceName: "pyPalworldAPI 0.2.0 fixed archive",
    sourceUrl: "https://github.com/cheahjs/palworld-save-tools",
    sourceRevision: "db70ea654aea70c4b1a4b0045bccfe58164cf01a",
    extractedAt: "2026-07-22T00:00:00.000Z",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    license: "operator_reference_use",
  };
  const skill: PalworldSkillSummary = {
    id: "active-fire-ball-fire-45-2",
    type: "active",
    nameEn: "Fire Ball",
    descriptionEn: "Creates a giant ball of flame and hurls it at an enemy.",
    element: "fire",
    power: 150,
    cooldownSeconds: 55,
    unlockLevel: 50,
    relatedPalCount: 1,
    localization: { sourceLanguage: "en", ko: "source_language_fallback", ja: "source_language_fallback" },
  };
  const detail: PalworldSkillDetail = {
    ...skill,
    relatedPals: [{ pal: { id: "jetragon", number: 111, nameKo: "제트래곤", nameJa: "ジェッドラン", nameEn: "Jetragon", elements: ["dragon"] }, unlockLevel: 50 }],
    metadata,
  };
  const korean = renderToStaticMarkup(<PalworldSkillCard locale="ko" onOpen={() => undefined} skill={skill} />);
  const japanese = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ja" onOpenPal={() => undefined} />);
  assert.match(korean, /Fire Ball/u);
  assert.match(korean, /Creates a giant ball of flame/u);
  assert.match(korean, /data-ko="영문 원문"/u);
  assert.match(korean, /위력 150/u);
  assert.match(korean, /관련 Pal 수[\s\S]*1/u);
  assert.match(japanese, /data-ja="英語原文"/u);
  assert.match(japanese, /ジェッドラン/u);
  assert.match(japanese, /解放レベル 50/u);
  assert.doesNotMatch(japanese, /palworld-source|pyPalworldAPI|db70ea654aea70c4b1a4b0045bccfe58164cf01a/u);
});

test("스킬 카드와 열린 상세는 locale 전환 시 번역문·검수 상태·패시브 효과를 즉시 바꾼다", () => {
  const metadata = {
    gameVersion: "1.0.1.100619",
    sourceName: "고정 번역 snapshot",
    sourceUrl: "https://example.com/palworld-translations",
    sourceRevision: "translation-r1",
    extractedAt: "2026-07-22T00:00:00.000Z",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    license: "operator_reference_use",
  };
  const detail: PalworldSkillDetail = {
    id: "passive-translation-test",
    type: "passive",
    nameKo: "용감한 마음",
    nameJa: "勇敢な心",
    nameEn: "Brave Heart",
    descriptionKo: "공격력이 증가한다.",
    descriptionJa: "攻撃力が増加する。",
    descriptionEn: "Increases attack.",
    passiveAbilityKo: "공격력 +10%",
    passiveAbilityJa: "攻撃力 +10%",
    passiveAbility: "Attack +10%",
    passiveTier: 1,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "machine_assisted", ja: "machine_assisted" },
      description: { ko: "machine_assisted", ja: "machine_assisted" },
      passiveAbility: { ko: "machine_assisted", ja: "machine_assisted" },
    },
    metadata,
  };
  const korean = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ko" onOpenPal={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ja" onOpenPal={() => undefined} />);
  assert.match(korean, /용감한 마음/u);
  assert.match(korean, /공격력이 증가한다/u);
  assert.match(korean, /공격력 \+10%/u);
  assert.match(korean, /data-ko="번역 검수 중"/u);
  assert.doesNotMatch(korean, /data-ko="영문 원문"/u);
  assert.match(japanese, /勇敢な心/u);
  assert.match(japanese, /攻撃力が増加する/u);
  assert.match(japanese, /data-ja="翻訳確認中"/u);
  assert.doesNotMatch(japanese, /data-ja="英語原文"/u);
});

test("스킬 카드는 표시하지 않는 passive ability의 번역 상태를 Badge에 합치지 않는다", () => {
  const skill: PalworldSkillSummary = {
    id: "passive-card-visible-fields",
    type: "passive",
    nameKo: "단단한 마음",
    nameJa: "堅い心",
    nameEn: "Steady Mind",
    descriptionKo: "방어력이 증가한다.",
    descriptionJa: "防御力が増加する。",
    descriptionEn: "Increases defense.",
    passiveAbility: "Defense +10%",
    passiveTier: 1,
    relatedPalCount: 0,
    translation: {
      name: { ko: "human_reviewed", ja: "human_reviewed" },
      description: { ko: "human_reviewed", ja: "human_reviewed" },
      passiveAbility: { ko: "source_language_fallback", ja: "source_language_fallback" },
    },
  };
  const korean = renderToStaticMarkup(<PalworldSkillCard locale="ko" onOpen={() => undefined} skill={skill} />);
  assert.match(korean, /단단한 마음/u);
  assert.doesNotMatch(korean, /영문 원문|Defense \+10%/u);
});

test("패시브 스킬 상세는 효과 원문이 없을 때 정보 없음 상태를 locale별로 표시한다", () => {
  const metadata = {
    gameVersion: "1.0.1.100619",
    sourceName: "고정 스킬 데이터",
    sourceUrl: "https://example.com/palworld-skills",
    sourceRevision: "translation-r1",
    extractedAt: "2026-07-22T00:00:00.000Z",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    license: "operator_reference_use",
  };
  const detail: PalworldSkillDetail = {
    id: "passive-without-ability-source",
    type: "passive",
    nameKo: "효과 없음",
    nameJa: "効果なし",
    nameEn: "No Ability Source",
    descriptionKo: "원본에 확인된 설명만 표시한다.",
    descriptionJa: "原文で確認できる説明のみ表示する。",
    descriptionEn: "Only verified source text is shown.",
    passiveTier: 1,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "human_reviewed", ja: "human_reviewed" },
      description: { ko: "human_reviewed", ja: "human_reviewed" },
      passiveAbility: { ko: "missing_source", ja: "missing_source" },
    },
    metadata,
  };
  const korean = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ko" onOpenPal={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ja" onOpenPal={() => undefined} />);
  assert.match(korean, /패시브 효과[\s\S]*원본 데이터에 정보가 없습니다/u);
  assert.match(japanese, /パッシブ効果[\s\S]*元データに情報がありません/u);
});

test("스킬 페이지는 URL query 필터를 선택 상태로 복원한다", () => {
  const html = renderToStaticMarkup(<PalworldSkillsPage locale="ja" onOpenPal={() => undefined} params={new URLSearchParams("type=passive&element=dark&sort=power&order=desc")} />);
  assert.match(html, /Palworld スキル/u);
  assert.match(html, /value="passive" selected=""/u);
  assert.match(html, /value="dark" selected=""/u);
  assert.match(html, /value="power" selected=""/u);
  assert.match(html, /value="desc" selected=""/u);
});

test("Palworld 헤더는 공유 Twitch 프로필과 Dashboard·로그아웃 메뉴를 렌더한다", () => {
  const html = renderToStaticMarkup(<PalworldHeader
    locale="ko"
    onLocale={() => undefined}
    page="home"
    twitchStatus={{
      connected: true,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: [],
      user: { id: "viewer-1", login: "pal_viewer", displayName: "Pal Viewer", profileImageUrl: "https://static-cdn.jtvnw.net/profile.png" },
      streamerRiotRequest: {
        id: "request-1",
        twitchUserId: "viewer-1",
        twitchLogin: "pal_viewer",
        twitchDisplayName: "Pal Viewer",
        riotGameName: "Viewer",
        riotTagLine: "JP1",
        status: "approved",
        requestedAt: "2026-07-22T00:00:00.000Z",
        updatedAt: "2026-07-22T00:00:00.000Z",
        dashboardEnabled: true,
      },
    }}
  />);
  assert.match(html, /class="public-twitch-login-chip connected"/u);
  assert.match(html, /src="https:\/\/static-cdn\.jtvnw\.net\/profile\.png"/u);
  assert.match(html, /Pal Viewer/u);
});

test("Palworld 홈은 기존 meta·shortcut·summary 없이 로그인 CTA가 있는 LIVE rail을 렌더한다", () => {
  const html = renderToStaticMarkup(<PalworldHome
    liveError={false}
    liveLoading={false}
    liveStreamers={[]}
    locale="ko"
    onLiveRetry={() => undefined}
    onOpenItem={() => undefined}
    onOpenPal={() => undefined}
    onSearch={() => undefined}
    onShowStreamers={() => undefined}
    onTwitchLogin={() => undefined}
    twitchConfigured
    twitchConnected={false}
  />);
  assert.doesNotMatch(html, /palworld-hero-meta|palworld-shortcuts|palworld-summary/u);
  assert.doesNotMatch(html, /등록된 Pal|등록된 아이템|게임 버전|데이터 갱신일/u);
  assert.match(html, /팔로우 중인 LIVE 스트리머/u);
  assert.match(html, /Twitch 로그인 후 팔로우 중인 스트리머의 방송 상태를 확인할 수 있습니다/u);
  assert.match(html, /data-testid="public-live-streamer-rail"/u);
});

test("Palworld 스트리머 페이지는 LIVE와 오프라인을 함께 표시하고 LoL 전용 정보를 노출하지 않는다", () => {
  const channels = [
    { twitchUserId: "offline", twitchLogin: "offline_user", twitchDisplayName: "Offline User", followedAt: "2026-07-22T00:00:00.000Z", isLive: false },
    { twitchUserId: "live", twitchLogin: "live_user", twitchDisplayName: "Live User", followedAt: "2026-07-22T00:00:00.000Z", isLive: true, gameName: "Palworld", title: "함께 모험해요", viewerCount: 321, channelUrl: "https://www.twitch.tv/live_user" },
  ];
  const html = renderToStaticMarkup(<PalworldStreamersPage
    channels={channels}
    error={false}
    loading={false}
    locale="ko"
    onLogin={() => undefined}
    onRefresh={() => undefined}
    status={{ connected: true, configured: true, requiredScopes: [], missingScopes: [], user: { id: "viewer", login: "viewer", displayName: "Viewer" } }}
    total={101}
  />);
  assert.match(html, /Live User[\s\S]*Offline User/u);
  assert.match(html, /data-ko="LIVE"/u);
  assert.match(html, /data-ko="오프라인"/u);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/u);
  assert.match(html, /팔로우 채널 101/u);
  assert.doesNotMatch(html, /Riot ID|랭크|전적 보기|구독 tier/u);
});

test("Palworld 스트리머 화면은 loading·error·empty 상태를 구분한다", () => {
  const status = { connected: true, configured: true, requiredScopes: [], missingScopes: [] };
  const loading = renderToStaticMarkup(<PalworldStreamersPage channels={[]} error={false} loading locale="ja" onLogin={() => undefined} onRefresh={() => undefined} status={status} />);
  const error = renderToStaticMarkup(<PalworldStreamersPage channels={[]} error loading={false} locale="ko" onLogin={() => undefined} onRefresh={() => undefined} status={{ ...status, connected: false, configured: false }} />);
  const empty = renderToStaticMarkup(<PalworldStreamersPage channels={[]} error={false} loading={false} locale="ja" onLogin={() => undefined} onRefresh={() => undefined} status={status} />);
  assert.match(loading, /aria-busy="true"/u);
  assert.match(error, /role="alert"/u);
  assert.match(empty, /フォロー中のチャンネルがありません/u);
});

test("Palworld 스트리머 화면은 미설정·미로그인·오프라인 전용 상태를 구분한다", () => {
  const baseStatus = { connected: false, configured: false, requiredScopes: [], missingScopes: [] };
  const notConfigured = renderToStaticMarkup(<PalworldStreamersPage channels={[]} error={false} loading={false} locale="ko" onLogin={() => undefined} onRefresh={() => undefined} status={baseStatus} />);
  const loggedOut = renderToStaticMarkup(<PalworldStreamersPage channels={[]} error={false} loading={false} locale="ja" onLogin={() => undefined} onRefresh={() => undefined} status={{ ...baseStatus, configured: true }} />);
  const offlineOnly = renderToStaticMarkup(<PalworldStreamersPage
    channels={[{ twitchUserId: "offline", twitchLogin: "offline_user", twitchDisplayName: "Offline User", followedAt: "2026-07-22T00:00:00.000Z", isLive: false }]}
    error={false}
    loading={false}
    locale="ko"
    onLogin={() => undefined}
    onRefresh={() => undefined}
    status={{ ...baseStatus, connected: true, configured: true }}
  />);
  assert.match(notConfigured, /Twitch 기능이 설정되지 않았습니다/u);
  assert.match(loggedOut, /Twitch ログインが必要です/u);
  assert.match(offlineOnly, /현재 LIVE 방송이 없습니다/u);
  assert.match(offlineOnly, /Offline User/u);
});

test("Pal 도감 상세 필터는 서버 facet만 아이콘·텍스트 단일 선택으로 렌더한다", () => {
  const facets: PalworldPalListFacets = {
    elements: [{ value: "fire", count: 12 }, { value: "ground", count: 8 }],
    workSuitabilities: [{ value: "mining", count: 9 }, { value: "handiwork", count: 7 }],
    rarities: [{ value: 2, count: 6 }, { value: 10, count: 2 }],
    variants: [{ value: "normal", count: 17 }, { value: "variant", count: 3 }],
  };
  const params = new URLSearchParams("element=fire&work=mining&rarity=10&variant=variant&sort=name&order=desc");
  const html = renderToStaticMarkup(
    <PalworldPalsDesktopFilterPanel
      clearDisabled={false}
      facets={facets}
      locale="ja"
      onClear={() => undefined}
      onUpdate={() => undefined}
      params={params}
    />,
  );
  assert.equal((html.match(/<fieldset/gu) ?? []).length, 3);
  assert.match(html, /<legend>属性<\/legend>/u);
  assert.match(html, /<legend>作業適性<\/legend>/u);
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*炎/u);
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*採掘/u);
  assert.match(html, /palworld-pal-filter-element-icon/u);
  assert.match(html, /palworld-pal-filter-work-icon/u);
  assert.doesNotMatch(html, /palworld-pal-filter-option[^>]*>[\s\S]*palworld-element-badge/u);
  assert.match(html, /value="10" selected=""/u);
  assert.doesNotMatch(html, /value="20"/u);
  assert.doesNotMatch(html, /特殊種/u);
});

test("Pal 도감 적용 chip과 결과 toolbar는 제거 label·0개 결과·정렬을 분리해 표시한다", () => {
  const params = new URLSearchParams("q=아누비스&element=ground&work=mining&rarity=10&variant=normal&sort=name&order=desc");
  const chips = renderToStaticMarkup(
    <PalworldPalsAppliedFilters
      locale="ko"
      onRemove={() => undefined}
      params={params}
    />,
  );
  const toolbar = renderToStaticMarkup(
    <PalworldPalsResultToolbar
      loadedCount={0}
      loading={false}
      locale="ko"
      onUpdate={() => undefined}
      pagination={{ page: 1, pageSize: 24, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }}
      params={params}
    />,
  );
  assert.match(chips, /검색: 아누비스/u);
  assert.match(chips, /땅 속성 필터 제거/u);
  assert.match(chips, /채굴 작업 적성 필터 제거/u);
  assert.doesNotMatch(chips, /정렬|내림차순/u);
  assert.match(toolbar, /조건에 맞는 Pal 0종 · 0종 표시/u);
  assert.match(toolbar, /value="name" selected=""/u);
  assert.match(toolbar, /내림차순/u);
});

test("아이템 필터는 실제 데이터의 희귀도 0을 선택 상태로 복원한다", () => {
  const html = renderToStaticMarkup(<PalworldItemsPage locale="ko" params={new URLSearchParams("rarity=0&sort=rarity")} onOpenItem={() => undefined} />);
  assert.match(html, /value="0" selected=""/u);
  assert.match(html, /value="20"/u);
  assert.match(html, /아이템/u);
});

test("현지화가 없는 아이템 카드는 영문 원문 Badge와 영어 이름·설명을 표시한다", () => {
  const html = renderToStaticMarkup(<ItemCard
    item={{
      id: "english-only-item",
      nameEn: "English Only Item",
      category: "material",
      rarity: 0,
      descriptionEn: "Source English description.",
    }}
    locale="ko"
    onOpen={() => undefined}
  />);
  assert.match(html, /English Only Item/u);
  assert.match(html, /Source English description/u);
  assert.match(html, /data-ko="영문 원문"/u);
});

test("번역된 아이템 카드는 locale별 이름·설명과 검수 중 Badge를 표시하고 영어 Badge를 숨긴다", () => {
  const item = {
    id: "translated-item",
    nameKo: "번역된 부품",
    nameJa: "翻訳された部品",
    nameEn: "Translated Part",
    category: "material" as const,
    rarity: 1,
    descriptionKo: "제작에 사용하는 부품이다.",
    descriptionJa: "クラフトに使用する部品です。",
    descriptionEn: "A part used for crafting.",
    translation: {
      name: { ko: "machine_assisted" as const, ja: "machine_assisted" as const },
      description: { ko: "machine_assisted" as const, ja: "machine_assisted" as const },
    },
  };
  const korean = renderToStaticMarkup(<ItemCard item={item} locale="ko" onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<ItemCard item={item} locale="ja" onOpen={() => undefined} />);
  assert.match(korean, /번역된 부품/u);
  assert.match(korean, /제작에 사용하는 부품이다/u);
  assert.match(korean, /data-ko="번역 검수 중"/u);
  assert.doesNotMatch(korean, /data-ko="영문 원문"/u);
  assert.match(japanese, /翻訳された部品/u);
  assert.match(japanese, /クラフトに使用する部品です/u);
  assert.match(japanese, /data-ja="翻訳確認中"/u);
});

test("교배 Pal 자동완성의 선택 상태도 공통 번역 이름과 locale별 검수 Badge를 사용한다", () => {
  const selected = {
    id: "translated-pal",
    number: 999,
    nameKo: "번역된 Pal",
    nameJa: "翻訳されたパル",
    nameEn: "Translated Pal",
    elements: ["neutral" as const],
    translation: {
      name: { ko: "machine_assisted" as const, ja: "machine_assisted" as const },
    },
  };
  const korean = renderToStaticMarkup(<PalworldPalPicker label="부모 Pal" locale="ko" onChange={() => undefined} selected={selected} testId="translated-picker-ko" />);
  const japanese = renderToStaticMarkup(<PalworldPalPicker label="親パル" locale="ja" onChange={() => undefined} selected={selected} testId="translated-picker-ja" />);
  assert.match(korean, /번역된 Pal/u);
  assert.match(korean, /data-ko="번역 검수 중"/u);
  assert.doesNotMatch(korean, /Translated Pal/u);
  assert.match(japanese, /翻訳されたパル/u);
  assert.match(japanese, /data-ja="翻訳確認中"/u);
});

test("교배 UI는 결과 Pal을 강조하고 역검색 카드에서 목표 Pal 반복을 제거한다", () => {
  const pair: PalworldBreedingPair = {
    id: "penking-bushi-sibelyx",
    parentA: {
      id: "penking",
      number: 11,
      nameKo: "펭킹",
      nameJa: "キャプペン",
      nameEn: "Penking",
      elements: ["water", "ice"],
    },
    parentB: {
      id: "bushi",
      number: 72,
      nameKo: "불무사",
      nameJa: "ツジギリ",
      nameEn: "Bushi",
      elements: ["fire"],
    },
    child: {
      id: "sibelyx",
      number: 79,
      nameKo: "실키누",
      nameJa: "シルキーヌ",
      nameEn: "Sibelyx",
      elements: ["ice"],
    },
    isSpecial: true,
    genderCondition: { parentA: "male", parentB: "female" },
  };
  const tabs = renderToStaticMarkup(<BreedingModeTabs locale="ja" mode="child" onMode={() => undefined} />);
  const direct = renderToStaticMarkup(<DirectBreedingResult locale="ko" onCopy={() => undefined} onOpenPal={() => undefined} onViewParents={() => undefined} pair={pair} />);
  const reverse = renderToStaticMarkup(<ReverseBreedingPairCard locale="ko" onOpenPal={() => undefined} onUsePair={() => undefined} pair={pair} />);
  const target = renderToStaticMarkup(<ReverseBreedingTargetSummary
    child={pair.child}
    loadedCount={12}
    locale="ko"
    onOpenPal={() => undefined}
    pagination={{ page: 2, pageSize: 12, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true }}
  />);
  const alternative = renderToStaticMarkup(<BreedingGenderAlternativeCard locale="ja" onApply={() => undefined} onOpenPal={() => undefined} pair={pair} />);
  const status = renderToStaticMarkup(<BreedingRequestStatus message="결과 1개" />);

  assert.equal((tabs.match(/role="tab"/gu) ?? []).length, 2);
  assert.match(tabs, /親から結果を探す[\s\S]*結果パルの親を探す/u);
  assert.match(tabs, /aria-selected="true"[^>]*>結果パルの親を探す/u);
  assert.match(direct, /data-testid="breeding-direct-card"/u);
  assert.match(direct, /class="palworld-direct-result-hero"/u);
  assert.match(direct, /결과 Pal 상세 보기/u);
  assert.match(direct, /이 Pal의 부모 조합 보기/u);
  assert.match(direct, /링크 복사/u);
  assert.match(reverse, /data-testid="breeding-reverse-pair"/u);
  assert.match(reverse, /펭킹/u);
  assert.match(reverse, /불무사/u);
  assert.doesNotMatch(reverse, /실키누/u);
  assert.match(reverse, /계산기에 넣기/u);
  assert.match(target, /data-testid="breeding-target-summary"/u);
  assert.match(target, /실키누/u);
  assert.match(target, /aria-label="목표 Pal 상세 보기: 실키누"/u);
  assert.match(target, /총 25개 조합/u);
  assert.match(target, /12\/25개 조합 표시/u);
  assert.match(alternative, /この条件を適用/u);
  assert.match(alternative, /aria-label="この条件を適用: シルキーヌ, オス \/ メス"/u);
  assert.match(status, /role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/u);
});

test("자동 로드 제어는 이전·다음 버튼 없이 스크롤 안내와 키보드 fallback을 제공한다", () => {
  const korean = renderToStaticMarkup(<PalworldAutoLoadControl
    error={null}
    hasMore
    loadedCount={24}
    loading={false}
    locale="ko"
    onLoadMore={() => undefined}
    onRetry={() => undefined}
    total={48}
  />);
  const japaneseError = renderToStaticMarkup(<PalworldAutoLoadControl
    error={new Error("네트워크 오류")}
    hasMore
    loadedCount={24}
    loading={false}
    locale="ja"
    onLoadMore={() => undefined}
    onRetry={() => undefined}
    total={48}
  />);

  assert.match(korean, /결과 24\/48개 표시/u);
  assert.match(korean, /아래로 스크롤하면 다음 결과를 자동으로 불러옵니다/u);
  assert.match(korean, />결과 더 보기</u);
  assert.doesNotMatch(korean, />이전<|>다음</u);
  assert.match(japaneseError, /role="alert"/u);
  assert.match(japaneseError, /読み込み済みの結果はそのまま表示/u);
  assert.match(japaneseError, /次の結果を再読み込み/u);
});

test("원문 설명이 없는 아이템 카드는 정보를 추정하지 않고 locale별 원본 없음 문구를 표시한다", () => {
  const item = {
    id: "missing-description-item",
    nameKo: "설명 없는 아이템",
    nameJa: "説明のないアイテム",
    nameEn: "Missing Description Item",
    category: "material" as const,
    rarity: 0,
    translation: {
      name: { ko: "human_reviewed" as const, ja: "human_reviewed" as const },
      description: { ko: "missing_source" as const, ja: "missing_source" as const },
    },
  };
  const korean = renderToStaticMarkup(<ItemCard item={item} locale="ko" onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<ItemCard item={item} locale="ja" onOpen={() => undefined} />);
  assert.match(korean, /원본 데이터에 정보가 없습니다/u);
  assert.match(japanese, /元データに情報がありません/u);
  assert.doesNotMatch(korean, /영문 원문|번역 검수 중/u);
});

test("이미지 없는 Pal은 카드 높이를 유지하는 한국어·일본어 대체 표시를 렌더한다", () => {
  const korean = renderToStaticMarkup(<PalworldMedia alt="도로롱" locale="ko" kind="pal" />);
  const japanese = renderToStaticMarkup(<PalworldMedia alt="モコロン" locale="ja" kind="pal" />);
  assert.match(korean, /role="img"/);
  assert.match(korean, /aria-label="도로롱 · 이미지 준비 중"/);
  assert.match(korean, /data-ko="이미지 준비 중"/);
  assert.match(japanese, /aria-label="モコロン · 画像準備中"/);
});

test("Pal 카드는 왼쪽 이미지·오른쪽 정보·하단 작업 적성 구조로 표시한다", () => {
  const imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const pal = {
    id: "lamball",
    number: 1,
    nameKo: "도로롱",
    nameJa: "モコロン",
    nameEn: "Lamball",
    imageUrl,
    elements: ["neutral" as const],
    rarity: 1,
    variantType: "normal" as const,
    workSuitabilities: [
      { type: "handiwork" as const, level: 1 },
      { type: "transporting" as const, level: 2 },
      { type: "farming" as const, level: 1 },
    ]
  };
  const korean = renderToStaticMarkup(<PalCard locale="ko" pal={pal} onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalCard locale="ja" pal={pal} onOpen={() => undefined} />);
  assert.match(korean, /class="yoro-card palworld-entity-card palworld-pal-card"/u);
  assert.match(korean, /class="palworld-pal-card-main"[\s\S]*class="palworld-pal-card-media"[\s\S]*class="palworld-pal-card-image-frame"[\s\S]*class="yoro-card__content palworld-pal-card-content"/u);
  assert.match(korean, new RegExp(`src="${imageUrl.replaceAll("/", "\\/")}" alt="도로롱"`));
  assert.match(korean, /class="palworld-card-work-list"[\s\S]*role="list"/u);
  assert.ok(korean.indexOf("palworld-pal-card-main") < korean.indexOf("palworld-card-work-list"));
  assert.equal((korean.match(/role="listitem"/gu) ?? []).length, 3);
  assert.equal((korean.match(/palworld-work-suitability-badge is-compact/gu) ?? []).length, 3);
  assert.equal((korean.match(/palworld-work-suitability-label yoro-u-sr-only/gu) ?? []).length, 3);
  assert.match(korean, /data-work-type="handiwork"[\s\S]*title="수작업: Lv\.1"[\s\S]*Lv\.1/u);
  assert.match(korean, /data-work-type="transporting"[\s\S]*Lv\.2/u);
  assert.match(korean, /data-work-type="farming"[\s\S]*Lv\.1/u);
  assert.match(japanese, /alt="モコロン"/);
  assert.match(japanese, /title="手作業: Lv\.1"/u);
});

test("첫 화면 Pal 이미지만 eager·high priority로 요청하고 고정 크기로 layout shift를 방지한다", () => {
  const imageUrl = `/images/palworld/1.0.1/pals/${"c".repeat(64)}.webp`;
  const priority = renderToStaticMarkup(<PalworldMedia alt="도로롱" imageUrl={imageUrl} locale="ko" kind="pal" priority />);
  const deferred = renderToStaticMarkup(<PalworldMedia alt="도로롱" imageUrl={imageUrl} locale="ko" kind="pal" />);
  assert.match(priority, /fetchpriority="high"/u);
  assert.match(priority, /loading="eager"/u);
  assert.match(priority, /width="128"/u);
  assert.match(priority, /height="128"/u);
  assert.match(priority, /class="palworld-media-image is-low-resolution"/u);
  assert.match(deferred, /fetchpriority="auto"/u);
  assert.match(deferred, /loading="lazy"/u);
});

test("Palworld 9개 속성 Badge는 검증된 content-hash 이미지와 접근 가능한 텍스트를 함께 표시한다", () => {
  assert.equal(generatedStaticAssets.schemaVersion, 1);
  assert.equal(generatedStaticAssets.elements.length, 9);
  for (const entry of generatedStaticAssets.elements) {
    assert.deepEqual(PALWORLD_ELEMENT_IMAGES[entry.id], { imageUrl: entry.imageUrl, width: entry.width, height: entry.height });
  }
  assert.equal(Object.keys(PALWORLD_ELEMENT_IMAGES).length, 9);
  for (const [element, asset] of Object.entries(PALWORLD_ELEMENT_IMAGES)) {
    assert.equal(isLocalPalworldElementImageUrl(asset.imageUrl), true, `${element} 이미지 경로`);
    assert.equal(asset.width, 48);
    assert.equal(asset.height, 48);
    const outputFileName = asset.imageUrl.split("/").at(-1)!;
    const outputBytes = readFileSync(new URL(`../public${asset.imageUrl}`, import.meta.url));
    assert.equal(createHash("sha256").update(outputBytes).digest("hex"), outputFileName.replace(".webp", ""));
    assert.equal(outputBytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(outputBytes.subarray(8, 12).toString("ascii"), "WEBP");
  }
  assert.equal(isLocalPalworldElementImageUrl("https://example.com/fire.webp"), false);
  const korean = renderToStaticMarkup(<PalworldElementBadge element="fire" locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldElementBadge element="water" locale="ja" />);
  assert.match(korean, /<img[^>]*class="palworld-element-icon"/u);
  assert.match(korean, /<img[^>]*alt=""[^>]*aria-hidden="true"/u);
  assert.match(korean, /불/u);
  assert.match(japanese, /水/u);
});

test("Palworld 2행 메뉴는 세로 overflow 없이 모바일 가로 스크롤 단서를 제공한다", () => {
  const css = readFileSync(new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url), "utf8");
  const secondaryRule = css.match(/\.palworld-secondary-row\s*\{[\s\S]*?\}/u)?.[0] ?? "";
  assert.match(secondaryRule, /overflow-y:\s*hidden/u);
  assert.match(secondaryRule, /scrollbar-width:\s*none/u);
  assert.match(css, /\.palworld-secondary-row::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/u);
  assert.match(css, /\.palworld-secondary-row\.can-scroll-end\s*\{[\s\S]*?mask-image:\s*linear-gradient/u);
  assert.match(css, /\.palworld-secondary-row\.can-scroll-start\.can-scroll-end\s*\{[\s\S]*?mask-image:\s*linear-gradient/u);
  assert.match(css, /\.palworld-shell\.public-dashboard-shell[\s\S]*?button\.active::after\s*\{[\s\S]*?bottom:\s*var\(--yoro-space-1\)\s*!important/u);
});

test("긴 한국어·일본어 번역문과 상세 링크는 페이지 너비를 확장하지 않는다", () => {
  const css = readFileSync(new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url), "utf8");
  const localizedCopyRule = css.match(/\.palworld-localized-copy\s*\{[\s\S]*?\}/u)?.[0] ?? "";
  const linkButtonRule = css.match(/\.palworld-link-list button\s*\{[\s\S]*?\}/u)?.[0] ?? "";
  const itemReferenceButtonRule = css.match(/\.palworld-item-reference-button\s*\{[\s\S]*?\}/u)?.[0] ?? "";
  assert.match(localizedCopyRule, /max-inline-size:\s*100%/u);
  assert.match(localizedCopyRule, /overflow-wrap:\s*anywhere/u);
  assert.match(linkButtonRule, /max-inline-size:\s*100%/u);
  assert.match(linkButtonRule, /overflow-wrap:\s*anywhere/u);
  assert.match(itemReferenceButtonRule, /max-inline-size:\s*100%/u);
  assert.match(itemReferenceButtonRule, /overflow-wrap:\s*anywhere/u);
});

test("Pal과 아이템 이미지는 종류별 고정 release content-hash WebP 경로만 요청한다", () => {
  const imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const itemImageUrl = `/images/palworld/1.0.1/items/${"b".repeat(64)}.webp`;
  const futureReleaseUrl = `/images/palworld/2.3.4/items/${"c".repeat(64)}.webp`;
  assert.equal(isLocalPalworldImageUrl(imageUrl), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl), true);
  assert.equal(isLocalPalworldImageUrl(futureReleaseUrl, "item"), true);
  assert.equal(isLocalPalworldImageUrl(imageUrl, "pal"), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl, "item"), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl, "pal"), false);
  assert.equal(isLocalPalworldImageUrl(imageUrl, "item"), false);
  assert.equal(isLocalPalworldImageUrl("https://example.com/pal.webp"), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/01.0.1/pals/${"a".repeat(64)}.webp`), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1-beta/pals/${"a".repeat(64)}.webp`), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1%2fpals/${"a".repeat(64)}.webp`), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1/pals/${"a".repeat(64)}.png`), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1/pals/${"A".repeat(64)}.webp`), false);

  const external = renderToStaticMarkup(<PalworldMedia alt="외부 이미지" imageUrl="https://example.com/pal.webp" locale="ko" kind="pal" />);
  assert.doesNotMatch(external, /<img/u);
  assert.match(external, /aria-label="외부 이미지 · 이미지 준비 중"/);
});

test("월드 지도는 generated manifest의 content-hash WebP와 한국어·일본어 접근성 문구를 사용한다", () => {
  const mapUrl = PALWORLD_WORLD_MAP_IMAGE_URL;
  assert.ok(mapUrl);
  assert.equal(isLocalPalworldMapUrl(mapUrl), true);
  assert.equal(isLocalPalworldMapUrl(`/images/palworld/2.3.4/maps/${"a".repeat(64)}.webp`), true);
  assert.equal(isLocalPalworldMapUrl("https://example.com/map.webp"), false);
  assert.equal(isLocalPalworldMapUrl(`${mapUrl}?download=1`), false);
  assert.equal(isLocalPalworldMapUrl(mapUrl.replace(".webp", ".png")), false);

  const outputFileName = mapUrl.split("/").at(-1)!;
  const outputBytes = readFileSync(new URL(`../public${mapUrl}`, import.meta.url));
  assert.equal(createHash("sha256").update(outputBytes).digest("hex"), outputFileName.replace(".webp", ""));
  assert.equal(outputBytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(outputBytes.subarray(8, 12).toString("ascii"), "WEBP");

  const korean = renderToStaticMarkup(<PalworldMapPage locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldMapPage locale="ja" />);
  assert.match(korean, /Palworld 월드 지도/u);
  assert.match(
    korean,
    /alt="빠른 이동 지점, 필드 보스와 선택한 Pal의 일반 야생 스폰 위치가 표시된 Palworld 월드 지도"/u
  );
  assert.doesNotMatch(korean, /pyPalworldAPI|>1\.0\.1</u);
  assert.match(korean, /aria-label="지도 확대"/u);
  assert.match(korean, /aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight \+ - Home"/u);
  assert.match(korean, /data-testid="palworld-map-stage"/u);
  assert.match(korean, /휠·핀치/u);
  assert.match(japanese, /Palworld ワールドマップ/u);
  assert.match(
    japanese,
    /ファストトラベル地点、フィールドボスと選択したパルの通常の野生スポーン位置が表示されたPalworldワールドマップ/u
  );
  assert.match(japanese, /ホイール・ピンチ/u);
});

test("월드 지도 이동과 기준점 확대는 지도 경계를 벗어나지 않는다", () => {
  assert.deepEqual(
    clampPalworldMapView({ x: 120, y: -1_000, zoom: 2 }, 1_000, 800),
    { x: 0, y: -800, zoom: 2 },
  );
  assert.deepEqual(
    clampPalworldMapView({ x: -400, y: -300, zoom: 1 }, 1_000, 800),
    { x: 0, y: 0, zoom: 1 },
  );

  const zoomed = zoomPalworldMapViewAt(
    { x: 0, y: 0, zoom: 1 },
    2,
    { x: 500, y: 400 },
    1_000,
    800,
  );
  assert.deepEqual(zoomed, { x: -500, y: -400, zoom: 2 });
  assert.equal((500 - zoomed.x) / zoomed.zoom, 500);
  assert.equal((400 - zoomed.y) / zoomed.zoom, 400);

  assert.deepEqual(
    zoomPalworldMapViewAt(zoomed, 1, { x: 500, y: 400 }, 1_000, 800),
    { x: 0, y: 0, zoom: 1 },
  );

  assert.deepEqual(
    focusPalworldMapViewAt({ normalizedX: 0.25, normalizedY: 0.75 }, 1_000, 800),
    { x: 0, y: -800, zoom: 2 },
  );
  assert.deepEqual(
    focusPalworldMapViewAt({ normalizedX: 0.5, normalizedY: 0.5 }, 1_000, 800),
    { x: -500, y: -400, zoom: 2 },
  );
});

test("월드 지도 marker layer는 지도 변환 평면 안에서 별도 상호작용 요소를 받을 수 있다", () => {
  const markup = renderToStaticMarkup(
    <PalworldMapPage
      locale="ko"
      markerLayer={({ zoom }) => (
        <button data-map-interactive="true" type="button">
          보스 · {zoom * 100}%
        </button>
      )}
    />,
  );
  assert.match(markup, /class="palworld-map-marker-layer"/u);
  assert.match(markup, /data-map-interactive="true"/u);
  assert.match(markup, /보스 · 100%/u);
});

test("월드 지도 보스 marker는 정규화 좌표와 현지화 이름·레벨로 상세 열기 동작을 제공한다", () => {
  const marker: PalworldMapMarker = {
    id: "main-anubis-001",
    sourceRowId: "Boss_Anubis",
    sourceInternalId: "Anubis",
    pal: {
      id: "anubis",
      number: 100,
      nameKo: "아누비스",
      nameJa: "アヌビス",
      nameEn: "Anubis",
      elements: ["ground"],
      imageUrl: `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`,
      imageWidth: 128,
      imageHeight: 128,
    },
    level: 47,
    normalizedX: 0.25,
    normalizedY: 0.75,
  };
  const korean = renderToStaticMarkup(
    <PalworldBossMarkerLayer focusedPalId="anubis" locale="ko" markers={[marker]} onOpenPal={() => undefined} zoom={2} />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldBossMarkerLayer locale="ja" markers={[marker]} onOpenPal={() => undefined} zoom={2} />,
  );
  const unmatched = renderToStaticMarkup(
    <PalworldBossMarkerLayer focusedPalId="Anubis" locale="ko" markers={[marker]} onOpenPal={() => undefined} zoom={2} />,
  );

  assert.match(korean, /data-map-interactive="true"/u);
  assert.match(korean, /aria-current="location"/u);
  assert.match(korean, /data-focused="true"/u);
  assert.match(korean, /aria-label="필드 보스: 아누비스, Lv\.47"/u);
  assert.match(korean, /left:25%/u);
  assert.match(korean, /top:75%/u);
  assert.match(korean, /--palworld-map-marker-inverse-scale:0\.5/u);
  assert.match(japanese, /aria-label="フィールドボス: アヌビス, Lv\.47"/u);
  assert.doesNotMatch(japanese, /フィールドボス: Anubis/u);
  assert.doesNotMatch(unmatched, /aria-current|data-focused/u);

  const pageSource = readFileSync(
    new URL("../src/pages/PublicPalworldPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /<PalworldMapPage focusPalId=\{focusPalId\} locale=\{locale\} onOpenPal=\{openPalHere\}/u);
  assert.match(pageSource, /onOpenMap=\{openPalMap\}/u);
});

test("월드 지도 일반 스폰 layer는 cluster 좌표를 확대 배율에 맞춰 표시한다", () => {
  const markup = renderToStaticMarkup(
    <PalworldSpawnAreaLayer
      points={[{
        id: "anubis-08-12",
        cellX: 8,
        cellY: 12,
        normalizedX: 0.265625,
        normalizedY: 0.390625,
        placementCount: 3,
        minimumLevel: 20,
        maximumLevel: 24,
        daytime: true,
        nighttime: true,
      }]}
      zoom={2}
    />,
  );
  assert.match(markup, /class="palworld-map-spawn-layer"/u);
  assert.match(markup, /cx="0\.265625"/u);
  assert.match(markup, /cy="0\.390625"/u);
  assert.match(markup, /opacity="0\.64"/u);
  assert.match(markup, /r="0\.004"/u);
});

test("Pal 상세 위치는 일반 스폰과 필드 보스를 분리 조회하고 한국어·일본어 i18n을 연결한다", () => {
  const anubisMarker: PalworldMapMarker = {
    id: "main-anubis-001",
    sourceRowId: "Boss_Anubis",
    sourceInternalId: "Anubis",
    pal: {
      id: "anubis",
      number: 100,
      nameKo: "아누비스",
      nameJa: "アヌビス",
      nameEn: "Anubis",
      elements: ["ground"],
    },
    level: 47,
    normalizedX: 0.25,
    normalizedY: 0.75,
  };
  const penkingMarker: PalworldMapMarker = {
    ...anubisMarker,
    id: "main-penking-001",
    sourceRowId: "Boss_Penking",
    sourceInternalId: "Penking",
    pal: {
      id: "penking",
      number: 11,
      nameKo: "펭킹",
      nameJa: "キャプペン",
      nameEn: "Penking",
      elements: ["water", "ice"],
    },
  };
  const secondAnubisMarker: PalworldMapMarker = {
    ...anubisMarker,
    id: "main-anubis-002",
    sourceRowId: "Boss_Anubis_02",
    normalizedX: 0.6,
    normalizedY: 0.4,
  };
  const markers = [anubisMarker, penkingMarker, secondAnubisMarker];

  assert.deepEqual(
    filterPalworldBossMarkers(markers, "anubis").map((marker) => marker.id),
    ["main-anubis-001", "main-anubis-002"],
  );
  assert.deepEqual(filterPalworldBossMarkers(markers, "Anubis"), []);
  assert.deepEqual(filterPalworldBossMarkers(markers, "anubi"), []);

  const korean = renderToStaticMarkup(
    <PalworldPalLocationMap
      locale="ko"
      onOpenFullMap={() => undefined}
      palId="anubis"
    />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldPalLocationMap
      locale="ja"
      onOpenFullMap={() => undefined}
      palId="anubis"
    />,
  );
  assert.match(korean, /data-testid="pal-detail-location"/u);
  assert.match(korean, />출현 위치</u);
  assert.match(korean, /aria-label="이 Pal의 출현 위치를 불러오는 중입니다."/u);
  assert.match(japanese, />出現位置</u);
  assert.match(japanese, /aria-label="このパルの出現位置を読み込んでいます。"/u);
  assert.equal(palworldI18n.ko.palLocationEmpty, "현재 지도 데이터에서 확인된 이 Pal의 출현 위치가 없습니다.");
  assert.equal(palworldI18n.ja.palLocationEmpty, "現在のマップデータでは、このパルの出現位置を確認できません。");

  const componentSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldPalLocationMap.tsx", import.meta.url),
    "utf8",
  );
  const detailSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldDetailModals.tsx", import.meta.url),
    "utf8",
  );
  assert.match(componentSource, /getPalworldMapMarkers\("main", controller\.signal\)/u);
  assert.match(componentSource, /getPalworldPalSpawns\(palId, "main", controller\.signal\)/u);
  assert.match(componentSource, /filterPalworldBossMarkers\(response\.markers, palId\)/u);
  assert.match(componentSource, /setBossRevision/u);
  assert.match(componentSource, /setSpawnRevision/u);
  assert.match(componentSource, /palWildSpawnLevelRange/u);
  assert.match(detailSource, /<PalworldPalLocationMap[\s\S]*onOpenFullMap=\{onOpenMap\}[\s\S]*palId=\{detail\.id\}/u);
});

test("페이지 기술 키커와 Pal·도감 번호·레벨 표기는 한국어·일본어 i18n을 통해 제공한다", () => {
  assert.equal(palworldI18n.ko.palsKicker, "PAL 도감");
  assert.equal(palworldI18n.ja.palsKicker, "パル図鑑");
  assert.equal(palworldI18n.ko.breedingKicker, "교배");
  assert.equal(palworldI18n.ja.breedingKicker, "配合");
  assert.equal(palworldI18n.ko.palEntityLabel, "Pal");
  assert.equal(palworldI18n.ja.palEntityLabel, "パル");

  const sources = [
    ["PalworldHome.tsx", "homeKicker"],
    ["PalworldStreamersPage.tsx", "streamersKicker"],
    ["PalworldPalsPage.tsx", "palsKicker"],
    ["PalworldBreedingPage.tsx", "breedingKicker"],
    ["PalworldItemsPage.tsx", "itemsKicker"],
    ["PalworldSkillsPage.tsx", "skillsKicker"],
    ["PalworldMapPage.tsx", "mapKicker"],
  ] as const;
  for (const [fileName, key] of sources) {
    const source = readFileSync(new URL(`../src/features/public-palworld/components/${fileName}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`text\\.${key}`, "u"), fileName);
  }

  const searchForm = readFileSync(new URL("../src/features/public-palworld/components/PalworldSearchForm.tsx", import.meta.url), "utf8");
  const cardAndDetail = [
    readFileSync(new URL("../src/features/public-palworld/components/PalworldCards.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/features/public-palworld/components/PalworldDetailModals.tsx", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(searchForm, /text\.palEntityLabel/u);
  assert.doesNotMatch(searchForm, /· Pal/u);
  assert.match(cardAndDetail, /text\.levelPrefix/u);
  assert.doesNotMatch(cardAndDetail, /Lv\.\$\{/u);
});

test("sitemap은 query 없는 Palworld 공개 base 경로를 모두 포함한다", () => {
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  for (const path of [
    "/palworld",
    "/palworld/pals",
    "/palworld/items",
    "/palworld/skills",
    "/palworld/breeding",
    "/palworld/map",
    "/palworld/streamers",
  ]) {
    assert.match(sitemap, new RegExp(`<loc>https://yoro\\.gg${path}</loc>`, "u"), path);
  }
  assert.doesNotMatch(sitemap, /<loc>[^<]*\?/u);
});

test("공통 footer는 정확한 한국어·일본어 비공식 출처 공지와 안전한 공식 링크를 렌더한다", () => {
  const korean = renderToStaticMarkup(<PalworldSourceFooter locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldSourceFooter locale="ja" />);
  assert.match(korean, /비공식 팰월드 데이터베이스 · 데이터\/이미지 출처 <a[^>]+>Palworld<\/a> · <a[^>]+>Pocketpair<\/a>/u);
  assert.match(korean, /data-ko="비공식 팰월드 데이터베이스 · 데이터\/이미지 출처 Palworld · Pocketpair"/u);
  assert.match(japanese, /非公式パルワールドデータベース・データ／画像出典 <a[^>]+>Palworld<\/a>・<a[^>]+>Pocketpair<\/a>/u);
  assert.match(japanese, /data-ja="非公式パルワールドデータベース・データ／画像出典 Palworld・Pocketpair"/u);
  assert.equal((korean.match(/target="_blank"/gu) ?? []).length, 2);
  assert.equal((korean.match(/rel="noopener noreferrer"/gu) ?? []).length, 2);
  assert.match(korean, /aria-label="Palworld · 외부 사이트, 새 창에서 열기"/u);
  assert.match(japanese, /aria-label="Pocketpair · 外部サイト、新しいタブで開く"/u);
});

test("이미지 URL이 없는 Pal 287종은 모두 접근 가능한 대체 이미지를 렌더한다", () => {
  const html = renderToStaticMarkup(<>{Array.from({ length: 287 }, (_, index) => (
    <PalworldMedia alt={`Pal ${index + 1}`} locale="ko" kind="pal" key={index} />
  ))}</>);
  assert.equal((html.match(/role="img"/g) ?? []).length, 287);
  assert.equal((html.match(/data-ko="이미지 준비 중"/g) ?? []).length, 287);
  assert.doesNotMatch(html, /<img/u);
});

test("Pal 드롭과 제작 재료는 이미지·현지화 이름·수량을 공유 아이템 참조 버튼으로 표시한다", () => {
  const item: PalworldItemReference = {
    id: "pal-sphere",
    nameKo: "팰 스피어",
    nameJa: "パルスフィア",
    nameEn: "Pal Sphere",
    imageUrl: `/images/palworld/1.0.1/items/${"b".repeat(64)}.webp`,
    imageWidth: 128,
    imageHeight: 128,
    translation: { name: { ko: "source_provided", ja: "source_provided" } },
  };
  const material = renderToStaticMarkup(<PalworldItemReferenceButton item={item} locale="ko" quantity={3} onOpen={() => undefined} />);
  const drop = renderToStaticMarkup(<PalworldItemReferenceButton item={item} locale="ja" minQuantity={1} maxQuantity={2} dropRatePercent={25} onOpen={() => undefined} />);
  const fallback = renderToStaticMarkup(<PalworldItemReferenceButton item={{ ...item, imageUrl: "https://example.com/item.webp" }} locale="ko" quantity={1} onOpen={() => undefined} />);
  assert.match(material, /<button[^>]+class="palworld-item-reference-button"[^>]+type="button"/u);
  assert.match(material, /src="\/images\/palworld\/1\.0\.1\/items\/[b]{64}\.webp"/u);
  assert.match(material, /alt="팰 스피어"/u);
  assert.match(material, /팰 스피어[\s\S]*× 3/u);
  assert.match(drop, /alt="パルスフィア"/u);
  assert.match(drop, /パルスフィア[\s\S]*ドロップ数 1–2[\s\S]*ドロップ率 25%/u);
  assert.doesNotMatch(fallback, /<img/u);
  assert.match(fallback, /role="img"[\s\S]*팰 스피어[\s\S]*이미지 준비 중[\s\S]*× 1/u);
});

test("Pal 작업 적성은 공식 로컬 이미지와 Lv. 숫자를 사용하고 능력치는 접근 가능한 그래프로 표시한다", () => {
  assert.deepEqual(generatedStaticAssets.workSource, {
    candidateRelease: "candidate-1248184a4b527d94",
    sourceArchiveSha256: "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384",
    mappingStatus: "verified_colored_source_member",
    status: "operator_acknowledged",
    usageBasis: "operator_reference_use",
    rightsVerified: false,
  });
  const koreanWork = renderToStaticMarkup(<PalworldWorkSuitabilityBadge level={3} locale="ko" type="mining" />);
  const japaneseWork = renderToStaticMarkup(<PalworldWorkSuitabilityBadge level={4} locale="ja" type="handiwork" />);
  assert.match(koreanWork, /data-work-type="mining"/u);
  assert.match(koreanWork, /title="채굴: Lv\.3"/u);
  assert.match(koreanWork, /<img[^>]+alt=""[^>]+aria-hidden="true"[^>]+class="palworld-work-suitability-icon is-source-image"/u);
  assert.match(koreanWork, /src="\/images\/palworld\/work\/[a-f0-9]{64}\.webp"/u);
  assert.match(koreanWork, /class="palworld-work-suitability-label">채굴<\/span>/u);
  assert.match(koreanWork, /Lv\.3/u);
  assert.doesNotMatch(koreanWork, /https?:\/\//u);
  assert.match(japaneseWork, /title="手作業: Lv\.4"/u);
  assert.match(japaneseWork, /class="palworld-work-suitability-label">手作業<\/span>/u);

  for (const type of PALWORLD_WORK_SUITABILITY_TYPES) {
    const imageUrl = workSuitabilityIconUrl(type);
    assert.ok(imageUrl);
    assert.match(imageUrl, /^\/images\/palworld\/work\/[a-f0-9]{64}\.webp$/u);
    const outputBytes = readFileSync(new URL(`../public${imageUrl}`, import.meta.url));
    assert.equal(createHash("sha256").update(outputBytes).digest("hex"), imageUrl.split("/").at(-1)?.replace(".webp", ""));
  }
  const badgeSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldWorkSuitabilityBadge.tsx", import.meta.url),
    "utf8"
  );
  assert.match(badgeSource, /onError=\{\(\) => setImageFailed\(true\)\}/u);
  assert.match(badgeSource, /imageFailed \|\| iconUrl === undefined \? \(/u);

  const graph = renderToStaticMarkup(<PalworldPalStatsGraph
    locale="ko"
    stats={{ hp: 100, attack: 80, shotAttack: 120, meleeAttack: 90, defense: 100, stamina: 250, food: 5, moveSpeed: 800, walkSpeed: 1_500, runSpeed: 1_500, rideSprintSpeed: 1_750 }}
  />);
  assert.equal((graph.match(/class="palworld-stat-chart-row"/gu) ?? []).length, 9);
  assert.match(graph, /data-stat="shotAttack"[\s\S]*원거리 공격력/u);
  assert.match(graph, /data-stat="rideSprintSpeed"[\s\S]*탑승 질주 속도/u);
  assert.doesNotMatch(graph, /data-stat="attack"|data-stat="moveSpeed"|야행성/u);
  assert.equal((graph.match(/aria-hidden="true"/gu) ?? []).length, 9);
});

test("공개 페이지의 데이터 범위 블록과 상세 기술 출처는 제거하고 하단 권리 고지는 유지한다", () => {
  const componentRoot = new URL("../src/features/public-palworld/components/", import.meta.url);
  for (const file of [
    "PalworldBreedingPage.tsx",
    "PalworldItemsPage.tsx",
    "PalworldSkillsPage.tsx",
    "PalworldSearchResults.tsx",
  ]) {
    assert.doesNotMatch(readFileSync(new URL(file, componentRoot), "utf8"), /PalworldDomainCoverageNotice|usePalworldDomainCoverage/u, file);
  }
  for (const file of ["PalworldDetailModals.tsx", "PalworldSkillsPage.tsx"]) {
    const source = readFileSync(new URL(file, componentRoot), "utf8");
    assert.doesNotMatch(source, /palworld-source|metadata\.sourceName|metadata\.sourceRevision|metadata\.gameVersion|metadata\.license/u, file);
  }
  const detailSource = readFileSync(new URL("PalworldDetailModals.tsx", componentRoot), "utf8");
  assert.doesNotMatch(detailSource, /multilingualNames/u);
  assert.doesNotMatch(detailSource, /breedingPower/u);
  assert.match(detailSource, /detail\.breeding\.specialParentPairs\.length \?/u);
  assert.match(detailSource, /palworld-pal-detail-summary[\s\S]*palworld-work-suitability-list/u);
  assert.doesNotMatch(detailSource, /<section><h4[^>]+workSuitabilities/u);
  assert.match(readFileSync(new URL("PalworldSourceFooter.tsx", componentRoot), "utf8"), /palworldI18n\.(?:ko|ja)\.sourceNotice/u);
});
