# Staging 실계정 E2E

## 목적

Riot, Twitch, EventSub, OBS는 mock과 로컬 smoke만으로 production 동작을 보증할 수 없다. release candidate와 동일한 Git SHA/image를 staging에 배포하고 운영과 분리된 계정으로 검증한다.

## GitHub Environment 준비

GitHub `staging` environment에 다음 secret을 등록한다. 값은 로그나 artifact에 출력하지 않는다.

- `STAGING_RIOT_ID`: 검색이 허용된 staging 검증용 Riot ID
- `STAGING_DASHBOARD_TOKEN`: staging dashboard 전용 token

선택적으로 repository secret `OPS_ALERT_WEBHOOK_URL`을 등록하면 edge monitor 실패를 HTTPS webhook으로 전달한다.

`.github/workflows/staging-smoke.yml`을 수동 실행하고 아래 input을 입력한다.

- `base_url`: staging HTTPS origin
- `require_obs`: 방송 PC bridge와 OBS가 준비된 검증 창에만 `true`

자동 결과 JSON은 workflow artifact로 90일 보관한다.

## 수동 E2E 시나리오

자동 smoke 후 아래 항목을 실제 계정과 OBS에서 수행한다.

1. Twitch OAuth 로그인 후 기대 scope와 계정이 표시된다.
2. EventSub follow, subscription 또는 test event가 한 번만 수신된다.
3. OBS Browser Source URL과 token이 외부에 노출되지 않는다.
4. overlay가 표시되고 bridge/OBS 재연결 후 상태가 복구된다.
5. Riot ID 검색, profile, recent matches가 production key로 성공한다.
6. 시청자 참여 신청, 취소, 체크인, 재참여가 정상 동작한다.
7. application 재시작 후 영속 대상 상태가 복원된다.
8. SIGTERM 종료 중 readiness가 503으로 전환되고 종료 후 새 instance가 ready가 된다.

## 증적

`docs/operations/STAGING_E2E_LOG.md`에 다음을 기록한다.

- 검증 일시와 담당자
- release Git SHA와 image digest
- staging URL
- GitHub Actions run URL과 artifact 이름
- 사용한 계정의 식별 가능한 최소 정보(credential 금지)
- 각 시나리오 PASS/FAIL
- 스크린샷 또는 로그 링크(개인정보와 token 마스킹)
- 발견 이슈와 release 차단 여부

최근 release candidate SHA에 대한 성공 기록이 없으면 production GO로 판정하지 않는다.
