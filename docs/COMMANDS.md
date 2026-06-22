# 채팅 명령어

StreamOps는 한국어 명령어를 기본으로 유지하면서 일본어/영어 alias도 함께 지원합니다. 영어 명령어는 대소문자를 구분하지 않고, 일본어 전각 느낌표 `！`도 일반 `!`처럼 처리합니다.

## 일반 명령어

| 기능 | 한국어 | 일본어 | 영어 |
| --- | --- | --- | --- |
| 디스코드 안내 | `!디코`, `!디스코드` | `!ディスコード`, `!ディスコ` | `!discord`, `!dc` |
| 오늘 방송 안내 | `!오늘` | `!今日`, `!きょう` | `!today`, `!schedule` |
| 클립 후보 저장 | `!클립` | `!クリップ` | `!clip` |
| 질문 등록 | `!질문` | `!質問`, `!しつもん` | `!question`, `!q` |
| 비상 테스트 | `!비상테스트` | `!緊急テスト` | `!emergencytest`, `!emergency-test` |

## 채팅 Overlay 표시 정책

`chat` overlay는 LINE 채팅창 느낌으로 일반 Twitch 채팅을 표시합니다.

- OBS Browser Source URL: `http://localhost:5174/?mode=chat`
- 권장 크기: `470 x 590`
- 기본 설정에서는 `!질문`, `!시참`, `!join` 같은 명령어 메시지는 채팅 overlay에 직접 표시하지 않습니다.
- 표시 여부는 `apps/server/config/chat-overlay.json`의 `enabled`, `hideCommands`, `maxMessageLength`로 조정합니다.
- 한국어↔일본어 채팅 번역은 `CHAT_TRANSLATION_*` 환경변수와 [CHAT_TRANSLATION.md](./CHAT_TRANSLATION.md)를 참고합니다.

## 롤 시참 명령어

| 기능 | 한국어 | 일본어 | 영어 |
| --- | --- | --- | --- |
| 시참 신청 | `!시참`, `!참가` | `!参加`, `!さんか` | `!join`, `!participate`, `!loljoin` |
| 참가 확인 | `!참가확인`, `!시참확인` | `!参加確認`, `!さんか確認` | `!checkin`, `!check-in`, `!ready` |
| 참가 취소 | `!시참취소`, `!참가취소` | `!参加取消`, `!参加キャンセル`, `!キャンセル` | `!cancel`, `!leave`, `!quit` |
| 모집 시작 | `!시참시작`, `!참가시작` | `!参加開始`, `!参加募集開始`, `!さんか開始` | `!joinstart`, `!participationstart`, `!queueopen`, `!openqueue` |
| 모집 종료 | `!시참종료`, `!참가종료` | `!参加終了`, `!参加募集終了`, `!さんか終了` | `!joinend`, `!participationstop`, `!queueclose`, `!closequeue` |

`모집 시작`, `모집 종료`는 방송자 또는 moderator만 사용할 수 있습니다.

다음 참가자 선정은 방송자 게임 종료 감지 후 자동으로 처리합니다. 수동 `!다음시참` 계열 명령어는 더 이상 사용하지 않습니다.

참가 취소는 본인의 대기열 신청만 취소합니다. 이미 게임 중으로 처리된 참가자는 채팅 명령어로 취소할 수 없고, 방송자가 직접 확인해야 합니다.

## 시참 신청 예시

```text
!시참 HideOnBush#KR1
!join HideOnBush#KR1
!参加 HideOnBush#KR1
```

라인은 입력하지 않아도 됩니다. 서버가 Riot API 최근 전적을 분석해서 주라인을 overlay와 dashboard에 표시합니다.

기존 사용자를 위해 라인 입력은 호환용으로 계속 받을 수 있지만, 방송용 overlay의 주라인 표시는 전적 기반 분석 결과를 우선 사용합니다.

호환용 라인 입력:

| 라인 | 한국어 | 일본어 | 영어 |
| --- | --- | --- | --- |
| 탑 | `탑`, `탑솔` | `トップ`, `上` | `top`, `top lane` |
| 정글 | `정글` | `ジャングル` | `jungle`, `jg` |
| 미드 | `미드` | `ミッド`, `中央` | `mid`, `middle` |
| 원딜 | `원딜`, `바텀` | `ボット`, `ボトム` | `adc`, `bot`, `bottom` |
| 서폿 | `서폿`, `서포터` | `サポート`, `サポ` | `support`, `sup` |
| 아무 라인 | `아무라인`, `상관없음`, `올포지션` | `どこでも`, `おまかせ`, `なんでも` | `fill`, `any role` |
