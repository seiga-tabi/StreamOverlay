# Minecraft 위키 카탈로그 임포트

## 공개 범위

- `GET /api/minecraft/items`
- `GET /api/minecraft/recipes`
- `GET /api/minecraft/enchants`

세 endpoint는 `q`, `page`, `limit`을 받고, recipes만 `type`을 추가로 받는다. unknown·중복 query와 범위 밖 pagination은 모두 거부한다. 정적 artifact를 읽지 못하거나 검증에 실패하면 일부 데이터 대신 전체 domain을 `data_unavailable`로 내보낸다.

## 원천과 권리 경계

- wrapper: `minecraft-data@3.111.0` exact version
- game version: Java `1.21.11`
- upstream: `https://github.com/PrismarineJS/minecraft-data`
- package metadata license: MIT
- source revision: `items.json`, `recipes.json`, `enchantments.json`의 파일명과 원문 bytes를 순서대로 SHA-256한 값

upstream README는 일부 과거 데이터의 wiki 계열 추출 이력을 별도로 경고한다. 따라서 YORO.gg artifact에는 canonical ID, 정수·boolean 수치와 recipe 구조만 넣는다. `displayName`, 설명문, 텍스처, 이미지, 외부 위키 본문은 임포트하지 않는다. Minecraft Wiki 문구를 복사하거나 번안하지 않는다.

공개 UI의 게임 텍스처는 artifact나 저장소에 복사하지 않는다. 대시보드가 `assets.mcasset.cloud`의 버전 고정 `1.21.11` 경로에서 직접 읽으며, canonical ID를 item → block 경로로만 변환한다. 외부 URL 입력은 받지 않고 CDN 장애·404는 자체 스와치로 닫힌다. 게임 텍스처의 권리는 Mojang·Microsoft에 있으며 비공식 서비스 고지를 항상 함께 표시한다.

## 번역 overlay

`apps/server/src/data/minecraft-translations.json`은 공식 게임 내 명칭을 별도로 검수한 뒤 추가하는 overlay다. 각 항목은 아래 필드만 허용한다.

```json
{
  "id": "diamond_sword",
  "ko": "검수된 한국어 공식 명칭",
  "ja": "검수된 일본어 공식 명칭",
  "source": "official_game",
  "verifiedAt": "2026-08-14T00:00:00.000Z"
}
```

`ko`와 `ja` 중 하나만 먼저 제공할 수 있지만 둘 다 비울 수 없다. overlay에 없는 locale은 canonical ID에서 만든 영문 label과 `source_language_fallback` 상태를 사용한다. generator는 unknown·중복 ID, 제어문자, 잘못된 시각과 source를 거부한다.

## 생성과 검증

생성 시각을 자동으로 넣지 않는다. 재현 가능한 canonical ISO 시각을 명시한다.

```bash
npm --workspace apps/server run generate:minecraft-catalog -- \
  --generated-at 2026-08-13T17:59:51.000Z
npm run build:shared
npm run build:server
node --test apps/server/test/minecraft-catalog.test.mjs apps/server/test/minecraft-api.test.mjs
```

현재 `minecraft-data`의 Java recipe domain은 crafting 구조만 제공한다. public schema의 `type`은 `crafting|smelting|brewing|smithing|stonecutting`을 강제하지만, metadata는 crafting만 `ready`, 나머지를 `not_provided_by_source`로 표시한다. 제련·양조·대장장이 작업·석재 절단 데이터를 추정해서 만들지 않는다.

`air` 결과와 count `0`으로 표현된 upstream special recipe sentinel 1건은 공개 조합법에서 제외한다. 이 제외 수가 달라지거나 source hash가 바뀌면 generator가 실패하므로, 패키지나 game version 갱신 시 원천 diff와 권리 범위를 다시 검수해야 한다.

생성 결과의 SHA-256도 `MinecraftCatalogService`에 고정되어 있다. 번역 overlay, package 또는 game version을 갱신해 artifact가 달라지면 generator 출력의 `artifactSha256`을 검수한 뒤 서비스의 기대값도 함께 갱신해야 하며, 불일치 상태에서는 운영 API가 fail-closed된다.

## 패치 노트 수집기

- Java 원천: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- 공식 Help Center 원천: `https://feedback.minecraft.net/api/v2/help_center/en-us/sections/{sectionId}/articles.json`
  - Release Changelogs: `360001186971`
  - Beta and Preview Information and Changelogs: `360001185332`
  - Snapshot Information and Changelogs: `360002267532`
- 수집 주기: 서버 기동 직후와 이후 6시간마다
- 재시도: timeout 10초, 일시 오류에 최대 3회 bounded retry
- 저장 위치: `${STREAMOPS_STATE_DIR}/minecraft-patch-notes/java.json`
- Bedrock 저장 위치: `${STREAMOPS_STATE_DIR}/minecraft-patch-notes/bedrock.json`
- 공개 API: `GET /api/minecraft/patch-notes?edition=java|bedrock&type=release|snapshot|preview&page=N`

Java의 버전·유형·`releaseTime` 단일 원본은 계속 piston-meta manifest다. Help Center의 Release·Snapshot article 제목에서 manifest version과 정확히 일치하는 것만 찾아 `officialUrl`을 버전별 공식 링크로 교체하고, 일치하지 않거나 Help Center가 실패하면 `https://www.minecraft.net/en-us/articles` 허브를 유지한다.

Bedrock은 Help Center의 Release Changelogs와 Beta and Preview Changelogs를 단일 원본으로 사용한다. 제목을 strict regex로 분류해 release·preview만 만들며 일치하지 않는 article은 제외한다. 두 Bedrock 섹션 중 하나라도 실패하면 새 snapshot을 만들지 않고 마지막 정상본을 유지하며, 정상본이 한 번도 없을 때만 `data_unavailable`이다.

Help Center 응답은 페이지당 8MiB, 섹션당 10페이지·1,000 article로 제한한다. URL은 고정 section ID로 직접 조립하므로 upstream의 `next_page`를 따라가지 않는다. JSON에 포함된 article 본문은 parsing 과정에서 사용하지 않고 snapshot·API·로그 어디에도 저장하거나 게재하지 않는다. 제목 불일치 로그도 원문 대신 제외 건수만 기록한다.

마지막 정상 snapshot은 원자적으로 저장하고 이후 수집 실패에도 계속 제공한다. Java piston-meta와 Help Center, Bedrock 수집 상태는 서로 격리되어 Help Center 장애가 Java API를 중단시키지 않는다.

사람이 검수한 한국어·일본어 요약은 `patch-note-curation.json`에서 edition·version 키 기반으로 관리한다. `title`과 `highlights`는 ko·ja를 동시에 제공해야 하며, 없는 버전에는 응답 필드 자체가 추가되지 않는다. 기계 번역이나 자동 요약은 사용하지 않는다.
