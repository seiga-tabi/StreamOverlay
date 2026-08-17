-- 반응속도 테스트 기록(계정당 1행) — 목업 docs/mockups/reaction-test.html v5 §④-2~④-5.
--
-- 계정당 1행만 두고 "더 빠를 때만" average_ms 를 갱신합니다. 기록 히스토리를
-- 쌓지 않는 이유는 이 기능이 개인 베스트 경쟁이고, 시도 로그까지 보관하면
-- 삭제 요청 시 지워야 할 개인정보 범위만 넓어지기 때문입니다.
--
-- user_id 는 yoro 계정(users.id)입니다. 계정이 지워지면 기록도 함께 사라져야
-- 하므로 CASCADE 입니다 — 남겨 두면 주인 없는 공개 기록이 리더보드에 남습니다.
CREATE TABLE reaction_records (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  average_ms INTEGER NOT NULL,
  -- 5회 측정치. 이상치 검증·부정 신고 대응용으로만 보관하고 응답으로는 내보내지 않습니다.
  samples JSONB NOT NULL,
  identity TEXT NOT NULL,
  -- 익명 표기용 고정 번호. 공개 응답에 "#4821" 형태로만 나가고 계정과 역추적되지
  -- 않아야 하므로 계정 id 와 무관한 난수입니다.
  anonymous_no INTEGER NOT NULL,
  -- 공유 링크 id. 불투명해야 하므로 계정 정보에서 파생하지 않습니다.
  share_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reaction_records_identity_check
    CHECK (identity IN ('public', 'anonymous')),
  -- 서버 검증과 같은 경계입니다(sanity bound). DB 에서도 막아 두면 잘못된 경로로
  -- 들어온 값이 리더보드를 오염시키지 못합니다.
  CONSTRAINT reaction_records_average_ms_check
    CHECK (average_ms BETWEEN 120 AND 2000),
  CONSTRAINT reaction_records_anonymous_no_check
    CHECK (anonymous_no BETWEEN 1000 AND 9999),
  CONSTRAINT reaction_records_share_id_check
    CHECK (share_id ~ '^[A-Za-z0-9_-]{8,64}$')
);

CREATE UNIQUE INDEX reaction_records_share_id_key
  ON reaction_records (share_id);

-- 리더베이스 정렬: 빠른 순, 동률은 먼저 등록한 쪽이 위입니다.
CREATE INDEX reaction_records_leaderboard_idx
  ON reaction_records (average_ms ASC, created_at ASC);
