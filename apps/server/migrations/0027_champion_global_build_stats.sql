-- 챔피언 글로벌 빌드 통계 — 매치 1건당 참가자(챔피언) 1명의 빌드 스냅샷.
-- 사용자가 프로필을 조회할 때 이미 가져오는 매치 상세 응답의 부산물로 채워진다
-- (능동 수집 없음). (match_id, puuid) 유니크로 같은 매치가 여러 유저 조회로
-- 재관측돼도 중복 집계되지 않는다.
CREATE TABLE lol_champion_match_builds (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,
  puuid TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  team_position TEXT NOT NULL,
  queue_id INTEGER NOT NULL,
  patch TEXT NOT NULL,
  win BOOLEAN NOT NULL,
  observed_tier TEXT,
  keystone_perk_id INTEGER,
  primary_style_id INTEGER,
  sub_style_id INTEGER,
  summoner_spell_1 INTEGER,
  summoner_spell_2 INTEGER,
  item_0 INTEGER,
  item_1 INTEGER,
  item_2 INTEGER,
  item_3 INTEGER,
  item_4 INTEGER,
  item_5 INTEGER,
  match_created_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, puuid)
);

CREATE INDEX lol_champion_match_builds_lookup_idx
  ON lol_champion_match_builds (champion_id, team_position, queue_id, patch);

CREATE INDEX lol_champion_match_builds_created_idx
  ON lol_champion_match_builds (match_created_at);
