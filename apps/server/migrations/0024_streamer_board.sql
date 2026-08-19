-- 스트리머 추천 게시판 — 목업 docs/mockups/streamer-board, 계약 packages/shared/src/streamer-board.ts.
--
-- 작성자를 users(id) 가 아니라 Twitch 계정으로 잡는 이유:
-- 공개 화면의 로그인 상태는 두 가지입니다. YORO 계정 세션과 공개 Twitch 뷰어
-- 세션인데, 뒤쪽은 users 행이 없습니다. users(id) 를 FK 로 잡으면 LoL 화면에서
-- Twitch 로 로그인한 사람은 화면에서는 글쓰기가 열려 있는데 저장만 실패합니다.
-- 두 경로 모두 Twitch 사용자 id 를 주므로 그것을 신원으로 씁니다.
--
-- 표시 이름을 함께 저장하는 이유: 뷰어 세션 작성자는 external_identities 에
-- 행이 없어 JOIN 으로 최신 이름을 못 가져옵니다. 이름이 바뀌면 옛 값이 남지만,
-- 이름 없는 빈 칸을 내보내는 것보다 낫습니다.

CREATE TABLE streamer_posts (
  -- 경로에 들어가는 불투명 id. 계정 정보에서 파생하지 않습니다.
  id TEXT PRIMARY KEY,
  -- 채널 정규화 키("twitch:bamtol"). 한 채널은 글 하나이므로 여기가 유일합니다.
  -- 조회 후 삽입만으로는 동시 등록을 못 막으므로 제약으로 막습니다.
  channel_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  -- 사용자가 적은 주소가 아니라 채널 키에서 다시 만든 정본 주소입니다.
  channel_url TEXT NOT NULL,
  streamer_name TEXT NOT NULL,
  -- 게임 태그와 자유 태그. 목록 필터가 이 값으로 좁힙니다.
  games TEXT[] NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- 리그 오브 레전드 글에만 있습니다. 전적 프로필이 붙는 조건.
  riot_id TEXT,
  author_twitch_user_id TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  -- 추천 수 비정규화. 목록 정렬 기본값이라 매 조회에서 세지 않습니다.
  -- 실제 원본은 streamer_post_votes 이고 투표할 때 함께 갱신합니다.
  vote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT streamer_posts_id_check CHECK (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT streamer_posts_platform_check CHECK (platform IN ('twitch', 'chzzk', 'youtube')),
  -- 서버 검증과 같은 경계입니다. DB 에서도 막아 두면 다른 경로로 들어온 값이
  -- 목록을 오염시키지 못합니다.
  CONSTRAINT streamer_posts_channel_key_check CHECK (char_length(channel_key) BETWEEN 3 AND 120),
  CONSTRAINT streamer_posts_channel_url_check CHECK (channel_url ~ '^https://' AND char_length(channel_url) <= 300),
  CONSTRAINT streamer_posts_streamer_name_check CHECK (char_length(streamer_name) BETWEEN 1 AND 60),
  CONSTRAINT streamer_posts_riot_id_check CHECK (riot_id IS NULL OR char_length(riot_id) BETWEEN 1 AND 60),
  CONSTRAINT streamer_posts_games_check
    CHECK (array_length(games, 1) BETWEEN 1 AND 4 AND games <@ ARRAY['lol', 'valorant', 'palworld', 'minecraft']::TEXT[]),
  CONSTRAINT streamer_posts_tags_check CHECK (COALESCE(array_length(tags, 1), 0) <= 4),
  CONSTRAINT streamer_posts_counts_check CHECK (vote_count >= 0 AND comment_count >= 0)
);

-- 목록 기본 정렬(추천 많은 순, 동률은 최신 우선)과 최신순 정렬.
CREATE INDEX streamer_posts_votes_idx ON streamer_posts (vote_count DESC, created_at DESC);
CREATE INDEX streamer_posts_created_idx ON streamer_posts (created_at DESC);
-- 게임 범위 nav 가 매 요청 거는 필터입니다.
CREATE INDEX streamer_posts_games_idx ON streamer_posts USING GIN (games);

-- 추천은 계정당 1회입니다. 행의 존재가 곧 "이 사람이 눌렀다" 이므로 취소는 삭제입니다.
CREATE TABLE streamer_post_votes (
  post_id TEXT NOT NULL REFERENCES streamer_posts(id) ON DELETE CASCADE,
  voter_twitch_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, voter_twitch_user_id)
);

CREATE TABLE streamer_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES streamer_posts(id) ON DELETE CASCADE,
  -- 익명 댓글도 작성 계정은 남깁니다. 반복 신고·제재에 필요하고, 응답에서만 감춥니다.
  author_twitch_user_id TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  body TEXT NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT streamer_comments_id_check CHECK (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT streamer_comments_body_check CHECK (char_length(body) BETWEEN 1 AND 600),
  CONSTRAINT streamer_comments_report_count_check CHECK (report_count >= 0)
);

CREATE INDEX streamer_comments_post_idx ON streamer_comments (post_id, created_at);

-- 같은 댓글은 계정당 1회만 접수합니다. 중복 신고로 숫자를 부풀리지 못하게 제약으로 막습니다.
CREATE TABLE streamer_comment_reports (
  comment_id TEXT NOT NULL REFERENCES streamer_comments(id) ON DELETE CASCADE,
  reporter_twitch_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, reporter_twitch_user_id),
  CONSTRAINT streamer_comment_reports_reason_check
    CHECK (reason IN ('spam', 'abuse', 'off_topic', 'other'))
);
