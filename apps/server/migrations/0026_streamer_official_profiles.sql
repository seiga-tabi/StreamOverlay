-- 기존 추천 게시글을 유지하면서 관리자 등록 공식 프로필 메타데이터를 확장합니다.
ALTER TABLE streamer_posts
  ADD COLUMN registered_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN official_handle TEXT,
  ADD COLUMN seo_slug TEXT,
  ADD COLUMN live_status_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE streamer_posts
  ADD CONSTRAINT streamer_posts_official_profile_check CHECK (
    (
      registered_by_admin
      AND official_handle IS NOT NULL
      AND seo_slug IS NOT NULL
      AND char_length(official_handle) BETWEEN 1 AND 80
      AND char_length(seo_slug) BETWEEN 1 AND 80
    )
    OR (
      NOT registered_by_admin
      AND official_handle IS NULL
      AND seo_slug IS NULL
      AND NOT live_status_supported
    )
  ),
  -- 1차 릴리스는 Twitch만 실시간 상태를 사용합니다. 치지직·YouTube는 정적 프로필입니다.
  ADD CONSTRAINT streamer_posts_live_status_platform_check CHECK (
    NOT live_status_supported OR platform = 'twitch'
  );

-- 비활성화 뒤에도 URL을 예약해 같은 공식 URL이 다른 프로필에 재사용되지 않게 합니다.
CREATE UNIQUE INDEX streamer_posts_official_slug_unique_idx
  ON streamer_posts (platform, seo_slug)
  WHERE registered_by_admin;

CREATE INDEX streamer_posts_active_official_idx
  ON streamer_posts (registered_by_admin, active, updated_at DESC);
