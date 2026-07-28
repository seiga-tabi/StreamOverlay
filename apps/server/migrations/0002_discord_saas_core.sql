CREATE TABLE discord_guilds (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (char_length(discord_guild_id) BETWEEN 1 AND 32),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discord_guild_id),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, discord_guild_id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE TABLE discord_installations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL,
  application_id TEXT NOT NULL CHECK (char_length(application_id) BETWEEN 1 AND 32),
  installed_by_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'disabled')),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, discord_guild_id)
    REFERENCES discord_guilds (organization_id, discord_guild_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, installed_by_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE TABLE game_servers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('palworld')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  region TEXT NOT NULL CHECK (char_length(region) BETWEEN 1 AND 64),
  connection_type TEXT NOT NULL CHECK (connection_type IN ('agent', 'rest')),
  connection_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (connection_status IN ('not_configured', 'pending', 'ready', 'unavailable', 'revoked')),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, display_name),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE TABLE server_connections (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('agent', 'rest')),
  encrypted_config BYTEA NOT NULL CHECK (octet_length(encrypted_config) BETWEEN 16 AND 65536),
  encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  last_verified_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, game_server_id, connection_type),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE agent_installations (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'offline', 'revoked')),
  credential_hash BYTEA NOT NULL CHECK (octet_length(credential_hash) BETWEEN 32 AND 128),
  credential_version INTEGER NOT NULL CHECK (credential_version >= 1),
  last_seen_at TIMESTAMPTZ,
  last_ip_hash BYTEA CHECK (last_ip_hash IS NULL OR octet_length(last_ip_hash) BETWEEN 32 AND 128),
  agent_version TEXT CHECK (agent_version IS NULL OR char_length(agent_version) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, game_server_id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
