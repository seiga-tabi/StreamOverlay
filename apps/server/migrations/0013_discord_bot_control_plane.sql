CREATE TABLE discord_bot_control_configs (
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  application_id TEXT NOT NULL CHECK (application_id ~ '^[0-9]{1,32}$'),
  public_commands_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  palworld_status_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status_command_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  guide_command_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_locale TEXT NOT NULL DEFAULT 'auto'
    CHECK (preferred_locale IN ('auto', 'ko', 'ja')),
  show_players BOOLEAN NOT NULL DEFAULT TRUE,
  show_version BOOLEAN NOT NULL DEFAULT TRUE,
  show_latency BOOLEAN NOT NULL DEFAULT TRUE,
  show_observed_at BOOLEAN NOT NULL DEFAULT TRUE,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, discord_guild_id, application_id),
  FOREIGN KEY (organization_id, discord_guild_id, application_id)
    REFERENCES discord_installations (
      organization_id,
      discord_guild_id,
      application_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, updated_by_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX discord_bot_control_configs_updated_idx
  ON discord_bot_control_configs (organization_id, updated_at DESC);

CREATE TABLE discord_bot_control_revisions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  application_id TEXT NOT NULL CHECK (application_id ~ '^[0-9]{1,32}$'),
  revision BIGINT NOT NULL CHECK (revision >= 1),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  safe_snapshot JSONB NOT NULL
    CHECK (
      jsonb_typeof(safe_snapshot) = 'object'
      AND octet_length(safe_snapshot::TEXT) <= 4096
    ),
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, discord_guild_id, application_id, revision),
  FOREIGN KEY (organization_id, discord_guild_id, application_id)
    REFERENCES discord_bot_control_configs (
      organization_id,
      discord_guild_id,
      application_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX discord_bot_control_revisions_recent_idx
  ON discord_bot_control_revisions (
    organization_id,
    discord_guild_id,
    application_id,
    revision DESC
  );
