# Palworld 번역 artifact 작업 흐름

이 디렉터리는 고정된 `catalog.json`과 `paldex.json`의 영어 원문을 한국어·일본어 번역과 분리해 관리한다. Runtime 또는 production build에서는 외부 번역 API를 호출하지 않는다.

현재 `machine_assisted` 후보는 고정 revision의 오프라인 모델로 생성한다. 모델과
라이선스·commit은 `translation-provenance.json`에 기록하며, 기계 보조 결과를 공식 번역이나
인간 검수 완료 번역으로 표시하지 않는다. 한국어는
`Helsinki-NLP/opus-mt-tc-big-en-ko`(CC-BY-4.0), 일본어는
`staka/fugumt-en-ja`(CC-BY-SA-4.0)를 사용한다. 배포 전 운영자는 모델 라이선스 고지와
게임 원문 기반 번역문의 권리를 별도로 확인해야 한다.

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

## 2. 오프라인 번역 후보 입력 형식

전용 오프라인 번역 모델의 결과는 locale별 `candidates/<locale>/batch-NNNN.json`에 저장한다. `batch-0000.json`은 기존 검수 이름 seed이므로 덮어쓰지 않는다.

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

## 3. Locale snapshot 생성

두 locale에 같은 고정 revision을 사용한다.

```bash
npm --workspace apps/server run import:palworld-translations -- --locale ko --revision offline-machine-assisted-v1
npm --workspace apps/server run import:palworld-translations -- --locale ja --revision offline-machine-assisted-v1
```

결과:

- `ko.json`, `ja.json`: Runtime locale snapshot
- `ko-coverage.json`, `ja-coverage.json`: 번역·누락·검수 상태 집계
- `manifest.json`: 두 locale의 checksum과 공통 revision

번역이 일부만 있으면 `translationStatus`는 자동으로 `incomplete`가 된다. 모든 영어 source field가 번역된 경우에만 `complete`가 된다.

## 4. 검증

```bash
npm --workspace apps/server run validate:palworld-translations
```

검증기는 현재 catalog/Paldex checksum, revision, canonical ID, 필드별 영어 원문 hash, 중복, 정렬, status, HTML·제어문자 및 영어 복사를 확인한다. `machine_assisted` 결과는 공식 번역으로 취급하지 않으며 화면에서는 검수 중 상태를 유지해야 한다.

추출 시각과 번역 시각은 artifact에 고정된 값만 사용한다. Source batch, 최종 record, manifest는 canonical 순서와 고정 JSON 직렬화를 사용하므로 같은 입력과 revision에서는 byte-for-byte 같은 결과가 생성된다. Runtime 및 production build는 외부 번역 API를 호출하지 않는다.
