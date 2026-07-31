ALTER TABLE discord_bot_control_configs
  ADD COLUMN player_command_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE discord_bot_control_revisions
  DROP CONSTRAINT discord_bot_control_revisions_schema_version_check;

ALTER TABLE discord_bot_control_revisions
  ADD CONSTRAINT discord_bot_control_revisions_schema_version_check
    CHECK (schema_version IN (1, 2));
