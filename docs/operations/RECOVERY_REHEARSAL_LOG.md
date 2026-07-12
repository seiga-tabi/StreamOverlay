# Backup/Restore 복구 훈련 기록

CI fixture 리허설은 스크립트 회귀 검증이며 아래 production-like staging 복구 훈련을 대체하지 않는다.

| 일시 | Release SHA | Backup timestamp | 대상 환경 | Manifest | 격리 복원 | Readiness | 기능 smoke | RPO | RTO | 증적 | 판정 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 미실시 | - | - | staging | - | - | - | - | - | - | - | BLOCKED |

## 상세 기록 템플릿

- 훈련 일시와 담당자:
- Release SHA / image digest:
- 원본 state 경로:
- Backup 경로와 manifest SHA-256:
- 격리 복원 경로:
- 복원 시작/종료 시각:
- `/health/live` 결과:
- `/health/ready` 결과:
- 참여 대기열/커뮤니티/대회 smoke 결과:
- 발견 이슈:
- 후속 담당자와 기한:
- Release Manager 승인:
