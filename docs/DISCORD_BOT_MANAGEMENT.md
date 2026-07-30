# YORO Bot Organization 관리와 Palworld REST 연결

`/dashboard/organizations`는 통합 YORO 로그인, Bot이 설치된 Guild claim, Organization과 Palworld 게임 서버 관리, Palworld REST 직접 연결을 제공하는 유일한 관리 화면입니다. 기존 `/bot/manage` 요청은 query를 allowlist로 정리한 뒤 이 경로로 redirect하며 별도 화면을 제공하지 않습니다. YORO 계정과 Discord·Twitch identity의 관계는 `YORO_ACCOUNT.md`에 정의되어 있습니다. 기존 Agent protocol은 배포 호환 경로로 남지만 Dashboard의 기본 등록 흐름에서는 사용하지 않습니다. Notification Worker, Discord 상태 Embed, 서버 제어 기능은 이 단계에 포함하지 않습니다.

## Onboarding OAuth와 관리 OAuth

- web management connect는 `identify guilds` scope로 Guild 권한과 Bot 설치를 검증하고 Organization을 처음 연결합니다.
- `/yoro setup` onboarding은 같은 검증을 Guild·실행자에게 귀속된 일회용 링크로 수행하는 복구 경로입니다.
- management login은 `identify` scope만 사용해 기존 `discord_identity`를 정확히 확인합니다.
- `/login`은 Discord 또는 Twitch identity로 동일한 YORO session을 발급하며 `/dashboard/organizations`가 이 session만으로 Organization과 Bot 설정을 제공합니다.
- Dashboard에서 시작한 Discord Guild 연결은 현재 YORO session의 내부 user ID에 binding됩니다. `/yoro setup`에서 시작한 연결은 완료 transaction에서 YORO session을 새로 발급합니다.
- 기존 Discord management session은 단계적 전환을 위한 호환 경로로만 유지합니다.
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
| Palworld REST 테스트·저장·새로고침·삭제 | 가능 | 가능 | 조회만 |

다른 Organization의 ID를 알고 있어도 같은 `not_found` 또는 권한 오류 경계 밖의 정보를 받을 수 없습니다.

## Free entitlement와 게임 서버

현재 생성 가능한 유형은 `palworld`, 새 연결 방식은 `rest`입니다. 스트리머는 자신의 REST 주소와 Palworld 전용 서버 설정의 `AdminPassword`를 직접 입력합니다. 브라우저는 Palworld 서버에 직접 접속하지 않으며, YORO Server가 URL·DNS·TLS 정책을 먼저 검증한 뒤 고정된 REST endpoint만 호출합니다.

Free 기본값은 활성 게임 서버 1개입니다. 생성 transaction에서 entitlement row를 lock하고 활성 서버 수를 확인한 뒤 insert하므로 동시 요청으로 한도를 초과하지 않습니다. entitlement 조회가 없거나 실패하면 무제한으로 완화하지 않고 fail-closed 처리합니다.

## Palworld REST와 자격 증명

- 공개 HTTPS 443 hostname은 `publicHttpsSelfService`가 활성화된 배포에서 직접 등록할 수 있습니다.
- HTTP, 별도 포트, LAN, VPN, 사설 IP는 운영자의 명시적인 outbound 정책 승인이 필요합니다.
- localhost, loopback, link-local, metadata 주소와 redirect는 allowlist로도 우회할 수 없습니다.
- DNS 검증 결과와 실제 연결 주소를 고정하고 poll마다 주소 정책을 다시 검증합니다.
- `AdminPassword`는 응답, 로그, URL, DOM 저장소에 반환하지 않습니다.
- 실제 `/v1/api/info` 인증과 schema 검증이 성공한 경우에만 공통 AES-256-GCM 저장소에 암호화해 저장합니다.
- 연결 테스트만으로 저장소를 변경하지 않습니다.
- 공통 암호화 key는 플랫폼 운영자가 한 번 준비하며 스트리머가 입력하거나 다운로드하지 않습니다.

기존 Agent bootstrap·Ingestion API는 이미 배포된 설치의 호환성을 위해 유지합니다. 신규 Dashboard UI는 Agent 설치 토큰을 발급하지 않습니다.

## Migration과 staging 검증

1. PostgreSQL backup과 checksum을 검증합니다.
2. migration `check`, `plan`으로 `0006_bot_management_and_agent_bootstrap`, `0007_agent_registration_and_ingestion`, `0008_web_management_guild_claim`을 확인합니다.
3. 별도 운영 승인 후에만 `apply`합니다.
4. feature가 비활성인 image로 먼저 배포하고 기존 방송 기능과 health를 확인합니다.
5. staging Discord identity·Organization으로 Bot 설치 관찰, web claim, management login, role, tenant A/B, entitlement와 Palworld REST 연결 격리를 검증합니다.
6. 승인 후 feature flag를 활성화합니다.

Session key는 기존 OAuth encryption key와 역할이 다릅니다. 현재 opaque session은 별도 암호화 key가 필요하지 않으며 hash만 저장합니다. Discord client secret이나 OAuth encryption key를 회전하면 진행 중 OAuth state를 폐기하고 새 로그인을 시작합니다.

Rollback은 feature flag를 먼저 끄고 이전 immutable image로 되돌립니다. 적용된 migration SQL을 수정하거나 자동 down migration하지 않으며, application 호환성이 없을 때만 배포 전 backup을 별도 승인으로 복원합니다.
