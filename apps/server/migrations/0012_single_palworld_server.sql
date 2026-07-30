UPDATE agent_bootstrap_sessions bootstrap
SET status = 'revoked',
    revoked_at = COALESCE(revoked_at, NOW())
FROM game_servers server
WHERE bootstrap.organization_id = server.organization_id
  AND bootstrap.game_server_id = server.id
  AND bootstrap.status = 'issued'
  AND server.deleted_at IS NULL
  AND server.is_enabled = FALSE;

UPDATE agent_installations installation
SET status = 'revoked',
    revoked_at = COALESCE(revoked_at, NOW())
FROM game_servers server
WHERE installation.organization_id = server.organization_id
  AND installation.game_server_id = server.id
  AND installation.status <> 'revoked'
  AND server.deleted_at IS NULL
  AND server.is_enabled = FALSE;

DELETE FROM server_connections connection
USING game_servers server
WHERE connection.organization_id = server.organization_id
  AND connection.game_server_id = server.id
  AND server.deleted_at IS NULL
  AND server.is_enabled = FALSE;

UPDATE game_servers
SET deleted_at = NOW(),
    connection_status = 'revoked',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND is_enabled = FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT organization_id
    FROM game_servers
    WHERE deleted_at IS NULL
    GROUP BY organization_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'single_palworld_server_precondition_failed';
  END IF;
END
$$;

ALTER TABLE game_servers
  DROP CONSTRAINT game_servers_organization_id_display_name_key;

CREATE UNIQUE INDEX game_servers_one_registered_per_organization_idx
  ON game_servers (organization_id)
  WHERE deleted_at IS NULL;
