# PostgreSQL 기반 구조

PostgreSQL은 Discord SaaS, YORO 통합 계정과 게임 서버 상태 기능의 기반입니다. 방송 운영용 Twitch token, Followers, Riot ID, Overlay, Community, Palworld runtime은 기존 JSON·파일 저장소를 그대로 사용하며 PostgreSQL로 복제하거나 dual-write하지 않습니다. YORO 로그인 사용자의 공개 LIVE 조회용 Twitch credential만 별도 목적과 수명으로 암호화 저장합니다.

## 활성화

기본값은 `features.database=false`입니다. 이 상태에서는
`/run/secrets/database_url`을 읽지 않고 pool 생성, 연결, migration 검사를 모두
생략하므로 기존 Server readiness에 영향을 주지 않습니다.

활성화 설정은 `/etc/yoro/runtime.json`에 둡니다.

```json
{
  "features": {
    "database": true
  },
  "database": {
    "poolMax": 10,
    "sslMode": "disable"
  }
}
```

연결 URL은 고정 경로 `/run/secrets/database_url`에서만 읽습니다. connection,
idle, statement timeout과 migration mode는 검증된 TypeScript 기본값을
사용합니다. production은 기본 계정·약한 password를 거부하고, 공개
hostname에는 `sslMode=verify-full`을 요구합니다. URL과 credential은
로그·health 응답에 포함하지 않습니다.

## Local·staging Compose

PostgreSQL은 `database` profile에만 존재하며 host port를 기본 공개하지 않습니다.

```bash
docker compose --env-file /dev/null --profile database up -d postgres
```

실제 실행 전 `/etc/yoro/secrets/postgres_password`와
`/etc/yoro/secrets/database_url`을 준비하고 `0600` 권한을 적용합니다.
Server 컨테이너에는 연결 URL만, PostgreSQL 컨테이너에는 password 파일만
제공합니다.

PostgreSQL은 application state와 분리된 `postgres_data` volume과 internal network를 사용합니다. 기본 pool 10개이며 향후 Bot·Worker pool을 포함한 총합은 PostgreSQL `max_connections=30` 안에서 운영합니다. 4GB VPS에서는 Server, Bot, Worker의 pool 합계를 먼저 계산한 뒤 늘립니다.

## Tenant 격리

모든 tenant table은 `organization_id NOT NULL`을 가집니다. 관계가 있는 table은 `(organization_id, resource_id)` composite foreign key를 사용해 다른 조직의 ID를 연결할 수 없게 합니다.

Repository 공개 method는 항상 `TenantContext`를 요구합니다.

```ts
type TenantContext = {
  organizationId: string;
  actorUserId?: string;
};
```

ID만 받는 전역 조회 method는 만들지 않습니다. 조회·수정·삭제 모두 `organization_id` 조건을 포함하며 cross-tenant 결과는 `not_found`와 동일하게 처리합니다.

## 상태와 보안

- Discord·Twitch token 원문 column을 만들지 않습니다.
- YORO 공개 LIVE 조회용 Twitch credential은 `TWITCH_TOKEN_ENCRYPTION_KEY`와 사용자별 AAD로 AES-256-GCM 암호화하며, 계정 연결 해제 시 암호문도 즉시 폐기합니다.
- Agent credential은 원문이 아니라 hash만 저장합니다.
- Agent 전체 payload를 history에 저장하지 않고 필요한 metric만 column으로 저장합니다.
- `/health/live`는 Database 장애와 독립적입니다.
- 활성 Database가 unavailable·migration pending·mismatch이면 `/health/ready`가 실패합니다.
- migration은 Server 시작 시 자동 적용하지 않습니다.

Discord OAuth onboarding은 `0004_discord_oauth_onboarding`부터 이 기반을 사용합니다. OAuth가 생성한 Organization과 Guild 관계도 transaction 안에서 저장되며, setup token·OAuth state는 원문 대신 SHA-256 hash만 저장합니다.

`0007_agent_registration_and_ingestion`부터 Agent 등록과 status 저장 기반을 사용합니다. Agent credential과 nonce는 SHA-256 hash만 저장하고, current·history·online/offline event는 하나의 transaction에서 갱신합니다. 오래된 관측은 current를 덮지 않습니다. Agent daemon은 별도 process로 구현되어 있고 Notification Worker는 아직 구현하지 않았습니다.

`0008_web_management_guild_claim`은 기존 setup session에 `web_management` 발급 목적을 additive하게 허용합니다. 웹 claim은 관리 가능한 Discord Guild와 Bot 설치 관찰을 재검증하고 Organization·membership·Guild·installation·management session을 하나의 transaction으로 확정합니다.

`0011_yoro_twitch_viewer_credentials`는 YORO 계정의 Twitch LIVE 조회 credential을 사용자 identity에 귀속합니다. OAuth access·refresh token 원문은 저장하지 않고 암호문과 access token 만료 시각만 저장하며, LIVE API는 YORO session의 user ID를 다시 확인한 뒤에만 복호화합니다.
# YORO Agent 상태 경계

Agent는 Database에 직접 연결하지 않습니다. bootstrap 등록과 status ingestion은 Server API만 통하며 credential 원문은 Agent의 권한 제한 파일에만 남습니다. Server Database에는 credential hash, current status, allowlist history metric, online/offline event만 저장합니다.

Agent 로컬 offline buffer는 마지막 미전송 payload 한 개만 보존하며 Database JSON fallback으로 사용하지 않습니다. Notification Worker와 Discord 상태 메시지는 별도 후속 단계입니다.
