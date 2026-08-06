# YORO.gg Shared AI Instructions

## Shared instructions

- 모든 응답, 코드 설명, 작업 요약과 오류 설명은 한국어로 작성한다.
- 코드 문법, 변수명, 함수명, 파일명, 명령어, 라이브러리명과 API endpoint는 영어 원문을 유지한다.
- 신규 UI 문구는 기존 한국어·일본어 i18n 구조를 사용한다. 영어 문구가 필요하면 한국어·일본어 번역도 함께 관리한다.
- 작업 전 `git status --short`와 `git diff --stat`을 실행하고 기존 사용자 변경사항을 보존한다.
- 실제 `.env`, secret, token, password, encryption key의 내용을 출력하거나 수정하지 않는다.
- 사용자 요청 없이 `git add`, commit, push를 하지 않는다.
- Claude Code와 Codex의 역할, 작업 경계, handoff 및 검증 기준은 `docs/AI_WORKFLOW.md`를 끝까지 읽고 따른다.

## Project purpose

This repository powers a modular Twitch broadcast automation system.

Core architecture:
- apps/server: Linux server for Twitch EventSub, action routing, logs, dashboard APIs, Codex automation hooks.
- apps/bridge: Broadcast PC local bridge for OBS WebSocket control.
- apps/dashboard: Streamer/admin dashboard.
- apps/overlay: OBS Browser Source overlay.
- packages/shared: Shared TypeScript types, schemas, and safe action definitions.

## Prime directive

This system may run during live broadcasts. Prioritize:
1. Safety
2. Predictability
3. Low runtime risk
4. Maintainability
5. Type safety
6. Clear logs
7. Minimal diffs

Never prioritize cleverness over broadcast stability.

## Hard safety rules

Viewer-triggered input must never lead to:
- shell command execution
- arbitrary file writes
- arbitrary file deletion
- arbitrary URL opening
- OBS stream key changes
- remote stream start/stop
- arbitrary OBS command execution
- unsafe Twitch moderation actions without explicit human approval
- Discord @everyone / @here without explicit human approval

Allowed runtime actions must remain allowlist-based.

Allowed action families:
- obs.setScene
- obs.showSource
- obs.hideSource
- obs.toggleSource
- obs.saveReplayBuffer
- obs.setInputMute
- obs.setText
- obs.playMedia
- twitch.chat
- overlay.banner
- subtitle.update
- question.show
- mission.update
- queue.question
- log.highlight
- noop

Do not introduce new action types unless:
1. The type is added to the shared schema.
2. The action is validated.
3. The action is documented.
4. Tests are added.
5. The action cannot execute arbitrary user-controlled behavior.

## Required validation

When modifying code, try to keep these commands passing:

```bash
npm run build
npm run validate:config
npm test
```
