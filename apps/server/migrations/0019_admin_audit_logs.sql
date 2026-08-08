CREATE INDEX audit_logs_admin_recent_idx
  ON audit_logs (created_at DESC, id DESC);

CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  actor_reference_hash BYTEA NOT NULL
    CHECK (octet_length(actor_reference_hash) = 32),
  actor_method TEXT NOT NULL CHECK (actor_method IN ('session', 'token')),
  action TEXT NOT NULL CHECK (
    action IN (
      'streamer.riot_id_request.resolved',
      'streamer.dashboard_access.updated'
    )
  ),
  target_type TEXT NOT NULL CHECK (target_type = 'streamer_riot_id_request'),
  target_reference_hash BYTEA NOT NULL
    CHECK (octet_length(target_reference_hash) = 32),
  outcome TEXT NOT NULL DEFAULT 'started'
    CHECK (outcome IN ('started', 'succeeded', 'failed')),
  safe_metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (
      jsonb_typeof(safe_metadata) = 'object'
      AND octet_length(safe_metadata::TEXT) <= 1024
      AND (
        (
          action = 'streamer.riot_id_request.resolved'
          AND safe_metadata ? 'decision'
          AND safe_metadata ? 'noteProvided'
          AND safe_metadata - 'decision' - 'noteProvided' = '{}'::JSONB
          AND jsonb_typeof(safe_metadata -> 'decision') = 'string'
          AND safe_metadata ->> 'decision' IN ('approved', 'rejected')
          AND jsonb_typeof(safe_metadata -> 'noteProvided') = 'boolean'
        )
        OR (
          action = 'streamer.dashboard_access.updated'
          AND safe_metadata ? 'dashboardEnabled'
          AND safe_metadata ? 'noteProvided'
          AND safe_metadata - 'dashboardEnabled' - 'noteProvided' = '{}'::JSONB
          AND jsonb_typeof(safe_metadata -> 'dashboardEnabled') = 'boolean'
          AND jsonb_typeof(safe_metadata -> 'noteProvided') = 'boolean'
        )
      )
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CHECK (
    (outcome = 'started' AND completed_at IS NULL)
    OR (
      outcome IN ('succeeded', 'failed')
      AND completed_at IS NOT NULL
      AND completed_at >= created_at
    )
  )
);

CREATE INDEX admin_audit_logs_recent_idx
  ON admin_audit_logs (created_at DESC, id DESC);

CREATE INDEX admin_audit_logs_started_idx
  ON admin_audit_logs (created_at ASC, id ASC)
  WHERE outcome = 'started';

CREATE FUNCTION enforce_admin_audit_logs_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.outcome = 'started' AND NEW.completed_at IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.outcome = 'started'
      AND NEW.outcome IN ('succeeded', 'failed')
      AND NEW.completed_at IS NOT NULL
      AND NEW.completed_at >= OLD.created_at
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.actor_reference_hash IS NOT DISTINCT FROM OLD.actor_reference_hash
      AND NEW.actor_method IS NOT DISTINCT FROM OLD.actor_method
      AND NEW.action IS NOT DISTINCT FROM OLD.action
      AND NEW.target_type IS NOT DISTINCT FROM OLD.target_type
      AND NEW.target_reference_hash IS NOT DISTINCT FROM OLD.target_reference_hash
      AND NEW.safe_metadata IS NOT DISTINCT FROM OLD.safe_metadata
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'admin_audit_logs lifecycle violation',
    CONSTRAINT = 'admin_audit_logs_finalize_only';
END;
$$;

CREATE TRIGGER admin_audit_logs_finalize_only
BEFORE INSERT OR UPDATE OR DELETE ON admin_audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_admin_audit_logs_lifecycle();

CREATE TRIGGER admin_audit_logs_no_truncate
BEFORE TRUNCATE ON admin_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION enforce_admin_audit_logs_lifecycle();

ALTER TABLE admin_audit_logs
  ENABLE ALWAYS TRIGGER admin_audit_logs_finalize_only;

ALTER TABLE admin_audit_logs
  ENABLE ALWAYS TRIGGER admin_audit_logs_no_truncate;
