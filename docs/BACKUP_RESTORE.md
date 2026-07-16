# 백업과 복구

## 자동 백업

저장소의 `deploy/systemd/yoro-backup.service`와 `yoro-backup.timer`를 사용합니다. `/etc/yoro/operations.env`는 운영자가 만들고 권한을 `0600`으로 제한합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now yoro-backup.timer
systemctl list-timers yoro-backup.timer
sudo systemctl start yoro-backup.service
sudo journalctl -u yoro-backup.service --since today
```

## 로컬 무해성 검증

```bash
node scripts/rehearse-backup-restore.mjs
```

이 명령은 임시 fixture를 만들고 backup manifest와 격리 복원을 비교합니다. production 상태 디렉터리를 수정하지 않습니다.

## 실제 복구 훈련

1. 최근 backup의 manifest와 권한을 확인합니다.
2. 별도 격리 디렉터리 또는 staging 서버에 복원합니다.
3. 서버를 staging 상태 디렉터리로 기동합니다.
4. 계정 설정, 참여 session, 문의함 등 핵심 상태를 샘플링합니다.
5. 훈련 일시, backup ID, restore 소요 시간, 검증자와 결과를 운영 기록에 남깁니다.

production에 적용하는 restore는 서버 중지와 사람 승인 없이 실행하지 않습니다. 실패 또는 backup 지연은 alert webhook으로 통지되어야 합니다.
