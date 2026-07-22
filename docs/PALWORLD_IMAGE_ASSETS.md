# Palworld 이미지 자산 정책

이 문서는 Palworld 1.0.1 도감 이미지의 권리 확인, 로컬 변환, manifest 검증, UI fallback과 배포 정책을 정의한다.

## 현재 상태: `blocked_by_license`

현재 고정 데이터 원본만으로는 287종 Pal 이미지의 재배포 권리를 확인할 수 없다. 따라서 초기 이미지 manifest는 다음 상태를 유지한다.

- 상태: `blocked_by_license`
- 명시적 Pal mapping: 287개(`blocked_by_license`)
- 승인되어 `ready`인 Pal mapping: 0개
- 고유 로컬 이미지: 0개
- fallback 대상: 287개
- 외부 hotlink: 0개

텍스트·수치 데이터 생성은 계속할 수 있지만, 권리 증빙 없이 게임 파일 이미지를 저장소나 배포 artifact에 추가하지 않는다. 이미지 수를 맞추기 위해 다른 Pal 이미지, 가짜 이미지 또는 출처 불명 이미지를 넣지 않는다.

## 판단 근거

고정 revision의 관련 자료에서 확인되는 범위는 다음과 같다.

- `Awy64/palworld-atlas-data`의 MIT 고지는 저장소의 소프트웨어와 관련 문서에 대한 조건이다. Pocketpair 원본 이미지 자산의 재배포 허가를 별도로 제공하지 않는다.
- `tylercamp/palcalc`의 MIT 고지도 PalCalc 소프트웨어와 관련 문서에 적용된다. 제3자가 소유한 게임 이미지까지 MIT로 재라이선스한다는 문구는 확인되지 않는다.
- PalCalc의 About 화면은 Pocket Pair가 Palworld 자산을 소유하며 일부 아이콘 출처가 `Paldb.cc`임을 별도로 표시한다. 이는 PalCalc 코드의 MIT 고지와 이미지 권리가 같지 않음을 보여 준다.
- PalCalc의 GenDB 처리 과정은 이미지를 게임 파일에서 export하는 구조임을 명시한다. 정상적으로 게임을 보유하고 추출할 수 있다는 사실은 웹 서비스가 그 파일을 재배포할 권리를 자동으로 부여하지 않는다.
- Pocketpair의 2차 창작 가이드라인은 팬이 만든 2차 창작물에 대한 조건을 다루지만, 게임에서 추출한 원본 Pal 이미지를 도감 데이터셋으로 재배포할 수 있다는 포괄적 라이선스로 해석하지 않는다.

따라서 저장소 MIT 라이선스, 게임 파일 접근 가능 여부 또는 다른 사이트의 사용 사례만으로 이미지 포함을 승인해서는 안 된다. Pocketpair, 실제 이미지 권리자 또는 명시적인 재배포 권한을 가진 제공자의 서면 조건이 필요하다.

## 승인 가능한 권리 증빙

이미지 source를 `ready`로 전환하려면 최소한 다음 내용을 사람이 검토할 수 있는 형태로 보관한다.

- 권리자 또는 권한 있는 제공자의 이름
- 허가 문서의 HTTPS URL과 고정 revision 또는 보존된 문서 checksum
- 이미지 원본과 허가 대상의 정확한 대응 관계
- 웹 서비스에서 복제·배포할 권리
- WebP 변환, 크기 조절과 metadata 제거 등 수정할 권리
- 상업적 또는 광고가 포함될 수 있는 서비스에서의 사용 가능 여부
- 필요한 attribution 문구와 표시 위치
- 허가 지역, 기간, 철회·갱신 조건
- 제3자 상표·초상·기타 권리에 대한 제한
- 검토자와 검토일

단순한 `free`, `official`, `MIT repository`, `fan use allowed` 표기만으로 승인하지 않는다. 권리 범위가 불명확하면 `blocked_by_license`를 유지한다.

## 이미지 manifest

`apps/server/data/palworld/1.0.1/images-manifest.json`은 exact key schema를 적용한다. 권장 최상위 구조는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "release": "1.0.1",
  "revision": "고정 image source revision",
  "status": "blocked_by_license",
  "rightsReview": {
    "status": "blocked_by_license",
    "reviewedAt": "release에 고정한 시각",
    "reasonCode": "REDISTRIBUTION_PERMISSION_NOT_VERIFIED",
    "evidenceUrls": ["고정 revision의 권리 검토 근거"]
  },
  "entries": ["287개 Pal별 blocked_by_license mapping"]
}
```

`status`는 `blocked_by_license`, `partial` 또는 `ready`만 허용한다. `blocked_by_license`에서도 fuzzy matching을 방지하고 권리 상태를 Pal별로 추적하기 위해 287개 entry를 유지하되, 모든 출력 파일·hash·크기·`imageUrl` 값은 `null`이어야 한다. `paldex.json`의 모든 Pal `imageUrl`도 생략한다.

승인된 각 entry는 다음 exact field를 갖는다.

- `palId`
- `sourceInternalId`
- `sourceName`
- `sourceUrl`
- `sourceRevision`
- `license`
- `retrievedAt`
- `originalSha256`
- `generatedSha256`
- `originalFileName`
- `outputFileName`
- `outputMime`
- `outputWidth`
- `outputHeight`
- `outputBytes`
- `imageUrl`

필요한 attribution 또는 개별 허가 문서가 있으면 구조화된 `rightsEvidence`와 manifest-level attribution 목록으로 관리한다. 파일명이나 URL에 비밀, 로컬 절대 경로 또는 사용자 입력을 포함하지 않는다.

## 출력 파일 규칙

승인된 원본만 다음 디렉터리로 변환한다.

```text
apps/dashboard/public/images/palworld/1.0.1/pals/<content-hash>.webp
```

API에는 다음 형태의 같은 출처 절대 경로만 제공한다.

```text
/images/palworld/1.0.1/pals/<content-hash>.webp
```

출력 규칙은 다음과 같다.

- 정적 WebP만 허용하고 애니메이션은 거부한다.
- 가로·세로 모두 1~512 pixel 범위여야 한다.
- 파일은 512 KiB 이하로 제한한다.
- 원본 비율과 Pal 전체 모습을 유지하고 `object-fit: contain`에 맞춘다.
- 자르기 대신 필요한 경우 투명 여백을 추가한다.
- EXIF, ICC comment와 불필요한 metadata를 제거한다.
- 출력 파일명은 소문자 64자리 SHA-256과 `.webp`로 구성한다.
- 동일 content는 같은 파일을 가리키되, 여러 Pal의 공유는 승인된 override가 있을 때만 허용한다.
- 기존 content-hash 파일을 다른 내용으로 덮어쓰지 않는다.

외부 `http:`/`https:` URL, protocol-relative URL, base64/data URL, `..`, 역슬래시, NUL, percent-encoding 우회와 사용자 입력 경로는 모두 거부한다.

## validator 요구사항

이미지 검증은 JSON 문자열만 검사해서는 안 된다. manifest와 실제 정적 파일을 함께 검증한다.

### Schema와 mapping

- 모든 object에 exact key schema를 적용하고 unknown field를 거부한다.
- `schemaVersion`, release와 snapshot revision을 exact match한다.
- `ready`이면 최종 287개 Pal 모두 정확히 하나의 mapping을 가져야 한다.
- `blocked_by_license`이면 287개 명시적 entry는 유지하되 출력 관련 필드는 모두 `null`이고 snapshot `imageUrl`은 없어야 한다.
- `palId`와 `sourceInternalId`가 canonical mapping과 일치해야 한다.
- 존재하지 않는 Pal, 사용되지 않은 mapping과 일반종/변종 교차 mapping을 거부한다.
- 이름을 이용한 fuzzy matching은 수행하지 않는다.

### 경로와 파일

- `imageUrl` prefix를 `/images/palworld/1.0.1/pals/`로 제한한다.
- 정규화 전후 경로가 같아야 하고 directory traversal과 symlink 이탈을 거부한다.
- manifest가 참조한 파일이 정적 자산 root 아래 regular file인지 확인한다.
- manifest에서 참조하지 않은 고아 이미지 파일을 거부한다.
- snapshot에서 참조하지만 manifest에 없는 파일을 거부한다.

### MIME, 크기와 checksum

- 확장자만 믿지 않고 실제 RIFF/WEBP signature와 chunk 구조를 검사한다.
- `outputMime`은 `image/webp`만 허용한다.
- 실제 byte 수가 512 KiB 이하이고 manifest `outputBytes`와 일치해야 한다.
- 디코딩한 가로·세로가 manifest와 일치하며 각각 1~512 범위여야 한다.
- `ANIM` 또는 `ANMF` chunk가 있는 파일을 거부한다.
- 실제 파일 SHA-256이 `generatedSha256` 및 content-hash 파일명과 일치해야 한다.
- source와 output hash는 소문자 64자리 hex만 허용한다.

### 중복

기본적으로 동일한 output hash가 여러 Pal에 연결되면 실패한다. 의도적인 공유만 `image-overrides.json`에 다음 내용을 기록하여 허용한다.

- 공유하는 canonical Pal ID 목록
- 공유가 필요한 이유
- 일반종/변종 관계
- 원본과 권리 증빙
- 검토 상태

사용되지 않는 override, 설명 없는 공유 또는 다른 Pal을 임시 대체한 공유는 거부한다.

## 생성 흐름

이미지 처리는 유지보수용 생성 단계에서만 수행한다.

```text
권리 증빙 검토
→ 고정 원본 checksum 확인
→ sourceInternalId exact mapping
→ 정적 WebP 변환
→ 크기·metadata·animation 검사
→ output SHA-256 계산
→ content-hash 파일명 확정
→ 임시 release 디렉터리에 기록
→ manifest와 전체 파일 교차 검증
→ deterministic 재생성 비교
→ atomic publish
```

HTTP 요청 처리 중에는 이미지를 다운로드하거나 변환하지 않는다. 외부 이미지 hotlink, scraping, 임의 URL proxy, shell 또는 `curl` subprocess를 런타임에 추가하지 않는다.

현재 코드는 권리 승인 후 별도 검토된 변환 단계에서 만들어진 정적 WebP만 `importApprovedPalworldWebp`로 반입한다. 이 함수는 WebP를 다시 인코딩하지 않고 signature·크기·metadata·hash를 검증한 뒤 content-hash 파일로 원자 반입한다. PNG→WebP 변환이나 리사이즈 도구는 권리 승인과 도구 재현성 검토가 끝난 뒤 별도 build-time 단계로 추가해야 한다.

## Dashboard fallback과 접근성

현재 `PalworldMedia`는 `imageUrl`이 없거나 이미지의 `onError`가 발생하면 기존 fallback을 렌더링한다. 이 동작을 유지한다.

- Pal 카드, 자동완성, 부모 선택기와 상세 Modal에서 같은 컴포넌트를 재사용한다.
- `alt`는 현재 locale의 한국어 또는 일본어 Pal 이름을 사용한다.
- fallback은 `role="img"`와 현재 locale의 이름·이미지 없음 안내를 제공한다.
- locale이 바뀌면 이미지 `alt`와 fallback `aria-label`도 함께 바뀌어야 한다.
- 이미지 유무와 상관없이 카드와 상세 영역의 비율 및 높이를 유지한다.
- 로딩 실패가 페이지 또는 Modal 오류로 전파되지 않아야 한다.
- CSS는 기존 token과 `object-fit: contain` 규칙을 유지한다.

최소 UI 테스트는 다음을 포함한다.

- 한국어 Pal 카드 이미지 `alt`
- 일본어 전환 후 일본어 `alt`
- 이미지 없는 Pal의 localized fallback
- 404 또는 손상 이미지 `onError` 후 localized fallback
- 카드와 상세 Modal에서 Pal이 잘리지 않음
- 360×800, 390×844, 430×932, 768×1024, 1440×1000에서 가로 overflow 없음

## 캐시, 배포와 rollback

content-hash 파일은 `public, max-age=31536000, immutable`로 제공할 수 있다. snapshot과 manifest는 파일 존재를 먼저 확인할 수 있도록 이미지보다 늦게 활성화한다.

1. 새 이미지 파일을 먼저 배포한다.
2. 배포 위치에서 manifest checksum과 모든 파일을 다시 검증한다.
3. snapshot, data manifest와 image manifest revision 일치를 확인한다.
4. 첫·중간·마지막 일반종과 변종의 카드·상세 Modal을 확인한다.
5. 브라우저에서 외부 이미지 요청과 이미지 로딩 오류가 0개인지 확인한다.
6. 검증 후에만 runtime snapshot을 전환한다.

rollback을 위해 이전 snapshot, image manifest와 content-hash 파일을 함께 보존한다. 새 release 실패 시 이전 snapshot으로 되돌리고, 이전 snapshot이 참조하는 이미지 파일은 cache 만료 여부와 무관하게 유지한다.

현재 `blocked_by_license` 상태에서는 로컬 Pal 이미지를 배포하거나 운영 snapshot을 이미지 포함 상태로 활성화하지 않는다. 권리 검토가 완료되기 전까지 기존 fallback이 정상 동작하는 상태가 의도된 결과다.
