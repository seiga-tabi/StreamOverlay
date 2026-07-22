# Palworld 1.0.1 도감 데이터 반입

이 문서는 Palworld 1.0.1 도감 데이터의 고정 원본, 정규화 규칙, 검증 절차와 운영 전환 조건을 정의한다. 데이터 생성 도구만 외부 원본을 내려받을 수 있으며, StreamOverlay 런타임은 네트워크 대신 검증이 끝난 immutable snapshot만 읽는다.

Pal 텍스트·수치 데이터와 이미지 자산의 gate는 독립적으로 적용한다. `dataIntegrityGate`가 통과한 287종 Pal artifact는 runtime에 활성화할 수 있다. 이미지 자산은 [PALWORLD_IMAGE_ASSETS.md](./PALWORLD_IMAGE_ASSETS.md)의 `imageAssetGate`를 적용하며, 현재 `blocked_by_license`이므로 287종 모두 fallback을 사용한다. 아이템과 교배 domain은 전체 1.0.1 데이터가 준비될 때까지 `sample-baseline` provenance와 `sample`/`incomplete` coverage로 격리한다.

## 고정 원본

| 용도 | 저장소 | 고정 revision | 입력 | SHA-256 |
| --- | --- | --- | --- | --- |
| 도감 번호, 속성, 희귀도, 스탯, 작업 적성, 교배 수치, 야행성 | `Awy64/palworld-atlas-data` | commit `0385b3fd8bd757240d4a2c79615145122669abd5`, Steam Build ID `24181105` | `published/v1/builds/24181105/pals/index.json` | `57fb4bf837061c1160d5f72755152245fe793e1b0073328714efd63c65ba5b47` |
| 한국어·일본어·영어 이름, 변종 여부, 교차 검증 | `tylercamp/palcalc` | release `v1.17.7`, commit `211dd9fe520cbff9c5e3b9f8ec4f132669869714` | `PalCalc.Model/db.json` | `803d891afdb18bd00e24332844a7276bbe5c0855170ef90ef142f2f4d7698ed1` |

원본 URL, revision, 입력 경로, byte 크기와 SHA-256은 `sources.lock.json`에 exact value로 기록한다. branch 이름, `latest` URL 또는 release의 이동 가능한 다운로드 주소를 검증 기준으로 사용하지 않는다.

각 저장소의 MIT 라이선스는 해당 저장소의 소프트웨어와 문서에 적용된다. Pocketpair가 소유한 게임 데이터·명칭·이미지의 권리까지 자동으로 이전한다고 해석하지 않는다. 생성 artifact의 `manifest.json`에는 각 필드의 provenance와 라이선스 검토 결과를 별도로 남긴다.

## 포함 기준과 격리 레코드

고정 원본에 대한 기대 수량은 다음과 같다.

- Atlas 입력: 289개
- PalCalc 입력: 299개
- `sourceInternalId` exact join: 288개
- 최종 공개 Pal: 287개
  - 일반종: 203개
  - 변종: 84개

이름을 이용한 fuzzy join, 번호만 이용한 join, 대소문자를 임의로 고친 join은 금지한다. 원본 internal ID를 명시적인 mapping으로 연결하고, join 실패는 생성 실패 또는 격리 보고서로 처리한다.

`exclusions.json`에는 다음 레코드와 사유를 숨김없이 기록한다.

- `PlantSlime_Flower`: Gumoss 도감 레코드와 중복되는 외형 레코드이므로 exact join 결과에서 제외한다.
- `WorldTreeDragon`: Atlas에만 존재하고 공개 도감 포함 여부를 교차 검증할 수 없으므로 격리한다.
- `YakushimaMonster*`: PalCalc에만 존재하는 이벤트·콜라보 계열 레코드이므로 격리한다.
- `YakushimaBoss*`: PalCalc에만 존재하는 이벤트·콜라보 계열 레코드이므로 격리한다.

제외 목록의 각 항목은 `sourceInternalId`, 원본 측 존재 여부, 제외 사유, 검토 상태를 포함해야 한다. 사용되지 않은 제외 항목이나 사유 없이 제외된 입력이 있으면 검증을 실패시킨다.

## 생성 artifact

권장 release 디렉터리는 다음과 같다.

```text
apps/server/data/palworld/1.0.1/
  sources.lock.json
  paldex.json
  manifest.json
  images-manifest.json
  import-report.json
```

- `sources.lock.json`: 고정 원본 URL, revision, 입력 경로, byte 크기와 SHA-256
- `paldex.json`: 정규화된 287종 Pal 레코드
- `manifest.json`: schema version, 게임 버전, 데이터·mapping artifact checksum, `dataIntegrityGate`와 `imageAssetGate`
- `images-manifest.json`: 이미지 권리와 로컬 파일 무결성 상태
- `import-report.json`: 입력·join·포함·격리 수량, 누락 필드, 충돌과 warning

`paldex.json`은 최소한 다음 정보를 보존한다.

- `id`: 공개 URL에서 사용하는 안정적인 slug
- `sourceInternalId`: 원본 데이터의 exact ID
- 도감 번호
- 한국어·일본어·영어 이름
- 일반종/변종 구분
- 속성, 희귀도
- HP, 공격력, 방어력, 이동 속도, 스태미나
- 작업 적성
- 교배 수치
- 야행성 여부
- 권리가 검증된 경우에만 같은 출처 절대 경로 `imageUrl`

공개 `id`와 `sourceInternalId`는 분리한다. 공개 slug는 `public-id-map.json`에 고정하며 이름이 바뀌어도 자동으로 변경하지 않는다. `-`와 `_` alias까지 포함하여 충돌을 검사한다.

## 명령과 책임 분리

프로젝트 naming convention에 맞춰 다음 네 작업을 제공한다.

```text
fetch-palworld-paldex
generate-palworld-paldex
validate-palworld-paldex
diff-palworld-paldex
```

- `fetch`: 명시적인 유지보수 작업에서만 고정 URL을 다운로드한다. redirect와 예상 밖 host를 거부하고 byte 제한, revision, SHA-256을 확인한 뒤 저장소 밖 OS 임시 cache에 저장한다.
- `generate`: 검증된 로컬 입력만 읽어 exact join, mapping, exclusions와 정규화를 수행한다. 런타임 API나 외부 사이트를 호출하지 않는다.
- `validate`: 원본 lock, schema, 수량, 참조 무결성, 이미지 manifest 상태와 artifact checksum을 읽기 전용으로 검사한다.
- `diff`: 이전 release와 Pal 단위 변경 사항을 출력하되 원본 전체나 비밀값을 로그에 출력하지 않는다.

일반 빌드와 서버 시작 과정은 `fetch`를 실행하지 않는다. CI와 운영 배포는 커밋된 정규화 artifact를 네트워크 없이 검증할 수 있어야 한다.

`npm run validate:palworld-data`는 Pal artifact의 source·mapping·artifact checksum과 `dataIntegrityGate`를 검증한다. `npm run validate:palworld-data:release`는 이미지가 포함된 전체 release 준비 상태까지 검증하며, 현재처럼 이미지 권리가 `blocked_by_license`이거나 287개 파일 중 하나라도 준비되지 않으면 `PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE`로 반드시 실패한다. 이 예상 실패는 이미 검증된 Pal 텍스트·수치 데이터의 runtime 활성화를 막지 않는다.

## 결정적 생성

같은 입력으로 두 번 생성하면 JSON byte가 동일해야 한다.

- key와 배열 정렬 규칙을 코드로 고정한다.
- Pal은 도감 번호, 일반종/변종 순서, 원본 internal ID 순으로 정렬한다.
- 현재 시각, 무작위 ID, 로컬 절대 경로를 artifact에 넣지 않는다.
- `retrievedAt`, `extractedAt`, `verifiedAt`은 실행 시각이 아니라 release manifest에 고정한 값만 사용한다.
- 출력은 임시 파일에 완전히 기록하고 검증한 후 atomic rename한다.
- 생성 실패 시 기존 artifact를 변경하거나 삭제하지 않는다.

## 데이터·이미지 gate

`dataIntegrityGate`는 다음 조건을 모두 만족해야 통과한다.

- Atlas 289개와 PalCalc 299개 입력 수량 일치
- exact join 288개
- 최종 Pal 287개, 일반종 203개, 변종 84개
- 한국어·일본어·영어 이름 누락 0개
- 필수 스탯과 교배 수치 누락 0개
- 알 수 없는 속성·작업 적성 enum 0개
- ID 및 alias 충돌 0개
- 설명 없는 제외 레코드 0개
- 원본, 5개 mapping(`publicIdMap`, `elements`, `workSuitabilities`, `exclusions`, `imageOverrides`) 및 artifact SHA-256 불일치 0개
- canonical 참조 불일치와 고아 참조 0개
- 동일 입력 재생성 결과가 byte-for-byte 동일
- `paldex.json`, `manifest.json`, `images-manifest.json`의 release/revision 일치

`imageAssetGate`는 기술 검증과 권리 확인을 분리한다. 고정 `image-use-policy.json`의 사용 상태는 `operator_acknowledged`, `usageBasis: operator_reference_use`, `rightsVerified: false`이며, 이는 라이선스 승인·권리 확인 완료를 뜻하지 않는다. 현재는 실제 source 이미지와 완성 mapping이 제공되지 않아 runtime 상태가 `blocked_by_license`, `readyImages: 0`, `fallbackPals: 287`이다. 따라서 Pal 텍스트·수치 데이터는 활성화하되 전체 이미지 release validator는 통과하지 못한다.

## Domain별 coverage와 provenance

- `pals`: Palworld `1.0.1`, 고정 source revision 기반, `ready`, 287종
- `items`: `sample-baseline`, `sample`/`incomplete`, 10개 샘플
- `breeding`: `sample-baseline`, `sample`/`incomplete`, 3개 샘플 조합

Pal 1.0.1 artifact와 아이템·교배 샘플을 같은 응답에 제공하더라도 domain별 provenance와 coverage를 분리한다. 홈, 아이템, 교배 화면에서 샘플을 전체 1.0.1 데이터처럼 표시하지 않으며 한국어·일본어 준비 안내와 sample badge를 제공한다.

## 운영 전환과 rollback

Pal runtime 전환 절차는 다음과 같다.

1. 데이터 snapshot, manifest와 이미지 manifest를 하나의 release artifact로 준비한다. 허가된 이미지가 없으면 파일을 포함하지 않는다.
2. 별도의 작업 디렉터리에서 checksum과 전체 validator를 실행한다.
3. 서버가 새 snapshot을 읽어 source·mapping·artifact checksum, Shared schema와 `dataIntegrityGate`를 다시 확인한다.
4. `/api/palworld/meta`에서 게임 버전, revision, 287개 수량과 domain별 coverage/provenance를 확인한다.
5. 이미지 manifest가 `blocked_by_license`이면 `readyImages: 0`, `fallbackPals: 287`과 화면 fallback을 확인한다. 운영자 확인 artifact만 있고 파일이 없을 때도 이 상태를 유지한다.
6. 이미지 manifest가 향후 `operator_acknowledged`, `partial` 또는 `ready`로 활성화되면 모든 content-hash 정적 파일을 snapshot보다 먼저 배포한다. `operator_acknowledged`와 `partial`은 권리 확인 완료를 의미하지 않는다.
7. 첫·중간·마지막 일반종과 변종 상세 화면을 확인한다.
8. LoL, Dashboard, Overlay와 OBS Bridge 회귀 검증을 수행한다.
9. 문제가 있으면 Pal API만 503으로 격리하고 artifact와 이미지 manifest를 이전 검증 release로 함께 되돌린다.

손상된 Palworld artifact는 `/api/palworld/*`에만 안전한 `503 PALWORLD_DATA_UNAVAILABLE`로 격리한다. 이 오류가 서버 전체 기동, `/health/ready`, LoL, Dashboard, Overlay 또는 OBS Bridge를 실패시키면 안 된다.

이 절차에는 새 환경 변수가 필요하지 않다. 실제 `.env`와 예제 환경 파일을 데이터 반입 경로로 사용하지 않는다.
