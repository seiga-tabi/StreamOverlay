# Database migration 운영

Migration은 `apps/server/migrations`의 versioned SQL과 `manifest.json` checksum을 기준으로 실행합니다. 적용된 SQL은 수정하지 않고 변경이 필요하면 다음 번호의 migration을 추가합니다.

## 명령

명령은 실제 `.env`를 자동 사용하지 않도록 운영 환경에서 명시적인 secret 주입과 함께 실행합니다.

```bash
npm --workspace apps/server run db:migrate:check
npm --workspace apps/server run db:migrate:plan
npm --workspace apps/server run db:migrate:apply -- --apply
```

production 적용은 추가 확인이 필요합니다.

```bash
npm --workspace apps/server run db:migrate:apply -- --apply --confirm-production
```

- `check`: 연결, 적용 순서, checksum, dirty·미래 schema, pending 상태를 읽기 전용으로 검사합니다.
- `plan`: 적용할 ID·설명·destructive 여부·transaction 여부만 표시하며 SQL·credential은 출력하지 않습니다.
- `apply`: advisory lock을 획득하고 migration별 transaction으로 실행합니다.

Server의 `DATABASE_MIGRATION_MODE`는 `check`만 허용합니다. Server 시작 과정에서 migration을 자동 적용하지 않습니다.

## 안전 규칙

1. 배포 전에 `check`와 `plan`을 실행합니다.
2. Database backup과 checksum 검증을 완료합니다.
3. 하나의 runner만 `apply`를 실행합니다.
4. 실패하면 해당 transaction은 rollback되고 적용 기록을 남기지 않습니다.
5. 적용 후 `check`가 `ready`인지 확인합니다.
6. 이미 적용된 SQL이나 manifest checksum을 수정하지 않습니다.
7. Database가 예상보다 새로운 version이면 이전 application을 실행하지 않습니다.

`schema_migrations`에는 migration ID, SHA-256, 적용 시각, 실행 시간, application version, dirty 상태를 저장합니다. SQL·parameter·Database URL은 로그나 public API에 노출하지 않습니다.

현재 Discord·YORO 기반 migration은 onboarding `0004`, Bot binding `0005`, Organization 관리 session과 Agent bootstrap `0006`, Agent credential·nonce·status idempotency 기반 `0007`, 웹 management Guild claim 목적 기반 `0008`, YORO 통합 계정·외부 identity·범용 session 기반 `0009`, 사용자별 Dashboard 개인 설정 기반 `0010`, YORO Twitch LIVE 조회 credential 암호화 저장 기반 `0011`, Organization당 Palworld 서버 1개 제한과 기존 비활성 항목 정리 `0012`, Organization별 Discord Bot module·명령 설정과 append-only revision 기반 `0013`입니다. 기존에 적용한 `0001`~`0012` SQL은 수정하지 않았습니다. staging에서 `check`와 `plan`을 확인한 뒤 별도 승인으로 pending migration을 적용합니다. `0012`는 기존 비활성 항목을 soft delete하므로 backup 확인 후 `--allow-destructive` 승인이 추가로 필요합니다. `0013`은 additive·transaction migration이며 실행 전에도 backup과 checksum 검증을 생략하지 않습니다.

## Rollback

자동 down migration은 제공하지 않습니다. application rollback이 새 schema와 호환되지 않으면 배포 전 PostgreSQL backup으로 전체 restore합니다. schema 변경과 application image를 하나의 release 단위로 기록하고, rollback 기간 동안 이전 immutable image와 backup을 보존합니다.
