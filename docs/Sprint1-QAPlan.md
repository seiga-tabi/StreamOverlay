# YORO.gg Sprint1 QA Plan

## 1. QA 목표

Sprint1 QA 목표는 foundation 변경이 production behavior를 바꾸지 않았음을 확인하는 것이다.

## 2. 공통 QA

모든 code PR:

- `npm run build`
- `npm run validate:config`
- `npm test`
- TypeScript compile
- no unexpected file changes
- no no-touch file changes

미실행 시:

- 항목
- 사유
- 위험도
- 대체 검증

## 3. Task별 QA Checklist

| Task | QA |
|---|---|
| S1-001 | git status, no tracked code change |
| S1-002 | dashboard/overlay build, flag undefined fallback |
| S1-003 | API client compile, auth status smoke, CSRF/header review |
| S1-004 | socket compile, URL/protocol unchanged review |
| S1-005 | locale switch smoke, no key removal |
| S1-006 | dashboard screenshot diff <= 0.3%, no selector deletion |
| S1-007 | overlay screenshot diff <= 0.1%, blank frame 0 |
| S1-008 | Button/IconButton compile, keyboard/focus review |
| S1-009 | Card/Metric compile, token usage review |
| S1-010 | PageHeader/state compile, i18n hardcoding check |
| S1-011 | export compile, circular import check |
| S1-012 | full build/config/test, Sprint1 close report |

## 4. Visual QA

Required screenshots:

- Dashboard desktop
- Dashboard mobile
- Login
- Settings
- Public Search
- Public Profile if reachable
- Overlay event mode
- Overlay participation mode
- Overlay solo-rank mode

허용:

- token alias로 인한 1px rounding

불허:

- text clipping
- card overlap
- button overflow
- mobile horizontal scroll
- overlay blank frame

## 5. Accessibility QA

확인:

- keyboard focus visible
- Button/IconButton accessible label
- 44px touch target
- Loading/Error/Empty state semantics
- no color-only state

## 6. i18n QA

확인:

- 새 user-facing text 없음 또는 KR/JP 구조 사용
- 영어 안내 문구 단독 추가 없음
- locale switch compile
- aria label도 번역 대상이면 KR/JP 처리

## 7. Performance QA

Sprint1 hard fail:

- initial JS gzip 30KB 이상 증가
- CSS gzip 20KB 이상 증가
- overlay first frame blank
- dashboard LCP baseline 대비 20% 이상 악화

## 8. Sprint1 종료 QA

S1-012에서 반드시 확인:

- 모든 PR merged in dependency order
- no no-touch file modified
- feature flags default safe
- legacy route/API/OBS URL unchanged
- no page migration started
- Sprint2 ready

