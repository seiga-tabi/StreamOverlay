import type { Pool, PoolClient, QueryResultRow } from "pg";

export const DATABASE_AUDIT_QUERIES = Object.freeze([
  Object.freeze({
    name: "migrations",
    sql: `SELECT migration_id,
                 checksum_sha256,
                 applied_at,
                 dirty
            FROM schema_migrations
           ORDER BY applied_at, migration_id`
  }),
  Object.freeze({
    name: "database",
    sql: `SELECT current_database() AS database_name,
                 pg_database_size(current_database())::bigint AS bytes`
  }),
  Object.freeze({
    name: "tables",
    sql: `SELECT schemaname AS schema_name,
                 relname AS table_name,
                 n_live_tup::bigint AS estimated_rows,
                 n_dead_tup::bigint AS dead_rows,
                 seq_scan::bigint,
                 idx_scan::bigint,
                 pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)::bigint AS total_bytes,
                 pg_relation_size(format('%I.%I', schemaname, relname)::regclass)::bigint AS table_bytes,
                 last_analyze,
                 last_autoanalyze,
                 last_vacuum,
                 last_autovacuum
            FROM pg_stat_user_tables
           ORDER BY total_bytes DESC, schema_name, table_name`
  }),
  Object.freeze({
    name: "indexes",
    sql: `SELECT schemaname AS schema_name,
                 relname AS table_name,
                 indexrelname AS index_name,
                 idx_scan::bigint,
                 pg_relation_size(indexrelid)::bigint AS index_bytes,
                 indisunique AS is_unique,
                 indisprimary AS is_primary
            FROM pg_stat_user_indexes
            JOIN pg_index ON pg_index.indexrelid = pg_stat_user_indexes.indexrelid
           ORDER BY index_bytes DESC, schema_name, table_name, index_name`
  }),
  Object.freeze({
    name: "json_columns",
    sql: `SELECT table_schema AS schema_name,
                 table_name,
                 column_name,
                 data_type,
                 is_nullable
            FROM information_schema.columns
           WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
             AND data_type IN ('json', 'jsonb')
           ORDER BY schema_name, table_name, ordinal_position`
  }),
  Object.freeze({
    name: "json_storage",
    sql: `SELECT 'server_events.safe_metadata' AS column_name,
                 COUNT(*)::bigint AS rows,
                 COALESCE(AVG(pg_column_size(safe_metadata)), 0)::bigint AS average_bytes,
                 COALESCE(MAX(pg_column_size(safe_metadata)), 0)::bigint AS maximum_bytes
            FROM server_events
           UNION ALL
          SELECT 'notification_rules.safe_config',
                 COUNT(*)::bigint,
                 COALESCE(AVG(pg_column_size(safe_config)), 0)::bigint,
                 COALESCE(MAX(pg_column_size(safe_config)), 0)::bigint
            FROM notification_rules
           UNION ALL
          SELECT 'notification_jobs.payload',
                 COUNT(*)::bigint,
                 COALESCE(AVG(pg_column_size(payload)), 0)::bigint,
                 COALESCE(MAX(pg_column_size(payload)), 0)::bigint
            FROM notification_jobs
           UNION ALL
          SELECT 'audit_logs.safe_metadata',
                 COUNT(*)::bigint,
                 COALESCE(AVG(pg_column_size(safe_metadata)), 0)::bigint,
                 COALESCE(MAX(pg_column_size(safe_metadata)), 0)::bigint
            FROM audit_logs
           UNION ALL
          SELECT 'discord_bot_control_revisions.safe_snapshot',
                 COUNT(*)::bigint,
                 COALESCE(AVG(pg_column_size(safe_snapshot)), 0)::bigint,
                 COALESCE(MAX(pg_column_size(safe_snapshot)), 0)::bigint
            FROM discord_bot_control_revisions`
  }),
  Object.freeze({
    name: "foreign_keys",
    sql: `SELECT ns.nspname AS schema_name,
                 child.relname AS table_name,
                 constraint_record.conname AS constraint_name,
                 parent.relname AS referenced_table,
                 pg_get_constraintdef(constraint_record.oid, true) AS definition
            FROM pg_constraint constraint_record
            JOIN pg_class child ON child.oid = constraint_record.conrelid
            JOIN pg_class parent ON parent.oid = constraint_record.confrelid
            JOIN pg_namespace ns ON ns.oid = child.relnamespace
           WHERE constraint_record.contype = 'f'
             AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
           ORDER BY schema_name, table_name, constraint_name`
  }),
  Object.freeze({
    name: "retention_candidates",
    sql: `SELECT 'agent_request_nonces' AS table_name,
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '1 day')::bigint AS expired_rows
            FROM agent_request_nonces
           UNION ALL
          SELECT 'discord_oauth_sessions',
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '7 days')::bigint
            FROM discord_oauth_sessions
           UNION ALL
          SELECT 'discord_management_oauth_sessions',
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '7 days')::bigint
            FROM discord_management_oauth_sessions
           UNION ALL
          SELECT 'yoro_oauth_sessions',
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '7 days')::bigint
            FROM yoro_oauth_sessions
           UNION ALL
          SELECT 'discord_setup_sessions',
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '30 days')::bigint
            FROM discord_setup_sessions
           UNION ALL
          SELECT 'agent_bootstrap_sessions',
                 COUNT(*) FILTER (WHERE expires_at < NOW() - INTERVAL '30 days')::bigint
            FROM agent_bootstrap_sessions`
  }),
  Object.freeze({
    name: "tenant_integrity",
    sql: `SELECT 'organization_members' AS relation_name,
                 COUNT(*)::bigint AS invalid_rows
            FROM organization_members member_record
            LEFT JOIN organizations organization_record
              ON organization_record.id = member_record.organization_id
            LEFT JOIN users user_record
              ON user_record.id = member_record.user_id
           WHERE organization_record.id IS NULL OR user_record.id IS NULL
           UNION ALL
          SELECT 'discord_installations', COUNT(*)::bigint
            FROM discord_installations installation
            LEFT JOIN discord_guilds guild_record
              ON guild_record.organization_id = installation.organization_id
             AND guild_record.id = installation.discord_guild_id
           WHERE guild_record.id IS NULL
           UNION ALL
          SELECT 'server_connections', COUNT(*)::bigint
            FROM server_connections connection_record
            LEFT JOIN game_servers server_record
              ON server_record.organization_id = connection_record.organization_id
             AND server_record.id = connection_record.game_server_id
           WHERE server_record.id IS NULL
           UNION ALL
          SELECT 'agent_installations', COUNT(*)::bigint
            FROM agent_installations installation
            LEFT JOIN game_servers server_record
              ON server_record.organization_id = installation.organization_id
             AND server_record.id = installation.game_server_id
           WHERE server_record.id IS NULL
           UNION ALL
          SELECT 'server_current_status', COUNT(*)::bigint
            FROM server_current_status status_record
            LEFT JOIN game_servers server_record
              ON server_record.organization_id = status_record.organization_id
             AND server_record.id = status_record.game_server_id
           WHERE server_record.id IS NULL
           UNION ALL
          SELECT 'server_status_history', COUNT(*)::bigint
            FROM server_status_history status_record
            LEFT JOIN game_servers server_record
              ON server_record.organization_id = status_record.organization_id
             AND server_record.id = status_record.game_server_id
           WHERE server_record.id IS NULL
           UNION ALL
          SELECT 'server_events', COUNT(*)::bigint
            FROM server_events event_record
            LEFT JOIN game_servers server_record
              ON server_record.organization_id = event_record.organization_id
             AND server_record.id = event_record.game_server_id
           WHERE server_record.id IS NULL
           UNION ALL
          SELECT 'discord_bot_control_configs', COUNT(*)::bigint
            FROM discord_bot_control_configs config_record
            LEFT JOIN discord_installations installation
              ON installation.organization_id = config_record.organization_id
             AND installation.discord_guild_id = config_record.discord_guild_id
             AND installation.application_id = config_record.application_id
           WHERE installation.discord_guild_id IS NULL`
  }),
  Object.freeze({
    name: "duplicate_candidates",
    sql: `SELECT 'game_servers.organization_id' AS constraint_name,
                 COUNT(*)::bigint AS duplicate_groups
            FROM (
              SELECT organization_id
                FROM game_servers
               GROUP BY organization_id
              HAVING COUNT(*) > 1
            ) duplicate_record
           UNION ALL
          SELECT 'discord_installations.guild_application', COUNT(*)::bigint
            FROM (
              SELECT discord_guild_id, application_id
                FROM discord_installations
               GROUP BY discord_guild_id, application_id
              HAVING COUNT(*) > 1
            ) duplicate_record
           UNION ALL
          SELECT 'external_identities.active_provider_subject', COUNT(*)::bigint
            FROM (
              SELECT provider, provider_subject
                FROM external_identities
               WHERE revoked_at IS NULL
               GROUP BY provider, provider_subject
              HAVING COUNT(*) > 1
            ) duplicate_record
           UNION ALL
          SELECT 'server_status_history.agent_observed_at', COUNT(*)::bigint
            FROM (
              SELECT agent_installation_id, observed_at
                FROM server_status_history
               WHERE agent_installation_id IS NOT NULL
               GROUP BY agent_installation_id, observed_at
              HAVING COUNT(*) > 1
            ) duplicate_record`
  })
]);

type QueryClient = Pick<PoolClient, "query">;

export type DatabaseAuditReport = Readonly<{
  generatedAt: string;
  transaction: "read_only";
  sections: Readonly<Record<string, readonly QueryResultRow[]>>;
}>;

export async function collectDatabaseAudit(
  source: Pick<Pool, "connect">
): Promise<DatabaseAuditReport> {
  const client = await source.connect();
  const sections: Record<string, QueryResultRow[]> = {};
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    for (const query of DATABASE_AUDIT_QUERIES) {
      const result = await (client as QueryClient).query(query.sql);
      sections[query.name] = result.rows;
    }
    await client.query("ROLLBACK");
    return Object.freeze({
      generatedAt: new Date().toISOString(),
      transaction: "read_only",
      sections: Object.freeze(sections)
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
