# YORO.gg AI Development Rules

## 1. 목적

이 문서는 YORO.gg 프로젝트에서 Codex와 모든 AI Agent가 반드시 따라야 하는 최상위 개발 규칙이다. AI는 프로젝트의 제품 방향, 디자인 언어, 아키텍처, API, 보안 정책을 임의로 변경할 수 없다.

## 2. 모든 AI Agent 공통 규칙

1. 모든 응답은 한국어로 작성한다.
2. 실제 코드 문법, 변수명, 함수명, 파일명, 명령어, 라이브러리명, API endpoint는 영어 원문을 유지한다.
3. 작업 전 요청 범위를 명확히 해석한다.
4. 사용자가 "코드 수정 금지"라고 말하면 Markdown 문서 외 어떤 코드/설정 파일도 수정하지 않는다.
5. 기존 사용자 변경사항을 되돌리지 않는다.
6. 방송 운영 안정성을 최우선으로 한다.
7. 모르는 구조는 추측하지 않고 저장소를 먼저 확인한다.
8. Product Constitution과 Architecture v2를 위반하는 기능은 구현하지 않는다.

## 3. 작업 전 반드시 읽어야 하는 문서

작업 유형별로 다음 문서를 먼저 확인한다.

| 작업 유형 | 필수 문서 |
|---|---|
| 모든 작업 | `docs/Product-Constitution.md`, `docs/Architecture-v2.md`, `docs/Migration-Plan.md`, `docs/Execution-Plan.md` |
| UI/UX | `docs/Design-System-Constitution.md`, `.ai/UI_RULES.md`, `.ai/DESIGN_SYSTEM_RULES.md` |
| 리팩토링 | `docs/Refactor-Priority-Matrix.md`, `docs/Compatibility-Layer.md`, `docs/Feature-Flag-Plan.md`, `.ai/REFACTOR_RULES.md` |
| API/Backend | `docs/Architecture-v2.md`, `.ai/SECURITY_RULES.md`, `.ai/CODING_STANDARDS.md` |
| QA/검증 | `docs/QA-Checkpoint.md`, `docs/Performance-Budget.md`, `.ai/QA_RULES.md` |
| Git/PR | `docs/Git-Strategy.md`, `.ai/GIT_RULES.md`, `.ai/REVIEW_RULES.md` |
| i18n | `I18N_RULES.md` |

## 4. 문서 우선순위

충돌이 발생하면 다음 순서로 판단한다.

1. 사용자 최신 지시
2. 보안/방송 안전 규칙
3. `docs/Product-Constitution.md`
4. `docs/Architecture-v2.md`
5. `docs/Design-System-Constitution.md`
6. `docs/Migration-Plan.md`
7. `docs/Execution-Plan.md`
8. `.ai/*_RULES.md`
9. 기존 코드 패턴

사용자 지시가 보안, 데이터 보호, 방송 안정성, 금지 action 원칙과 충돌하면 작업을 중단하고 이유를 보고한다.

## 5. 작업 범위 제한 규칙

- 요청받은 파일과 직접 관련된 파일만 수정한다.
- 관련 없는 refactor, formatting, rename을 하지 않는다.
- package, dependency, build 설정은 명시 요청 없이 수정하지 않는다.
- HTML, CSS, TypeScript, React, Node, DB 수정 금지 요청이 있으면 절대 수정하지 않는다.
- 문서 작성 요청이면 Markdown 문서만 생성/수정한다.
- 기능 추가 요청이 아니면 새 기능을 만들지 않는다.

## 6. 임의 기능 추가 금지

AI는 다음을 임의로 추가할 수 없다.

- 새 페이지
- 새 navigation item
- 새 API endpoint
- 새 DB model
- 새 dependency
- 새 auth/session 정책
- 새 OBS action type
- 새 Twitch/Riot integration
- 새 디자인 컨셉
- 새 analytics event taxonomy

필요해 보여도 먼저 문서와 사용자 승인이 필요하다.

## 7. 임의 디자인 변경 금지

AI는 다음을 임의로 변경할 수 없다.

- color palette
- typography scale
- radius scale
- shadow style
- spacing scale
- motion/easing
- card/button/modal/toast 기본 스타일
- layout density
- YORO.gg product tone

모든 UI 변경은 `docs/Design-System-Constitution.md`와 `.ai/DESIGN_SYSTEM_RULES.md`를 따른다.

## 8. 충돌 발생 시 판단 기준

| 상황 | 판단 |
|---|---|
| 제품 문서와 기존 코드가 다름 | migration plan에 따라 compatibility layer를 둔다 |
| 디자인 문서와 기존 CSS가 다름 | 기존 화면을 유지하며 token alias부터 도입한다 |
| 새 구조와 legacy 구조가 충돌 | feature flag와 adapter로 병행한다 |
| 보안과 편의성이 충돌 | 보안을 우선한다 |
| 방송 안정성과 refactor가 충돌 | 방송 안정성을 우선한다 |

## 9. 보고 형식

작업 완료 보고에는 다음을 포함한다.

- 변경한 파일 목록
- 변경하지 않은 범위
- 검증한 명령 또는 미실행 사유
- 코드 변경 여부
- 위험/rollback 메모
- 다음 추천 작업

## 10. 금지 행동 목록

- 사용자 요청 없이 코드 구조를 대규모 변경
- Big Bang Refactor
- 임의 디자인 redesign
- 기존 문서와 반대되는 기능 추가
- unsafe OBS/Twitch action 추가
- secret, token, API key 하드코딩
- package.json 임의 수정
- DB schema 임의 수정
- legacy path 즉시 삭제
- feature flag 없이 high-risk path 변경
- 한국어/일본어 i18n 없이 UI text 추가
- 테스트 실패를 숨김
- git reset, checkout 등 사용자 변경 파괴
