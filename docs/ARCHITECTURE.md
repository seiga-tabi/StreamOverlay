# Architecture

## Runtime path

```text
Twitch EventSub WebSocket
  → server/twitch-eventsub-client
  → server EventBus
  → modules
  → ActionDispatcher
  → BridgeManager or TwitchApi or OverlayHub
  → broadcast PC bridge
  → OBS WebSocket
```

## Server responsibilities

- EventSub session lifecycle
- Twitch API calls
- module registration
- action validation and dispatch
- dashboard API and WebSocket
- overlay WebSocket
- JSONL logging
- LoL participation queue

## Bridge responsibilities

- connect outbound to the server
- authenticate with shared secret
- validate bridge commands
- connect to OBS WebSocket on localhost
- execute only allowlisted OBS commands
- return success/failure acknowledgements

## Frontend responsibilities

- Dashboard: operator UI, status, questions, safe action tester
- Overlay: OBS Browser Source rendering for events, subtitles, questions, missions, LoL queue
