CREATE TABLE discord_participation_announcement_targets (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  application_id TEXT NOT NULL CHECK (application_id ~ '^[0-9]{1,32}$'),
  streamer_twitch_user_id TEXT NOT NULL
    CHECK (char_length(streamer_twitch_user_id) BETWEEN 1 AND 64),
  channel_id TEXT NOT NULL CHECK (channel_id ~ '^[0-9]{1,32}$'),
  mention_role_id TEXT
    CHECK (mention_role_id IS NULL OR mention_role_id ~ '^[0-9]{1,32}$'),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  deliverable TEXT NOT NULL DEFAULT 'ok'
    CHECK (deliverable IN ('ok', 'missing_channel', 'missing_permission', 'bot_removed')),
  last_delivered_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, discord_guild_id, streamer_twitch_user_id),
  FOREIGN KEY (organization_id, discord_guild_id, application_id)
    REFERENCES discord_installations (organization_id, discord_guild_id, application_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, created_by_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX discord_participation_announcement_targets_streamer_idx
  ON discord_participation_announcement_targets (streamer_twitch_user_id)
  WHERE is_enabled = TRUE;

CREATE INDEX discord_participation_announcement_targets_guild_idx
  ON discord_participation_announcement_targets (organization_id, discord_guild_id);

CREATE TABLE discord_participation_messages (
  target_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  message_id TEXT NOT NULL CHECK (message_id ~ '^[0-9]{1,32}$'),
  public_session_id TEXT NOT NULL
    CHECK (char_length(public_session_id) BETWEEN 1 AND 128),
  last_state TEXT NOT NULL CHECK (last_state IN ('recruiting', 'closed')),
  last_waiting INTEGER CHECK (last_waiting IS NULL OR last_waiting BETWEEN 0 AND 9999),
  last_edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, target_id),
  FOREIGN KEY (organization_id, target_id)
    REFERENCES discord_participation_announcement_targets (organization_id, id)
    ON DELETE CASCADE
);

ALTER TABLE discord_bot_control_configs
  ADD COLUMN participation_announce_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE discord_bot_control_revisions
  DROP CONSTRAINT discord_bot_control_revisions_schema_version_check;

ALTER TABLE discord_bot_control_revisions
  ADD CONSTRAINT discord_bot_control_revisions_schema_version_check
    CHECK (schema_version IN (1, 2, 3, 4));
