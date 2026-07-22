# YORO.gg 운영 문서

이 폴더는 재현 가능한 배포와 장애 복구에 필요한 운영 문서를 모읍니다. 실제 secret 값, 토큰, 운영자 개인정보는 저장소에 기록하지 않습니다.

- [Docker 배포](DEPLOYMENT_DOCKER.md)
- [릴리즈 체크리스트](RELEASE_CHECKLIST.md)
- [롤백](ROLLBACK.md)
- [백업과 복구](BACKUP_RESTORE.md)
- [Secret rotation](SECRETS_ROTATION.md)
- [Palworld 서버 상태 운영 설정](PALWORLD_SERVER_STATUS.md)
- [운영자 확인 체크리스트](PRODUCTION_OPERATOR_CHECKLIST.md)

코드로 검증 가능한 항목은 CI에서 차단합니다. 외부 계정, DNS, webhook 수신, 법적 문구와 실제 복구 훈련은 운영자가 별도로 확인하고 증적을 남겨야 합니다.
