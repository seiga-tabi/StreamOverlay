# StreamOps Twitch Bot - Codex Instructions

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
