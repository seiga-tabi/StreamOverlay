# LoL 시참 및 Riot 전적 연동

## 신청 방법

```text
!시참 RiotName#KR1
!join RiotName#KR1
!参加 RiotName#KR1
!참가확인
!checkin
!参加確認
!시참취소
!cancel
!参加取消
```

또는 Twitch 채널 포인트 리워드 `롤 시참 신청`의 user input으로 신청할 수 있습니다.

라인은 신청자가 직접 적지 않아도 됩니다. Riot API 최근 전적 분석 결과로 주라인을 추정하고, overlay에는 그 주라인을 표시합니다.

참가 취소는 본인의 대기열 신청에만 적용됩니다. `in_game` 상태로 넘어간 뒤에는 채팅 취소를 막고, 방송자 확인을 안내합니다.

## 상태 흐름

```text
pending → waitlisted → selected → checked_in → invited → in_game → played
                      ↘ no_show / skipped / rejected / cancelled
```

## Riot API 설정

Riot API key가 설정되어 있으면 신청 시 다음 순서로 조회합니다.

1. `account-v1`: `RiotID#태그`로 PUUID 조회
2. `summoner-v4`: PUUID로 소환사 레벨과 profile icon 조회
3. `league-v4`: summoner id로 솔로랭크/자유랭크 전적 조회

필요한 환경변수:

```bash
RIOT_API_KEY=
RIOT_ACCOUNT_REGION=asia
RIOT_LOL_PLATFORM=kr
RIOT_RATE_LIMIT_ENABLED=true
RIOT_RATE_LIMIT_PER_SECOND=20
RIOT_RATE_LIMIT_PER_TWO_MINUTES=100
RIOT_RATE_LIMIT_QUEUE_MAX=500
```

`RIOT_ACCOUNT_REGION`은 `asia`, `americas`, `europe`, `sea` 같은 account routing region을 사용합니다. `RIOT_LOL_PLATFORM`은 한국 서버 기준 `kr`, 일본 서버 기준 `jp1`을 사용합니다.
기본 rate limit 값은 Personal API Key 기준인 `20 requests / 1초`, `100 requests / 2분`에 맞춰져 있습니다. Production key를 승인받은 경우에만 `RIOT_RATE_LIMIT_PER_SECOND`, `RIOT_RATE_LIMIT_PER_TWO_MINUTES` 값을 올리세요.

## 랭크 표시 기준

- 솔로랭크(`RANKED_SOLO_5x5`)를 우선 표시합니다.
- 솔로랭크가 없으면 자유랭크(`RANKED_FLEX_SR`)를 표시합니다.
- 둘 다 없으면 `UNRANKED`와 소환사 레벨만 표시합니다.
- Riot API 랭크 조회가 실패해도 Riot ID 확인이 끝났다면 시참 신청은 유지하고, 전적 없이 대기열에 올립니다.

## Overlay 개인정보 기준

OBS overlay에는 Riot ID, PUUID, raw Riot payload를 표시하지 않습니다.

Overlay로 전달되는 안전 필드:

- Twitch display name
- 전적 기반 추정 주라인
- status
- queue type
- tier / rank / LP
- wins / losses / win rate
- summoner level
- profile icon id

Dashboard 운영 화면은 관리 목적으로 Riot ID와 랭크 전적을 함께 표시합니다.

## 대시보드 기능

- 모집 시작/종료
- 대기열 보기
- 게임 종료 감지 후 다음 참가자 자동 선정 상태 확인
- 전적 기반 주라인 확인
- Riot ID와 랭크 전적 확인
- 노쇼/스킵/완료 처리, 향후

## OBS overlay

- 대기열 최대 4명과 생략 인원 표시
- 모스트 챔피언 일러스트 위에 닉네임, 챔피언, 상태, 주라인 표시
- 팀 구성 표시, 향후

## 게임 중 자동 감시

Dashboard의 LoL 시참 관리 화면에서 방송자 Riot ID를 저장하면 방송자의 현재 게임을 감시할 수 있습니다. 직접 파일로 관리해야 하는 배포에서는 `apps/server/config/lol-participation.json`의 `gameMonitor` 설정을 기본값으로 사용할 수도 있습니다.

대시보드에서 저장한 운영값은 `apps/server/config`가 아니라 `.streamops/lol-game-monitor.json`에 저장됩니다. Docker 배포에서는 이 경로가 `streamops_state` volume으로 관리되므로, `apps/server/config`를 read-only로 마운트해도 저장이 실패하지 않습니다.

```json
{
  "gameMonitor": {
    "enabled": true,
    "streamerRiotId": "StreamerName#KR1",
    "pollIntervalMs": 45000,
    "gameEndDebounceMs": 90000,
    "autoSelectNextAfterGame": true,
    "announceInChat": true
  }
}
```

동작 흐름:

1. 방송자 Riot ID로 PUUID를 조회합니다.
2. Spectator API로 현재 게임 여부를 주기적으로 확인합니다.
3. 게임이 감지되면 참가 확인 완료/선정 상태의 참가자를 `in_game`으로 바꾸고 overlay에 `ゲーム中`과 다음 대기 후보를 표시합니다.
4. 게임 중에는 남은 대기열을 계속 overlay에 보여주므로, 게임 종료 감지 지연이 있어도 다음 참가자 정보를 미리 확인할 수 있습니다.
5. 게임이 끝난 것으로 감지되면 `gameEndDebounceMs`만큼 기다린 뒤 `in_game` 참가자를 `played`로 변경합니다.
6. `autoSelectNextAfterGame`이 `true`이면 종료 처리 후 다음 대기자를 자동 선정합니다. 실제 선정은 확인 시간 만료를 피하기 위해 게임 시작 직후가 아니라 종료 처리 시점에 수행합니다.

주의:

- `streamerRiotId`가 비어 있으면 감시가 시작되지 않습니다.
- Riot Spectator API는 간헐적으로 지연/404가 발생할 수 있어 `gameEndDebounceMs`를 너무 짧게 잡지 않는 편이 안전합니다.
- public overlay에는 PUUID, Riot ID, raw Riot payload를 보내지 않습니다.

## 참고

Riot API는 공식 Developer Portal의 `account-v1`, `summoner-v4`, `league-v4`, `spectator-v5` API를 사용합니다.
