-- 관리자 권한 부여·회수 감사 action 추가.
-- packages/shared/src/admin-audit.ts 의 GLOBAL_ADMIN_AUDIT_ACTIONS 와 1:1 로 맞춥니다.
--
-- 0019 는 action 과 safe_metadata 를 컬럼 인라인 CHECK 로 선언했고 Postgres 는
-- 그런 제약에 <table>_<column>_check 이름을 붙입니다. 이름이 다르면(수동 변경 등)
-- DROP 이 실패해 migration 이 중단됩니다 — 옛 제약이 남아 새 action INSERT 가
-- 조용히 거부되는 것보다 안전합니다.
--
-- 기존 두 action 의 metadata 규칙은 그대로 옮기고, 새 action 은 granted(boolean)
-- 하나만 허용합니다. 부여·회수는 full_admin 만 호출할 수 있어 actor 계정 id 가
-- 실리지 않습니다.

ALTER TABLE admin_audit_logs
  DROP CONSTRAINT admin_audit_logs_action_check;

ALTER TABLE admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_action_check CHECK (
    action IN (
      'streamer.riot_id_request.resolved',
      'streamer.dashboard_access.updated',
      'streamer.admin_access.updated'
    )
  );

ALTER TABLE admin_audit_logs
  DROP CONSTRAINT admin_audit_logs_safe_metadata_check;

ALTER TABLE admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_safe_metadata_check CHECK (
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
      OR (
        action = 'streamer.admin_access.updated'
        AND safe_metadata ? 'granted'
        AND safe_metadata - 'granted' = '{}'::JSONB
        AND jsonb_typeof(safe_metadata -> 'granted') = 'boolean'
      )
    )
  );
