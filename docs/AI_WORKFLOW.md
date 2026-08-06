# YORO.gg AI 공동 작업 지침

이 문서는 Claude Code와 Codex가 함께 사용하는 작업 기준의 단일 원본이다. 도구별 파일에는 이 문서와 충돌하지 않는 역할별 보충 규칙만 둔다.

## 1. 역할 분담

| 영역 | 주 담당 | 검수 담당 |
| --- | --- | --- |
| UI/UX, responsive, CSS, motion, component 구성 | Claude Code | Codex |
| 한국어·일본어 UI 문구와 visual state | Claude Code | Codex |
| API, domain logic, cache, performance | Codex | Claude Code가 사용성 확인 |
| shared schema, validator, migration, database | Codex | 테스트와 migration plan 검수 |
| OAuth, authorization, tenant isolation, secret | Codex | 보안 회귀 테스트 |
| CI, build, test, 운영 배포 검수 | Codex | Claude Code가 visual regression 확인 |

주 담당은 소유권을 뜻하지만 독점 권한은 아니다. 사용자 요청이 우선하며, 경계를 넘는 변경은 이유와 영향을 handoff에 명시한다.

## 2. 공통 작업 원칙

1. 작업 전에 `AGENTS.md`와 이 문서를 끝까지 읽는다.
2. `git status --short`와 `git diff --stat`으로 기존 변경을 확인한다.
3. 사용자의 미완료 변경을 덮어쓰거나 되돌리지 않는다.
4. 같은 파일을 Claude Code와 Codex가 동시에 수정하지 않는다.
5. 기능 동작을 바꾸는 UI는 먼저 API contract와 상태 전이를 합의한다.
6. fake data, 존재하지 않는 endpoint, 가짜 download와 임시 보안 우회로 UI를 완성하지 않는다.
7. viewer 또는 외부 입력은 기존 allowlist, validator, permission 정책을 통과해야 한다.
8. secret 값, OAuth token, ciphertext, private URL과 원문 외부 응답을 로그나 UI에 노출하지 않는다.
9. schema 변경은 forward-only migration으로 작성하며 적용된 migration은 수정하지 않는다.
10. destructive operation, 운영 데이터 변경, 외부 전송, commit과 push는 사용자 승인 범위를 확인한다.

## 3. Git 및 작업 공간

- 동시에 작업할 때는 별도 branch와 worktree를 사용한다.
- Claude Code branch 권장 형식: `claude/ui-<feature>`
- Codex branch 권장 형식: `codex/<feature>`
- 한쪽 작업이 끝나기 전 다른 쪽이 같은 파일을 수정해야 하면 먼저 handoff하고 변경 파일 소유권을 넘긴다.
- merge 전에 `git diff --check`와 충돌 여부를 확인한다.

## 4. UI 작업 기준

- 신규 UI 문구는 한국어와 일본어를 함께 추가한다.
- 기존 design token, primitive, routing, shared validator를 재사용한다.
- 최소 `360`, `390`, `430`, `768`, `1024`, `1440px`에서 overflow와 주요 flow를 확인한다.
- keyboard focus, label, ARIA, contrast, reduced motion, loading, empty, error, success state를 구현한다.
- 모바일 touch target은 원칙적으로 `44×44px` 이상으로 유지한다.
- 시각 효과가 기능 상태를 가리거나 live broadcast 안정성을 해치지 않아야 한다.

## 5. Backend 및 보안 작업 기준

- request/response는 shared schema로 검증하고 사용자 입력은 allowlist 기반으로 처리한다.
- tenant 소유권과 권한 검사를 repository 및 route 양쪽 사용 흐름에서 확인한다.
- timeout, abort, bounded retry와 safe error code를 사용한다.
- 로그에는 진단에 필요한 식별자만 hash 또는 비식별 형태로 기록한다.
- migration은 plan, backup, apply, check와 rollback 절차를 문서화한다.

## 6. Handoff 계약

Claude Code에서 Codex로 넘길 때:

- 변경한 화면과 canonical route
- 사용한 기존 API와 필요한 신규 contract
- loading, empty, error, success 상태
- i18n key와 responsive 기준
- 수정 파일과 실행한 frontend test

Codex에서 Claude Code로 넘길 때:

- endpoint, method, auth 및 permission
- request/response schema와 safe error code
- cache, pagination, timeout 정책
- migration 또는 운영 설정 필요 여부
- UI가 반드시 처리해야 하는 상태

공식 handoff 기록은 `docs/AI_HANDOFF_TEMPLATE.md`를 복사해 작업 설명 또는 PR 본문에 작성한다.

## 7. 검증 기준

변경 범위에 맞는 최소 검증을 선택하되, 최종 통합 단계에서는 가능한 범위에서 아래를 실행한다.

```bash
npm run lint
npm run typecheck
npm run build
npm run validate:config
npm run test:run
git diff --check
```

UI 변경에는 관련 component test와 visual regression을, backend 변경에는 route/service test와 tenant·permission 회귀 테스트를 포함한다. 실제 secret 또는 운영 외부 시스템이 필요한 검증은 값을 읽어 출력하지 말고 blocker와 수동 확인 절차를 보고한다.

## 8. Skill 관리

- Claude Code UI/UX 작업은 `.claude/skills/ui-ux-pro-max/SKILL.md`를 사용한다.
- third-party skill의 출처, 버전, commit과 로컬 수정은 해당 skill의 `UPSTREAM.md`에서 관리한다.
- skill은 참고 지식이며 YORO.gg의 기존 design system과 사용자 요구보다 우선하지 않는다.
- 새 skill을 추가할 때는 source, license, script 권한, network 사용, 파일 쓰기 및 삭제 범위를 먼저 감사한다.
