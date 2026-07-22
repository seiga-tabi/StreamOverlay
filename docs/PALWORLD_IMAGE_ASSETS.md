# Palworld 운영자 제공 이미지 반입 정책

이 문서는 Palworld 1.0.1 공개 도감에 운영자가 제공한 로컬 이미지를 반입하는 유지보수 절차를 정의한다. 출처는 운영자 관리 서버 export 또는 운영자가 직접 제공한 고정 archive일 수 있다. 이 절차는 Pocketpair의 서면 라이선스 취득이나 공식 제휴를 의미하지 않는다.

## 현재 상태와 blocker

- 운영자 사용 정책: `operator_acknowledged`
- 사용 근거: `operator_reference_use`
- 독립적인 권리 확인: `rightsVerified: false`
- 고정 source archive: `pyPalworldAPI-0.2.0.zip` (`SHA-256 42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115`)
- 실제 image source mapping: canonical exact join 272개
- 기술 검증 이미지: 272개
- fallback: 15개
- runtime image gate: `partial`
- 공개 월드 지도: 빠른 이동 지점 합성 지도 1개, 4096×4096 content-hash WebP

운영자 결정은 [image-use-policy.json](../apps/server/data/palworld/1.0.1/image-use-policy.json)에 고정되어 있다. 이 artifact는 권리자 허가서가 아니다. archive에 존재하고 canonical `sourceInternalId`와 정확히 일치한 272개만 `imageUrl`을 활성화한다. 누락된 15개는 fallback이며 다른 Palworld DB, 게임 추출 URL, 외부 hotlink, 변종 이미지 또는 임의 API로 보충하지 않는다. archive 분석 근거는 [import-provenance.json](../apps/server/data/palworld/_imports/pypalworldapi-0.2.0/import-provenance.json)에 고정한다.

## 운영자 source 제공

Codex나 CI가 운영 서버에 임의로 SSH 접속하지 않는다. 운영자는 PNG 또는 WebP export 디렉터리나 고정 archive를 다음 중 하나로 제공한다.

1. workspace 밖의 read-only mount
2. CI job이 읽을 수 있는 read-only volume
3. 운영자가 직접 실행하는 maintenance host의 로컬 directory

예시 경로는 `/srv/palworld-assets/1.0.1/pals`이지만 실제 mount가 존재하는 경우에만 사용한다. 원본 PNG는 `apps/dashboard/public` 아래로 복사하지 않는다.

## Policy와 source mapping

`image-use-policy.json`은 unknown field를 거부하는 exact schema다. 현재 policy의 핵심 불변식은 다음과 같다.

- `status: operator_acknowledged`
- `usageBasis: operator_reference_use`
- 공개 표시·self-hosting·resize·WebP 변환 허용값은 모두 `true`
- `rightsVerified: false`
- 한국어·일본어 공지는 UI footer 문구와 byte-for-byte 일치

rollback policy는 `blocked_by_license`, `usageBasis: none`, 네 허용값 `false`, `rightsVerified: false`여야 한다. `ready`는 별도의 권리 근거까지 확인하여 `rightsVerified: true`인 경우에만 허용한다.

실제 파일이 제공되면 [image-source-map.example.json](../apps/server/src/data/palworld-mappings/image-source-map.example.json)을 참고해 `apps/server/src/data/palworld-mappings/image-source-map.json`을 작성한다. 예제의 두 entry를 복사해 287종을 추측해서는 안 된다. 각 entry는 다음 exact field를 사용한다.

- `palId`
- `sourceInternalId`
- `sourceFileName`
- `sourceRevision`
- `sourceKind: operator_controlled_server_export` 또는 `operator_provided_archive`

mapping은 이름 fuzzy match를 하지 않는다. `palId`와 `sourceInternalId`를 1.0.1 canonical 도감에 exact join하고 policy의 `sourceType`과 각 entry의 `sourceKind`가 일치해야 한다. subset mapping은 나머지 Pal을 fallback으로 계산한다. 같은 파일 또는 같은 output hash가 여러 Pal에 대응하면 `image-overrides.json`에 정확한 Pal 목록과 한국어 사유가 있어야 한다. 일반종과 변종을 임의로 공유하지 않는다.

## Maintenance CLI

실제 source와 mapping이 준비된 host에서만 실행한다.

```bash
npm --workspace apps/server run import:palworld-images -- \
  --release 1.0.1 \
  --source-dir /srv/palworld-assets/1.0.1/pals \
  --mapping apps/server/src/data/palworld-mappings/image-source-map.json \
  --policy apps/server/data/palworld/1.0.1/image-use-policy.json
```

이 명령은 HTTP runtime과 연결되지 않는다. Dashboard/API에서 source path를 받을 수 없고, shell·`curl` subprocess, 외부 다운로드, URL proxy, scraping을 사용하지 않는다. 로그에는 source root의 절대경로나 원본 body를 출력하지 않는다.

경로 검증은 `path.resolve()`와 `realpath()`를 비교한다. source root 또는 file symlink, directory traversal, `/`, 역슬래시, NUL, `%` encoding과 `..`를 거부한다. regular file basename만 읽는다.

## 입력과 변환 규격

- 실제 PNG signature 또는 RIFF/WEBP signature만 허용
- SVG, GIF, MIME 위장 파일 거부
- APNG `acTL`, animated WebP `ANIM`/`ANMF`, multiple page 거부
- 원본 최대 16 MiB
- 원본 각 변 최대 8192px
- 원본 총 최대 16,777,216 pixels
- converter: exact `sharp@0.35.3`
- resize: 최대 512×512, `fit: inside`, `withoutEnlargement: true`, `lanczos3`
- WebP quality 순서: 90, 84, 78, 72
- `alphaQuality: 100`, `effort: 6`, `preset: picture`
- 출력 최대 512 KiB
- EXIF, XMP, ICC와 기타 metadata 제거
- 원본 비율 유지, crop 금지

출력은 실제 bytes의 SHA-256을 파일명으로 사용한다.

```text
apps/dashboard/public/images/palworld/1.0.1/pals/<64-hex-sha256>.webp
```

API에는 같은 origin의 아래 URL만 기록한다. 외부 URL, base64/data URL과 다른 release 경로는 schema에서 거부한다.

```text
/images/palworld/1.0.1/pals/<64-hex-sha256>.webp
```

## 월드 지도 자산

`pyPalworldAPI-0.2.0.zip`의 지도 821개 약 1.27GB를 전체 반입하지 않는다. 공개 `/palworld/map`은 strict decoder 검증을 통과한 `map_locations_fast_travel_world.png` 한 장만 사용한다. 원본 8192×8192 PNG를 `sharp@0.35.3`, WebP quality 82, effort 6으로 4096×4096까지 축소하고 metadata를 제거했다.

```text
/images/palworld/1.0.1/maps/<64-hex-sha256>.webp
```

선택·변환 결과는 [import-provenance.json](../apps/server/data/palworld/_imports/pypalworldapi-0.2.0/import-provenance.json)에 고정한다. Pal 전용 importer의 크기·pixel 제한을 완화하지 않으며 지도는 코드가 소유한 고정 allowlist 경로로만 노출한다. `map_locations_fast_travel_tree.png`는 ZIP CRC와 header는 정상이지만 strict decoder 검증에 실패하므로 공개하지 않는다. 나머지 Pal별 주야간 분포도와 장소별 합성 지도는 별도 lazy-load·좌표·권리 검증 기능이 준비되기 전까지 격리한다.

## 검증과 publish 순서

1. policy와 source mapping의 exact schema/checksum을 검증한다.
2. source root와 각 regular file을 검사한다.
3. 임시 image directory에서 WebP를 생성한다.
4. `paldex.json`, `images-manifest.json`, `import-report.json`, `manifest.json` 후보를 생성한다.
5. 임시 release와 실제 image bytes를 strict 검증한다.
6. 같은 입력으로 두 번 생성한 네 JSON이 byte-for-byte 같은지 확인한다.
7. content-hash 이미지 파일을 먼저 게시한다. 기존 같은 이름 파일은 bytes/hash가 일치할 때만 재사용한다.
8. JSON은 각 파일을 atomic rename하고 checksum 기준점인 `manifest.json`을 마지막에 게시한다.
9. 게시 위치를 다시 strict 검증한다.

검증 실패 시 기존 JSON release를 게시하지 않는다. 데이터 generator는 검증된 기존 image manifest와 실제 파일을 보존해야 하며, Pal ID나 source revision이 바뀌면 자동 추측하지 않는다.

## Manifest provenance

운영자 이미지 entry는 외부 `sourceUrl` 대신 공개 가능한 opaque `sourceReference`를 쓴다. 서버 export는 `operator-export-*`, 제공 archive는 `operator-archive-*`를 사용하며 절대경로는 기록하지 않는다.

- `status: operator_acknowledged`
- `license: RIGHTS_NOT_INDEPENDENTLY_VERIFIED`
- `usageBasis: operator_reference_use`
- 원본/output SHA-256과 byte/pixel 크기
- 고정 `sourceRevision`
- content-hash `imageUrl`

일부만 검증되면 overall status는 `partial`이며 누락 Pal은 fallback이다. 287종 전부 기술 검증되면 `operator_acknowledged`다. 이는 `licensed`, `approved`, `권리 확인 완료`가 아니다. `ready`는 별도의 명시적 권리 검증이 있을 때만 사용한다.

## Rollback

운영자가 공개 표시를 중단하려면 다음 maintenance 명령을 실행하고 server/dashboard를 재배포한다.

```bash
npm --workspace apps/server run rollback:palworld-images
```

명령은 다음 순서를 따른다.

1. policy를 `blocked_by_license`로 전환한다.
2. 모든 `imageUrl`과 활성 manifest 참조를 제거한다.
3. Pal 텍스트·수치 287종은 유지한다.
4. UI는 `PalworldMedia` fallback으로 돌아간다.
5. 기존 content-hash 파일은 즉시 삭제하지 않는다.

이미 받은 immutable 응답은 브라우저/CDN에 최대 1년 남을 수 있다. manifest 참조 제거와 재배포를 먼저 완료하고 CDN purge를 수행한다. 이후 접근 로그와 cache 정책에 맞는 유예 기간이 지난 뒤, 현재 및 rollback manifest가 참조하지 않는 content-hash 파일만 별도 승인된 정리 작업으로 삭제한다. 이미지 차단·손상은 Palworld 텍스트 API, `/health/ready`, LoL, Followers, Overlay, Dashboard tenant 격리와 OBS Bridge를 중단시키지 않아야 한다.
