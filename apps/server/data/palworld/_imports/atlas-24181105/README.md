# Palworld Atlas build 24181105 격리 반입본

이 디렉터리는 사용자가 제공한 `palworld-atlas-data-main.zip`에서 StreamOverlay의 공개 Palworld DB에 관련된 원본만 선별해 보관한다. 압축파일과 각 원본의 SHA-256, byte 크기, 레코드 수는 `import-provenance.json`에 고정했다.

## 포함한 데이터

- `pals/index.json`: Pal 원본 289개. 현재 운영 도감 287종을 생성할 때 사용한 원본과 byte-for-byte 동일하다.
- `items/index.json`: 아이템 원본 1,891개.
- `breeding.json`: 특수 교배 257개와 동일종 교배 규칙.
- `upstream-manifest.json`: Steam build, 원본 테이블과 checksum.
- `schemas/`: upstream Pal·아이템 JSON schema.
- `LICENSE`: upstream MIT 라이선스 전문.

이전 build, 지도 스폰 약 21.8 MB, 개별 Pal 중복 JSON, extractor 소스와 CI 파일은 포함하지 않았다.

## 운영 활성화 상태

이 디렉터리는 active release가 아닌 quarantine source staging이다. 서버 runtime은 이 경로를 읽지 않으며 `runtimeActivation`은 `false`다.

아이템은 영어 이름·설명만 제공하고 한국어·일본어, 기술 해금 레벨, 제작 재료·시설, 드롭 Pal, 획득법과 관련 아이템 정보가 없다. `icon` 값은 이미지 파일이 아니라 게임 asset key다. 희귀도 `0`인 레코드도 있어 현재 Shared item schema에 그대로 전달할 수 없다.

교배 데이터는 일반 교배 전체 결과가 아니라 특수 조합만 제공한다. 현재 공개 Pal 287종의 exact `sourceInternalId`로 모두 해석되는 행은 182개이며, 나머지 75개는 명시적인 alias 또는 제외 검토가 필요하다. 성별 조건이 있는 2개 조합도 보존해야 한다.

압축파일에는 Pal·아이템 이미지가 하나도 없다. 이 반입본만으로 공개 이미지를 활성화하거나 이미지 권리를 확인할 수 없다.

## 다음 활성화 조건

1. 아이템의 안정적인 public ID와 category allowlist를 고정한다.
2. 한국어·일본어 이름·설명의 검증된 고정 출처를 추가한다.
3. 원본 `rarity`, `rank`, `price`의 의미를 검증하고 Shared schema를 분리한다.
4. 제작·획득·드롭 관계를 별도 검증 데이터로 보강한다.
5. 특수 교배 ID를 exact mapping하고 일반 교배 알고리즘 또는 검증된 결과표를 추가한다.
6. 별도 item/breeding artifact와 checksum gate를 통과한 뒤에만 domain 상태를 `ready`로 전환한다.
