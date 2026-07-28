CREATE TABLE server_current_status (
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  online BOOLEAN NOT NULL,
  players INTEGER NOT NULL CHECK (players >= 0),
  max_players INTEGER NOT NULL CHECK (max_players >= 0 AND players <= max_players),
  game_version TEXT CHECK (game_version IS NULL OR char_length(game_version) BETWEEN 1 AND 80),
  uptime_seconds BIGINT CHECK (uptime_seconds IS NULL OR uptime_seconds >= 0),
  cpu_percent NUMERIC(5,2) CHECK (cpu_percent IS NULL OR cpu_percent BETWEEN 0 AND 100),
  memory_percent NUMERIC(5,2) CHECK (memory_percent IS NULL OR memory_percent BETWEEN 0 AND 100),
  disk_percent NUMERIC(5,2) CHECK (disk_percent IS NULL OR disk_percent BETWEEN 0 AND 100),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_version INTEGER NOT NULL CHECK (payload_version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, game_server_id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE server_status_history (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  online BOOLEAN NOT NULL,
  players INTEGER NOT NULL CHECK (players >= 0),
  max_players INTEGER NOT NULL CHECK (max_players >= 0 AND players <= max_players),
  uptime_seconds BIGINT CHECK (uptime_seconds IS NULL OR uptime_seconds >= 0),
  cpu_percent NUMERIC(5,2) CHECK (cpu_percent IS NULL OR cpu_percent BETWEEN 0 AND 100),
  memory_percent NUMERIC(5,2) CHECK (memory_percent IS NULL OR memory_percent BETWEEN 0 AND 100),
  disk_percent NUMERIC(5,2) CHECK (disk_percent IS NULL OR disk_percent BETWEEN 0 AND 100),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_version INTEGER NOT NULL CHECK (payload_version >= 1),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX server_status_history_recent_idx
  ON server_status_history (organization_id, game_server_id, observed_at DESC);

CREATE TABLE server_events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  safe_metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(safe_metadata) = 'object' AND octet_length(safe_metadata::TEXT) <= 16384),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT,
  CHECK (expires_at >= occurred_at)
);

CREATE INDEX server_events_recent_idx
  ON server_events (organization_id, game_server_id, occurred_at DESC);

CREATE TABLE notification_rules (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (char_length(rule_type) BETWEEN 1 AND 80),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_interval_seconds INTEGER NOT NULL DEFAULT 300 CHECK (minimum_interval_seconds BETWEEN 30 AND 86400),
  safe_config JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(safe_config) = 'object' AND octet_length(safe_config::TEXT) <= 16384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, game_server_id, rule_type),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE notification_jobs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (char_length(job_type) BETWEEN 1 AND 80),
  deduplication_key TEXT NOT NULL CHECK (char_length(deduplication_key) BETWEEN 1 AND 160),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::TEXT) <= 65536),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  locked_at TIMESTAMPTZ,
  locked_by TEXT CHECK (locked_by IS NULL OR char_length(locked_by) BETWEEN 1 AND 120),
  completed_at TIMESTAMPTZ,
  last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT,
  CHECK ((locked_at IS NULL) = (locked_by IS NULL))
);

CREATE UNIQUE INDEX notification_jobs_active_dedup_idx
  ON notification_jobs (organization_id, deduplication_key)
  WHERE completed_at IS NULL;

CREATE INDEX notification_jobs_dequeue_idx
  ON notification_jobs (organization_id, available_at, created_at)
  WHERE completed_at IS NULL AND locked_at IS NULL;

CREATE TABLE discord_status_messages (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL CHECK (char_length(channel_id) BETWEEN 1 AND 32),
  message_id TEXT NOT NULL CHECK (char_length(message_id) BETWEEN 1 AND 32),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, game_server_id, discord_guild_id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, discord_guild_id)
    REFERENCES discord_guilds (organization_id, discord_guild_id) ON DELETE RESTRICT
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
  provider_customer_reference TEXT NOT NULL CHECK (char_length(provider_customer_reference) BETWEEN 1 AND 160),
  provider_subscription_reference TEXT CHECK (
    provider_subscription_reference IS NULL
    OR char_length(provider_subscription_reference) BETWEEN 1 AND 160
  ),
  status TEXT NOT NULL CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'cancelled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (provider, provider_customer_reference),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE TABLE entitlements (
  organization_id UUID PRIMARY KEY,
  max_discord_guilds INTEGER NOT NULL DEFAULT 1 CHECK (max_discord_guilds BETWEEN 0 AND 1000),
  max_game_servers INTEGER NOT NULL DEFAULT 1 CHECK (max_game_servers BETWEEN 0 AND 1000),
  minimum_push_interval_seconds INTEGER NOT NULL DEFAULT 300
    CHECK (minimum_push_interval_seconds BETWEEN 30 AND 86400),
  history_retention_days INTEGER NOT NULL DEFAULT 1 CHECK (history_retention_days BETWEEN 1 AND 3650),
  custom_embed_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  resource_metrics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  export_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE TABLE usage_counters (
  organization_id UUID NOT NULL,
  counter_key TEXT NOT NULL CHECK (char_length(counter_key) BETWEEN 1 AND 80),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  counter_value BIGINT NOT NULL DEFAULT 0 CHECK (counter_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, counter_key, period_start),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CHECK (period_end > period_start)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  target_type TEXT NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 80),
  target_reference_hash BYTEA CHECK (
    target_reference_hash IS NULL OR octet_length(target_reference_hash) BETWEEN 32 AND 128
  ),
  safe_metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(safe_metadata) = 'object' AND octet_length(safe_metadata::TEXT) <= 16384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, actor_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX audit_logs_recent_idx
  ON audit_logs (organization_id, created_at DESC);
