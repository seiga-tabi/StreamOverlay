# YORO.gg SQL Migration 추가·검증·운영 적용 Runbook

> 기준일: 2026-08-08
>
> 목적: 새로운 PostgreSQL SQL 파일을 추가할 때 개발 검증부터 운영 적용, 장애 진단, rollback까지 동일한 절차로 수행하기 위한 단일 실행 가이드
>
> 현재 manifest 기준 최신 migration: 0019_admin_audit_logs

---

## 목차

1. [핵심 원칙](#1-핵심-원칙)
2. [Migration 구조](#2-migration-구조)
3. [새 SQL 작성 절차](#3-새-sql-작성-절차)
4. [Manifest 등록](#4-manifest-등록)
5. [개발 환경 검증](#5-개발-환경-검증)
6. [운영 적용 전 준비](#6-운영-적용-전-준비)
7. [PostgreSQL Backup](#7-postgresql-backup)
8. [Production Docker 적용](#8-production-docker-적용)
9. [적용 후 검증](#9-적용-후-검증)
10. [오류 진단](#10-오류-진단)
11. [Rollback과 실패 처리](#11-rollback과-실패-처리)
12. [SQL 유형별 권장 패턴](#12-sql-유형별-권장-패턴)
13. [금지 작업](#13-금지-작업)
14. [체크리스트](#14-체크리스트)
15. [2026-08-08 실제 장애 사례](#15-2026-08-08-실제-장애-사례)
16. [관련 단일 원본](#16-관련-단일-원본)

---

## 1. 핵심 원칙

YORO.gg의 migration은 다음 원칙을 따른다.

1. migration은 forward-only다.
2. 이미 적용된 SQL 파일은 수정하지 않는다.
3. 이미 등록된 checksum을 변경하지 않는다.
4. 변경이 필요하면 다음 번호의 migration을 추가한다.
5. Server는 시작할 때 migration을 자동 적용하지 않는다.
6. pending migration이 있으면 Server readiness가 fail-closed 된다.
7. 운영 적용 전 PostgreSQL backup과 archive 검증을 완료한다.
8. apply는 한 runner만 실행한다.
9. migration마다 별도 transaction을 사용한다.
10. 적용 후 check, health, 핵심 기능 smoke test를 수행한다.
11. 자동 down migration은 제공하지 않는다.
12. 운영 DB URL, password, secret 원문을 출력하지 않는다.

가장 중요한 규칙은 다음 한 문장이다.

> SQL 파일 추가, manifest 등록, application image build, backup, plan, apply, check를 하나의 release 작업으로 취급한다.

---

## 2. Migration 구조

### 2.1 파일 위치

~~~text
apps/server/migrations/
├── 0001_database_foundation.sql
├── ...
├── 0019_admin_audit_logs.sql
└── manifest.json
~~~

현재 최신 번호는 0019이다. 따라서 다음 migration은 0020부터 사용하지만, 실제 작업 직전에 manifest의 마지막 ID를 다시 확인해야 한다.

### 2.2 적용 기록

DB의 <code>schema_migrations</code> table에는 다음 정보가 기록된다.

- migration ID
- SHA-256 checksum
- 적용 시각
- 실행 시간
- application version
- dirty 상태

runner는 manifest와 DB 기록을 순서대로 비교한다.

- 모든 항목이 일치하고 pending 없음: ready
- DB 기록은 일치하지만 미적용 항목 존재: pending
- 알 수 없는 migration, 순서 불일치, checksum 불일치, dirty row: mismatch

### 2.3 실행 방식

runner는 각 migration을 다음처럼 처리한다.

~~~text
PostgreSQL advisory lock 획득
  → manifest와 schema_migrations 검사
  → destructive 승인 검사
  → migration A BEGIN
  → statement_timeout 설정
  → migration A SQL 실행
  → schema_migrations 기록
  → migration A COMMIT
  → migration B BEGIN
  → ...
  → advisory lock 해제
~~~

전체 pending batch가 하나의 transaction은 아니다. migration A가 성공하고 migration B가 실패하면 A는 이미 commit된 상태로 남는다.

---

## 3. 새 SQL 작성 절차

### 3.1 다음 번호 결정

먼저 manifest 마지막 ID를 확인한다.

~~~bash
tail -80 apps/server/migrations/manifest.json
~~~

예를 들어 최신 ID가 0019이면 다음 파일을 만든다.

~~~text
apps/server/migrations/0020_example_change.sql
~~~

이름 규칙:

- 4자리 숫자
- underscore
- lowercase 영문, 숫자, underscore
- 변경 목적이 드러나는 이름

허용 예:

~~~text
0020_add_participation_audit.sql
0021_add_guild_channel_index.sql
~~~

금지 예:

~~~text
19-change.sql
0020_AddField.sql
0020 fix.sql
0020.sql
~~~

### 3.2 SQL 파일 규칙

- UTF-8 일반 파일이어야 한다.
- symlink를 사용하지 않는다.
- 최대 크기는 2MiB다.
- 빈 SQL은 허용하지 않는다.
- SQL 파일 안에 BEGIN, COMMIT, ROLLBACK을 직접 쓰지 않는다.
- runner가 migration마다 transaction을 생성한다.
- 현재 manifest의 transaction 값은 반드시 true다.
- SQL과 secret/credential을 log statement로 남기지 않는다.

### 3.3 Statement timeout

현재 기본 migration statement timeout은 10초다.

따라서 다음 작업을 하나의 일반 migration으로 바로 실행하면 위험하다.

- 대규모 table 전체 backfill
- 긴 ACCESS EXCLUSIVE lock
- 대형 index 생성
- 수백만 row의 일괄 UPDATE
- 장시간 constraint validation

10초 안에 완료될지 확신할 수 없다면 다음 중 하나로 분리한다.

1. nullable schema를 먼저 추가한다.
2. application이 구·신 schema를 동시에 처리하도록 배포한다.
3. bounded batch job으로 데이터를 채운다.
4. 별도 migration에서 constraint를 추가·검증한다.
5. 마지막 release에서 legacy column 또는 code path를 제거한다.

`0019_admin_audit_logs`는 기존 `audit_logs`에 일반 `CREATE INDEX`를 실행한다. 운영 적용 전
`audit_logs`의 row 수와 table/index 크기를 읽기 전용으로 확인하고, 10초 timeout과 write lock 안에
완료될 근거가 없으면 적용하지 않는다. 이 경우 transaction migration에 `CONCURRENTLY`를 억지로
추가하지 말고 별도 운영 절차와 승인 계획을 먼저 세운다.

### 3.4 Transaction 제약

모든 migration이 transaction 안에서 실행되므로 다음 명령은 그대로 사용할 수 없다.

~~~sql
CREATE INDEX CONCURRENTLY ...;
~~~

<code>CREATE INDEX CONCURRENTLY</code>처럼 transaction block 안에서 실행할 수 없는 명령이 필요하면 기존 runner에 억지로 넣지 않는다. 별도 운영 설계, 승인, lock/timeout/재시도 계획을 먼저 작성해야 한다.

### 3.5 Tenant 데이터

Organization 소유 데이터에는 다음을 유지한다.

- organization_id NOT NULL
- 가능한 경우 composite foreign key
- tenant별 unique/index 조건
- cross-tenant 연결 방지
- repository의 TenantContext
- 모든 SELECT/UPDATE/DELETE의 organization_id 조건

SQL만 추가하고 repository tenant 조건을 빠뜨리면 안 된다.

### 3.6 Destructive 판단

다음 변경은 보수적으로 <code>destructive: true</code>로 분류한다.

- table/column 삭제
- 기존 row 삭제
- irreversible UPDATE
- data type 축소
- 길이 제한 축소
- NULL 허용 row가 있는 상태에서 NOT NULL 강제
- 기존 값과 충돌할 수 있는 unique constraint
- application 하위 호환성을 깨는 rename
- 기존 index/constraint 제거

애매하면 destructive로 분류한다. 운영 apply 때 별도 <code>--allow-destructive</code> 승인을 요구하게 만드는 편이 안전하다.

---

## 4. Manifest 등록

### 4.1 SHA-256 계산

SQL 파일의 정확한 byte를 기준으로 checksum을 계산한다.

Linux:

~~~bash
sha256sum apps/server/migrations/0020_example_change.sql
~~~

macOS:

~~~bash
shasum -a 256 apps/server/migrations/0020_example_change.sql
~~~

공백, 주석, 줄바꿈 하나만 변경해도 checksum이 달라진다.

### 4.2 Manifest entry

apps/server/migrations/manifest.json의 마지막에 정렬 순서대로 등록한다.

~~~json
{
  "id": "0020_example_change",
  "file": "0020_example_change.sql",
  "description": "변경 목적을 설명하는 한국어 문장",
  "checksumSha256": "<64자리 lowercase SHA-256>",
  "destructive": false,
  "transaction": true
}
~~~

제약:

| Field | 규칙 |
|---|---|
| id | 4자리 숫자 + underscore + lowercase 이름 |
| file | id로 시작하는 .sql 파일명 |
| description | 1~200자 |
| checksumSha256 | lowercase 64자리 SHA-256 |
| destructive | boolean |
| transaction | 반드시 true |

manifest에 등록하지 않은 SQL 파일은 자동으로 적용되지 않는다.

### 4.3 테스트 예상 ID 갱신

다음 테스트의 migration ID 배열에도 신규 ID를 추가한다.

[apps/server/test/database-foundation.test.mjs](../apps/server/test/database-foundation.test.mjs)

예:

~~~text
0019_admin_audit_logs
0020_example_change
~~~

이 테스트는 manifest 순서, ID, 파일, checksum 계약의 회귀를 잡는 역할을 한다.

---

## 5. 개발 환경 검증

### 5.1 최소 검증

~~~bash
npm run build:server
node --test apps/server/test/database-foundation.test.mjs
npm --workspace apps/server run test:run
npm run typecheck
git diff --check
~~~

### 5.2 전체 검증

~~~bash
npm run lint
npm run typecheck
npm run build
npm run validate:config
npm run test:run
git diff --check
~~~

### 5.3 실제 PostgreSQL 통합 테스트

반드시 전용 test DB에서만 실행한다.

~~~bash
DATABASE_TEST_URL="<전용 streamops_test DB URL>" \
  npm --workspace apps/server run test:database
~~~

주의:

- test DB 이름은 streamops_test 계열을 사용한다.
- 이 테스트는 public schema를 삭제하고 다시 만들 수 있다.
- 운영 DB URL을 절대 전달하지 않는다.
- URL 값을 terminal log, 문서, PR에 기록하지 않는다.

### 5.4 개발용 migration 명령

개발 checkout에는 devDependency인 tsx가 있으므로 다음 npm script를 사용할 수 있다.

~~~bash
npm --workspace apps/server run db:migrate:check
npm --workspace apps/server run db:migrate:plan
npm --workspace apps/server run db:migrate:apply -- --apply
~~~

production config를 대상으로 apply할 때는 추가 확인이 필요하다.

~~~bash
npm --workspace apps/server run db:migrate:apply -- \
  --apply \
  --confirm-production
~~~

이 명령은 개발 checkout 또는 devDependency가 설치된 운영 도구 환경용이다. production server container 안에서는 사용하지 않는다.

---

## 6. 운영 적용 전 준비

### 6.1 중요한 production image 차이

production server runtime image에는 tsx가 없다.

따라서 운영 컨테이너에서 다음 명령을 실행하면 안 된다.

~~~bash
npm --workspace apps/server run db:migrate:plan
~~~

운영에서는 build된 JavaScript를 직접 실행한다.

~~~bash
node apps/server/dist/scripts/database-migrate.js plan
~~~

### 6.2 같은 image를 사용해야 한다

다음 세 단계는 반드시 같은 server image로 실행한다.

1. plan
2. apply
3. 실제 server 기동

plan 뒤 image를 다시 build하면 검토한 SQL과 실제 적용 SQL이 달라질 수 있다.

### 6.3 운영 전 필수 확인

~~~bash
git status --short
git rev-parse --short HEAD
docker compose config --quiet
docker compose ps -a
~~~

확인 항목:

- 예상 branch/commit인가?
- source build라면 working tree가 깨끗한가?
- 새 image에 신규 SQL과 manifest가 포함됐는가?
- config-check가 성공하는가?
- PostgreSQL이 healthy인가?
- 방송이 없는 maintenance window인가?
- rollback에 사용할 pre-migration backup이 있는가?
- backup은 repository 밖에 있는가?
- restore 방법과 담당자가 정해졌는가?

### 6.4 권위 운영 경로

권위 Compose는 다음 파일이다.

[deploy/production/compose.yaml](../deploy/production/compose.yaml)

명령은 repository마다 경로가 다를 수 있으므로 다음처럼 이동한다.

~~~bash
cd <repository-root>/deploy/production
~~~

2026-08-08 확인된 운영 서버의 실제 경로는 다음이었다.

~~~text
/root/StreamOverlay/deploy/production
~~~

환경이 바뀌면 hard-code하지 말고 git root를 다시 확인한다.

---

## 7. PostgreSQL Backup

### 7.1 원칙

- PostgreSQL 16 server와 같은 major의 pg_dump/pg_restore를 사용한다.
- backup은 repository와 application state 밖에 저장한다.
- backup directory는 0700이다.
- dump와 manifest/checksum은 0600이다.
- custom format을 사용한다.
- archive를 pg_restore --list로 검증한다.
- 가능하면 격리 DB restore rehearsal까지 수행한다.

### 7.2 표준 backup script

pg_dump가 설치되어 있고 DB에 안전하게 연결 가능한 운영 도구 host에서는 저장소 표준 script를 사용한다.

~~~bash
npm run backup:postgres -- \
  --database-url-file=/secure/path/database_url \
  --output-dir=/secure/backups/yoro
~~~

검증:

~~~bash
npm run verify:postgres-backup -- \
  --manifest=/secure/backups/yoro/<backup>.manifest.json
~~~

복구 훈련:

~~~bash
npm run rehearse:postgres-backup -- \
  --database-url-file=/secure/path/database_admin_url \
  --manifest=/secure/backups/yoro/<backup>.manifest.json
~~~

### 7.3 현재 Compose topology의 주의점

현재 production에는 전용 backup service가 없고 server runtime image에도 pg_dump가 없다. PostgreSQL port도 host에 공개하지 않는다.

따라서 표준 backup script를 실행할 별도 운영 도구 환경이 준비되지 않았다면, PostgreSQL container의 같은-major pg_dump를 사용해 repository 밖으로 archive를 저장할 수 있다.

아래 예시는 root 운영 shell 기준이다.

~~~bash
cd <repository-root>/deploy/production

install -d -m 0700 /var/backups/yoro/postgres
umask 077

yoro_backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
yoro_backup_path=/var/backups/yoro/postgres/streamops-pre-migration-$yoro_backup_stamp.dump

docker compose exec -T postgres \
  pg_dump \
  -U streamops_app \
  -d streamops \
  --format=custom \
  --no-owner \
  --no-privileges \
  > $yoro_backup_path.partial

mv $yoro_backup_path.partial $yoro_backup_path
chmod 0600 $yoro_backup_path
sha256sum $yoro_backup_path > $yoro_backup_path.sha256
chmod 0600 $yoro_backup_path.sha256
~~~

주의:

- pg_dump 실패 시 partial 파일을 backup으로 사용하지 않는다.
- command의 exit code를 확인한 뒤에만 rename한다.
- DB 이름과 user는 현재 production Compose 기준이다.
- Compose 변경 시 실제 non-secret 설정을 다시 확인한다.
- password 파일의 내용을 출력하지 않는다.

### 7.4 Archive 검증

host에 pg_restore가 없다면 동일 PostgreSQL image를 network none, read-only로 실행해 검증할 수 있다.

~~~bash
docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -v /var/backups/yoro/postgres:/backup:ro \
  postgres:16.6-bookworm \
  pg_restore --list /backup/<backup-file>.dump \
  > /dev/null
~~~

추가 확인:

~~~bash
sha256sum -c /var/backups/yoro/postgres/<backup-file>.dump.sha256
stat /var/backups/yoro/postgres/<backup-file>.dump
~~~

크기가 0이 아니고 pg_restore list가 성공했다는 사실만으로 완전한 복구를 보장하지는 않는다. 가능한 경우 격리 restore rehearsal을 수행해야 한다.

### 7.5 Backup을 repository에 두지 않는다

다음 위치에 dump를 만들지 않는다.

~~~text
<repository-root>/*.dump
apps/server/*.dump
deploy/production/*.dump
~~~

이유:

- git에 실수로 포함될 수 있다.
- source build context에 포함될 수 있다.
- file permission이 느슨할 수 있다.
- repository backup과 DB backup의 lifecycle이 섞인다.

---

## 8. Production Docker 적용

### 8.1 Image build

신규 SQL과 manifest를 포함하는 server image를 먼저 준비한다.

source-build 운영 경로를 사용하는 경우:

~~~bash
cd <repository-root>/deploy/production
docker compose build server discord-bot
~~~

가능하면 release pipeline에서 만든 immutable image digest를 사용하는 것이 더 안전하다.

### 8.2 읽기 전용 check

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js check
~~~

exit code:

| 결과 | Exit code | 의미 |
|---|---:|---|
| ready | 0 | 적용할 migration 없음 |
| pending | 2 | 미적용 migration 존재 |
| mismatch | 2 | manifest/DB 불일치 |
| 실행 오류 | 1 | config, DB, runner 오류 |

pending에서 exit 2는 runner crash가 아니다. 아직 server를 ready로 만들 수 없다는 의도된 신호다.

### 8.3 Plan

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js plan
~~~

plan은 다음만 표시한다.

- ID
- description
- destructive
- transaction

SQL 원문과 credential을 출력하지 않는다.

pending plan은 정상적으로 exit 0이다. mismatch이면 exit 2다.

### 8.4 Writer 중지

최종 plan과 backup을 확인한 뒤 DB writer를 중지한다.

~~~bash
docker compose stop server discord-bot
~~~

현재 Bot이 DB에 직접 접근하지 않더라도, release 단위의 쓰기 동작을 차단하고 일관된 maintenance window를 만들기 위해 함께 중지한다.

### 8.5 최종 plan

writer 중지 후 동일 image로 plan을 한 번 더 확인한다.

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js plan
~~~

다음을 확인한다.

- 예상한 ID만 pending인가?
- destructive 값이 검토 결과와 같은가?
- migration 순서가 맞는가?
- plan 후 image를 다시 build하지 않았는가?

### 8.6 비파괴 migration 적용

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js \
  apply \
  --apply \
  --confirm-production
~~~

### 8.7 Destructive migration 적용

pending 중 하나라도 <code>destructive: true</code>이면 별도 승인이 필요하다.

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js \
  apply \
  --apply \
  --confirm-production \
  --allow-destructive
~~~

<code>--allow-destructive</code>는 편의를 위한 일반 option이 아니다. backup, restore rehearsal, maintenance window, 영향받는 row, application 호환성을 검토한 뒤에만 사용한다.

### 8.8 적용 직후 check

~~~bash
docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js check
~~~

정상 예:

~~~json
{
  "command": "check",
  "status": "ready",
  "applied": 19,
  "pending": 0
}
~~~

---

## 9. 적용 후 검증

### 9.1 Server 기동

~~~bash
docker compose start server
~~~

readiness가 ready가 될 때까지 확인한다.

~~~bash
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
~~~

ready가 성공한 뒤 Bot을 시작한다.

~~~bash
docker compose start discord-bot
~~~

### 9.2 Compose 상태

~~~bash
docker compose ps -a
~~~

기대 상태:

- postgres: healthy
- config-check: Exited (0)
- server: healthy
- discord-bot: healthy
- init service: Exited (0)

cloudflared는 optional edge profile이므로 해당 profile을 실제 사용하는 환경인지 별도로 판단한다.

### 9.3 Log

~~~bash
docker compose logs --no-color --tail=200 server discord-bot
~~~

기대 server event:

~~~json
{
  "type": "database.runtime_state",
  "state": "ready",
  "ready": true
}
~~~

### 9.4 기능 smoke test

최소 확인:

- 공개 첫 페이지
- login/account session 조회
- streamer dashboard
- Discord Bot health/ready
- migration이 추가한 실제 기능
- 주요 tenant query
- error log 급증 여부

### 9.5 Release 기록

다음을 함께 기록한다.

- application Git SHA
- image digest 또는 image ID
- build time
- backup file과 checksum
- 적용 전·후 migration ID
- apply 실행 시각
- 실행자
- check 결과
- health 결과
- rollback 판단 시점

---

## 10. 오류 진단

### 10.1 config-check 오류와 migration pending은 다르다

<code>config-check</code>는 runtime 설정과 필수 secret 파일을 검사한다. DB의 schema_migrations를 조회하지 않는다.

따라서:

| 증상 | 주요 원인 |
|---|---|
| config-check exit 1 | runtime JSON, secret 파일, 권한, init volume |
| config-check exit 0 + server unhealthy | DB, migration, Store 등 readiness |
| DATABASE_MIGRATION_PENDING | 새 image의 migration이 DB에 미적용 |
| DATABASE_MIGRATION_MISMATCH | checksum, 순서, dirty/future schema 불일치 |

SQL pending 때문에 config-check가 실패한다고 해석하면 안 된다.

### 10.2 DATABASE_MIGRATION_PENDING

확인:

~~~bash
curl -sS http://127.0.0.1:3000/health/ready

docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js check

docker compose run --rm server \
  node apps/server/dist/scripts/database-migrate.js plan
~~~

해결:

1. plan 검토
2. 새 backup
3. writer 중지
4. 같은 image로 apply
5. check
6. server/Bot 시작

### 10.3 DATABASE_MIGRATION_MISMATCH

가능한 원인:

- 적용된 SQL 파일을 나중에 수정함
- manifest checksum을 변경함
- DB에 현재 image가 모르는 미래 migration이 있음
- schema_migrations 순서 불일치
- dirty row
- 잘못된 image를 실행함

이 상태에서는 apply를 반복하지 않는다.

확인:

- 현재 image Git SHA
- manifest 마지막 ID
- DB에 적용된 ID의 범위
- 이전 release image
- pre-migration backup
- 누가 어떤 migration을 적용했는지

schema_migrations row를 수동 삭제·수정해서 ready로 속이지 않는다.

### 10.4 DATABASE_MIGRATION_LOCKED

다른 runner가 advisory lock을 보유한 상태다.

- 동시에 apply를 다시 실행하지 않는다.
- 실행 중인 migration process를 확인한다.
- 첫 runner 결과를 기다린다.
- 비정상 종료 후에는 DB session이 실제로 끝났는지 확인한다.

connection이 종료되면 session advisory lock은 해제된다.

### 10.5 DATABASE_INVALID_INPUT

destructive migration이 pending인데 <code>--allow-destructive</code>가 없을 때 발생할 수 있다.

flag를 즉시 추가해서 재실행하지 말고 destructive 이유, 대상 row, backup, restore rehearsal을 다시 확인한다.

### 10.6 Statement timeout

현재 기본값은 10초다.

timeout으로 실패한 해당 migration transaction은 rollback된다. 하지만 앞선 migration이 이미 성공했다면 앞 migration은 남아 있다.

대응:

- 실제 lock과 row 수 조사
- SQL을 후속 migration 또는 bounded job으로 재설계
- 무작정 timeout만 늘리지 않기
- schema_migrations 수동 수정 금지

---

## 11. Rollback과 실패 처리

### 11.1 자동 down migration 없음

YORO.gg는 down SQL을 자동 실행하지 않는다.

적용 후 장애 대응은 두 가지다.

1. 새 forward-fix application/migration 배포
2. 승인된 절차로 pre-migration PostgreSQL backup 복원

### 11.2 Image-only rollback의 한계

새 migration이 DB에 기록된 뒤 구 image를 실행하면, 구 image의 manifest는 새 migration ID를 모른다.

결과:

~~~text
future schema
  → DATABASE_MIGRATION_MISMATCH
  → readiness fail-closed
~~~

따라서 migration 적용 뒤 application image만 이전 버전으로 되돌리는 rollback은 일반적으로 동작하지 않는다.

### 11.3 Batch 중간 실패

예:

~~~text
0019 성공·commit
0020 실패·rollback
~~~

이 경우 0019는 적용된 상태로 남고 0020만 pending이다.

대응:

1. check와 plan으로 실제 상태 확인
2. 0019와 application 호환성 확인
3. 0020 SQL을 수정하지 않음
4. 적용되지 않은 0020 파일 자체에 결함이 있다면 release 전이라도 checksum/manifest와 함께 올바르게 교체할지 책임자 검토
5. 이미 다른 환경에 0020이 적용됐다면 반드시 새 번호의 forward-fix 사용

### 11.4 Restore

저장소의 restore 도구는 안전상 <code>streamops_restore_*</code> 격리 DB를 기본 대상으로 한다. 운영 streamops DB를 직접 덮어쓰는 자동 절차가 아니다.

실제 운영 복구에는 다음이 필요하다.

- server와 writer 완전 중지
- backup checksum 검증
- archive 검증
- 복구 대상 승인
- 운영 DB 교체 절차
- schema_migrations 검증
- application image 정합성
- smoke test

복구는 별도 승인과 운영 runbook에 따라 수행한다.

---

## 12. SQL 유형별 권장 패턴

### 12.1 새 nullable column

가장 안전한 기본 패턴:

~~~sql
ALTER TABLE example_records
  ADD COLUMN new_value TEXT;
~~~

이후 application이 NULL을 처리하도록 먼저 배포한다.

### 12.2 NOT NULL column

한 번에 default + backfill + NOT NULL을 강제하기보다 단계적으로 진행한다.

~~~text
Release A: nullable column 추가
Release B: 새 write가 값을 기록
Background: 기존 row bounded backfill
Release C: NULL 존재 여부 검증
Release D: NOT NULL constraint
~~~

### 12.3 Index

작은 table:

~~~sql
CREATE INDEX example_records_org_created_idx
  ON example_records (organization_id, created_at DESC);
~~~

큰 table은 10초 transaction timeout과 lock 영향을 먼저 측정한다. CONCURRENTLY가 필요하면 현재 runner 밖의 별도 운영 절차가 필요하다.

### 12.4 Unique constraint

추가 전 중복을 먼저 확인한다.

~~~sql
SELECT organization_id, external_id, COUNT(*)
FROM example_records
GROUP BY organization_id, external_id
HAVING COUNT(*) > 1;
~~~

운영 데이터 결과를 문서나 log에 그대로 붙여 넣지 않는다. 중복 정리 정책과 destructive 여부를 먼저 결정한다.

### 12.5 Foreign key

tenant table은 tenant 경계를 포함한다.

~~~sql
FOREIGN KEY (organization_id, parent_id)
  REFERENCES parent_records (organization_id, id)
~~~

parent table에 대응하는 composite unique key가 필요할 수 있다.

### 12.6 Rename 또는 제거

expand/contract 패턴을 사용한다.

~~~text
1. 새 column/table 추가
2. application dual-read 또는 호환 read
3. 새 경로로 write 전환
4. 데이터 이관
5. 관측 기간
6. legacy read 제거
7. 별도 destructive migration에서 legacy schema 제거
~~~

DB와 application을 한 번에 강제 rename하면 이전 image rollback이 어려워진다.

### 12.7 대량 데이터 변경

일반 migration에서 전체 row를 한 번에 UPDATE하지 않는다.

권장:

- primary key cursor
- 작은 batch
- retry 가능
- idempotent update
- progress checkpoint
- bounded lock
- 별도 operator command
- 완료 검증 후 constraint migration

---

## 13. 금지 작업

다음 작업은 하지 않는다.

- 이미 적용된 SQL 수정
- 적용된 checksum 변경
- schema_migrations row 수동 삭제
- dirty 값을 임의로 false로 변경
- production DB에서 테스트 integration 실행
- backup 없이 destructive migration 적용
- plan과 apply 사이 image 재build
- 여러 apply runner 동시 실행
- DB URL/password 출력
- dump를 repository에 저장
- partial dump를 정상 backup으로 사용
- pg_restore 검증 없이 적용
- docker compose down -v
- PostgreSQL volume 삭제
- docker system prune
- 전체 volume prune
- 광범위한 rm -rf
- migration 적용 후 구 image만 실행해 rollback 시도

---

## 14. 체크리스트

### 14.1 개발자 체크리스트

- [ ] manifest 마지막 번호 확인
- [ ] 다음 번호의 lowercase snake_case SQL 생성
- [ ] SQL 안에 transaction 문 없음
- [ ] 10초 timeout과 lock 영향 검토
- [ ] tenant 경계 검토
- [ ] destructive 여부 결정
- [ ] SHA-256 계산
- [ ] manifest 정렬 위치에 등록
- [ ] database-foundation 예상 ID 갱신
- [ ] server build
- [ ] foundation test
- [ ] server test
- [ ] typecheck
- [ ] 실제 test DB integration
- [ ] git diff --check
- [ ] SQL·manifest·application을 같은 release에 포함

### 14.2 운영자 체크리스트

- [ ] maintenance window
- [ ] clean source 또는 immutable image
- [ ] Git SHA/image digest 기록
- [ ] config-check 성공
- [ ] PostgreSQL healthy
- [ ] 같은 image로 check/plan
- [ ] pending ID와 destructive 확인
- [ ] repository 밖 새 backup
- [ ] backup 0600, directory 0700
- [ ] SHA-256 검증
- [ ] pg_restore archive 검증
- [ ] 가능하면 restore rehearsal
- [ ] writer 중지
- [ ] 최종 plan
- [ ] apply 한 번 실행
- [ ] post-check ready
- [ ] server start
- [ ] /health/live
- [ ] /health/ready
- [ ] Bot start/healthy
- [ ] 기능 smoke
- [ ] error log 확인
- [ ] release/backup/migration 기록

---

## 15. 2026-08-08 실제 장애 사례

### 15.1 증상

운영 Docker 기동 중 처음에는 config-check 오류가 보고되었지만, 재진단 시 상태는 다음과 같았다.

~~~text
config-check: Exited (0)
postgres: healthy
server: unhealthy
discord-bot: Created
~~~

### 15.2 실제 원인

<code>/health/ready</code>:

~~~json
{
  "ok": false,
  "status": "not_ready",
  "errors": ["database:DATABASE_MIGRATION_PENDING"]
}
~~~

migration check:

~~~json
{
  "command": "check",
  "status": "pending",
  "applied": 16,
  "pending": 2
}
~~~

plan:

~~~text
0017_discord_participation_announcement
0018_discord_guild_directory_cache
~~~

두 migration 모두 destructive:false, transaction:true였다.

### 15.3 Backup 판단

repository root의 기존 dump는 오래됐고 매우 작았으며 host에 pg_restore도 없어 이번 release의 신뢰 가능한 backup으로 사용하지 않았다.

대신:

- /var/backups/yoro/postgres에 새 custom-format dump 생성
- directory 0700
- dump/checksum 0600
- PostgreSQL 16 image의 pg_restore --list 성공
- public table data entry 존재 확인
- apply 직전 SHA-256 재검증

### 15.4 적용

~~~text
Server·Bot 중지
  → final plan
  → 0017 적용
  → 0018 적용
  → check: applied 18, pending 0, ready
  → Server 시작
  → readiness 확인
  → Bot 시작
~~~

### 15.5 최종 상태

~~~text
config-check: Exited (0)
postgres: healthy
server: healthy
discord-bot: healthy
/health/ready: ok=true
databaseReady=true
errors=[]
~~~

이 사례의 핵심 교훈:

1. config-check와 DB migration readiness를 구분한다.
2. pending check의 exit 2는 예상된 신호다.
3. production container에서는 tsx가 아니라 compiled JS를 실행한다.
4. repository 안의 오래된 dump를 자동으로 신뢰하지 않는다.
5. 검증된 새 backup 후 동일 image로 apply한다.

---

## 16. 관련 단일 원본

- [Migration manifest](../apps/server/migrations/manifest.json)
- [Manifest loader](../apps/server/src/database/migration-manifest.ts)
- [Migration runner](../apps/server/src/database/migration-runner.ts)
- [Migration CLI](../apps/server/src/scripts/database-migrate.ts)
- [Database foundation test](../apps/server/test/database-foundation.test.mjs)
- [Production Compose](../deploy/production/compose.yaml)
- [기존 migration 운영 문서](DATABASE_MIGRATIONS.md)
- [PostgreSQL backup·restore](DATABASE_BACKUP_ROLLBACK.md)
- [AI 공동 작업 지침](AI_WORKFLOW.md)

문서와 코드가 충돌할 때는 manifest, loader, runner, CLI, production Compose를 우선한다.
