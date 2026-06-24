# Riot 프로필 자동 분석

## 개요

롤 시참 신청자가 `RiotID#태그`를 입력하면 서버가 Riot API와 Data Dragon을 사용해 프로필을 분석합니다.

분석 결과:

- Riot 계정 확인, PUUID 내부 저장
- 랭크 정보
- 모스트 챔피언 TOP 3
- 최근 경기 기반 추정 주라인
- 분석 상태: `pending`, `analyzing`, `ready`, `failed`, `rate_limited`

신청 자체는 분석 실패와 분리되어 있습니다. Riot API 일부가 실패해도 대기열 신청은 삭제하지 않습니다.

## 환경변수

```bash
RIOT_API_KEY=
RIOT_ACCOUNT_REGION=asia
RIOT_LOL_PLATFORM=kr
RIOT_RATE_LIMIT_ENABLED=true
RIOT_RATE_LIMIT_PER_SECOND=20
RIOT_RATE_LIMIT_PER_TWO_MINUTES=100
RIOT_RATE_LIMIT_QUEUE_MAX=500
```

Riot API key는 서버 환경변수로만 설정합니다. 코드, 프론트엔드, overlay, Git에는 저장하지 않습니다.
일본 서버 계정은 `RIOT_LOL_PLATFORM=jp1`, 한국 서버 계정은 `RIOT_LOL_PLATFORM=kr`을 사용합니다. `RIOT_ACCOUNT_REGION=asia`는 Riot ID/Match-V5 조회용 region이므로 보통 일본/한국 계정 모두 `asia`로 둡니다.
기본 rate limit 값은 Personal API Key 기준입니다. 서버는 host별 요청 큐로 `20 requests / 1초`, `100 requests / 2분`을 넘지 않도록 Riot API 호출을 지연합니다.

## 입력 형식

```text
!시참 HideOnBush#KR1
!시참 닉네임#KR1
!join HideOnBush#KR1
!参加 HideOnBush#KR1
```

`tagLine`이 없으면 신청자에게 `gameName#tagLine` 형식 안내를 보냅니다.
라인 입력은 필수가 아닙니다. 기존 호환을 위해 라인 토큰을 붙여도 파싱은 가능하지만, 기본 표시는 Riot API 최근 전적에서 추정한 주라인을 사용합니다.

## 공개 overlay 표시 정보

기본적으로 public overlay에는 다음만 표시합니다.

- Twitch display name
- 분석 상태
- 추정 주라인과 confidence
- 모스트 챔피언 이름/아이콘/대표 일러스트
- 주라인 아이콘 배지

랭크 정보는 서버/대시보드 분석 데이터로는 유지하지만, 방송용 시참 대기열 overlay에서는 랭크 티어 대신 주사용 챔피언 일러스트를 우선 표시합니다.

다음 값은 overlay로 보내지 않습니다.

- Riot PUUID
- raw Riot API payload
- refresh token/client secret/API key
- Riot ID 전체값, 기본값 false

`apps/server/config/lol-participation.json`의 `showRiotIdPublicly`는 기본 `false`입니다.

## Dashboard 표시 정보

Dashboard는 운영자용이므로 Riot ID, 분석 상태, 주라인, 모스트 챔피언, 랭크를 함께 표시합니다.

지원 기능:

- 프로필 새로고침
- 수동 role override
- 분석 실패/rate limit 상태 확인

## Cache 정책

프로필 cache는 `.streamops/lol-profiles.json`에 저장합니다. 현재 구현은 JSON repository이며, `LolProfileRepository` interface를 통해 나중에 SQLite/PostgreSQL로 교체할 수 있습니다.

기본 cache TTL:

```json
{
  "profileCacheTtlHours": 24
}
```

## Riot API rate limit

Riot API가 `429`를 반환하면 `rate_limited` 상태로 저장하고 `retry-after` 또는 config backoff를 기준으로 재시도 시점을 둡니다.

관련 설정:

```json
{
  "rateLimit": {
    "backoffMs": 60000,
    "maxBackoffMs": 900000
  }
}
```

## 사용 API

- Account-V1: Riot ID로 PUUID 조회
- Summoner-V4: PUUID로 summoner 정보 조회
- Champion-Mastery-V4: 모스트 챔피언 조회
- Match-V5: 최근 경기 role/champion 분석
- League-V4: 랭크 정보 조회
- Data Dragon: championId를 이름/아이콘으로 매핑

## Production Key 고려사항

개발 key는 rate limit이 낮고 만료될 수 있습니다. 실제 방송 운영에서 안정적으로 쓰려면 Riot Developer Portal에서 Production Key 신청을 고려해야 합니다. 공개 overlay는 정적/사전 정보만 표시하고, 게임 중 상대 정보나 비공개 match history 같은 경쟁 우위 정보를 표시하지 않도록 주의합니다.
