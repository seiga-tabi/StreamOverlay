import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PalworldDomainCoverage } from "@streamops/shared";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalworldHome } from "../src/features/public-palworld/components/PalworldHome";
import { PalCard } from "../src/features/public-palworld/components/PalworldCards";
import { isLocalPalworldImageUrl, PalworldMedia } from "../src/features/public-palworld/components/PalworldMedia";
import { isLocalPalworldMapUrl, PALWORLD_WORLD_MAP_IMAGE_URL, PalworldMapPage } from "../src/features/public-palworld/components/PalworldMapPage";
import { PalworldDomainCoverageNotice } from "../src/features/public-palworld/components/PalworldCoverageNotice";
import { PalworldPalsPage } from "../src/features/public-palworld/components/PalworldPalsPage";
import { PalworldSourceFooter } from "../src/features/public-palworld/components/PalworldSourceFooter";
import { PalworldStreamersPage } from "../src/features/public-palworld/components/PalworldStreamersPage";

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

test("Palworld 2행 메뉴는 한국어·일본어 6개 순서와 스트리머 활성 상태를 유지한다", () => {
  const korean = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="streamers" searchContent={<div data-testid="header-search">검색</div>} />);
  const japanese = renderToStaticMarkup(<PalworldHeader locale="ja" onLocale={() => undefined} page="home" />);
  const map = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="map" searchContent={<div data-testid="header-search">검색</div>} />);
  assert.equal((korean.match(/<nav[^>]*data-testid="palworld-secondary-nav"[\s\S]*?<button/gu) ?? []).length > 0, true);
  assert.equal((korean.match(/data-ko="(?:홈|스트리머|Pal 도감|교배 조합|아이템|지도)"/gu) ?? []).length, 6);
  assert.match(korean, /홈[\s\S]*스트리머[\s\S]*Pal 도감[\s\S]*교배 조합[\s\S]*아이템[\s\S]*지도/u);
  assert.match(korean, /aria-current="page"[^>]*data-ko="스트리머"/u);
  assert.match(japanese, /ホーム[\s\S]*配信者[\s\S]*パル図鑑[\s\S]*配合組み合わせ[\s\S]*アイテム[\s\S]*マップ/u);
  assert.match(map, /aria-current="page"[^>]*data-ko="지도"/u);
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
  assert.match(japanese, /非公式パルワールドデータベース · データ・画像出典 <a[^>]+>Palworld<\/a> · <a[^>]+>Pocketpair<\/a>/u);
  assert.match(japanese, /data-ja="非公式パルワールドデータベース · データ・画像出典 Palworld · Pocketpair"/u);
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

test("아이템과 교배의 샘플 출처를 한국어·일본어 안내와 배지로 표시한다", () => {
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
  assert.match(korean, /Pal 1.0.1 전체 아이템 데이터가 아닙니다/);
  assert.match(korean, /StreamOverlay curated sample snapshot · sample-revision/);
  assert.match(japanese, /data-testid="palworld-breeding-coverage"/);
  assert.match(japanese, /data-ja="サンプル"/);
  assert.match(japanese, /パル1.0.1の全配合データではありません/);
  assert.match(unknown, /범위 확인 중/);
  assert.match(unknown, /전체 데이터로 표시하지 않습니다/);
});
