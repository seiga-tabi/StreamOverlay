# YORO Bot Organization 관리와 Agent 연결

`/bot/manage`는 Discord 웹 로그인, Bot이 설치된 Guild claim, Organization과 Palworld 게임 서버 관리, 10분 일회용 Agent 설치 토큰 발급을 제공합니다. Agent daemon과 Server의 등록·상태 Ingestion protocol은 구현되어 있으며 `YORO_AGENT.md`, `YORO_AGENT_PROTOCOL.md`에 정의되어 있습니다. staging 실연동과 Notification Worker, Discord 상태 Embed, 서버 제어 기능은 이 단계에 포함하지 않습니다.

## Onboarding OAuth와 관리 OAuth

- web management connect는 `identify guilds` scope로 Guild 권한과 Bot 설치를 검증하고 Organization을 처음 연결합니다.
- `/yoro setup` onboarding은 같은 검증을 Guild·실행자에게 귀속된 일회용 링크로 수행하는 복구 경로입니다.
- management login은 `identify` scope만 사용해 기존 `discord_identity`를 정확히 확인합니다.
- 연결과 기존 사용자 로그인 흐름의 state, PKCE AAD와 cookie는 목적별로 분리됩니다.
- management callback은 access token을 Database에 저장하지 않고 사용자 확인이 끝난 뒤 폐기합니다. refresh token은 영구 저장하지 않습니다.

관리 기능은 `runtime.json`의 `features.discordBotManagement=false`가
기본값입니다. 활성화하려면 Database와 Discord SaaS가 모두 준비되어야 하며
migration은 Server 시작 과정에서 자동 적용하지 않습니다.

Guild claim 완료 시 새로운 management session을 같은 transaction에서 발급합니다. OAuth access token과 setup token을 management session으로 전환하거나 재사용하지 않습니다.

## 관리 session

로그인 성공 시 YORO 전용 opaque session token과 CSRF token을 새로 생성합니다.

- Database에는 두 token의 SHA-256 hash만 저장합니다.
- cookie는 `HttpOnly`, production `Secure`, `SameSite=Lax`로 설정합니다.
- idle timeout은 최대 8시간, absolute lifetime은 최대 24시간입니다.
- mutation은 session-bound CSRF token과 Origin을 함께 검증합니다.
- logout, idle·absolute 만료와 security failure는 session을 즉시 사용할 수 없게 합니다.
- Organization ID는 선택 힌트일 뿐이며 모든 요청에서 membership과 role을 다시 조회합니다.

## Organization role

| 기능 | owner | manager | viewer |
|---|---:|---:|---:|
| Organization·게임 서버 조회 | 가능 | 가능 | 가능 |
| Palworld 게임 서버 생성 | 가능 | 가능 | 불가 |
| 게임 서버 비활성화 | 가능 | 불가 | 불가 |
| Agent 설치 토큰 발급·폐기 | 가능 | 가능 | 불가 |

다른 Organization의 ID를 알고 있어도 같은 `not_found` 또는 권한 오류 경계 밖의 정보를 받을 수 없습니다.

## Free entitlement와 게임 서버

현재 생성 가능한 유형은 `palworld`, 연결 방식은 `agent`뿐입니다. RCON password, AdminPassword, 내부 주소는 받지 않습니다.

Free 기본값은 활성 게임 서버 1개입니다. 생성 transaction에서 entitlement row를 lock하고 활성 서버 수를 확인한 뒤 insert하므로 동시 요청으로 한도를 초과하지 않습니다. entitlement 조회가 없거나 실패하면 무제한으로 완화하지 않고 fail-closed 처리합니다.

## Agent bootstrap token

- token 원문은 발급 응답 한 번에서만 반환합니다.
- Database와 audit log에는 SHA-256 hash만 저장합니다.
- 기본 만료는 10분입니다.
- Organization, game server와 발급 사용자에 귀속됩니다.
- 한 game server에는 활성 token 하나만 허용합니다.
- 새 token 발급은 같은 transaction에서 이전 활성 token을 폐기합니다.
- UI는 token을 `localStorage`, URL, analytics 또는 오류 payload에 저장하지 않습니다.
- staging 검증 전에는 존재하지 않거나 검증되지 않은 `docker run`, mutable `latest` image 또는 download URL을 제공하지 않습니다.

유출이 의심되면 관리 화면에서 즉시 폐기하고 새 token을 발급합니다. bootstrap은 `/api/agent/v1/register`에서 한 번 소비되며, 반환된 Agent credential 원문은 응답 한 번에서만 확인할 수 있습니다.

## Migration과 staging 검증

1. PostgreSQL backup과 checksum을 검증합니다.
2. migration `check`, `plan`으로 `0006_bot_management_and_agent_bootstrap`, `0007_agent_registration_and_ingestion`, `0008_web_management_guild_claim`을 확인합니다.
3. 별도 운영 승인 후에만 `apply`합니다.
4. feature가 비활성인 image로 먼저 배포하고 기존 방송 기능과 health를 확인합니다.
5. staging Discord identity·Organization으로 Bot 설치 관찰, web claim, management login, role, tenant A/B, entitlement와 token 폐기를 검증합니다.
6. 승인 후 feature flag를 활성화합니다.

Session key는 기존 OAuth encryption key와 역할이 다릅니다. 현재 opaque session은 별도 암호화 key가 필요하지 않으며 hash만 저장합니다. Discord client secret이나 OAuth encryption key를 회전하면 진행 중 OAuth state를 폐기하고 새 로그인을 시작합니다.

Rollback은 feature flag를 먼저 끄고 이전 immutable image로 되돌립니다. 적용된 migration SQL을 수정하거나 자동 down migration하지 않으며, application 호환성이 없을 때만 배포 전 backup을 별도 승인으로 복원합니다.
