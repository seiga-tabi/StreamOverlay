# YORO.gg Git Strategy

## 1. Branch Strategy

| Branch | 역할 | 규칙 |
|---|---|---|
| `main` | production stable | 직접 push 금지, protected |
| `develop` | integration branch | Sprint 단위 통합 |
| `release/x.y.z` | release stabilization | bugfix만 허용 |
| `hotfix/x.y.z` | production emergency fix | `main`에서 분기 후 main/develop에 역병합 |
| `feature/<area>/<slug>` | 일반 기능 | 작고 독립적인 PR |
| `codex/<topic>` | Codex agent 작업 | 자동/보조 작업용, 리뷰 필수 |

## 2. Migration Branch 흐름

```text
main
  -> develop
    -> feature/architecture/folder-boundary
    -> feature/dashboard/app-shell
    -> feature/public/search-strangler
    -> feature/overlay/studio-boundary
    -> feature/server/api-v1-adapter
```

## 3. PR 크기 기준

| PR 유형 | 권장 크기 |
|---|---|
| 문서 | 제한 없음, 단 문서별 책임 명확 |
| 파일 이동 | 10~20 files 이하, behavior change 없음 |
| Component 추출 | 1 feature 이하 |
| CSS token | token/layer 하나씩 |
| API route | endpoint group 하나씩 |
| Store repository | domain 하나씩 |
| Overlay runtime | mode 또는 channel 하나씩 |

Code PR 권장 기준:

- 변경 파일 15개 이하
- production code diff 400 lines 이하
- CSS diff 300 lines 이하
- tests 또는 verification note 포함

## 4. PR Strategy

PR은 다음 중 하나의 성격만 가진다.

1. Documentation
2. Pure move/rename
3. Type/contract addition
4. Component extraction
5. CSS token/layer migration
6. API adapter addition
7. Domain service/repository extraction
8. Behavior change

섞으면 안 되는 조합:

- 파일 이동 + behavior change
- CSS token 변경 + page redesign
- API namespace 변경 + auth policy 변경
- Store migration + Prisma migration
- Overlay visual 변경 + socket protocol 변경

## 5. Review 기준

공통:

- Product Constitution과 충돌하지 않는가
- Architecture v2 layer rule을 지켰는가
- Design System Constitution을 깨지 않는가
- 기존 방송 운영 안정성을 해치지 않는가
- rollback 방법이 명확한가

Frontend:

- role별 navigation이 올바른가
- mobile/tablet/desktop 상태가 깨지지 않는가
- KR/JP copy 구조가 유지되는가
- accessibility state가 존재하는가
- loading/error/empty state가 빠지지 않았는가

Backend:

- auth, csrf, rate limit이 유지되는가
- unsafe action path가 생기지 않았는가
- shared contract와 validator가 있는가
- error response가 일관적인가
- log에 민감정보가 남지 않는가

Overlay:

- OBS URL 호환성이 유지되는가
- token auth가 유지되는가
- reconnect behavior가 유지되는가
- blank frame 가능성을 검증했는가
- heavy animation이 방송 화면을 방해하지 않는가

## 6. Merge 조건

1. 최소 1명 이상 review approval
2. CI 또는 수동 verification 결과 첨부
3. rollback note 작성
4. migration checklist 통과
5. 관련 문서 업데이트
6. production critical 변경은 release branch에서 추가 검증

## 7. Release Strategy

| Release 유형 | 내용 |
|---|---|
| Patch | bugfix, docs, low-risk CSS token |
| Minor | feature boundary migration, API v1 adapter |
| Major | DB cutover, navigation IA major change, overlay protocol change |

Migration 기간에는 minor release를 자주 만들고, major release는 Prisma read cutover 또는 IA-level behavior 변경에만 사용한다.

