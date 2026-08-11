# 발로란트 공개 데이터·전적 API

## 1. 범위와 안전 경계

발로란트 공개 기능은 다음 세 경계를 분리한다.

1. `features.valorantPublic`: `/api/valorant/*` route 공개 여부. `false`이면 모든 공개 API가 `404`이다.
2. `riot.valorantProductionApproved`: Riot 프로덕션 승인 여부. `false`여도 로컬 공식 카탈로그는 제공하지만 리더보드·스트리머 전적은 `HTTP 200 { "state": "approval_pending" }`만 반환한다.
3. 사용자 `valorantRecordConsent`: Riot identity 연결과 별개인 전적 공개 동의. 연결만으로 공개 대상이 되지 않는다.

공개 스트리머 조건은 서버에서 매 요청마다 다음 조건을 모두 확인한다.

```text
승인된 대표 스트리머 등록
  ∧ 활성 Twitch identity
  ∧ 활성 Riot RSO identity
  ∧ valorant-record-v1 공개 동의
  ∧ Riot 프로덕션 승인
```

PUUID, Riot API key, 원본 match 응답과 다른 참가자의 정보는 응답·로그에 포함하지 않는다. 공개 streamer ID는 내부 user UUID를 직접 노출하지 않는 SHA-256 기반 32자리 reference이다.

## 2. 계정 동의 API

`POST /api/account/riot/valorant-record-consent`

```json
{ "enabled": true }
```

- YORO Dashboard session cookie, `Content-Type: application/json`, trusted `Origin`, `X-Yoro-CSRF`가 필요하다.
- 최근 15분 이내 Twitch로 인증한 session과 활성 Riot RSO identity가 필요하다.
- exact body이며 `enabled` 이외 필드는 거부한다.
- `enabled:false`와 Riot 연결 해제는 즉시 공개 자격을 제거한다.

응답은 `valorantRecordConsent`, `enabled`, 활성화 시 `consentedAt`을 반환한다. `GET /api/account/session`의 Riot identity에도 `valorantRecordConsent:boolean`이 포함되지만 PUUID는 계속 비노출이다.

## 3. 공식 공개 카탈로그

- `GET /api/valorant/agents?offset=0&limit=50`
- `GET /api/valorant/weapons?offset=0&limit=50`
- `GET /api/valorant/maps?offset=0&limit=50`

`offset` 기본값은 `0`, `limit` 기본값은 `50`, 최대값은 `100`이다. 성공 응답은 `state:"ready"`, `items`, `offset`, `limit`, `total`, `returned`, `hasMore`, `metadata`를 반환한다. artifact가 없거나 검증에 실패하면 `HTTP 200 { "state": "data_unavailable" }`이다.

원본은 Riot Games 공식 `PublicContentCatalog-release-12.08.zip`이며 운영 이미지에는 필요한 한국어·일본어 텍스트만 추린 `apps/server/data/valorant/public-content-12.08.json`을 포함한다. 운영 Docker build는 1GB가 넘는 원본 ZIP을 다운로드하지 않는다.

```bash
npm --workspace apps/server run generate:valorant-catalog -- \
  --input /secure/path/PublicContentCatalog.json \
  --output apps/server/data/valorant/public-content-12.08.json \
  --extracted-at 2026-08-11T00:00:00.000Z \
  --verified-at 2026-08-11T00:00:00.000Z
```

원본에 없는 무기 가격은 `null`, 맵 사이트는 `[]`로 반환하고 추측하지 않는다. 현재 provenance:

- source SHA-256: `f77abda18ccd76bbb94c9d24e61594c97e5f917a6b5a01122dccf21a93f6bbba`
- artifact SHA-256: `b4e5ebb1c095bac03cf84609ea907da9271b845166e712cbd04baa9cdf0fa2ad`
- agents 29, standard weapons 20, standard maps 12, acts 39, queues 27

## 4. 리더보드와 스트리머 전적

`GET /api/valorant/leaderboard?region=kr|ap|na&act=<actId>`는 승인 전 `approval_pending`, 승인 후 top 500을 최대 200개 단위의 bounded upstream 요청으로 반환한다. `act` 생략 시 `riot.valorantCurrentActId`를 사용한다. cache는 5분 fresh, 30분 stale-while-revalidate이다. 익명 row는 `riotId`를 생략하고 PUUID는 parser 단계에서 버린다.

- `GET /api/valorant/streamers`
- `GET /api/valorant/streamers/<publicId>/matches?offset=0&limit=20`

스트리머 API는 `no-store`이다. 미등록·미동의·철회·잘못된 public ID는 모두 같은 `404 { "error": "not_found" }`이며 Database 장애는 `data_unavailable`이다. 대상 PUUID의 player row와 team 결과만 추출하고 상대·팀원·채팅·PUUID는 노출하지 않는다. match-v1 기본 통계로 정확히 계산할 수 없는 `headshotPercent`는 `null`이다. timeout은 Riot 공통 설정을 사용하며 network/5xx에 한해 최대 1회 재시도한다. Riot 문서상 생략 가능한 0값 통계는 0으로 복원하며, 60초 cache는 프로세스당 최대 2,000개로 제한합니다. 동의 철회·Riot 연결 해제 중 진행 중이던 요청도 visibility generation이 바뀌면 응답과 cache 저장을 폐기합니다.

## 5. 운영 활성화

승인 전 배포:

```json
{
  "features": { "valorantPublic": true },
  "riot": { "valorantProductionApproved": false }
}
```

승인 후에는 `/etc/yoro/secrets/riot_api_key`와 공식 current act UUID가 필요하다.

```json
{
  "features": { "valorantPublic": true },
  "riot": {
    "valorantProductionApproved": true,
    "valorantCurrentActId": "공식-current-act-uuid"
  }
}
```

승인 flag에 feature, current act 또는 Riot API key가 빠지면 config validation이 fail-closed한다.

## 6. Migration과 rollback

동의 table은 `0021_yoro_valorant_record_consent.sql`이다. 운영 적용은 `docs/SQL_MIGRATION_APPLICATION_RUNBOOK.md`를 따른다. 적용 후 구 image는 future schema mismatch로 readiness가 실패하므로 image-only rollback을 하지 않는다. 사전 Database backup 복원 또는 forward-fix migration을 사용한다.
