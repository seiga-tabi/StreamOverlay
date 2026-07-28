ALTER TABLE agent_installations
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN credential_expires_at TIMESTAMPTZ,
  ADD COLUMN last_credential_used_at TIMESTAMPTZ,
  ADD COLUMN last_payload_version INTEGER
    CHECK (last_payload_version IS NULL OR last_payload_version >= 1);

CREATE UNIQUE INDEX agent_installations_credential_hash_idx
  ON agent_installations (credential_hash)
  WHERE credential_hash IS NOT NULL;

CREATE TABLE agent_request_nonces (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  agent_installation_id UUID NOT NULL,
  nonce_hash BYTEA NOT NULL CHECK (octet_length(nonce_hash) = 32),
  request_timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (agent_installation_id, nonce_hash),
  FOREIGN KEY (organization_id, agent_installation_id)
    REFERENCES agent_installations (organization_id, id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at)
);

CREATE INDEX agent_request_nonces_expiry_idx
  ON agent_request_nonces (expires_at);

ALTER TABLE server_status_history
  ADD COLUMN agent_installation_id UUID,
  ADD COLUMN game_version TEXT
    CHECK (game_version IS NULL OR char_length(game_version) BETWEEN 1 AND 80),
  ADD COLUMN payload_hash BYTEA
    CHECK (payload_hash IS NULL OR octet_length(payload_hash) = 32),
  ADD CONSTRAINT server_status_history_agent_fk
    FOREIGN KEY (organization_id, agent_installation_id)
      REFERENCES agent_installations (organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT server_status_history_agent_payload_pair
    CHECK (
      (agent_installation_id IS NULL AND payload_hash IS NULL)
      OR (agent_installation_id IS NOT NULL AND payload_hash IS NOT NULL)
    );

CREATE UNIQUE INDEX server_status_history_agent_observed_idx
  ON server_status_history (
    organization_id,
    game_server_id,
    agent_installation_id,
    observed_at
  )
  WHERE agent_installation_id IS NOT NULL;
