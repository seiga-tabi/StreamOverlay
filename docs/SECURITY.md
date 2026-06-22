# Security Notes

## Critical boundaries

1. Twitch viewer input must not become code.
2. Server-generated commands must pass action validation.
3. Bridge must revalidate OBS commands before execution.
4. OBS WebSocket should stay on localhost.
5. Server-to-bridge WebSocket must require a shared secret.

## Forbidden action types

- `shell.exec`
- `file.delete`
- `file.write_anywhere`
- `browser.open_url_any`
- `obs.setStreamKey`
- `obs.startStream`
- `obs.stopStream`

## Production checklist

- Use HTTPS/WSS in production.
- Do not commit `.env` files.
- Rotate Twitch tokens if leaked.
- Set OBS WebSocket password.
- Do not expose OBS WebSocket to the internet.
- Enable config validation in CI.
