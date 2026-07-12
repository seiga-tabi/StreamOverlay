# 상태 백업 및 복원

## 대상

기본 상태 디렉터리는 `.streamops`이며 운영에서는 `STREAMOPS_STATE_DIR`로 별도 persistent volume을 지정한다. 백업에는 참여 대기열/운영 상태, 승인 Riot ID, 커뮤니티, 대회, follower snapshot, 암호화된 문의 메일함 등 해당 디렉터리의 일반 파일이 포함된다.

Twitch 실시간 LIVE 상태와 로그인 session은 재시작 시 재동기화하거나 재로그인해야 하는 파생/보안 상태이므로 영속화하지 않는다.

## Backup

읽기와 manifest 생성을 검증한다.

```bash
npm run backup:state -- --dry-run --state-dir=/srv/yoro/state
```

실제 백업:

```bash
npm run backup:state -- --state-dir=/srv/yoro/state --output-dir=/srv/yoro/backups
```

백업은 임시 디렉터리에 복사한 뒤 원자적으로 이름을 바꾸며, `manifest.json`에 파일 크기와 SHA-256을 기록한다. symlink와 임시 파일은 포함하지 않는다.

## Restore Rehearsal

저장 상태 디렉터리가 없는 개발 환경에서도 실제 backup/restore 스크립트 경로를 검증할 수 있도록 격리 fixture 리허설을 제공한다. 이 명령은 임시 디렉터리만 사용하며 production state를 읽거나 수정하지 않는다.

```bash
node scripts/rehearse-backup-restore.mjs
```

이 자동 리허설은 manifest와 복원 로직의 회귀를 찾는 CI gate다. production과 같은 volume, 권한, 사용자, 파일 크기를 사용하는 staging 복구 훈련을 대체하지 않는다.

1. production과 분리된 임시 state 경로를 준비한다.
2. manifest dry-run을 수행한다.
3. 테스트 server를 중지한 상태로 임시 경로에 복원한다.
4. server를 테스트 config로 시작하고 readiness와 참여 대기열을 확인한다.
5. 리허설 결과와 소요 시간을 기록한다.

```bash
npm run restore:state -- --source=/srv/yoro/backups/state-<timestamp> --state-dir=/srv/yoro/restore-test
npm run restore:state -- --source=/srv/yoro/backups/state-<timestamp> --state-dir=/srv/yoro/restore-test --apply --server-stopped
```

## Production Restore Gate

- Release Manager 승인
- application 중지 확인
- 복원 대상과 backup timestamp 확인
- manifest dry-run 통과
- 현재 state의 별도 backup 완료
- 복원 후 `/health/ready`와 기능 smoke 통과

복원 스크립트는 기존 파일을 sibling pre-restore 디렉터리에 보존한다. backup에 없는 파일은 삭제하지 않는다.

## 자동 Backup Timer

저장소의 `deploy/systemd/yoro-backup.service`와 `deploy/systemd/yoro-backup.timer`는 매일 03:15에 상태 백업을 실행하는 운영 템플릿이다. 다음 명령은 운영자가 경로와 계정을 검토한 뒤 서버에서 실행한다.

```bash
sudo install -d -o yoro -g yoro -m 700 /srv/yoro/state /srv/yoro/backups
sudo install -o root -g root -m 600 deploy/systemd/yoro-operations.env.example /etc/yoro/operations.env
sudo install -o root -g root -m 644 deploy/systemd/yoro-backup.service /etc/systemd/system/yoro-backup.service
sudo install -o root -g root -m 644 deploy/systemd/yoro-backup.timer /etc/systemd/system/yoro-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now yoro-backup.timer
sudo systemctl start yoro-backup.service
systemctl status yoro-backup.service --no-pager
systemctl list-timers yoro-backup.timer --no-pager
```

`/etc/yoro/operations.env`의 경로는 실제 persistent volume과 일치해야 한다. 예제의 webhook과 운영 URL은 placeholder이므로 그대로 사용하지 않는다.

## 복구 훈련 기록

각 staging 복구 훈련은 `docs/operations/RECOVERY_REHEARSAL_LOG.md`에 증적 링크, backup timestamp, 소요 시간, RPO/RTO, 실패와 후속 조치를 기록한다. release 승인자는 최근 30일 내 성공 기록이 없으면 production 배포를 중단한다.

## 운영 정책 필요

- 백업 암호화 방식과 key 소유자
- offsite 저장소
- RPO/RTO
- 보관 기간과 자동 만료
- 일일 backup 실패 알림
- 월 1회 restore rehearsal
