ALTER TABLE discord_setup_sessions
  DROP CONSTRAINT discord_setup_sessions_issued_via_check,
  ADD CONSTRAINT discord_setup_sessions_issued_via_check
    CHECK (issued_via IN ('bot_command', 'operator_test', 'web_management'));

CREATE INDEX discord_setup_sessions_web_management_expiry_idx
  ON discord_setup_sessions (status, expires_at)
  WHERE issued_via = 'web_management';
