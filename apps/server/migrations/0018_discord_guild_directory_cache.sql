CREATE TABLE discord_guild_directory (
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  application_id TEXT NOT NULL CHECK (application_id ~ '^[0-9]{1,32}$'),
  channels JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(channels) = 'array' AND octet_length(channels::TEXT) <= 32768),
  roles JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(roles) = 'array' AND octet_length(roles::TEXT) <= 32768),
  channels_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  roles_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, discord_guild_id, application_id),
  UNIQUE (organization_id, discord_guild_id),
  FOREIGN KEY (organization_id, discord_guild_id, application_id)
    REFERENCES discord_installations (organization_id, discord_guild_id, application_id)
    ON DELETE CASCADE
);

CREATE INDEX discord_guild_directory_reported_idx
  ON discord_guild_directory (reported_at DESC);
