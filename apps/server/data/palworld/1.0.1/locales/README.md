# Palworld 번역 artifact 작업 흐름

이 디렉터리는 고정된 `catalog.json`과 `paldex.json`의 영어 원문을 한국어·일본어 번역과 분리해 관리한다. Runtime 또는 production build에서는 외부 번역 API를 호출하지 않는다.

공개 runtime에는 공식 게임 locale인 `source_provided` 또는 명시적으로 검수된
`human_reviewed` 값만 사용할 수 있다. `machine_assisted` 후보는 활성 KO/JA snapshot과
공개 이름·설명에 포함하지 않는다.

현재 operator PAK candidate 전체는 게임 버전·Steam Build ID·public ID mapping
release 증빙이 완료되지 않아 활성화하지 않는다. 다만 기존 `1.0.1` canonical
ID·`sourceInternalId`와 exact join되는 공식 KO/JA locale만 별도의
`translation_compatibility_only` overlay로 검증해 사용할 수 있다. 이 overlay는
candidate의 Pal·Item·Skill 데이터를 활성화하지 않으며, exact join되지 않거나
rich text가 해결되지 않은 필드는 기계 번역으로 채우지 않고 원문 fallback으로
표시한다.

## 1. 원문 추출

```bash
npm --workspace apps/server run extract:palworld-translations
```

생성물:

- `corpus.json`: canonical ID와 필드별 영어 원문·SHA-256
- `source-batches/batch-NNNN.json`: 150 record 단위의 고정 번역 입력
- `glossary.json`: 기존 검수 Pal 이름과 검증된 핵심 아이템 5종 이름, 공통 용어, 이름 충돌, 영문 동일 예외
- `glossary-overrides.json`: 같은 영문 이름을 공유하는 canonical ID의 수동 충돌 처리 정책
- `corpus-report.json`: 원문 수·문자량·중복·손상 가능 원문 보고서
- `corpus-manifest.json`: 각 source batch와 corpus의 checksum
- `candidates/{ko,ja}/batch-0000.json`: 기존 검수 Pal 이름 287개와 핵심 아이템 5종 이름 seed

## 2. 격리된 과거 기계 번역 후보

`candidates/<locale>/batch-NNNN.json`은 과거 결과의 감사와 회귀 검증을 위한
격리 자료다. 이 파일은 active manifest와 Docker runtime bundle에 포함하지 않으며,
locale snapshot 생성 입력으로 다시 사용하지 않는다. `batch-0000.json`의 검수 이름
seed도 활성 snapshot의 `glossary.json`을 통해서만 사용한다.

```json
{
  "schemaVersion": 1,
  "locale": "ko",
  "records": [
    {
      "id": "accessory-air-dash1",
      "kind": "item",
      "fields": {
        "name": {
          "sourceSha256": "영어 name 원문의 소문자 64자리 SHA-256",
          "text": "에어 대시 부츠",
          "status": "machine_assisted",
          "note": "전용 오프라인 번역 모델 후보"
        },
        "description": {
          "sourceSha256": "영어 description 원문의 소문자 64자리 SHA-256",
          "text": "장착하면 공중에서 대시할 수 있는 액세서리이다.",
          "status": "machine_assisted"
        }
      }
    }
  ]
}
```

허용 field는 `name`, `description`, `passiveAbility`뿐이다. 원문에 없는 field, orphan ID, 오래된 source hash, 빈 문자열, HTML, 제어문자, 영어 원문 복사는 import 단계에서 거부한다. 공식 고유명사 때문에 영어와 같은 값이 반드시 필요할 때만 `glossary.json`의 `englishCopyAllowlist`에 locale·kind·ID·field·사유를 명시한다.

`corpus-report.json.sourceQuality`에 등록된 손상 원문은 모델이 누락된 단어를 추정해서 채우면 안 된다. 원문의 `()` 또는 값이 빠진 구두점 위치마다 한국어 후보에는 `[원문 누락]`, 일본어 후보에는 `[原文欠落]`을 넣고 해당 field의 `note`에 `source_anomaly_preserved`를 포함한다. marker 수가 원문 누락 위치와 정확히 일치하지 않거나 note가 없으면 import가 실패한다. 이 필드도 coverage 분모에서는 제외하지 않으며, 정상 번역과 별도로 원문 품질 보고서에 집계한다.

검수된 Pal 이름은 `glossary.json.palNames`와 정확히 일치해야 한다. `glossary-overrides.json`에 명시된 이름 충돌은 ID별 후보를 모두 요구하며 다른 ID로 자동 전파하지 않는다. 특히 `Double Fang`처럼 이름은 같지만 설명이 다른 스킬은 각 canonical ID의 source hash로 독립 검증한다.

같은 ID/field의 후보가 여러 batch에 있으면 다음 규칙을 적용한다.

1. `human_reviewed`가 `machine_assisted`보다 우선한다.
2. 같은 우선순위에서 번역이 다르면 import를 중단한다.
3. 임의의 첫 번째 결과를 선택하지 않는다.

후보 batch 파일의 순서는 결과에 영향을 주지 않는다. Import는 모든 field를 위 규칙으로 병합한 다음 `kind:canonical ID` 순으로 정렬한다. 같은 우선순위의 충돌은 batch 순서와 관계없이 실패한다.

## 3. 공개 Locale snapshot 생성

활성 snapshot에서 기계 번역을 제거하고 검수된 값만 남긴다.

```bash
npm --workspace apps/server run purge:palworld-machine-translations
```

결과:

- `ko.json`, `ja.json`: Runtime locale snapshot
- `ko-coverage.json`, `ja-coverage.json`: 번역·누락·검수 상태 집계
- `manifest.json`: 두 locale의 checksum과 공통 revision

공식 PAK locale compatibility overlay를 생성할 때는 고정 candidate와 검수 증거를
명시한다.

```bash
npm --workspace apps/server run generate:palworld-official-locale-overlay -- \
  --active-root apps/server/data/palworld/1.0.1 \
  --candidate-root apps/server/data/palworld/candidates/<candidate-id> \
  --output <새 staging-directory> \
  --reviewed-at <고정 RFC3339 UTC 시각> \
  --reviewer <검수자 ID> \
  --evidence-checksum <검수 증거 SHA-256> \
  --active-skill-mapping \
    apps/server/src/data/palworld-pak-mappings/legacy-active-skill-locale-map.json
```

생성물:

- `official-source-fields.json`: locale member와 message key까지 고정한 exact source
- `official-active-skill-evidence.json`: Pal ID·해금 레벨·전투 수치로 검증한
  legacy 액티브 스킬 217개의 공식 locale 연결 근거
- `official-locale-compatibility.json`: ZIP·candidate·mapping·출력 checksum과 blocker
- `ko.json`, `ja.json`: 공개 runtime snapshot
- `ko-coverage.json`, `ja-coverage.json`: 공식·검수·fallback 상태 집계
- `manifest.json`: locale checksum과 공통 revision

공식 locale이 없거나 exact join되지 않은 필드는 원문 fallback으로 남으므로
`translationStatus`는 `incomplete`다. 생성기는 candidate activation blocker와
`rightsVerified: false`를 그대로 보존하며 동일 입력에서 byte-for-byte 같은 결과를
만든다. 게시할 때는 모든 파일을 검증한 뒤 `manifest.json`과 active runtime selector를
마지막에 원자적으로 갱신한다.

## 4. 검증

```bash
npm --workspace apps/server run validate:palworld-translations
```

검증기는 현재 catalog/Paldex checksum, revision, canonical ID, 필드별 영어 원문 hash,
공식 message key·본문·member checksum, 중복, 정렬, status, HTML·제어문자 및 영어
복사를 확인한다. 활성 snapshot에 `machine_assisted` 필드가 하나라도 있으면 검증을
실패시킨다.

추출 시각과 번역 시각은 artifact에 고정된 값만 사용한다. Source batch, 최종 record, manifest는 canonical 순서와 고정 JSON 직렬화를 사용하므로 같은 입력과 revision에서는 byte-for-byte 같은 결과가 생성된다. Runtime 및 production build는 외부 번역 API를 호출하지 않는다.
