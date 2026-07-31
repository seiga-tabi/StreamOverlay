# YORO Bot Organization 관리와 Palworld REST 연결

`/dashboard/organizations`는 통합 YORO 로그인, Bot이 설치된 Guild claim, Organization과 Palworld 게임 서버 관리, Palworld REST 직접 연결을 제공하는 유일한 관리 화면입니다. 기존 `/bot/manage` 요청은 query를 allowlist로 정리한 뒤 이 경로로 redirect하며 별도 화면을 제공하지 않습니다. YORO 계정과 Discord·Twitch identity의 관계는 `YORO_ACCOUNT.md`에 정의되어 있습니다. Palworld 상태 조회는 저장된 REST 연결만 사용합니다. Notification Worker, Discord 상태 Embed, 서버 제어 기능은 이 단계에 포함하지 않습니다.

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
| 게임 서버 삭제 | 가능 | 불가 | 불가 |
| Palworld REST 테스트·저장·새로고침·삭제 | 가능 | 가능 | 조회만 |
| Discord Bot 공개 명령 설정 | 가능 | 가능 | 조회만 |

다른 Organization의 ID를 알고 있어도 같은 `not_found` 또는 권한 오류 경계 밖의 정보를 받을 수 없습니다.

## Free entitlement와 게임 서버

현재 생성 가능한 유형은 `palworld`, 새 연결 방식은 `rest`입니다. 스트리머는 자신의 REST 주소와 Palworld 전용 서버 설정의 `AdminPassword`를 직접 입력합니다. 브라우저는 Palworld 서버에 직접 접속하지 않으며, YORO Server가 URL·DNS·TLS 정책을 먼저 검증한 뒤 고정된 REST endpoint만 호출합니다.

Organization에는 삭제되지 않은 Palworld 게임 서버를 정확히 1개만 등록할 수 있습니다. 생성 transaction에서 entitlement row를 lock하고 등록 서버 수를 확인한 뒤 insert하며, Database unique index도 같은 제한을 강제하므로 동시 요청으로 한도를 초과하지 않습니다. 서버 삭제는 REST 연결을 제거하고 서버를 soft delete하여 이력을 보존합니다. entitlement 조회가 없거나 실패하면 무제한으로 완화하지 않고 fail-closed 처리합니다.

## Palworld REST와 자격 증명

- 공개 HTTPS 443 hostname은 `publicHttpsSelfService`가 활성화된 배포에서 직접 등록할 수 있습니다.
- HTTP, 별도 포트, LAN, VPN, 사설 IP는 운영자의 명시적인 outbound 정책 승인이 필요합니다.
- localhost, loopback, link-local, metadata 주소와 redirect는 allowlist로도 우회할 수 없습니다.
- DNS 검증 결과와 실제 연결 주소를 고정하고 poll마다 주소 정책을 다시 검증합니다.
- `AdminPassword`는 응답, 로그, URL, DOM 저장소에 반환하지 않습니다.
- 실제 `/v1/api/info` 인증과 schema 검증이 성공한 경우에만 공통 AES-256-GCM 저장소에 암호화해 저장합니다.
- 연결 테스트만으로 저장소를 변경하지 않습니다.
- 공통 암호화 key는 플랫폼 운영자가 한 번 준비하며 스트리머가 입력하거나 다운로드하지 않습니다.

기존 Agent bootstrap·Ingestion API는 제거되었습니다. 이미 저장된 legacy 연결 유형은 runtime에서 REST로만 정규화하므로 별도 DB migration 없이 기존 REST 자격 증명을 계속 사용합니다.

## Discord 일반 사용자 상태 명령

`runtime.json`의 `discord.prefixCommandsEnabled=true`인 경우 일반 사용자는
Discord 공개 채널에서 `!yoro status`, `!yoro player`,
`!yoro player {nickname}`, `!yoro guide`, `!yoro help`를 사용할
수 있습니다. 관리와 인증이 필요한 `/yoro setup`, `/yoro dashboard`는 기존
slash command로 유지합니다.

명령 입력은 영어 단일 문법만 지원합니다. Bot 응답은 Dashboard 설정 또는
Discord Guild locale에 따라 한국어·일본어로 표시합니다.

Discord의 일반 `!` 메시지는 작성자 전용 표시를 지원하지 않습니다. 상태,
플레이어와 가이드를 작성자에게만 보여야 할 때는 `/yoro status`,
`/yoro player`, `/yoro guide`를 사용하며 모든 응답은 ephemeral입니다.
이 명령도 아래 Organization별 enable 정책과 응답 언어를 동일하게 적용합니다.

`!yoro status` 요청은 Discord Application과 Guild의 활성 설치를 Server에서
다시 확인하고, 해당 Organization의 활성 Palworld 서버 한 개만 tenant-bound로
조회합니다. 응답에는 온라인 상태, 접속 인원, 게임 버전, 응답 시간과 마지막
확인 시각 중 안전한 값만 포함합니다. REST URL, 게임 접속 주소,
`AdminPassword`, token, credential, Organization ID와 내부 오류는 포함하지
않습니다.

사용자 문구는 Shared의 한국어·일본어 catalog를 Bot과 Dashboard가 함께
사용합니다. 등록 미완료, 운영 기능 비활성, 자격 증명 저장소 준비 실패,
Palworld 인증 실패, 연결 정책 차단, upstream 실패, stale과 부분 응답을
서로 다른 공개 사유로 표시합니다. 정상 응답에는 불필요한 Dashboard 버튼을
붙이지 않고 관리 작업이 필요한 경우에만 고정 관리 링크를 제공합니다.

prefix 응답은 ephemeral이 아닌 공개 메시지입니다. 따라서 민감한 설정 변경과
관리자 작업에는 prefix 명령을 추가하지 않습니다. 플레이어 조회는 현재 접속
중인 게임 내 닉네임을 대상으로 하며 YORO·Discord 계정 identity와 결합하지
않습니다. REST 원문의 IP·좌표·플랫폼 식별자는 파싱 직후 폐기합니다. 상태
이력 명령은 이력의 source·retention 정책과 Database schema를 별도 확정한 뒤
additive migration과 함께 구현합니다.

## Discord Bot Control Plane 1단계

Organization 관리 화면은 활성 Discord 설치가 확인된 경우 `Discord Bot 제어`
카드를 표시합니다. 현재 code-owned module registry에는
`palworld.status` version `1`만 존재하며 웹에서 임의 module, endpoint,
실행 action 또는 메시지 template을 등록할 수 없습니다.

관리 API:

- `GET /api/discord/management/organizations/:organizationId/bot-control`
- `PATCH /api/discord/management/organizations/:organizationId/bot-control`

모든 요청은 YORO session의 user ID와 Organization membership을 다시
검증합니다. `owner`와 `manager`만 설정을 변경할 수 있고 `viewer`는 조회만
가능합니다. mutation은 Origin과 session-bound CSRF를 검증하며 클라이언트가
보낸 user ID, role, Guild ID와 Application ID는 받거나 신뢰하지 않습니다.

설정 가능한 범위:

- 공개 prefix 명령 전체 사용 여부
- Palworld 상태 module 사용 여부
- `!yoro status`, `!yoro player`, `!yoro guide` 개별 사용 여부
- Bot 응답 성공 후 인식된 `!yoro` 원본 명령 메시지 삭제 여부
- 응답 언어 자동 감지·한국어·일본어
- 상태 응답의 접속 인원·게임 버전·응답 시간·마지막 확인 시각 표시 여부
- 현재 언어와 표시 항목을 적용한 Discord 상태 응답 미리보기

설정 row가 아직 없으면 기존 명령과의 호환을 위해 안전한 기본 설정을
읽기 전용으로 계산하며 GET만으로 Database row를 생성하지 않습니다.
`discord.prefixCommandsEnabled=false`는 Organization 설정보다 우선하는 운영
전역 kill switch입니다.

PATCH는 현재 revision을 `expectedRevision`으로 요구합니다. 같은 설정을 여러
관리자가 동시에 변경하면 먼저 commit한 요청만 성공하고 나머지는
`revision_conflict`로 최신 설정을 다시 조회합니다. 성공한 변경은
`discord_bot_control_revisions`에 안전한 설정 snapshot으로 append되고
`discord.bot.settings.updated` audit를 남깁니다. Guild 이름, raw token,
Discord 사용자 표시 이름과 request body 전체는 audit metadata에 기록하지
않습니다.

이 단계에는 임의 자동화 Builder, 예약 Job, moderation, role 지급, webhook,
mention, 사용자 작성 URL·Embed와 임의 Discord API action을 포함하지
않습니다. 후속 module은 Shared schema, 실행 allowlist, 권한·rate limit,
audit·revision과 테스트를 각각 갖춘 뒤 code-owned registry에 추가합니다.

`!yoro help`와 `/yoro help`는 저장된 명령 설정을 다시 조회하여 활성
명령만 표시합니다. 설정에서 비활성화된 명령을 실행하면 조용히 무시하지
않고 비활성 설치·module·command 중 공개 가능한 수준의 짧은 안내만
반환합니다.

## Migration과 staging 검증

1. PostgreSQL backup과 checksum을 검증합니다.
2. migration `check`, `plan`으로 `0006_bot_management_and_agent_bootstrap`부터 `0015_discord_command_message_cleanup`까지 순서와 checksum을 확인합니다.
3. 별도 운영 승인 후에만 `apply`합니다.
4. feature가 비활성인 image로 먼저 배포하고 기존 방송 기능과 health를 확인합니다.
5. staging Discord identity·Organization으로 Bot 설치 관찰, web claim, management login, role, tenant A/B, entitlement와 Palworld REST 연결 격리를 검증합니다.
6. 승인 후 feature flag를 활성화합니다.

Session key는 기존 OAuth encryption key와 역할이 다릅니다. 현재 opaque session은 별도 암호화 key가 필요하지 않으며 hash만 저장합니다. Discord client secret이나 OAuth encryption key를 회전하면 진행 중 OAuth state를 폐기하고 새 로그인을 시작합니다.

Rollback은 feature flag를 먼저 끄고 이전 immutable image로 되돌립니다. 적용된 migration SQL을 수정하거나 자동 down migration하지 않으며, application 호환성이 없을 때만 배포 전 backup을 별도 승인으로 복원합니다.
