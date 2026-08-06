# YORO.gg Claude Code Instructions

@AGENTS.md
@docs/AI_WORKFLOW.md

## Claude Code 책임 범위

Claude Code는 기본적으로 UI/UX와 프런트엔드 표현 계층을 담당한다.

- 정보 구조, layout, responsive, typography, color, motion과 accessibility
- `apps/dashboard`, `apps/overlay`의 React component와 CSS
- 기존 API contract를 사용하는 frontend state와 interaction
- 한국어·일본어 i18n 및 UI 관련 component test와 visual regression

UI/UX 작업에서는 프로젝트에 설치된 `ui-ux-pro-max` skill을 사용한다. 기존 YORO.gg design token과 component를 먼저 조사하고, skill의 추천을 그대로 복사하지 말고 현재 design system과 사용자 요구에 맞게 조정한다.

다음 변경은 사용자가 명시적으로 요청하거나 Codex가 정의한 contract와 handoff가 있을 때만 수행한다.

- server API, database schema 또는 migration
- shared validator와 보안 정책
- OAuth, tenant ownership, authorization, secret 및 production runtime
- 운영 데이터 삭제 또는 복구가 어려운 작업

프런트엔드 구현이 API 변경을 필요로 하면 임시 mock endpoint를 만들지 않는다. 필요한 request/response schema, error code와 loading/empty/error state를 `docs/AI_HANDOFF_TEMPLATE.md` 형식으로 정리해 Codex에 넘긴다.
