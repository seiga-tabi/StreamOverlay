CREATE TABLE schema_migrations (
  migration_id TEXT PRIMARY KEY,
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
  application_version TEXT NOT NULL CHECK (char_length(application_version) BETWEEN 1 AND 80),
  dirty BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  discord_user_id TEXT UNIQUE CHECK (discord_user_id IS NULL OR char_length(discord_user_id) BETWEEN 1 AND 32),
  twitch_user_id TEXT UNIQUE CHECK (twitch_user_id IS NULL OR char_length(twitch_user_id) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (discord_user_id IS NOT NULL OR twitch_user_id IS NOT NULL)
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (id, status)
);

CREATE TABLE organization_members (
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX organization_members_user_idx
  ON organization_members (user_id, organization_id);
