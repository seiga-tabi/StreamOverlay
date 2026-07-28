# PostgreSQL backup·restore

기존 file state backup과 PostgreSQL backup은 별도로 관리합니다. PostgreSQL backup은 `pg_dump` custom format, SHA-256 manifest, `0600` 파일 권한을 사용합니다.

## 필수 조건

- Database 서버 major와 같은 major의 `pg_dump`·`pg_restore`
- repository 밖의 절대 backup 경로
- `0600` Database URL 파일
- backup directory `0700`
- 방송이 없는 유지보수 시간

client/server major가 다르면 backup 스크립트가 실패할 수 있으며, 이를 무시하거나 plain SQL로 임의 전환하지 않습니다.

## Backup

```bash
npm run backup:postgres -- \
  --database-url-file=/secure/path/database_url \
  --output-dir=/secure/backups/streamops
```

manifest에는 backup SHA-256, source identity의 SHA-256, migration ID와 checksum을 기록합니다. Database URL, password, host 원문은 출력하지 않습니다.

```bash
npm run verify:postgres-backup -- \
  --manifest=/secure/backups/streamops/<backup>.manifest.json
```

## Restore

기본 restore 명령은 checksum과 archive만 검증하고 Database를 변경하지 않습니다.

```bash
npm run restore:postgres -- \
  --manifest=/secure/backups/streamops/<backup>.manifest.json
```

실제 restore는 Server가 중지됐음을 명시하고 `streamops_restore_*` 이름의 전용 target만 허용합니다.

```bash
npm run restore:postgres -- \
  --apply \
  --server-stopped \
  --database-url-file=/secure/path/database_admin_url \
  --target-database=streamops_restore_rehearsal \
  --manifest=/secure/backups/streamops/<backup>.manifest.json
```

복원 후 `schema_migrations`의 ID와 checksum이 manifest와 일치해야 성공합니다.

## Restore rehearsal

다음 명령은 임시 `streamops_restore_*` Database를 생성하고 restore·migration 검증 후 해당 임시 Database만 제거합니다.

```bash
npm run rehearse:postgres-backup -- \
  --database-url-file=/secure/path/database_admin_url \
  --manifest=/secure/backups/streamops/<backup>.manifest.json
```

운영 Database, application state volume, 다른 Docker volume을 자동 삭제하지 않습니다. `docker system prune`, 전체 volume prune, 광범위한 `rm -rf`는 사용하지 않습니다.

## 배포·rollback 순서

1. 기존 file state와 PostgreSQL을 각각 backup합니다.
2. backup checksum과 restore rehearsal을 확인합니다.
3. migration `plan`을 검토하고 별도 명령으로 적용합니다.
4. 새 immutable image를 배포합니다.
5. `/health/live`, `/health/ready`와 기존 Twitch·Followers·Overlay 기능을 확인합니다.
6. rollback 시 이전 image와 migration 이전 backup을 함께 복원합니다.

외부 암호화 저장소와 WAL archive는 후속 운영 단계에서 추가합니다.
