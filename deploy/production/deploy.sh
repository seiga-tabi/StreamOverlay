#!/usr/bin/env bash
# 운영 migration 절차의 단일 원본: docs/SQL_MIGRATION_APPLICATION_RUNBOOK.md §7~11.
set -euo pipefail

main() {
  dry_run=false
  auto_confirm=false
  for arg in "$@"; do
    case "$arg" in
      --dry-run) dry_run=true ;;
      --yes|--auto-confirm) auto_confirm=true ;;
      --help|-h)
        printf '사용법: ./deploy.sh [--dry-run] [--yes|--auto-confirm]\n'
        printf '%s\n' '기본값은 대화형 승인입니다. dirty 확인은 자동 승인하지 않습니다.' \
          'dry-run은 기존 이미지의 읽기 전용 check/plan만 실행합니다.'
        return 0 ;;
      *) printf '알 수 없는 옵션: %s\n' "$arg" >&2; return 1 ;;
    esac
  done

  cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
  stage='사전 확인'
  git_sha='미확인' image_id='미확인' build_time='미실행'
  backup_path='없음' backup_checksum='없음' apply_time='미실행'
  before_check='미실행' after_check='미실행'
  before_ids='없음' applied_ids='없음' after_ids='미확인'
  health_live='미실행' health_ready='미실행' compose_health='미실행'
  writers_stopped=false
  apply_in_progress=false
  db_ready=false
  scratch=''
  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  umask 077
  for dependency in docker git jq flock curl sha256sum install mktemp df awk; do
    command -v "$dependency" >/dev/null || fail "필수 명령이 없습니다: $dependency"
  done
  # lock 파일은 삭제하지 않는다. 삭제하면 서로 다른 inode에 잠금이 걸릴 수 있다.
  exec 9>/var/run/yoro-deploy.lock
  flock -n 9 || fail '다른 배포가 실행 중입니다. 기존 실행을 확인한 뒤 재실행하십시오.'
  scratch=$(mktemp -d)
  local dirty answer
  dirty=$(git status --short)
  if [[ -n "$dirty" ]]; then
    printf '경고: working tree에 미커밋 변경이 있습니다.\n%s\n' "$dirty"
    printf '이 상태로 계속하시겠습니까? (yes 입력 필요): '
    read -r answer || fail '입력을 읽지 못했습니다. 대화형 터미널에서 실행하십시오.'
    [[ "$answer" == yes ]] || fail '운영자가 진행을 취소했습니다.'
  fi
  git_sha=$(git rev-parse --short HEAD)
  printf '배포 Git SHA: %s\n' "$git_sha"
  docker compose config --quiet
  docker compose ps -a

  if ! "$dry_run"; then
    stage='이미지 빌드'
    docker compose build server discord-bot
    build_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  else
    printf '%s\n' '사전 조회: 기존 로컬 이미지를 사용합니다. 현재 소스의 새 migration은 빌드 전에는 반영되지 않습니다.' \
      '의존 서비스를 시작하지 않으므로 PostgreSQL과 운영 설정이 이미 준비되어 있어야 합니다.'
  fi
  stage='Compose 설정 추출'
  # 전체 config에는 secret이 있을 수 있으므로 출력하거나 파일에 저장하지 않는다.
  local settings
  if settings=$(docker compose config --format json | jq -er '
    .services | [.server.image, (.postgres.environment.POSTGRES_USER // "streamops_app"),
      (.postgres.environment.POSTGRES_DB // "streamops"), (.postgres.image // "postgres:16.6-bookworm")]
    | if all(.[]; type == "string" and length > 0 and (test("[\\t\\r\\n]") | not))
      then @tsv else error("설정 형식 오류") end'); then
    IFS=$'\t' read -r server_image db_user db_name postgres_image <<< "$settings"
  else
    fail 'Compose 설정 추출 실패. 실제 이미지와 DB 대상을 보장할 수 없어 중단합니다.'
  fi
  image_id=$(docker image inspect --format '{{.Id}}' "$server_image") ||
    fail 'server 이미지 조회 실패. Docker 상태를 확인하고, 최초 배포는 --dry-run 없이 빌드부터 실행하십시오.'
  [[ -n "$image_id" ]] || fail 'server 이미지가 없습니다. 이미지를 준비한 뒤 다시 실행하십시오.'

  stage='읽기 전용 migration check'
  migration_check
  before_check=$check_json
  if [[ "$check_status" == pending ]]; then
    stage='migration plan 검토'
    migration_plan
    before_ids=$(jq -r '[.pending[].id] | join(", ")' <<< "$plan_json")
    [[ "$(jq '.pending | length' <<< "$plan_json")" == "$(jq '.pending' <<< "$check_json")" ]] ||
      fail 'check와 plan의 pending 수가 다릅니다. 다른 runner 실행 여부를 확인하십시오.'
    approved_plan=$(jq -cS '.pending' <<< "$plan_json")
    if jq -e 'any(.pending[]; .destructive)' <<< "$plan_json" >/dev/null; then
      fail 'destructive migration이 있습니다. 런북 §8.7·§13에 따라 영향, 복구 훈련, 점검 시간을 검토하고 수동 진행하십시오.'
    fi
    if "$dry_run"; then
      printf '사전 조회 완료: pending %s개, destructive 없음. 실제 배포에서는 승인과 새 백업이 필요합니다.\n' "$(jq '.pending | length' <<< "$plan_json")"
      return 0
    fi
    if ! "$auto_confirm"; then
      printf '이 migration을 지금 적용하시겠습니까? (yes 입력 필요): '
      read -r answer || fail '승인 입력을 읽지 못했습니다. 무인 실행에는 명시적인 --yes가 필요합니다.'
      [[ "$answer" == yes ]] || fail 'migration 적용을 취소했습니다.'
    fi
    backup_database
    stage='writer 중지'
    # 중지 도중 실패해도 일부 writer가 중지됐을 수 있으므로 수동 확인 안내를 남긴다.
    writers_stopped=true
    docker compose stop server discord-bot
    stage='최종 migration plan'
    migration_plan
    [[ "$(jq -cS '.pending' <<< "$plan_json")" == "$approved_plan" ]] ||
      fail '최종 plan이 승인된 목록과 다릅니다. 자동 적용하지 않습니다. writer 상태와 변경 원인을 확인하십시오.'
    stage='migration apply'
    apply_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    applied_ids='미확인'
    migration_command apply --apply --confirm-production > "$scratch/apply.json" ||
      fail 'apply 실패. 런북 §10·§11에 따라 실패 ID, timeout, advisory lock 및 백업을 확인하십시오.'
    apply_in_progress=false
    jq -es 'length == 1 and (.[0] | .command == "apply" and
      (.migrationIds | type == "array") and .applied == (.migrationIds | length))' "$scratch/apply.json" >/dev/null ||
      fail 'apply 결과 JSON이 예상 형식이 아닙니다. DB 상태를 수동 확인하십시오.'
    applied_ids=$(jq -r '.migrationIds | join(", ")' "$scratch/apply.json")
    [[ "$(jq -c '.migrationIds' "$scratch/apply.json")" == "$(jq -c '[.[].id]' <<< "$approved_plan")" ]] ||
      fail 'apply 결과 ID가 승인 목록과 다릅니다. 자동 재기동하지 않습니다. DB 상태를 확인하십시오.'
    stage='적용 직후 migration check'
    migration_check
    after_check=$check_json
    [[ "$check_status" == ready ]] || fail '적용 후에도 pending이 남아 있습니다. 서버를 자동 재기동하지 않습니다.'
    after_ids='없음 (pending 0)'
  else
    after_check=$check_json
    after_ids='없음 (pending 0)'
    if "$dry_run"; then
      printf '%s\n' '사전 조회 완료: ready, pending 0개, destructive 없음. 배포 변경은 수행하지 않았습니다.'
      return 0
    fi
    printf '%s\n' 'migration이 필요 없습니다. 서비스 기동으로 진행합니다.'
  fi

  db_ready=true
  stage='서버 기동 및 헬스체크'
  assert_image
  local up_rc=0 ps_rc=0
  docker compose up -d server discord-bot || up_rc=$?
  # 기동 실패도 그대로 표시한 뒤, 마지막 health 응답과 Compose 상태를 남긴다.
  poll_health
  docker compose ps -a || ps_rc=$?
  if (( up_rc != 0 || ps_rc != 0 )) || [[ "$health_live" != 성공 || "$health_ready" != 성공 || "$compose_health" != 성공 ]]; then
    fail "기동 또는 health 확인 실패(up=$up_rc, ps=$ps_rc). 런북 §9·§10에 따라 config-check와 서비스 상태를 확인하십시오."
  fi
  writers_stopped=false
  stage='배포 검증 완료'
  printf '%s\n' '런북 §9.3~§9.4의 로그, 로그인·대시보드·Discord Bot 및 변경 기능 smoke test는 운영자가 확인하십시오.'
}

fail() {
  printf '중단 [%s]: %s\n' "$stage" "$1" >&2
  exit 1
}

finish() {
  local rc=$?
  trap - EXIT
  if (( rc != 0 )); then
    printf '실패 단계: %s (종료 코드 %s). 원인을 확인한 뒤 수동 재실행하십시오.\n' "$stage" "$rc" >&2
    if "$db_ready"; then
      printf '%s\n' 'DB migration 상태는 ready이나 서비스 기동/헬스체크 단계가 실패했습니다. config-check와 컨테이너 로그를 확인하세요.' >&2
    elif "$writers_stopped"; then
      printf '%s\n' 'writer가 중지되었거나 일부만 중지됐을 수 있습니다. 자동 재기동하지 않습니다.' \
        '자동 down 없음, 새 forward-fix 또는 승인된 backup 복원만 가능, 여기서 자동 복원 시도하지 않음' >&2
    fi
    if "$apply_in_progress"; then
      printf '%s\n' '일부 migration은 이미 commit됐을 수 있으며 image만 되돌리면 mismatch가 발생할 수 있습니다. 런북 §11을 확인하십시오.' >&2
    fi
  fi
  printf '\n배포 기록 (종료 코드 %s)\nGit SHA: %s\nserver image ID: %s\n빌드 완료 시각(UTC): %s\n' "$rc" "$git_sha" "$image_id" "$build_time"
  printf '실행자: %s\n백업: %s\nSHA-256: %s\n' "$(id -un)" "$backup_path" "$backup_checksum"
  printf '적용 전 pending ID: %s\n이번 적용 ID: %s\n적용 후 pending ID: %s\napply 시작 시각(UTC): %s\n' "$before_ids" "$applied_ids" "$after_ids" "$apply_time"
  printf '이전 check: %s\n이후 check: %s\nhealth/live: %s\nhealth/ready: %s\n' "$before_check" "$after_check" "$health_live" "$health_ready"
  printf 'server/discord-bot 컨테이너 health: %s\n' "$compose_health"
  printf '기록/rollback 판단 시점(UTC): %s / 운영자 판단 필요\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  [[ -z "$scratch" ]] || rm -rf -- "$scratch"
  exit "$rc"
}

assert_image() {
  local current_id
  current_id=$(docker image inspect --format '{{.Id}}' "$server_image") || fail 'server 이미지 조회 실패. Docker 상태를 확인하십시오.'
  [[ "$current_id" == "$image_id" ]] || fail 'server 이미지가 바뀌었습니다. 같은 이미지로 plan부터 다시 검토하십시오.'
}

migration_command() {
  assert_image
  # 이미지 확인에서 중단되면 apply 자체는 시작되지 않았으므로 부분 commit 경고를 남기지 않는다.
  if [[ "$1" == apply ]]; then apply_in_progress=true; fi
  if "$dry_run"; then
    docker compose run -T --rm --no-deps --pull never server node apps/server/dist/scripts/database-migrate.js "$@"
  else
    docker compose run -T --rm server node apps/server/dist/scripts/database-migrate.js "$@"
  fi
}

migration_check() {
  local rc=0
  migration_command check > "$scratch/check.json" || rc=$?
  if (( rc != 0 && rc != 2 )); then
    fail "check 실행 실패(exit=$rc). 의존 서비스 config-check/초기화 컨테이너 로그와 Docker·설정·DB 연결을 확인하십시오."
  fi
  if jq -es 'length == 1 and (.[0] | .command == "check" and .status == "mismatch")' "$scratch/check.json" >/dev/null 2>&1; then
    fail "migration 이력 mismatch(exit=$rc). 런북 §10의 checksum·DB 이력을 확인하십시오."
  fi
  # exit 2는 pending 또는 mismatch이므로 반드시 JSON과 함께 판단한다.
  jq -es 'length == 1 and (.[0] | .command == "check" and
    (.applied | type == "number" and . >= 0 and floor == .) and
    (.pending | type == "number" and . >= 0 and floor == .) and
    ((.status == "ready" and .pending == 0) or (.status == "pending" and .pending > 0)))' "$scratch/check.json" >/dev/null ||
    fail "check 결과 JSON 형식/상태 오류(exit=$rc). CLI 출력 형식과 실행 완료 여부를 확인하십시오."
  check_json=$(jq -c '{command, status, applied, pending}' "$scratch/check.json")
  check_status=$(jq -r '.status' <<< "$check_json")
  if [[ "$check_status" == ready && "$rc" == 0 ]] || [[ "$check_status" == pending && "$rc" == 2 ]]; then
    printf '%s\n' "$check_json"
  else
    fail "check 상태와 종료 코드가 일치하지 않습니다(exit=$rc). 자동 적용하지 않습니다."
  fi
}

migration_plan() {
  migration_command plan > "$scratch/plan.json" || fail 'plan 실패. 런북 §10의 mismatch·설정·DB 상태를 확인하십시오.'
  jq -es 'length == 1 and (.[0] | .command == "plan" and .status == "pending" and
    (.pending | type == "array" and length > 0 and
      all(.[]; (.id | type == "string" and test("^[0-9]{4}_[a-z0-9_]+$")) and
        (.description | type == "string") and (.destructive | type == "boolean") and .transaction == true)))' "$scratch/plan.json" >/dev/null ||
    fail 'plan 형식 또는 상태가 예상과 다릅니다. 수동 확인하십시오.'
  plan_json=$(jq -c . "$scratch/plan.json")
  jq '{status, pendingCount: (.pending | length), pending}' <<< "$plan_json"
}

backup_database() {
  stage='PostgreSQL 백업'
  install -d -m 0700 /var/backups/yoro/postgres
  umask 077
  backup_path=/var/backups/yoro/postgres/streamops-pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump
  [[ ! -e "$backup_path" && ! -e "$backup_path.partial" && ! -e "$backup_path.sha256" ]] ||
    fail '동일 시각의 백업 파일이 존재합니다. 덮어쓰지 않습니다.'
  # DB 크기의 2배와 1GiB 여유를 요구한다. 실제 dump 크기나 동시 디스크 사용을 보장하지는 않는다.
  local db_bytes required_kb available_kb
  db_bytes=$(docker compose exec -T postgres psql -X -A -t -v ON_ERROR_STOP=1 \
    -U "$db_user" -d "$db_name" -c 'SELECT pg_database_size(current_database());') ||
    fail '백업 전 DB 크기 조회 실패. apply하지 않습니다.'
  required_kb=$(jq -enr --arg size "$db_bytes" '$size | select(test("^[0-9]+$")) | tonumber
    | select(. > 0 and . <= 4503599627370495) | ((. / 1024 | ceil) * 2 + 1048576)') ||
    fail '백업 전 DB 크기 응답이 올바르지 않습니다. apply하지 않습니다.'
  available_kb=$(LC_ALL=C df -Pk /var/backups/yoro/postgres | awk 'NR == 2 {print $4}') ||
    fail '백업 디스크 여유 공간 조회 실패. apply하지 않습니다.'
  jq -en --arg available "$available_kb" --argjson required "$required_kb" \
    '$available | select(test("^[0-9]+$")) | tonumber | . >= $required' >/dev/null ||
    fail "백업 디스크 공간 부족 또는 용량 응답 오류(필요 ${required_kb} KiB). apply하지 않습니다."
  docker compose exec -T postgres pg_dump -U "$db_user" -d "$db_name" \
    --format=custom --no-owner --no-privileges > "$backup_path.partial" ||
    fail "pg_dump 실패. 조사용 파일을 보존했습니다: $backup_path.partial (백업으로 사용 금지)"
  mv "$backup_path.partial" "$backup_path"
  chmod 0600 "$backup_path"
  sha256sum "$backup_path" > "$backup_path.sha256"
  chmod 0600 "$backup_path.sha256"
  stage='백업 archive 및 checksum 검증'
  docker run --rm --network none --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    -v /var/backups/yoro/postgres:/backup:ro \
    "$postgres_image" pg_restore --list "/backup/$(basename "$backup_path")" > "$scratch/archive.list" ||
    fail 'pg_restore --list 실패. 백업을 확인하십시오. apply하지 않습니다.'
  # 주석만 있는 목록도 유효한 복원 항목이 없는 것으로 취급한다.
  grep -Eq '^[[:space:]]*[0-9]+;' "$scratch/archive.list" || fail '복원 가능한 archive 목록이 비어 있습니다. apply하지 않습니다.'
  sha256sum -c "$backup_path.sha256" || fail '백업 checksum 검증 실패. 파일 손상·경로·권한을 확인하십시오. apply하지 않습니다.'
  # TOC와 checksum 체인을 유지한 뒤 모든 데이터 블록을 읽어 잘린 archive도 거부한다.
  docker run --rm --network none --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=16m \
    -v /var/backups/yoro/postgres:/backup:ro \
    "$postgres_image" pg_restore -f /dev/null "/backup/$(basename "$backup_path")" ||
    fail 'pg_restore 전체 읽기 검증 실패. 백업을 확인하십시오. apply하지 않습니다.'
  read -r backup_checksum _ < "$backup_path.sha256"
}

poll_health() {
  local deadline=$((SECONDS + 180)) endpoint remaining timeout code
  health_live='실패' health_ready='실패' compose_health='실패'
  : > "$scratch/live.body"
  : > "$scratch/ready.body"
  while (( SECONDS < deadline )); do
    for endpoint in live ready; do
      remaining=$((deadline - SECONDS))
      (( remaining > 0 )) || break
      timeout=$remaining
      (( timeout <= 5 )) || timeout=5
      # --fail은 오류 본문을 버리므로 HTTP 상태를 별도로 판단한다.
      if code=$(curl -sS --connect-timeout 2 --max-time "$timeout" \
        -o "$scratch/$endpoint.body" -w '%{http_code}' "http://127.0.0.1:3000/health/$endpoint"); then
        if [[ "$code" == 2[0-9][0-9] ]]; then
          if [[ "$endpoint" == live ]]; then health_live='성공'; else health_ready='성공'; fi
        else
          if [[ "$endpoint" == live ]]; then health_live='실패'; else health_ready='실패'; fi
        fi
      else
        if [[ "$endpoint" == live ]]; then health_live='실패'; else health_ready='실패'; fi
      fi
    done
    # Bot도 healthy가 될 때까지 같은 180초 예산 안에서 기다린다.
    if docker compose ps --format json server discord-bot | jq -es '
      [.[] | if type == "array" then .[] else . end]
      | map(select(.Service == "server" or .Service == "discord-bot"))
      | (map(.Service) | sort) == ["discord-bot", "server"] and
        all(.[]; .State == "running" and .Health == "healthy")' >/dev/null; then
      compose_health='성공'
    else
      compose_health='실패'
    fi
    [[ "$health_live" != 성공 || "$health_ready" != 성공 || "$compose_health" != 성공 ]] || break
    (( SECONDS < deadline )) || break
    sleep 1
  done
  for endpoint in live ready; do
    printf '\n/health/%s 마지막 응답 본문:\n' "$endpoint"
    cat "$scratch/$endpoint.body"
    printf '\n'
  done
}

# 테스트에서는 main을 호출하지 않고 함수를 가져와 명령을 모의 실행할 수 있다.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
