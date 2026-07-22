# 펠월드 데이터 스냅샷 안내

`palworld-snapshot.ts`는 공개 페이지와 API 동작을 검증하기 위한 **소규모 기준 샘플**이다. Pal 287종의 운영 데이터 출처로 사용하지 않으며, 아직 전체 데이터가 없는 아이템과 교배 domain만 `sample-baseline` provenance와 `sample`/`incomplete` coverage로 격리해 제공한다.

Palworld 1.0.1의 검증된 287종 Pal 텍스트·수치 데이터는 `apps/server/data/palworld/1.0.1/`의 immutable release artifact에서 읽는다. `dataIntegrityGate`가 `ready`이면 Pal domain을 runtime에 활성화한다. 이미지 사용 상태와 권리 확인은 별도 `imageAssetGate`로 관리한다. 고정 policy는 `operator_acknowledged`, `usageBasis: operator_reference_use`, `rightsVerified: false`이며 라이선스 승인이나 권리 확인 완료를 뜻하지 않는다. 운영자가 제공한 `pyPalworldAPI-0.2.0.zip`에서 canonical internal ID로 정확히 연결된 272종은 metadata를 제거한 content-hash WebP로 활성화했고, 원본에 없는 15종은 fallback 그래픽을 사용한다. 따라서 runtime image 상태는 `partial`, `readyImages: 272`, `fallbackPals: 15`다. 반입·검증·운영 전환 절차는 `docs/PALWORLD_DATA_IMPORT.md`와 `docs/PALWORLD_IMAGE_ASSETS.md`를 따른다.

## 출처와 재현성

- Pal 287종은 고정 source와 mapping에서 결정적으로 생성하며, 아이템·교배 샘플은 StreamOverlay 저장소에서 직접 정규화한다.
- 교배 계산 구조는 MIT 라이선스 프로젝트 `tylercamp/palcalc`의 commit `59d70fecd99698021809b09760fa0a57adaefea2`를 참고했다.
- `mlg404/palworld-paldex-api`는 오래된 데이터일 수 있어 API 스키마 비교에만 참고하며, 이 스냅샷의 데이터 출처로 사용하지 않는다.
- 다른 DB 사이트의 HTML을 scraping하거나 런타임에 외부 커뮤니티 API를 호출하지 않는다.

## 라이선스와 이미지

- 스냅샷의 정규화 코드와 샘플 구조는 이 저장소의 라이선스를 따른다.
- `palcalc`에서 유래한 구현을 추가할 때는 MIT 고지와 고정 commit을 유지해야 한다.
- Palworld 명칭과 상표 및 원본 게임 자산의 권리는 Pocketpair에 있다.
- 현재 release는 외부 hotlink나 운영자 source 원본을 포함하지 않는다. 검증된 Pal 이미지 272개와 빠른 이동 월드 지도 1개는 metadata를 제거한 content-hash WebP만 공개하고, 누락되거나 검증되지 않은 이미지는 fallback 또는 미제공 상태를 유지한다.
- `operator_acknowledged`는 운영자가 출처 공지 조건으로 참조 사용을 결정했다는 기술적 사용 근거이며, `licensed`, `approved` 또는 권리 확인 완료로 표시하지 않는다. 별도 서면 허가가 검증된 경우에만 `rightsVerified: true`와 `ready`를 사용할 수 있다.
