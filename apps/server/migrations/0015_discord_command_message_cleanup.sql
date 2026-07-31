ALTER TABLE discord_bot_control_configs
  ADD COLUMN delete_invocation_after_reply BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE discord_bot_control_revisions
  DROP CONSTRAINT discord_bot_control_revisions_schema_version_check;

ALTER TABLE discord_bot_control_revisions
  ADD CONSTRAINT discord_bot_control_revisions_schema_version_check
    CHECK (schema_version IN (1, 2, 3));
