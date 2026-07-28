ALTER TABLE discord_setup_sessions
  ADD COLUMN requested_discord_guild_id TEXT
    CHECK (
      requested_discord_guild_id IS NULL
      OR requested_discord_guild_id ~ '^[0-9]{1,32}$'
    ),
  ADD COLUMN requested_by_discord_user_id TEXT
    CHECK (
      requested_by_discord_user_id IS NULL
      OR requested_by_discord_user_id ~ '^[0-9]{1,32}$'
    ),
  ADD COLUMN issued_via TEXT NOT NULL DEFAULT 'operator_test'
    CHECK (issued_via IN ('bot_command', 'operator_test')),
  ADD COLUMN requested_application_id TEXT
    CHECK (
      requested_application_id IS NULL
      OR requested_application_id ~ '^[0-9]{1,32}$'
    ),
  ADD CONSTRAINT discord_setup_sessions_bot_binding_check CHECK (
    issued_via <> 'bot_command'
    OR (
      requested_discord_guild_id IS NOT NULL
      AND requested_by_discord_user_id IS NOT NULL
      AND requested_application_id IS NOT NULL
    )
  );

CREATE UNIQUE INDEX discord_setup_sessions_active_bot_binding_idx
  ON discord_setup_sessions (
    requested_discord_guild_id,
    requested_by_discord_user_id
  )
  WHERE issued_via = 'bot_command'
    AND status IN ('issued', 'authenticated', 'guild_selected')
    AND consumed_at IS NULL;

CREATE TABLE discord_bot_installation_observations (
  discord_guild_id TEXT NOT NULL
    CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  application_id TEXT NOT NULL
    CHECK (application_id ~ '^[0-9]{1,32}$'),
  status TEXT NOT NULL DEFAULT 'observed'
    CHECK (status IN ('observed', 'revoked')),
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (discord_guild_id, application_id),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX discord_bot_installation_observations_status_idx
  ON discord_bot_installation_observations (status, last_observed_at);

CREATE UNIQUE INDEX discord_installations_guild_application_idx
  ON discord_installations (organization_id, discord_guild_id, application_id);
