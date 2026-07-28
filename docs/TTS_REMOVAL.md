# TTS·VOICEVOX 제거 운영 안내

로컬 TTS Engine과 VOICEVOX는 서버 자원 절감과 운영 단순화를 위해 제거되었습니다.
Overlay 배너, 효과음, 자막 및 미디어 기능은 유지되며 기존 `/tts/*` URL은 더 이상 제공되지 않습니다.

## 배포 전 확인

운영 `.env`는 코드 변경 과정에서 자동으로 수정하지 않습니다. 운영자는 배포 승인 후 다음 변수를 직접 제거할 수 있습니다.

- `LOCAL_TTS_ENABLED`
- `LOCAL_TTS_PROVIDER`
- `LOCAL_TTS_BASE_URL`
- `LOCAL_TTS_SPEAKER`
- `LOCAL_TTS_BROADCAST_WAIT_MS`
- `LOCAL_TTS_TIMEOUT_MS`
- `LOCAL_TTS_MAX_TEXT_LENGTH`
- `LOCAL_TTS_CACHE_DIR`
- `LOCAL_TTS_PUBLIC_PATH`
- `SE0YA_TTS_BIND`
- `SE0YA_TTS_HOST_PORT`
- `SE0YA_DEFAULT_SPEAKER_ID`
- `SE0YA_SERVER_HOST`
- `SE0YA_SERVER_PORT`
- `SEOYA_DEFAULT_SPEAKER_ID`
- `SEOYA_SERVER_HOST`
- `SEOYA_SERVER_PORT`
- `VOICEVOX_BASE_URL`
- `VOICEVOX_IMAGE`

알림 runtime 설정의 legacy 음성 필드는 먼저 읽기 전용으로 점검합니다.

```bash
npm --workspace @streamops/server run migrate:remove-tts-config
```

출력의 `changedRecords`와 `removedFields`만 확인할 수 있으며 음성 문장 원문은 출력하지 않습니다.
실제 변경은 유지보수 시간과 rollback 준비가 끝난 뒤 명시적으로 실행합니다.

```bash
npm --workspace @streamops/server run migrate:remove-tts-config -- --apply
```

적용 시 같은 디렉터리에 `.pre-tts-removal.bak` 백업을 만든 뒤 임시 파일 검증과 atomic rename을 수행합니다.
이미 migration된 파일에는 다시 변경을 적용하지 않습니다.
대상은 `STREAMOPS_STATE_DIR` 아래의 독립 파일 `alert-overlays.runtime.json` 하나로 고정되며 CLI 입력으로 경로를 바꿀 수 없습니다.
대상 파일이나 디렉터리가 symlink이거나 JSON이 손상된 경우 원본을 변경하지 않고 중단합니다.
쓰기 또는 rename 실패 시 원본과 검증된 backup을 보존하며, 동일한 원본으로 안전하게 재시도할 수 있습니다.

## 운영 자원 정리

새 버전의 안정성과 rollback 기간 종료를 확인하기 전에는 기존 TTS cache, 중지된 컨테이너, VOICEVOX image를 삭제하지 않습니다.
정리가 승인되면 정확한 TTS 대상만 확인하여 제거하며 `docker system prune`, 전체 volume prune, 광범위한 재귀 삭제는 사용하지 않습니다.

## 롤백

이전 immutable image와 이전 Compose 파일, 배포 전 runtime 설정 backup을 함께 복원합니다.
rollback 기간 동안 기존 TTS cache와 image를 보존합니다.
