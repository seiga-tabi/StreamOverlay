import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PalworldDomainCoverage, PalworldSkillDetail, PalworldSkillSummary } from "@streamops/shared";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../src/features/public-palworld/components/PalworldHome";
import { ItemCard, PalCard } from "../src/features/public-palworld/components/PalworldCards";
import { isLocalPalworldImageUrl, PalworldMedia } from "../src/features/public-palworld/components/PalworldMedia";
import { isLocalPalworldMapUrl, PALWORLD_WORLD_MAP_IMAGE_URL, PalworldMapPage } from "../src/features/public-palworld/components/PalworldMapPage";
import { PalworldDomainCoverageNotice } from "../src/features/public-palworld/components/PalworldCoverageNotice";
import { PalworldPalsPage } from "../src/features/public-palworld/components/PalworldPalsPage";
import { PalworldItemsPage } from "../src/features/public-palworld/components/PalworldItemsPage";
import { PalworldSourceFooter } from "../src/features/public-palworld/components/PalworldSourceFooter";
import { PalworldStreamersPage } from "../src/features/public-palworld/components/PalworldStreamersPage";
import { PalworldSkillCard, PalworldSkillDetailView, PalworldSkillsPage } from "../src/features/public-palworld/components/PalworldSkillsPage";
import { PalworldElementBadge } from "../src/features/public-palworld/components/PalworldElementBadge";
import { PalworldPalPicker } from "../src/features/public-palworld/components/PalworldPalPicker";
import { PalworldNotFoundPage } from "../src/features/public-palworld/components/PalworldNotFoundPage";
import { PalworldPageErrorBoundary } from "../src/features/public-palworld/components/PalworldPageErrorBoundary";
import { isLocalPalworldElementImageUrl, PALWORLD_ELEMENT_IMAGES } from "../src/features/public-palworld/utils/element-images";

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

test("Pal 필터는 URL query 값을 선택 상태로 렌더하고 전체 희귀도를 제공한다", () => {
  const html = renderToStaticMarkup(<PalworldPalsPage locale="ja" params={new URLSearchParams("element=fire&work=mining&sort=number&rarity=10")} onOpenPal={() => undefined} />);
  assert.match(html, /value="fire" selected=""/);
  assert.match(html, /value="mining" selected=""/);
  assert.match(html, /value="10" selected=""/);
  assert.match(html, /value="20"/);
  assert.match(html, /パル図鑑/);
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

test("Pal 카드 이미지 alt는 현재 locale 이름을 사용하고 동일 출처 경로를 유지한다", () => {
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
    workSuitabilities: [{ type: "handiwork" as const, level: 1 }]
  };
  const korean = renderToStaticMarkup(<PalCard locale="ko" pal={pal} onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalCard locale="ja" pal={pal} onOpen={() => undefined} />);
  assert.match(korean, new RegExp(`src="${imageUrl.replaceAll("/", "\\/")}" alt="도로롱"`));
  assert.match(japanese, /alt="モコロン"/);
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
  const manifest = JSON.parse(readFileSync(new URL("../../server/data/palworld/1.0.1/element-images-manifest.json", import.meta.url), "utf8")) as {
    sourceArchiveSha256: string;
    entries: Array<{ id: keyof typeof PALWORLD_ELEMENT_IMAGES; imageUrl: string; outputWidth: number; outputHeight: number }>;
  };
  assert.equal(manifest.sourceArchiveSha256, "42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115");
  assert.equal(manifest.entries.length, 9);
  for (const entry of manifest.entries) {
    assert.deepEqual(PALWORLD_ELEMENT_IMAGES[entry.id], { imageUrl: entry.imageUrl, width: entry.outputWidth, height: entry.outputHeight });
  }
  assert.equal(Object.keys(PALWORLD_ELEMENT_IMAGES).length, 9);
  for (const [element, asset] of Object.entries(PALWORLD_ELEMENT_IMAGES)) {
    assert.equal(isLocalPalworldElementImageUrl(asset.imageUrl), true, `${element} 이미지 경로`);
    assert.equal(asset.width, 48);
    assert.equal(asset.height, 48);
    const outputFileName = asset.imageUrl.split("/").at(-1)!;
    const outputBytes = readFileSync(new URL(`../public/images/palworld/1.0.1/elements/${outputFileName}`, import.meta.url));
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
  const dropButtonRule = css.match(/\.palworld-drop-row button\s*\{[\s\S]*?\}/u)?.[0] ?? "";
  assert.match(localizedCopyRule, /max-inline-size:\s*100%/u);
  assert.match(localizedCopyRule, /overflow-wrap:\s*anywhere/u);
  assert.match(linkButtonRule, /max-inline-size:\s*100%/u);
  assert.match(linkButtonRule, /overflow-wrap:\s*anywhere/u);
  assert.match(dropButtonRule, /max-inline-size:\s*100%/u);
  assert.match(dropButtonRule, /overflow-wrap:\s*anywhere/u);
});

test("Pal과 아이템 이미지는 종류별 고정 release content-hash WebP 경로만 요청한다", () => {
  const imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const itemImageUrl = `/images/palworld/1.0.1/items/${"b".repeat(64)}.webp`;
  assert.equal(isLocalPalworldImageUrl(imageUrl), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl), true);
  assert.equal(isLocalPalworldImageUrl(imageUrl, "pal"), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl, "item"), true);
  assert.equal(isLocalPalworldImageUrl(itemImageUrl, "pal"), false);
  assert.equal(isLocalPalworldImageUrl(imageUrl, "item"), false);
  assert.equal(isLocalPalworldImageUrl("https://example.com/pal.webp"), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1/pals/${"a".repeat(64)}.png`), false);
  assert.equal(isLocalPalworldImageUrl(`/images/palworld/1.0.1/pals/${"A".repeat(64)}.webp`), false);

  const external = renderToStaticMarkup(<PalworldMedia alt="외부 이미지" imageUrl="https://example.com/pal.webp" locale="ko" kind="pal" />);
  assert.doesNotMatch(external, /<img/u);
  assert.match(external, /aria-label="외부 이미지 · 이미지 준비 중"/);
});

test("월드 지도는 고정 release content-hash WebP와 한국어·일본어 접근성 문구를 사용한다", () => {
  assert.equal(isLocalPalworldMapUrl(PALWORLD_WORLD_MAP_IMAGE_URL), true);
  assert.equal(isLocalPalworldMapUrl("https://example.com/map.webp"), false);
  assert.equal(isLocalPalworldMapUrl(`${PALWORLD_WORLD_MAP_IMAGE_URL}?download=1`), false);
  assert.equal(isLocalPalworldMapUrl(PALWORLD_WORLD_MAP_IMAGE_URL.replace(".webp", ".png")), false);

  const outputFileName = PALWORLD_WORLD_MAP_IMAGE_URL.split("/").at(-1)!;
  const outputBytes = readFileSync(new URL(`../public/images/palworld/1.0.1/maps/${outputFileName}`, import.meta.url));
  assert.equal(createHash("sha256").update(outputBytes).digest("hex"), outputFileName.replace(".webp", ""));
  assert.equal(outputBytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(outputBytes.subarray(8, 12).toString("ascii"), "WEBP");

  const korean = renderToStaticMarkup(<PalworldMapPage locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldMapPage locale="ja" />);
  assert.match(korean, /Palworld 월드 지도/u);
  assert.match(korean, /alt="빠른 이동 지점이 표시된 Palworld 월드 지도"/u);
  assert.match(korean, /지도 이미지 출처: 운영자가 제공한 pyPalworldAPI 0\.2\.0 archive/u);
  assert.match(korean, /aria-label="지도 확대"/u);
  assert.match(japanese, /Palworld ワールドマップ/u);
  assert.match(japanese, /ファストトラベル地点が表示されたPalworldワールドマップ/u);
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

test("아이템과 교배의 데이터 범위·출처를 한국어·일본어 안내와 배지로 표시한다", () => {
  const metadata = {
    gameVersion: "sample-baseline",
    sourceName: "StreamOverlay curated sample snapshot",
    sourceUrl: "https://example.com/palworld-sample",
    sourceRevision: "sample-revision",
    extractedAt: "2026-07-21T00:00:00.000Z",
    verifiedAt: "2026-07-21T00:00:00.000Z",
    license: "Test-only fixture",
  };
  const itemsCoverage: PalworldDomainCoverage = { status: "sample", recordCount: 10, metadata };
  const breedingCoverage: PalworldDomainCoverage = { status: "sample", recordCount: 3, metadata };
  const korean = renderToStaticMarkup(<PalworldDomainCoverageNotice coverage={itemsCoverage} domain="items" locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldDomainCoverageNotice coverage={breedingCoverage} domain="breeding" locale="ja" />);
  const unknown = renderToStaticMarkup(<PalworldDomainCoverageNotice domain="items" locale="ko" />);
  assert.match(korean, /data-testid="palworld-items-coverage"/);
  assert.match(korean, /data-ko="샘플"/);
  assert.match(korean, /고정 출처에서 검증된 아이템만 제공/u);
  assert.match(korean, /StreamOverlay curated sample snapshot · sample-revision/);
  assert.match(japanese, /data-testid="palworld-breeding-coverage"/);
  assert.match(japanese, /data-ja="サンプル"/);
  assert.match(japanese, /固定された Palworld release で検証済みの通常・特殊配合/u);
  assert.match(unknown, /범위 확인 중/);
  assert.match(unknown, /전체 데이터로 표시하지 않습니다/);
});
