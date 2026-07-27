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
  PalworldPalCondensationProfile,
  PalworldPalListFacets,
  PalworldPalReference,
  PalworldPalStats,
  PalworldSkillDetail,
  PalworldSkillListFacets,
  PalworldSkillSummary,
} from "@streamops/shared";
import { PALWORLD_WORK_SUITABILITY_TYPES } from "@streamops/shared";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../src/features/public-palworld/components/PalworldHome";
import { ItemCard, PalCard } from "../src/features/public-palworld/components/PalworldCards";
import { PalworldItemReferenceButton } from "../src/features/public-palworld/components/PalworldItemReferenceButton";
import { PalworldMapFilterPanel } from "../src/features/public-palworld/components/PalworldMapFilterPanel";
import { PalworldMapLocationLayer } from "../src/features/public-palworld/components/PalworldMapLocationLayer";
import { PalworldMapMarkerPopover } from "../src/features/public-palworld/components/PalworldMapMarkerPopover";
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
import { PalworldSkillsFilters } from "../src/features/public-palworld/components/PalworldSkillsFilters";
import { PalworldElementBadge } from "../src/features/public-palworld/components/PalworldElementBadge";
import { PalworldPalCondensation } from "../src/features/public-palworld/components/PalworldPalCondensation";
import { PalworldPalStatsGraph } from "../src/features/public-palworld/components/PalworldPalStatsGraph";
import { PalworldPalPicker } from "../src/features/public-palworld/components/PalworldPalPicker";
import { BreedingModeTabs } from "../src/features/public-palworld/components/PalworldBreedingControls";
import {
  BreedingCombinationList,
  BreedingGenderAlternativeCard,
  BreedingPartnerPairCard,
  BreedingRequestStatus,
  DirectBreedingResult,
  ReverseBreedingPairCard,
  ReverseBreedingTargetSummary,
} from "../src/features/public-palworld/components/PalworldBreedingResults";
import { PalworldNotFoundPage } from "../src/features/public-palworld/components/PalworldNotFoundPage";
import { PalworldPageErrorBoundary } from "../src/features/public-palworld/components/PalworldPageErrorBoundary";
import {
  filterPalworldBossMarkers,
  PALWORLD_PAL_DETAIL_INITIAL_ZOOM,
  PALWORLD_PAL_DETAIL_MIN_SPAWN_OPACITY,
  PalworldPalLocationMap,
} from "../src/features/public-palworld/components/PalworldPalLocationMap";
import {
  PalworldActiveSkillDetail,
  PalworldPalDescription,
} from "../src/features/public-palworld/components/PalworldDetailModals";
import {
  clampPalworldMapView as clampSharedPalworldMapView,
  focusPalworldMapViewAt as focusSharedPalworldMapViewAt,
  zoomPalworldMapViewAt as zoomSharedPalworldMapViewAt,
} from "../src/features/public-palworld/hooks/usePalworldMapViewport";
import { PalworldWorkSuitabilityBadge } from "../src/features/public-palworld/components/PalworldWorkSuitabilityBadge";
import { PalworldTranslationReviewNotice } from "../src/features/public-palworld/components/PalworldTranslationBadge";
import generatedMapLayerIcons from "../src/features/public-palworld/data/palworld-map-layer-icons.json";
import generatedStaticAssets from "../src/features/public-palworld/data/palworld-static-assets.generated.json";
import { palworldI18n } from "../src/features/public-palworld/i18n/palworld-i18n";
import {
  isLocalPalworldElementImageUrl,
  PALWORLD_ELEMENT_IMAGES,
  PALWORLD_MAP_IMAGES,
} from "../src/features/public-palworld/utils/element-images";
import { PALWORLD_MAP_COLLECTIBLE_TYPE_IDS } from "../src/features/public-palworld/utils/map-collectible-types";
import {
  isLocalPalworldMapLayerIconUrl,
  PALWORLD_MAP_LAYER_ICONS,
} from "../src/features/public-palworld/utils/map-layer-icons";
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
  assert.match(home, /class="public-app-header public-app-header-v2 palworld-header is-home"/);
  assert.doesNotMatch(home, /palworld-header home/);
  assert.match(child, /data-testid="palworld-secondary-nav"/);
  assert.match(child, /aria-current="page"[^>]*data-ko="Pal 도감"/);
  assert.match(home, /class="public-brand-mark public-brand-mobile-logo" src="\/images\/yorogg-home-logo\.webp" alt="" aria-hidden="true"/);
  assert.doesNotMatch(home, /src="\/images\/yorogg-mark\.png"/);
});

test("펠월드 홈 Hero는 모바일 검색 제안이 경계 밖에서도 잘리지 않게 유지한다", () => {
  const css = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  const heroRule = css.match(/\.palworld-hero\s*\{(?<body>[^}]+)\}/u)?.groups?.body;
  const shellRule = css.match(/\.palworld-shell\s*\{(?<body>[^}]+)\}/u)?.groups?.body;

  assert.ok(heroRule);
  assert.match(heroRule, /overflow:\s*visible;/u);
  assert.doesNotMatch(heroRule, /overflow:\s*hidden;/u);
  assert.ok(shellRule);
  assert.match(shellRule, /overflow-x:\s*clip;/u);
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

test("스킬 카드는 관련 Pal 이미지를 최대 3개 표시하고 나머지는 접근 가능한 생략 표시로 알린다", () => {
  const palImageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const relatedPalPreviews: PalworldPalReference[] = [
    { id: "lamball", number: 1, nameKo: "도로롱", nameJa: "モコロン", imageUrl: palImageUrl, imageWidth: 128, imageHeight: 128, elements: ["neutral"] },
    { id: "cattiva", number: 2, nameKo: "까부냥", nameJa: "ツッパニャン", imageUrl: palImageUrl, imageWidth: 128, imageHeight: 128, elements: ["neutral"] },
    { id: "chikipi", number: 3, nameKo: "꼬꼬닭", nameJa: "タマコッコ", imageUrl: palImageUrl, imageWidth: 128, imageHeight: 128, elements: ["neutral"] },
  ];
  const skill: PalworldSkillSummary = {
    id: "active-related-preview",
    type: "active",
    nameKo: "공기 대포",
    nameJa: "エアーキャノン",
    nameEn: "Air Cannon",
    descriptionKo: "고속 공기 덩어리를 발사한다.",
    descriptionJa: "高速の空気の塊を発射する。",
    element: "neutral",
    power: 25,
    cooldownSeconds: 2,
    relatedPalCount: 5,
    relatedPalPreviews,
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_provided", ja: "source_provided" },
    },
  };

  const korean = renderToStaticMarkup(<PalworldSkillCard locale="ko" onOpen={() => undefined} skill={skill} />);
  const japanese = renderToStaticMarkup(<PalworldSkillCard locale="ja" onOpen={() => undefined} skill={skill} />);
  const exactlyThree = renderToStaticMarkup(
    <PalworldSkillCard
      locale="ko"
      onOpen={() => undefined}
      skill={{ ...skill, relatedPalCount: 3 }}
    />,
  );
  const four = renderToStaticMarkup(
    <PalworldSkillCard
      locale="ko"
      onOpen={() => undefined}
      skill={{ ...skill, relatedPalCount: 4 }}
    />,
  );

  assert.equal((korean.match(/class="palworld-skill-related-preview-media"/gu) ?? []).length, 3);
  assert.equal((korean.match(/\/images\/palworld\/1\.0\.1\/pals\//gu) ?? []).length, 3);
  assert.match(korean, /aria-label="관련 Pal"/u);
  assert.match(korean, /title="도로롱"/u);
  assert.match(korean, /title="까부냥"/u);
  assert.match(korean, /title="꼬꼬닭"/u);
  assert.match(korean, /aria-label="외 2종"[^>]*class="palworld-skill-related-preview-more"/u);
  assert.match(korean, /palworld-skill-related-preview-more[\s\S]*?>[\s\S]*?…/u);
  assert.match(japanese, /aria-label="関連パル"/u);
  assert.match(japanese, /title="モコロン"/u);
  assert.match(japanese, /aria-label="ほか2体"[^>]*class="palworld-skill-related-preview-more"/u);
  assert.doesNotMatch(exactlyThree, /palworld-skill-related-preview-more/u);
  assert.match(four, /aria-label="외 1종"[^>]*class="palworld-skill-related-preview-more"/u);
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
    passiveEffectState: "available",
    passiveEffects: [{ type: "ShotAttack", value: 10, target: "ToSelf" }],
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
  assert.match(korean, /효과 상세[\s\S]*공격[\s\S]*\+10%/u);
  assert.match(korean, /이 항목에는 적용되지 않습니다\./u);
  assert.equal((korean.match(/data-translation-status="machine_assisted"/gu) ?? []).length, 1);
  assert.equal((korean.match(/class="palworld-translation-review-notice"/gu) ?? []).length, 1);
  assert.doesNotMatch(korean, /data-ko="영문 원문"/u);
  assert.match(japanese, /勇敢な心/u);
  assert.match(japanese, /攻撃力が増加する/u);
  assert.match(japanese, /効果詳細[\s\S]*攻撃[\s\S]*\+10%/u);
  assert.match(japanese, /この項目には適用されません。/u);
  assert.equal((japanese.match(/data-translation-status="machine_assisted"/gu) ?? []).length, 1);
  assert.equal((japanese.match(/class="palworld-translation-review-notice"/gu) ?? []).length, 1);
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

test("패시브 스킬 상세는 구조화 효과 원문이 없을 때 정확한 상태를 locale별로 표시한다", () => {
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
    passiveEffectState: "missing_source",
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
  assert.match(korean, /효과 상세[\s\S]*현재 원본 데이터에서 패시브 효과 수치를 확인할 수 없습니다/u);
  assert.match(japanese, /効果詳細[\s\S]*現在の元データではパッシブ効果値を確認できません/u);
  assert.doesNotMatch(korean, /원본 데이터에 정보가 없습니다/u);
  assert.doesNotMatch(japanese, /元データに情報がありません/u);
});

test("패시브 효과의 source mismatch와 data unavailable은 일반 원본 누락과 구분한다", () => {
  const detail = (state: "source_mismatch" | "data_unavailable"): PalworldSkillDetail => ({
    id: `passive-${state}`,
    type: "passive",
    nameKo: "상태 확인",
    nameJa: "状態確認",
    nameEn: "State Check",
    descriptionEn: "Source-language description",
    passiveTier: 1,
    passiveEffectState: state,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_language_fallback", ja: "source_language_fallback" },
    },
    metadata: {
      gameVersion: "1.0.1.100619",
      sourceName: "고정 스킬 데이터",
      sourceUrl: "https://example.com/palworld-skills",
      sourceRevision: "translation-r1",
      extractedAt: "2026-07-22T00:00:00.000Z",
      verifiedAt: "2026-07-22T00:00:00.000Z",
      license: "operator_reference_use",
    },
  });
  const mismatchKo = renderToStaticMarkup(<PalworldSkillDetailView detail={detail("source_mismatch")} locale="ko" onOpenPal={() => undefined} />);
  const mismatchJa = renderToStaticMarkup(<PalworldSkillDetailView detail={detail("source_mismatch")} locale="ja" onOpenPal={() => undefined} />);
  const unavailableKo = renderToStaticMarkup(<PalworldSkillDetailView detail={detail("data_unavailable")} locale="ko" onOpenPal={() => undefined} />);
  const unavailableJa = renderToStaticMarkup(<PalworldSkillDetailView detail={detail("data_unavailable")} locale="ja" onOpenPal={() => undefined} />);

  assert.match(mismatchKo, /현재 릴리스와 원본 효과 수치가 일치하지 않아/u);
  assert.match(mismatchJa, /現在のリリースと元データの効果値が一致しないため/u);
  assert.match(unavailableKo, /패시브 효과 데이터를 사용할 수 없습니다/u);
  assert.match(unavailableJa, /パッシブ効果データを利用できません/u);
  assert.doesNotMatch(`${mismatchKo}${unavailableKo}`, /원본 데이터에 정보가 없습니다|영문 원문/u);
  assert.doesNotMatch(`${mismatchJa}${unavailableJa}`, /元データに情報がありません|英語原文/u);
});

test("구형 응답과 면역형 패시브 효과는 원본 누락이나 백분율로 오인하지 않는다", () => {
  const base: PalworldSkillDetail = {
    id: "passive-immunity",
    type: "passive",
    nameKo: "화상 면역",
    nameJa: "炎上無効",
    nameEn: "Burn Immunity",
    descriptionEn: "Prevents burns.",
    passiveTier: 1,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_language_fallback", ja: "source_language_fallback" },
    },
    metadata: {
      gameVersion: "1.0.1.100619",
      sourceName: "고정 스킬 데이터",
      sourceUrl: "https://example.com/palworld-skills",
      sourceRevision: "translation-r1",
      extractedAt: "2026-07-22T00:00:00.000Z",
      verifiedAt: "2026-07-22T00:00:00.000Z",
      license: "operator_reference_use",
    },
  };
  const legacy = renderToStaticMarkup(
    <PalworldSkillCard locale="ko" onOpen={() => undefined} skill={base} />,
  );
  const korean = renderToStaticMarkup(
    <PalworldSkillDetailView
      detail={{
        ...base,
        passiveEffectState: "available",
        passiveEffects: [{
          type: "ResistAdditionalEffect_Burn",
          value: 100,
          target: "ToSelf",
        }],
      }}
      locale="ko"
      onOpenPal={() => undefined}
    />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldSkillDetailView
      detail={{
        ...base,
        passiveEffectState: "available",
        passiveEffects: [{
          type: "ResistAdditionalEffect_Burn",
          value: 100,
          target: "ToSelf",
        }],
      }}
      locale="ja"
      onOpenPal={() => undefined}
    />,
  );

  assert.match(legacy, /패시브 효과 데이터를 사용할 수 없습니다/u);
  assert.doesNotMatch(legacy, /원본 데이터에 정보가 없습니다/u);
  assert.match(korean, /화상 무효[\s\S]*적용/u);
  assert.match(japanese, /炎上無効[\s\S]*適用/u);
  assert.doesNotMatch(`${korean}${japanese}`, /\+100%/u);
});

test("패시브 스킬은 공식 설명문이 없어도 구조화 효과를 locale별로 표시한다", () => {
  const detail: PalworldSkillDetail = {
    id: "passive-source-language-fallback",
    type: "passive",
    nameKo: "단단한 피부",
    nameJa: "硬い皮膚",
    nameEn: "Hard Skin",
    descriptionEn: "Defense increases.",
    passiveAbility: "Defense +10%",
    passiveEffectState: "available",
    passiveEffects: [{ type: "Defense", value: 10, target: "ToSelf" }],
    passiveTier: 1,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_language_fallback", ja: "source_language_fallback" },
      passiveAbility: { ko: "source_language_fallback", ja: "source_language_fallback" },
    },
    metadata: {
      gameVersion: "1.0.1.100619",
      sourceName: "고정 스킬 데이터",
      sourceUrl: "https://example.com/palworld-skills",
      sourceRevision: "translation-r1",
      extractedAt: "2026-07-22T00:00:00.000Z",
      verifiedAt: "2026-07-22T00:00:00.000Z",
      license: "operator_reference_use",
    },
  };
  const koreanCard = renderToStaticMarkup(<PalworldSkillCard locale="ko" onOpen={() => undefined} skill={detail} />);
  const koreanDetail = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ko" onOpenPal={() => undefined} />);
  const japaneseDetail = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ja" onOpenPal={() => undefined} />);

  assert.doesNotMatch(koreanCard, /Defense increases/u);
  assert.match(koreanCard, /방어 \+10%/u);
  assert.doesNotMatch(koreanCard, /원본 데이터에 정보가 없습니다|data-translation-status="source_language_fallback"/u);
  assert.doesNotMatch(koreanDetail, /Defense increases|Defense \+10%/u);
  assert.match(koreanDetail, /공식 한국어 설명 문장은 제공되지 않지만/u);
  assert.match(koreanDetail, /효과 상세[\s\S]*방어[\s\S]*\+10%[\s\S]*적용 대상: Pal/u);
  assert.doesNotMatch(koreanDetail, /원본 데이터에 정보가 없습니다|data-translation-status="source_language_fallback"/u);
  assert.doesNotMatch(japaneseDetail, /Defense increases|Defense \+10%/u);
  assert.match(japaneseDetail, /公式の日本語説明文は提供されていません/u);
  assert.match(japaneseDetail, /効果詳細[\s\S]*防御[\s\S]*\+10%[\s\S]*適用対象: パル/u);
  assert.doesNotMatch(japaneseDetail, /元データに情報がありません|data-translation-status="source_language_fallback"/u);
});

test("패시브 스킬은 공식 source_provided 설명과 효과를 locale별로 그대로 표시한다", () => {
  const detail: PalworldSkillDetail = {
    id: "passive-source-provided",
    type: "passive",
    nameKo: "장인의 손",
    nameJa: "職人の手",
    nameEn: "Artisan",
    descriptionKo: "작업 속도가 증가한다.",
    descriptionJa: "作業速度が上昇する。",
    descriptionEn: "Work speed increases.",
    passiveAbilityKo: "작업 속도 +50%",
    passiveAbilityJa: "作業速度 +50%",
    passiveAbility: "Work Speed +50%",
    passiveEffectState: "available",
    passiveEffects: [{ type: "CraftSpeed", value: 50, target: "ToSelf" }],
    passiveTier: 3,
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_provided", ja: "source_provided" },
      passiveAbility: { ko: "source_provided", ja: "source_provided" },
    },
    metadata: {
      gameVersion: "1.0.1.100619",
      sourceName: "공식 게임 locale",
      sourceUrl: "https://example.com/palworld-skills",
      sourceRevision: "translation-r1",
      extractedAt: "2026-07-22T00:00:00.000Z",
      verifiedAt: "2026-07-22T00:00:00.000Z",
      license: "operator_reference_use",
    },
  };
  const korean = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ko" onOpenPal={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalworldSkillDetailView detail={detail} locale="ja" onOpenPal={() => undefined} />);

  assert.match(korean, /장인의 손/u);
  assert.match(korean, /작업 속도가 증가한다/u);
  assert.match(korean, /효과 상세[\s\S]*작업 속도[\s\S]*\+50%/u);
  assert.doesNotMatch(korean, /Work speed increases|Work Speed \+50%|원본 데이터에 정보가 없습니다/u);
  assert.match(japanese, /職人の手/u);
  assert.match(japanese, /作業速度が上昇する/u);
  assert.match(japanese, /効果詳細[\s\S]*作業速度[\s\S]*\+50%/u);
  assert.doesNotMatch(japanese, /Work speed increases|Work Speed \+50%|元データに情報がありません/u);
});

test("스킬 페이지는 URL query 필터를 선택 상태로 복원한다", () => {
  const facets: PalworldSkillListFacets = {
    types: [
      { value: "active", count: 304 },
      { value: "passive", count: 115 },
      { value: "partner", count: 288 },
    ],
    activeElements: [{ value: "fire", count: 30 }],
    partnerElements: [{ value: "dark", count: 40 }],
    passiveEffects: [
      { value: "attack", count: 20 },
      { value: "work_speed", count: 13 },
    ],
    passiveTiers: [
      { value: 5, count: 7 },
      { value: -1, count: 10 },
    ],
  };
  const html = renderToStaticMarkup(<PalworldSkillsPage locale="ja" params={new URLSearchParams("type=passive&passiveEffect=attack&passiveTier=5&sort=power&order=desc")} />);
  const passiveFilters = renderToStaticMarkup(<PalworldSkillsFilters
    facets={facets}
    locale="ja"
    onUpdate={() => undefined}
    params={new URLSearchParams("type=passive&passiveEffect=attack&passiveTier=5")}
    selectedType="passive"
  />);
  const partnerFilters = renderToStaticMarkup(<PalworldSkillsFilters
    facets={facets}
    locale="ko"
    onUpdate={() => undefined}
    params={new URLSearchParams("type=partner&partnerElement=dark")}
    selectedType="partner"
  />);
  assert.match(html, /Palworld スキル/u);
  assert.match(html, /aria-pressed="true"[^>]*data-selected="true"[^>]*>パッシブスキル/u);
  assert.match(html, /攻撃/u);
  assert.match(html, /value="power" selected=""/u);
  assert.match(html, /value="desc" selected=""/u);
  assert.match(passiveFilters, /アクティブスキル[\s\S]*パッシブスキル[\s\S]*パートナースキル/u);
  assert.match(passiveFilters, /aria-pressed="true"[^>]*aria-label="攻撃効果で絞り込む"/u);
  assert.match(passiveFilters, /aria-pressed="true"[^>]*aria-label="パッシブ等級\+5で絞り込む"/u);
  assert.match(passiveFilters, /作業速度/u);
  assert.match(partnerFilters, /aria-pressed="true"[^>]*aria-label="어둠 속성 스킬로 필터"/u);
  assert.match(partnerFilters, /palworld-element-icon/u);
});

test("스킬 페이지의 기본 탭은 액티브이며 game data 속성 아이콘과 다국어 탭을 표시한다", () => {
  const korean = renderToStaticMarkup(<PalworldSkillsPage locale="ko" params={new URLSearchParams()} />);
  const japanese = renderToStaticMarkup(<PalworldSkillsPage locale="ja" params={new URLSearchParams()} />);

  assert.match(korean, /aria-pressed="true"[^>]*data-selected="true"[^>]*>액티브 스킬/u);
  assert.match(korean, /액티브 스킬[\s\S]*패시브 스킬[\s\S]*파트너 스킬/u);
  assert.match(korean, /palworld-element-icon/u);
  assert.match(japanese, /アクティブスキル[\s\S]*パッシブスキル[\s\S]*パートナースキル/u);
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
  assert.match(html, /src="\/images\/palworld\/1\.0\.1\/work\/[a-f0-9]{64}\.webp"/u);
  assert.match(html, /alt="" aria-hidden="true" class="palworld-pal-filter-work-icon"/u);
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

test("아이템 종류와 레어도 필터는 신규 query와 legacy 숫자 rarity를 chip 선택 상태로 복원한다", () => {
  const korean = renderToStaticMarkup(<PalworldItemsPage locale="ko" params={new URLSearchParams("itemType=material&rarityTier=common&sort=rarity&order=desc&acquisition=drop")} onOpenItem={() => undefined} />);
  const legacy = renderToStaticMarkup(<PalworldItemsPage locale="ko" params={new URLSearchParams("category=material&rarity=4")} onOpenItem={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalworldItemsPage locale="ja" params={new URLSearchParams("itemType=sphere_module&rarityTier=legendary")} onOpenItem={() => undefined} />);
  assert.match(korean, /<legend>아이템 종류<\/legend>/u);
  assert.match(korean, /aria-pressed="true" aria-label="소재 종류로 필터"/u);
  assert.match(korean, /<legend>레어도<\/legend>/u);
  assert.match(korean, /<button(?=[^>]*aria-pressed="true")(?=[^>]*aria-label="레어도 일반 선택")(?=[^>]*data-rarity-band="common")[^>]*>/u);
  assert.match(korean, /<button(?=[^>]*aria-label="레어도 전설 선택")(?=[^>]*data-rarity-band="legendary")[^>]*>/u);
  assert.match(korean, /value="drop" selected=""/u);
  assert.match(korean, /value="desc" selected=""/u);
  assert.doesNotMatch(korean, /희귀도/u);
  assert.match(legacy, /aria-pressed="true" aria-label="소재 종류로 필터"/u);
  assert.match(legacy, /<button(?=[^>]*aria-pressed="true")(?=[^>]*aria-label="레어도 전설 선택")(?=[^>]*data-rarity-band="legendary")[^>]*>/u);
  assert.match(japanese, /<legend>レア度<\/legend>/u);
  assert.match(japanese, /aria-pressed="true" aria-label="スフィアモジュールの種類で絞り込む"/u);
  assert.match(japanese, /<button(?=[^>]*aria-pressed="true")(?=[^>]*aria-label="レア度レジェンダリーで絞り込む")(?=[^>]*data-rarity-band="legendary")[^>]*>/u);
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
  assert.match(html, /data-rarity-band="common"/u);
});

test("아이템 카드 이미지 영역은 레어도 단계별 디자인 상태를 제공한다", () => {
  const rarities = [
    [0, "common", "일반"],
    [1, "uncommon", "비범"],
    [2, "rare", "희귀"],
    [3, "epic", "영웅"],
    [4, "legendary", "전설"],
    [5, "unclassified", "레어도 5"],
    [20, "unclassified", "레어도 20"],
  ] as const;
  for (const [rarity, band, label] of rarities) {
    const html = renderToStaticMarkup(<ItemCard
      item={{
        id: `rarity-${rarity}`,
        nameEn: `Rarity ${rarity}`,
        category: "material",
        rarity,
      }}
      locale="ko"
      onOpen={() => undefined}
    />);
    assert.match(html, new RegExp(`data-rarity-band="${band}"`, "u"));
    assert.match(html, new RegExp(`data-ko="${label}"`, "u"));
    assert.match(html, new RegExp(`>${label}<`, "u"));
  }
  const css = readFileSync(new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url), "utf8");
  assert.match(css, /data-rarity-band="epic"[\s\S]*--palworld-item-rarity-accent: var\(--yoro-color-secondary\)/u);
  assert.match(css, /data-rarity-band="legendary"[\s\S]*--palworld-item-rarity-accent: var\(--palworld-gold\)/u);
});

test("아이템 카드의 12분류는 legacy category보다 itemType을 우선해 locale별로 표시한다", () => {
  const item = {
    id: "glider-item",
    nameKo: "시험용 글라이더",
    nameJa: "テスト用グライダー",
    nameEn: "Test Glider",
    category: "other" as const,
    itemType: "glider" as const,
    rarity: 5,
  };
  const korean = renderToStaticMarkup(<ItemCard item={item} locale="ko" onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<ItemCard item={item} locale="ja" onOpen={() => undefined} />);
  assert.match(korean, />글라이더</u);
  assert.doesNotMatch(korean, />기타</u);
  assert.match(japanese, />グライダー</u);
  assert.match(japanese, /data-ja="レア度 5"/u);
});

test("번역된 아이템 카드는 locale별 이름·설명을 유지하고 반복 검수 Badge를 숨긴다", () => {
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
  assert.match(korean, /data-ko="비범"/u);
  assert.doesNotMatch(korean, /data-ko="번역 검수 중"/u);
  assert.doesNotMatch(korean, /data-ko="영문 원문"/u);
  assert.match(japanese, /翻訳された部品/u);
  assert.match(japanese, /クラフトに使用する部品です/u);
  assert.match(japanese, /data-ja="アンコモン"/u);
  assert.doesNotMatch(japanese, /data-ja="翻訳確認中"/u);
});

test("목록의 machine-assisted 안내는 페이지 단위로 한 번만 제공한다", () => {
  const korean = renderToStaticMarkup(<>
    <PalworldTranslationReviewNotice locale="ko" />
    <ItemCard
      item={{
        id: "machine-item-a",
        nameKo: "자동 번역 아이템 A",
        nameEn: "Machine Item A",
        category: "material",
        rarity: 0,
        descriptionKo: "자동 번역 설명 A",
        descriptionEn: "Machine description A",
        translation: {
          name: { ko: "machine_assisted", ja: "missing_source" },
          description: { ko: "machine_assisted", ja: "missing_source" },
        },
      }}
      locale="ko"
      onOpen={() => undefined}
    />
    <ItemCard
      item={{
        id: "machine-item-b",
        nameKo: "자동 번역 아이템 B",
        nameEn: "Machine Item B",
        category: "material",
        rarity: 0,
        descriptionKo: "자동 번역 설명 B",
        descriptionEn: "Machine description B",
        translation: {
          name: { ko: "machine_assisted", ja: "missing_source" },
          description: { ko: "machine_assisted", ja: "missing_source" },
        },
      }}
      locale="ko"
      onOpen={() => undefined}
    />
  </>);

  assert.equal((korean.match(/data-translation-status="machine_assisted"/gu) ?? []).length, 1);
  assert.equal((korean.match(/class="palworld-translation-review-notice"/gu) ?? []).length, 1);
});

test("카드는 machine-assisted 반복 Badge 대신 해당 레코드의 원문 이상만 표시한다", () => {
  const item = {
    id: "source-anomaly-item",
    nameKo: "손상 원문 아이템",
    nameJa: "原文欠落アイテム",
    nameEn: "Source Anomaly Item",
    category: "material" as const,
    rarity: 0,
    descriptionKo: "에서 제작할 수 있다. [원문 누락]",
    descriptionJa: "で製作できる。[原文欠落]",
    descriptionEn: "Can be crafted at .",
    translation: {
      name: {
        ko: "human_reviewed" as const,
        ja: "human_reviewed" as const,
        sourceIntegrity: { ko: "intact" as const, ja: "intact" as const },
      },
      description: {
        ko: "machine_assisted" as const,
        ja: "machine_assisted" as const,
        sourceIntegrity: { ko: "source_anomaly" as const, ja: "source_anomaly" as const },
      },
    },
  };
  const korean = renderToStaticMarkup(<ItemCard item={item} locale="ko" onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<ItemCard item={item} locale="ja" onOpen={() => undefined} />);

  assert.doesNotMatch(korean, /data-translation-status="machine_assisted"/u);
  assert.match(korean, /data-source-integrity="source_anomaly"/u);
  assert.match(korean, /data-ko="원문 일부 누락"/u);
  assert.match(japanese, /data-ja="原文の一部欠落"/u);
});

test("상세의 빈 데이터는 제작식 없음과 현재 원본 미제공을 임의 추정 없이 구분한다", () => {
  const detailSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldDetailModals.tsx", import.meta.url),
    "utf8",
  );
  const skillSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldSkillsPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detailSource, /detail\.recipes !== undefined \? text\.craftingRecipeEmpty : text\.sourceNotProvided/u);
  assert.match(detailSource, /detail\.craftingFacility[\s\S]*text\.sourceNotProvided/u);
  assert.match(detailSource, /detail\.relatedItems\.length[\s\S]*text\.sourceNotProvided/u);
  assert.match(
    skillSource,
    /detail\.relatedPals\.length[\s\S]*detail\.type === "passive" \? text\.notApplicable : text\.relatedPalEmpty/u
  );
  assert.equal(palworldI18n.ko.craftingRecipeEmpty, "제작식이 없습니다.");
  assert.equal(palworldI18n.ja.craftingRecipeEmpty, "製作レシピはありません。");
  assert.equal(palworldI18n.ko.sourceNotProvided, "현재 원본 데이터에서 제공되지 않는 정보입니다.");
  assert.equal(palworldI18n.ja.sourceNotProvided, "現在の元データでは提供されていない情報です。");
  assert.equal(palworldI18n.ko.notApplicable, "이 항목에는 적용되지 않습니다.");
  assert.equal(palworldI18n.ja.notApplicable, "この項目には適用されません。");
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
  const reverse = renderToStaticMarkup(<ReverseBreedingPairCard locale="ko" onOpenPal={() => undefined} pair={pair} />);
  const partner = renderToStaticMarkup(<BreedingPartnerPairCard locale="ko" onOpenPal={() => undefined} pair={pair} selectedParentId="penking" />);
  const partnerList = renderToStaticMarkup(<BreedingCombinationList
    labelledBy="partner-list-title"
    locale="ko"
    onOpenPal={() => undefined}
    pairs={[pair]}
    selectedParentId="penking"
    total={287}
    variant="partner-results"
  />);
  const reverseList = renderToStaticMarkup(<BreedingCombinationList
    labelledBy="reverse-list-title"
    locale="ja"
    onOpenPal={() => undefined}
    pairs={[pair]}
    total={1}
    variant="reverse-results"
  />);
  const target = renderToStaticMarkup(<ReverseBreedingTargetSummary
    child={pair.child}
    loadedCount={12}
    locale="ko"
    onOpenPal={() => undefined}
    pagination={{ page: 2, pageSize: 12, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true }}
  />);
  const alternative = renderToStaticMarkup(<BreedingGenderAlternativeCard locale="ja" onApply={() => undefined} onOpenPal={() => undefined} pair={pair} />);
  const status = renderToStaticMarkup(<BreedingRequestStatus message="결과 1개" />);
  const breedingPageSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldBreedingPage.tsx", import.meta.url),
    "utf8",
  );
  const breedingCss = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );

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
  assert.doesNotMatch(reverse, /계산기에 넣기/u);
  assert.match(partner, /data-testid="breeding-partner-pair"/u);
  assert.match(partner, /펭킹[\s\S]*불무사[\s\S]*실키누/u);
  assert.doesNotMatch(partner, /계산기에 넣기/u);
  assert.match(partnerList, /role="table"/u);
  assert.match(partnerList, /aria-rowcount="288"/u);
  assert.match(partnerList, /가능한 조합 287개/u);
  assert.match(partnerList, /현재 1\/287개 표시/u);
  assert.match(partnerList, /선택한 부모[\s\S]*상대 부모[\s\S]*결과 Pal/u);
  assert.match(reverseList, /親パル1[\s\S]*親パル2[\s\S]*配合条件/u);
  assert.doesNotMatch(reverseList, /シルキーヌ/u);
  assert.match(target, /data-testid="breeding-target-summary"/u);
  assert.match(target, /실키누/u);
  assert.match(target, /aria-label="목표 Pal 상세 보기: 실키누"/u);
  assert.match(target, /총 25개 조합/u);
  assert.match(target, /12\/25개 조합 표시/u);
  assert.match(alternative, /この条件を適用/u);
  assert.match(alternative, /aria-label="この条件を適用: シルキーヌ, オス \/ メス"/u);
  assert.match(status, /role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/u);
  assert.match(breedingPageSource, /data-testid="breeding-partner-scroll"[\s\S]*<PalworldAutoLoadControl/u);
  assert.match(breedingPageSource, /data-testid="breeding-reverse-scroll"[\s\S]*<PalworldAutoLoadControl/u);
  assert.match(
    breedingPageSource,
    /className="yoro-u-sr-only"[\s\S]*?id="palworld-breeding-partner-list-title"/u,
  );
  assert.doesNotMatch(breedingPageSource, /text\.partnerPairSuggestionsDescription/u);
  assert.doesNotMatch(
    breedingPageSource,
    /className="palworld-section-title"><h2>\{text\.breedingResult\}/u,
  );
  assert.match(
    breedingCss,
    /\.palworld-breeding-combination-scroll\s*\{[\s\S]*?block-size:\s*clamp\([^;]+;[\s\S]*?overflow-y:\s*auto;/u,
  );
  assert.match(
    breedingCss,
    /\.palworld-breeding-result > \.palworld-section-title\s*\{[\s\S]*?padding-block-start:\s*var\(--yoro-space-4\);/u,
  );
  assert.match(
    breedingCss,
    /\.palworld-breeding-combination-copy > strong\s*\{[\s\S]*?color:\s*var\(--yoro-color-text-strong\);/u,
  );
  assert.match(
    breedingCss,
    /\.palworld-breeding-combination-scroll \.palworld-breeding-combination-header\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?inset-block-start:\s*0;[\s\S]*?border-block-end:\s*thin solid var\(--yoro-color-border-strong\);/u,
  );
  assert.equal(palworldI18n.ko.partnerPairSuggestions, "선택한 부모의 교배 조합");
  assert.equal(palworldI18n.ja.partnerPairSuggestions, "選択した親パルの配合組み合わせ");
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
  assert.match(korean, /data-ko="원문 없음"/u);
  assert.match(japanese, /元データに情報がありません/u);
  assert.match(japanese, /data-ja="原文なし"/u);
  assert.doesNotMatch(korean, /영문 원문|번역 검수 중/u);
});

test("Pal 상세 액티브 스킬은 영문 fallback을 숨기고 현지어 안내와 전투 수치를 유지한다", () => {
  const fallbackSkill = {
    id: "active-absolute-frost",
    type: "active" as const,
    nameEn: "Absolute Frost",
    descriptionEn: "Throws icicles in a wide area from under the enemy's feet.",
    element: "ice" as const,
    power: 700,
    cooldownSeconds: 30,
    unlockLevel: 50,
    localization: {
      sourceLanguage: "en" as const,
      ko: "source_language_fallback" as const,
      ja: "source_language_fallback" as const,
    },
    translation: {
      name: {
        ko: "source_language_fallback" as const,
        ja: "source_language_fallback" as const,
      },
      description: {
        ko: "source_language_fallback" as const,
        ja: "source_language_fallback" as const,
      },
    },
  };
  const korean = renderToStaticMarkup(
    <PalworldActiveSkillDetail index={0} locale="ko" skill={fallbackSkill} />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldActiveSkillDetail index={0} locale="ja" skill={fallbackSkill} />,
  );

  assert.doesNotMatch(korean, /Absolute Frost|Throws icicles|영문 원문/u);
  assert.doesNotMatch(japanese, /Absolute Frost|Throws icicles|英語原文/u);
  assert.match(korean, /액티브 스킬 1/u);
  assert.match(korean, /공식 한국어 스킬 설명을 확인할 수 없습니다/u);
  assert.match(japanese, /アクティブスキル 1/u);
  assert.match(japanese, /公式の日本語スキル説明を確認できません/u);
  assert.match(korean, /위력 700/u);
  assert.match(korean, /재사용 시간 30초/u);
  assert.match(korean, /해금 레벨 50/u);
  assert.match(korean, />얼음</u);
  assert.match(japanese, />氷</u);
});

test("Pal 상세 액티브 스킬은 공식 source_provided 이름과 설명을 그대로 표시한다", () => {
  const officialSkill = {
    id: "active-aqua-jet",
    type: "active" as const,
    nameKo: "워터 제트",
    nameJa: "ウォータージェット",
    nameEn: "Aqua Jet",
    descriptionKo: "고속 물줄기를 발사한다.",
    descriptionJa: "高速の水流を放つ。",
    descriptionEn: "Hurls a high speed ball of water at an enemy.",
    element: "water" as const,
    power: 40,
    cooldownSeconds: 2,
    translation: {
      name: { ko: "source_provided" as const, ja: "source_provided" as const },
      description: { ko: "source_provided" as const, ja: "source_provided" as const },
    },
  };
  const korean = renderToStaticMarkup(
    <PalworldActiveSkillDetail index={0} locale="ko" skill={officialSkill} />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldActiveSkillDetail index={0} locale="ja" skill={officialSkill} />,
  );

  assert.match(korean, /워터 제트/u);
  assert.match(korean, /고속 물줄기를 발사한다/u);
  assert.match(japanese, /ウォータージェット/u);
  assert.match(japanese, /高速の水流を放つ/u);
  assert.doesNotMatch(korean, /Aqua Jet|Hurls a high speed ball/u);
  assert.doesNotMatch(japanese, /Aqua Jet|Hurls a high speed ball/u);
});

test("Xenolord Pal 상세는 공식 KO·JA 설명이 없을 때 영문 대신 현지어 원본 없음 상태를 표시한다", () => {
  const xenolordDescription = {
    descriptionEn: "It came from beyond the stars to bring ruin to this world.",
    translation: {
      description: {
        ko: "source_language_fallback" as const,
        ja: "source_language_fallback" as const,
      },
    },
  };
  const korean = renderToStaticMarkup(
    <PalworldPalDescription detail={xenolordDescription} locale="ko" />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldPalDescription detail={xenolordDescription} locale="ja" />,
  );

  assert.doesNotMatch(korean, /It came from beyond the stars|영문 원문/u);
  assert.doesNotMatch(japanese, /It came from beyond the stars|英語原文/u);
  assert.match(korean, /원본 데이터에 정보가 없습니다/u);
  assert.match(korean, /data-translation-status="missing_source"/u);
  assert.match(japanese, /元データに情報がありません/u);
  assert.match(japanese, /data-translation-status="missing_source"/u);
});

test("Pal 상세는 공식 source_provided KO·JA 설명을 영어로 대체하지 않는다", () => {
  const officialDescription = {
    descriptionKo: "별에서 온 초월적인 Pal이다.",
    descriptionJa: "星から来た超越的なパル。",
    descriptionEn: "A transcendent Pal from the stars.",
    translation: {
      description: {
        ko: "source_provided" as const,
        ja: "source_provided" as const,
      },
    },
  };
  const korean = renderToStaticMarkup(
    <PalworldPalDescription detail={officialDescription} locale="ko" />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldPalDescription detail={officialDescription} locale="ja" />,
  );

  assert.match(korean, /별에서 온 초월적인 Pal이다/u);
  assert.match(japanese, /星から来た超越的なパル/u);
  assert.doesNotMatch(korean, /A transcendent Pal from the stars|원문 없음/u);
  assert.doesNotMatch(japanese, /A transcendent Pal from the stars|原文なし/u);
});

test("스킬 카드 설명은 한 줄 말줄임하고 상세는 전체 설명을 유지한다", () => {
  const css = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  const oneLineRule = css.match(
    /\.palworld-skill-description\.palworld-localized-copy\s*\{(?<body>[^}]+)\}/u,
  )?.groups?.body;
  assert.ok(oneLineRule);
  assert.match(oneLineRule, /overflow:\s*hidden;/u);
  assert.match(oneLineRule, /text-overflow:\s*ellipsis;/u);
  assert.match(oneLineRule, /white-space:\s*nowrap;/u);

  const detail: PalworldSkillDetail = {
    id: "active-long-description",
    type: "active",
    nameKo: "긴 설명 스킬",
    nameJa: "長い説明のスキル",
    nameEn: "Long Description Skill",
    descriptionKo: "첫 문장 뒤에도 상세 화면에서 계속 읽을 수 있는 전체 설명입니다.",
    descriptionJa: "最初の文の後も詳細画面で読める完全な説明です。",
    descriptionEn: "The complete description remains available in the detail view.",
    relatedPalCount: 0,
    relatedPals: [],
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_provided", ja: "source_provided" },
    },
    metadata: {
      gameVersion: "1.0.1",
      sourceName: "공식 게임 locale",
      sourceUrl: "https://example.com/palworld-skills",
      sourceRevision: "translation-r1",
      extractedAt: "2026-07-22T00:00:00.000Z",
      verifiedAt: "2026-07-22T00:00:00.000Z",
      license: "operator_reference_use",
    },
  };
  const detailHtml = renderToStaticMarkup(
    <PalworldSkillDetailView detail={detail} locale="ko" onOpenPal={() => undefined} />,
  );
  assert.match(detailHtml, /첫 문장 뒤에도 상세 화면에서 계속 읽을 수 있는 전체 설명입니다/u);
  assert.doesNotMatch(detailHtml, /palworld-skill-description/u);
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
      { type: "mining" as const, level: 3 },
    ]
  };
  const korean = renderToStaticMarkup(<PalCard locale="ko" pal={pal} onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalCard locale="ja" pal={pal} onOpen={() => undefined} />);
  const twoWorkKorean = renderToStaticMarkup(
    <PalCard
      locale="ko"
      onOpen={() => undefined}
      pal={{ ...pal, workSuitabilities: pal.workSuitabilities.slice(0, 2) }}
    />,
  );
  const cardCss = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  assert.match(korean, /class="yoro-card palworld-entity-card palworld-pal-card"/u);
  assert.match(korean, /class="palworld-pal-card-main"[\s\S]*class="palworld-pal-card-media"[\s\S]*class="palworld-pal-card-image-frame"[\s\S]*class="yoro-card__content palworld-pal-card-content"/u);
  assert.match(korean, new RegExp(`src="${imageUrl.replaceAll("/", "\\/")}" alt="도로롱"`));
  assert.match(korean, /class="palworld-card-work-list has-overflow"[\s\S]*role="list"/u);
  assert.match(twoWorkKorean, /class="palworld-card-work-list"[\s\S]*role="list"/u);
  assert.doesNotMatch(cardCss, /\.palworld-card-work-list\.has-many/u);
  assert.match(
    cardCss,
    /\.palworld-card-work-list\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?\}/u,
  );
  assert.ok(korean.indexOf("palworld-pal-card-main") < korean.indexOf("palworld-card-work-list"));
  assert.equal((korean.match(/role="listitem"/gu) ?? []).length, 3);
  assert.equal((korean.match(/palworld-work-suitability-badge is-compact/gu) ?? []).length, 2);
  assert.equal((korean.match(/palworld-work-suitability-icon is-source-image/gu) ?? []).length, 2);
  assert.equal((korean.match(/palworld-work-suitability-label yoro-u-sr-only/gu) ?? []).length, 2);
  assert.match(korean, new RegExp(`src="${workSuitabilityIconUrl("handiwork")?.replaceAll("/", "\\/")}"`));
  assert.match(korean, new RegExp(`src="${workSuitabilityIconUrl("transporting")?.replaceAll("/", "\\/")}"`));
  assert.doesNotMatch(korean, new RegExp(`src="${workSuitabilityIconUrl("farming")?.replaceAll("/", "\\/")}"`));
  assert.doesNotMatch(korean, /<svg/u);
  assert.match(korean, /data-work-type="handiwork"[\s\S]*aria-describedby="[^"]+"[\s\S]*Lv\.1/u);
  assert.match(korean, /class="palworld-work-suitability-tooltip">수작업: Lv\.1/u);
  assert.match(korean, /data-work-type="transporting"[\s\S]*Lv\.2/u);
  assert.doesNotMatch(korean, /data-work-type="farming"/u);
  assert.doesNotMatch(korean, /data-work-type="mining"/u);
  assert.match(korean, /class="palworld-card-work-more"[^>]+data-ko="그 외 작업 적성 2개"[^>]+role="listitem"[^>]*>\.\.\.<\/span>/u);
  assert.match(korean, /<button[^>]+aria-haspopup="dialog"[^>]+class="yoro-button palworld-card-open-action"/u);
  assert.doesNotMatch(korean, /<article[^>]+role="button"/u);
  assert.match(japanese, /alt="モコロン"/);
  assert.match(japanese, /class="palworld-work-suitability-tooltip">手作業: Lv\.1/u);
  assert.match(japanese, /aria-label="ほかの作業適性 2件"/u);
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
  assert.match(
    css,
    /@media \(min-width:\s*48\.001rem\) and \(max-width:\s*63\.999rem\)[\s\S]*?\.palworld-header-layout > \.public-header-product-cluster\s*\{[\s\S]*?grid-column:\s*1\s*!important;[\s\S]*?\.palworld-header-layout > \.public-header-tools\s*\{[\s\S]*?grid-column:\s*2\s*!important;[\s\S]*?\.palworld-header-layout > \.palworld-secondary-row\s*\{[\s\S]*?grid-row:\s*2\s*!important;[\s\S]*?\.palworld-header-layout > \.palworld-search-form\s*\{[\s\S]*?grid-row:\s*3\s*!important;/u,
  );
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
  const mainMapImage = PALWORLD_MAP_IMAGES.main;
  const treeMapImage = PALWORLD_MAP_IMAGES.tree;
  assert.ok(mapUrl);
  assert.ok(mainMapImage);
  assert.ok(treeMapImage);
  assert.equal(mainMapImage.imageUrl, mapUrl);
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
  const treeOutputBytes = readFileSync(
    new URL(`../public${treeMapImage.imageUrl}`, import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(treeOutputBytes).digest("hex"),
    treeMapImage.imageUrl.split("/").at(-1)?.replace(".webp", ""),
  );
  assert.equal(treeMapImage.width, 4096);
  assert.equal(treeMapImage.height, 4096);

  const korean = renderToStaticMarkup(<PalworldMapPage locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldMapPage locale="ja" />);
  assert.match(korean, /Palworld 월드 지도/u);
  assert.match(
    korean,
    /alt="검증된 필드 보스, 야생 스폰, 이동 및 수집 위치가 표시된 Palworld 월드 지도"/u
  );
  assert.doesNotMatch(korean, /pyPalworldAPI|>1\.0\.1</u);
  assert.match(korean, /aria-label="지도 확대"/u);
  assert.match(korean, /class="[^"]*palworld-map-control is-zoom-in[^"]*"/u);
  assert.match(korean, /class="[^"]*palworld-map-control is-zoom-out[^"]*"/u);
  assert.match(korean, /class="palworld-map-zoom-output"/u);
  assert.match(korean, /class="[^"]*palworld-map-control is-zoom-reset[^"]*"/u);
  assert.match(korean, /aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight \+ - Home"/u);
  assert.match(
    korean,
    /class="palworld-map-stage palworld-map-stage-layout-zoom"[^>]*data-testid="palworld-map-stage"/u,
  );
  assert.match(korean, /class="[^"]*palworld-map-filter-panel/u);
  assert.match(korean, /data-testid="palworld-map-pal-picker"/u);
  assert.match(korean, /class="[^"]*palworld-map-mobile-filter-trigger/u);
  assert.match(korean, />필터 1개</u);
  assert.match(korean, /role="tablist"/u);
  assert.match(korean, /팰파고스섬/u);
  assert.match(korean, /세계수/u);
  assert.match(korean, /이동·장소/u);
  assert.match(korean, /빠른 이동 지점/u);
  assert.match(korean, /수집품/u);
  assert.match(korean, /쿠룰리스 상/u);
  assert.match(korean, /도로롱 상/u);
  assert.match(korean, /펭키 상/u);
  assert.match(korean, /크로꽁 상/u);
  assert.match(korean, /초원 알/u);
  assert.match(korean, /천락 알/u);
  assert.match(korean, /광물·광석/u);
  assert.match(korean, /밤별 모래/u);
  assert.match(korean, /팰지움 파편/u);
  assert.match(korean, /금속 광석/u);
  assert.match(korean, /팰키사이트/u);
  assert.match(korean, /data-layer="fast-travel"[\s\S]*<input disabled=""/u);
  assert.equal(
    (korean.match(/class="palworld-map-filter-layer-icon"/gu) ?? []).length,
    39,
  );
  assert.match(
    korean,
    /data-layer="fast-travel"[\s\S]*src="\/images\/palworld\/1\.0\.1\/map-icons\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="egg-grass"[\s\S]*?src="\/images\/palworld\/1\.0\.1\/map-icons\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="egg-grass"[\s\S]*?<img[^>]*loading="eager"[^>]*src="\/images\/palworld\/1\.0\.1\/map-icons\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="statue-lifmunk"[\s\S]*?src="\/images\/palworld\/1\.0\.1\/map-icons\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="resource-copper-ore"[\s\S]*?src="\/images\/palworld\/1\.0\.1\/items\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="resource-stone"[\s\S]*?src="\/images\/palworld\/1\.0\.1\/items\/[a-f0-9]{64}\.webp"/u,
  );
  assert.match(
    korean,
    /data-layer="resource-iron-ore"[\s\S]*?palworld-map-filter-layer-icon-fallback[^>]*>◆</u,
  );
  assert.doesNotMatch(
    korean,
    /data-layer="statue-lifmunk"[\s\S]*?src="\/images\/palworld\/1\.0\.1\/pals\//u,
  );
  assert.doesNotMatch(korean, /현재 화면의 위치/u);
  assert.doesNotMatch(korean, /현재 게시 릴리스에서 검증된/u);
  assert.doesNotMatch(korean, /휠·핀치/u);
  assert.doesNotMatch(korean, /게임 월드에서 검증된 위치를 표시합니다/u);
  assert.match(japanese, /Palworld ワールドマップ/u);
  assert.match(japanese, />フィルター 1件</u);
  assert.match(japanese, /移動・場所/u);
  assert.match(japanese, /収集品/u);
  assert.match(japanese, /鉱物・鉱石/u);
  assert.match(japanese, /金属鉱石/u);
  assert.match(japanese, /パルキサイト/u);
  assert.match(japanese, /クルリス像/u);
  assert.match(japanese, /モコロン像/u);
  assert.match(
    japanese,
    /検証済みのフィールドボス、野生スポーン、移動・収集地点が表示されたPalworldワールドマップ/u
  );
  assert.doesNotMatch(japanese, /現在公開中のリリースで検証済み/u);
  assert.doesNotMatch(japanese, /ホイール・ピンチ/u);
  assert.doesNotMatch(japanese, /ゲームワールドで検証済みの位置を表示します/u);

  const css = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  assert.match(
    css,
    /\.palworld-map-filter-content\[hidden\],\s*\.palworld-map-filter-group > ul\[hidden\]\s*\{[\s\S]*?display:\s*none/u,
  );
  assert.match(
    css,
    /@media \(min-width:\s*48\.001rem\)[\s\S]*?\.palworld-map-workspace\s*\{[\s\S]*?align-items:\s*start;/u,
  );
  assert.match(
    css,
    /\.palworld-map-desktop-filter \.palworld-map-filter-content\s*\{[\s\S]*?block-size:\s*auto;[\s\S]*?max-block-size:\s*calc\(100dvh/u,
  );
  const layoutZoomRule = css.match(
    /\.palworld-map-stage-layout-zoom\s*\{[\s\S]*?\n\}/u,
  )?.[0] ?? "";
  assert.match(
    layoutZoomRule,
    /inline-size:\s*var\(--palworld-map-layout-width,\s*100%\)/u,
  );
  assert.doesNotMatch(layoutZoomRule, /\bscale\(/u);
});

test("월드 지도 필터와 마커 상세는 검증된 레이어만 선택하고 키보드 닫기를 제공한다", () => {
  const filter = renderToStaticMarkup(
    <PalworldMapFilterPanel
      collapsed={false}
      copy={{
        all: { ko: "전체", ja: "すべて" },
        hide: { ko: "필터 숨기기", ja: "フィルターを隠す" },
        reset: { ko: "초기화", ja: "リセット" },
        show: { ko: "필터 열기", ja: "フィルターを開く" },
        title: { ko: "지도 필터", ja: "マップフィルター" },
      }}
      groups={[{
        id: "pal",
        label: { ko: "Pal 위치", ja: "パルの位置" },
        layers: [{
          id: "boss",
          iconFallback: "◆",
          label: { ko: "필드 보스", ja: "フィールドボス" },
          selected: true,
          state: "ready",
          statusLabel: { ko: "사용 가능", ja: "利用可能" },
        }, {
          id: "spawn",
          iconFallback: "●",
          label: { ko: "일반 야생 스폰", ja: "通常の野生スポーン" },
          selected: false,
          state: "data_unavailable",
          statusLabel: { ko: "준비되지 않음", ja: "準備中" },
        }],
      }]}
      locale="ko"
      onCollapsedChange={() => undefined}
      onGroupLayerChange={() => undefined}
      onLayerChange={() => undefined}
      onReset={() => undefined}
    />,
  );
  const popover = renderToStaticMarkup(
    <PalworldMapMarkerPopover
      closeLabel={{ ko: "위치 정보 닫기", ja: "位置情報を閉じる" }}
      kindLabel={{ ko: "필드 보스", ja: "フィールドボス" }}
      locale="ko"
      onClose={() => undefined}
      title={{ ko: "아누비스", ja: "アヌビス" }}
    />,
  );

  assert.match(filter, /data-layer="boss"[\s\S]*type="checkbox" checked=""/u);
  assert.match(filter, /palworld-map-filter-layer-icon-fallback[^>]*>◆</u);
  assert.doesNotMatch(filter, /사용 가능|利用可能/u);
  assert.match(filter, /data-layer="spawn"[\s\S]*<input disabled=""[^>]*type="checkbox"/u);
  assert.match(filter, /준비되지 않음/u);
  const filterCss = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  assert.match(
    filterCss,
    /\.palworld-map-filter-layer-copy strong\s*\{[\s\S]*?font-size:\s*var\(--yoro-font-size-sm\);[\s\S]*?-webkit-line-clamp:\s*2;/u,
  );
  assert.match(popover, /role="dialog"/u);
  assert.match(popover, /aria-modal="false"/u);
  assert.match(popover, /aria-label="위치 정보 닫기"/u);
  assert.match(popover, />아누비스</u);
});

test("지도 필터는 검증된 게임 WebP만 활성화하고 동상·지역 알 subtype을 완전하게 제공한다", () => {
  const resourceIconIds = [
    "resource-coal",
    "resource-copper-ore",
    "resource-night-stone",
    "resource-pal-crystal",
    "resource-quartz",
    "resource-sky-island-ore",
    "resource-stone",
    "resource-sulfur",
    "resource-world-tree-ore",
  ] as const;
  const ids = [
    "ancient-ruin",
    "boss",
    "dungeon",
    "fast-travel",
    "journal",
    "npc",
    "resource",
    ...resourceIconIds,
    "skill-fruit",
    "spawn",
    "treasure",
    ...PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.filter((id) =>
      !id.startsWith("resource-")
    ),
  ] as const;
  assert.deepEqual(
    Object.keys(PALWORLD_MAP_LAYER_ICONS).sort(),
    [...ids].sort(),
  );
  assert.equal(PALWORLD_MAP_LAYER_ICONS["resource-iron-ore"], undefined);

  const resourceSources = new Map(
    generatedMapLayerIcons.entries.map((entry) => [
      entry.id,
      entry.sourceReference,
    ]),
  );
  assert.deepEqual(
    Object.fromEntries(resourceIconIds.map((id) => [id, resourceSources.get(id)])),
    {
      "resource-coal": "Coal",
      "resource-copper-ore": "CopperOre",
      "resource-night-stone": "NightStone",
      "resource-pal-crystal": "Pal_crystal_S",
      "resource-quartz": "Quartz",
      "resource-sky-island-ore": "SkyIslandOre",
      "resource-stone": "Stone",
      "resource-sulfur": "Sulfur",
      "resource-world-tree-ore": "WorldTreeOre",
    },
  );

  for (const id of ids) {
    const asset = PALWORLD_MAP_LAYER_ICONS[id];
    assert.ok(asset);
    assert.equal(isLocalPalworldMapLayerIconUrl(asset.imageUrl), true);
    const bytes = readFileSync(new URL(`../public${asset.imageUrl}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.imageUrl.split("/").at(-1)?.replace(".webp", ""),
    );
  }

  assert.equal(isLocalPalworldMapLayerIconUrl("https://example.com/icon.webp"), false);
  assert.equal(
    isLocalPalworldMapLayerIconUrl(
      `/images/palworld/1.0.1/map-icons/${"a".repeat(64)}.png`,
    ),
    false,
  );
});

test("월드 지도 이동과 기준점 확대는 지도 경계를 벗어나지 않는다", () => {
  assert.equal(clampPalworldMapView, clampSharedPalworldMapView);
  assert.equal(zoomPalworldMapViewAt, zoomSharedPalworldMapViewAt);
  assert.equal(focusPalworldMapViewAt, focusSharedPalworldMapViewAt);
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

test("월드 지도 추가 위치 마커는 상세 연결 상태와 최소 터치 영역을 제공한다", () => {
  const labels = {
    "fast-travel": { ko: "빠른 이동", ja: "ファストトラベル" },
    dungeon: { ko: "던전", ja: "ダンジョン" },
    egg: { ko: "알", ja: "タマゴ" },
    lifmunk: { ko: "쿠룰리스 석상", ja: "クルリス像" },
    "skill-fruit": { ko: "스킬 열매", ja: "スキルフルーツ" },
    journal: { ko: "수기", ja: "手記" },
  } as const;
  const html = renderToStaticMarkup(
    <PalworldMapLocationLayer
      clusterLabel={(count) => `${count}개 위치`}
      iconAssets={{
        "egg-grass": {
          imageUrl: `/images/palworld/1.0.1/map-icons/${"a".repeat(64)}.webp`,
          width: 256,
          height: 256,
        },
      }}
      labels={labels}
      locale="ko"
      locations={[{
        id: "egg-001",
        category: "egg",
        subtype: "grass-main",
        normalizedX: 0.25,
        normalizedY: 0.75,
      }]}
      onSelectCluster={() => undefined}
      onSelectLocation={() => undefined}
      popoverId="map-location-popover"
      selectedLocationId="egg-001"
      zoom={2}
    />,
  );
  const css = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  const markerRule = css.match(
    /\.palworld-map-location-marker\s*\{(?<body>[^}]+)\}/u,
  )?.groups?.body;

  assert.match(html, /aria-controls="map-location-popover"/u);
  assert.match(html, /aria-expanded="true"/u);
  assert.match(html, /aria-label="알"/u);
  assert.match(
    html,
    /src="\/images\/palworld\/1\.0\.1\/map-icons\/a{64}\.webp"/u,
  );
  assert.match(html, /--palworld-map-marker-inverse-scale:0\.5/u);
  assert.match(html, /alt=""[^>]*aria-hidden="true"/u);
  assert.ok(markerRule);
  assert.match(
    markerRule,
    /min-inline-size:\s*var\(--yoro-size-touch-target\);/u,
  );
  assert.match(
    markerRule,
    /min-block-size:\s*var\(--yoro-size-touch-target\);/u,
  );
});

test("월드 지도 subtype cluster는 검증된 실제 아이콘과 위치 수를 함께 표시한다", () => {
  const labels = {
    "fast-travel": { ko: "빠른 이동", ja: "ファストトラベル" },
    dungeon: { ko: "던전", ja: "ダンジョン" },
    egg: { ko: "알", ja: "タマゴ" },
    lifmunk: { ko: "석상", ja: "像" },
    "skill-fruit": { ko: "스킬 열매", ja: "スキルフルーツ" },
    journal: { ko: "수기", ja: "手記" },
  } as const;
  const subtypeLabels = {
    "statue-lifmunk": { ko: "쿠룰리스 상", ja: "クルリス像" },
  } as const;
  const imageUrl = `/images/palworld/1.0.1/map-icons/${"b".repeat(64)}.webp`;
  const html = renderToStaticMarkup(
    <PalworldMapLocationLayer
      clusterLabel={(count) => `${count}개 위치`}
      iconAssets={{
        "statue-lifmunk": {
          imageUrl,
          width: 256,
          height: 256,
        },
      }}
      labels={labels}
      locale="ko"
      locations={[{
        id: "statue-001",
        category: "lifmunk",
        subtype: "statue-lifmunk",
        normalizedX: 0.25,
        normalizedY: 0.75,
      }, {
        id: "statue-002",
        category: "lifmunk",
        subtype: "statue-lifmunk",
        normalizedX: 0.251,
        normalizedY: 0.751,
      }]}
      onSelectCluster={() => undefined}
      onSelectLocation={() => undefined}
      subtypeLabels={subtypeLabels}
      zoom={1}
    />,
  );

  assert.match(html, /aria-label="쿠룰리스 상, 2개 위치"/u);
  assert.match(html, new RegExp(`src="${imageUrl}"`, "u"));
  assert.match(html, /<strong aria-hidden="true">2<\/strong>/u);
  assert.equal((html.match(/palworld-map-location-marker/gu) ?? []).length, 1);
});

test("Pal 상세 위치는 일반 스폰과 필드 보스를 분리 조회하고 한국어·일본어 i18n을 연결한다", () => {
  assert.equal(PALWORLD_PAL_DETAIL_INITIAL_ZOOM, 1.5);
  assert.equal(PALWORLD_PAL_DETAIL_MIN_SPAWN_OPACITY, 0.96);
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
      onPeriodChange={() => undefined}
      palId="anubis"
      period="night"
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
  assert.match(korean, />전체 지도에서 보기</u);
  assert.match(japanese, />出現位置</u);
  assert.match(japanese, /aria-label="このパルの出現位置を読み込んでいます。"/u);
  assert.match(japanese, />全体マップで見る</u);
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
  const css = readFileSync(
    new URL("../src/styles/pages/public-palworld/14-palworld.css", import.meta.url),
    "utf8",
  );
  assert.match(componentSource, /getPalworldMapMarkers\("main", controller\.signal\)/u);
  assert.match(componentSource, /getPalworldPalSpawns\(palId, "main", controller\.signal\)/u);
  assert.match(componentSource, /filterPalworldBossMarkers\(response\.markers, palId\)/u);
  assert.match(componentSource, /setBossRevision/u);
  assert.match(componentSource, /setSpawnRevision/u);
  assert.match(componentSource, /palWildSpawnLevelRange/u);
  assert.match(componentSource, /usePalworldMapViewport\(imageState === "ready"\)/u);
  assert.match(
    componentSource,
    /period === "all"[\s\S]*period === "day" \? point\.daytime : point\.nighttime/u,
  );
  assert.match(componentSource, /aria-pressed=\{period === value\}/u);
  assert.match(componentSource, /onClick=\{\(\) => onPeriodChange\(value\)\}/u);
  assert.match(componentSource, /<SpawnAreaLayer points=\{visibleSpawnPoints\} zoom=\{view\.zoom\}/u);
  assert.match(
    componentSource,
    /Math\.max\([\s\S]*PALWORLD_PAL_DETAIL_MIN_SPAWN_OPACITY[\s\S]*palworldSpawnPointOpacity/u,
  );
  assert.match(
    componentSource,
    /imageState !== "ready" \|\| !hasLocations[\s\S]*resetView\(\);[\s\S]*zoomAt\(PALWORLD_PAL_DETAIL_INITIAL_ZOOM\)/u,
  );
  assert.match(componentSource, /spawnSummary\(visibleSpawnPoints, locale\)/u);
  assert.match(componentSource, /data-testid="pal-detail-map-viewport"[\s\S]*role="region"/u);
  assert.match(
    componentSource,
    /aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight \+ - Home"/u,
  );
  assert.match(componentSource, /aria-label=\{text\.mapZoomOut\}/u);
  assert.match(componentSource, /aria-label=\{text\.mapZoomIn\}/u);
  assert.match(componentSource, /onClick=\{resetView\}/u);
  assert.match(componentSource, /onClick=\{\(\) => onOpenFullMap\(palId\)\}/u);
  assert.match(detailSource, /<PalworldPalLocationMap[\s\S]*onOpenFullMap=\{onOpenMap\}[\s\S]*palId=\{detail\.id\}/u);
  assert.match(detailSource, /onPeriodChange=\{onSpawnPeriodChange\}/u);
  assert.match(detailSource, /period=\{spawnPeriod\}/u);
  assert.match(
    css,
    /\.palworld-pal-location-loading,[\s\S]*?\.palworld-pal-location-preview\s*\{[\s\S]*?inline-size:\s*100%;[\s\S]*?justify-self:\s*center;/u,
  );
  assert.match(
    css,
    /\.palworld-pal-location-spawn-point\s*\{[\s\S]*?fill:\s*color-mix\(in srgb, var\(--palworld-sky\) 52%, var\(--yoro-color-text-on-dark\)\);[\s\S]*?stroke:\s*var\(--yoro-color-text-strong\);[\s\S]*?stroke-width:\s*0\.006;[\s\S]*?paint-order:\s*stroke fill;/u,
  );
  assert.match(
    css,
    /\.palworld-pal-location-legend-dot\s*\{[\s\S]*?border:\s*medium solid var\(--yoro-color-text-strong\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--palworld-sky\) 52%, var\(--yoro-color-text-on-dark\)\);/u,
  );
});

test("페이지 상단 소개 문구는 숨기고 Pal·도감 번호·레벨 표기는 한국어·일본어 i18n을 통해 제공한다", () => {
  assert.equal(palworldI18n.ko.palEntityLabel, "Pal");
  assert.equal(palworldI18n.ja.palEntityLabel, "パル");

  const sources = [
    ["PalworldHome.tsx", ["homeKicker", "description"]],
    ["PalworldStreamersPage.tsx", ["streamersKicker", "streamersDescription"]],
    ["PalworldPalsPage.tsx", ["palsKicker", "palsDescription"]],
    ["PalworldBreedingPage.tsx", ["breedingKicker", "breedingDescription"]],
    ["PalworldItemsPage.tsx", ["itemsKicker", "itemsDescription"]],
    ["PalworldSkillsPage.tsx", ["skillsKicker", "skillsDescription"]],
  ] as const;
  for (const [fileName, hiddenKeys] of sources) {
    const source = readFileSync(new URL(`../src/features/public-palworld/components/${fileName}`, import.meta.url), "utf8");
    assert.match(source, /yoro-u-sr-only/u, fileName);
    for (const key of hiddenKeys) {
      assert.doesNotMatch(source, new RegExp(`text\\.${key}(?![A-Za-z])`, "u"), fileName);
    }
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

test("Pal 카드·상세·도감 필터는 동일한 검증된 작업 적성 아이콘을 사용한다", () => {
  assert.deepEqual(generatedStaticAssets.workSource, {
    release: "1.0.1",
    candidateRelease: "candidate-1248184a4b527d94",
    sourceType: "operator_pak_export",
    sourceArchiveSha256: "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384",
    mappingSha256: "1867e2a6caf0efa9f852c6227cf80fa04fa1ab8d09b8281f415bc08c6e50db58",
    mappingStatus: "verified_colored_source_member",
    status: "operator_acknowledged",
    usageBasis: "operator_reference_use",
    rightsVerified: false,
  });
  const koreanWork = renderToStaticMarkup(<PalworldWorkSuitabilityBadge level={3} locale="ko" type="mining" />);
  const japaneseWork = renderToStaticMarkup(<PalworldWorkSuitabilityBadge level={4} locale="ja" type="handiwork" />);
  assert.match(koreanWork, /data-work-type="mining"/u);
  assert.match(koreanWork, /<img[^>]+alt=""[^>]+aria-hidden="true"[^>]+class="palworld-work-suitability-icon is-source-image"/u);
  assert.match(koreanWork, /\/images\/palworld\/1\.0\.1\/work\/[a-f0-9]{64}\.webp/u);
  assert.doesNotMatch(koreanWork, /<svg/u);
  assert.match(koreanWork, /class="palworld-work-suitability-label">채굴<\/span>/u);
  assert.match(koreanWork, /Lv\.3/u);
  assert.doesNotMatch(koreanWork, /https?:\/\//u);
  assert.doesNotMatch(japaneseWork, /title=/u);
  assert.match(japaneseWork, /class="palworld-work-suitability-label">手作業<\/span>/u);

  for (const type of PALWORLD_WORK_SUITABILITY_TYPES) {
    const imageUrl = workSuitabilityIconUrl(type) ?? "";
    assert.match(imageUrl, /^\/images\/palworld\/1\.0\.1\/work\/[a-f0-9]{64}\.webp$/u);
    const asset = readFileSync(
      new URL(`../public${imageUrl}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(asset).digest("hex"), imageUrl.slice(-69, -5));
  }
  const badgeSource = readFileSync(
    new URL("../src/features/public-palworld/components/PalworldWorkSuitabilityBadge.tsx", import.meta.url),
    "utf8"
  );
  assert.match(badgeSource, /onError=\{\(\) => setImageFailed\(true\)\}/u);
  assert.match(badgeSource, /const hasImage = iconUrl !== undefined && !imageFailed/u);
  assert.doesNotMatch(badgeSource, /WorkSuitabilityGlyph|<svg/u);
  const viteSource = readFileSync(
    new URL("../vite.config.ts", import.meta.url),
    "utf8"
  );
  assert.match(viteSource, /active-manifest\.json/u);
  assert.match(viteSource, /work-images-manifest\.json/u);
  assert.match(viteSource, /availability\?\.workImages !== "active"/u);
  assert.match(viteSource, /workManifestArtifacts\[0\]\?\.sha256 !== workManifestSha256/u);
  assert.match(viteSource, /workManifest\.mappingSha256 !== workMappingSha256/u);
  assert.match(viteSource, /activeWorkAssets[\s\S]*outputBytes[\s\S]*outputSha256/u);
  assert.match(viteSource, /images\/palworld\/work/u);
  assert.match(viteSource, /activeWorkRelease[\s\S]*"work"/u);

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

test("농축 원본이 없으면 선택한 별 단계와 관계없이 기본 능력치를 유지하고 locale별 상태를 표시한다", () => {
  const baseStats: PalworldPalStats = {
    hp: 100,
    attack: 80,
    defense: 70,
    moveSpeed: 500,
    stamina: 120,
  };
  const korean = renderToStaticMarkup(
    <PalworldPalCondensation
      baseStats={baseStats}
      hasPartnerSkill
      locale="ko"
      onStarsChange={() => undefined}
      profile={{ availability: "missing_source" }}
      stars={4}
    />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldPalCondensation
      baseStats={baseStats}
      hasPartnerSkill
      locale="ja"
      onStarsChange={() => undefined}
      profile={{ availability: "missing_source" }}
      stars={4}
    />,
  );

  assert.match(korean, /data-testid="pal-condensation"/u);
  assert.match(korean, /role="radiogroup"/u);
  assert.equal((korean.match(/role="radio"/gu) ?? []).length, 5);
  assert.match(korean, /aria-checked="true"[^>]*aria-label="농축 4★"/u);
  assert.equal(
    (korean.match(/검증된 농축 수치 원본이 없어 기본 능력치를 표시합니다\./gu) ?? []).length,
    1,
  );
  assert.match(korean, /data-stat="hp"[\s\S]*<strong>100<\/strong>/u);
  assert.doesNotMatch(korean, /data-changed="true"|캐릭터 랭크|파트너 스킬 랭크|100[\s\S]*→[\s\S]*117/u);

  assert.match(japanese, /aria-checked="true"[^>]*aria-label="濃縮 4★"/u);
  assert.equal(
    (japanese.match(/検証済みの濃縮数値の元データがないため、基本ステータスを表示します。/gu) ?? []).length,
    1,
  );
  assert.doesNotMatch(japanese, /キャラクターランク|パートナースキルランク/u);
});

test("검증된 농축 단계는 서버가 제공한 수치·작업 적성·Rank만 locale별로 표시한다", () => {
  const baseStats: PalworldPalStats = {
    hp: 100,
    attack: 80,
    defense: 70,
    moveSpeed: 500,
    stamina: 120,
  };
  const profile: PalworldPalCondensationProfile = {
    availability: "available",
    sourceRuleSha256: "a".repeat(64),
    stages: [
      {
        stars: 0,
        characterRank: 1,
        partnerSkillRank: 1,
        stats: [{ stat: "hp", baseValue: 100, value: 100 }],
        workSuitabilities: [{ type: "gathering", baseLevel: 8, level: 8 }],
      },
      {
        stars: 1,
        characterRank: 2,
        partnerSkillRank: 2,
        stats: [{ stat: "hp", baseValue: 100, value: 103 }],
        workSuitabilities: [{ type: "gathering", baseLevel: 8, level: 8 }],
      },
      {
        stars: 2,
        characterRank: 3,
        partnerSkillRank: 3,
        stats: [{ stat: "hp", baseValue: 100, value: 107 }],
        workSuitabilities: [{ type: "gathering", baseLevel: 8, level: 8 }],
      },
      {
        stars: 3,
        characterRank: 4,
        partnerSkillRank: 4,
        stats: [{ stat: "hp", baseValue: 100, value: 111 }],
        workSuitabilities: [{ type: "gathering", baseLevel: 8, level: 8 }],
      },
      {
        stars: 4,
        characterRank: 5,
        partnerSkillRank: 5,
        stats: [{ stat: "hp", baseValue: 100, value: 117 }],
        workSuitabilities: [{ type: "gathering", baseLevel: 8, level: 9 }],
      },
    ],
  };
  const korean = renderToStaticMarkup(
    <PalworldPalCondensation
      baseStats={baseStats}
      hasPartnerSkill
      locale="ko"
      onStarsChange={() => undefined}
      profile={profile}
      stars={4}
    />,
  );
  const japanese = renderToStaticMarkup(
    <PalworldPalCondensation
      baseStats={baseStats}
      hasPartnerSkill
      locale="ja"
      onStarsChange={() => undefined}
      profile={profile}
      stars={4}
    />,
  );

  assert.match(korean, /검증된 농축 규칙/u);
  assert.match(korean, /4★ · \+17%/u);
  assert.match(korean, /농축 적용 능력치/u);
  assert.match(korean, /캐릭터 랭크[\s\S]*5/u);
  assert.match(korean, /파트너 스킬 랭크[\s\S]*5/u);
  assert.match(korean, /data-changed="true"[^>]*data-stat="hp"/u);
  assert.match(korean, /aria-label="기본값 100, 농축 적용값 117"/u);
  assert.match(korean, /100[\s\S]*→[\s\S]*<strong>117<\/strong>/u);
  assert.match(korean, /채집[\s\S]*Lv\.8[\s\S]*→[\s\S]*Lv\.9/u);
  assert.doesNotMatch(korean, /103|107|111/u);

  assert.match(japanese, /検証済みの濃縮ルール/u);
  assert.match(japanese, /4★ · \+17%/u);
  assert.match(japanese, /濃縮適用ステータス/u);
  assert.match(japanese, /キャラクターランク[\s\S]*5/u);
  assert.match(japanese, /パートナースキルランク[\s\S]*5/u);
  assert.match(japanese, /aria-label="基本値 100, 濃縮適用値 117"/u);
  assert.match(japanese, /採集[\s\S]*Lv\.8[\s\S]*→[\s\S]*Lv\.9/u);
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
  assert.match(detailSource, /palworld-item-detail-media/u);
  assert.match(detailSource, /data-rarity-band=\{itemRarityBand\(detail\.rarity\)\}/u);
  assert.match(detailSource, /itemRarityLabel\(detail\.rarity, locale\)/u);
  assert.doesNotMatch(detailSource, /<section><h4[^>]+workSuitabilities/u);
  assert.match(readFileSync(new URL("PalworldSourceFooter.tsx", componentRoot), "utf8"), /palworldI18n\.(?:ko|ja)\.sourceNotice/u);
});
