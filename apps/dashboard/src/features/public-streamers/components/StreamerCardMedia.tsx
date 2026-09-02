/* 카드 우측 비주얼 슬롯 — 근거: docs/mockups/streamer-board-redesign-v1.html §v2.
 *
 * LoL 글은 티어 엠블럼을, 다른 게임 글은 게임 마크를 같은 액자(6rem, 285:380)에
 * 넣습니다. 두 경우가 같은 자리·같은 크기를 써야 목록 그리드가 흔들리지 않습니다.
 * 박스아트 실물(GameBoxartService)은 후속 작업이라 여기서는 폴백 마크만 그립니다 —
 * 실제 boxArtUrl 이 null 일 때 나오는 화면이 곧 이 그림입니다.
 */

import { formatStreamersText, type StreamersText } from "../i18n/streamers-i18n";
import type { StreamerGame, StreamerPost } from "../types/streamer-post";

export const GAME_LABEL_KEYS: Record<StreamerGame, keyof StreamersText> = {
  lol: "scopeLol",
  valorant: "scopeValorant",
  palworld: "scopePalworld",
  minecraft: "scopeMinecraft",
};

const artProps = {
  "aria-hidden": true,
  className: "streamers-media__art",
  fill: "none",
  stroke: "currentColor",
  strokeLinejoin: "round" as const,
  viewBox: "0 0 48 48",
} as const;

/* 게임 마크는 선화 한 겹 + 옅은 면 하나입니다(그라디언트·그림자 없음). */
function GameArt({ game }: { game: StreamerGame }) {
  if (game === "valorant") {
    return (
      <svg {...artProps} strokeWidth="1.6">
        <path className="fill" d="M6 8 L24 40 L42 8 L33 8 L24 25 L15 8 Z" />
      </svg>
    );
  }
  if (game === "palworld") {
    return (
      <svg {...artProps} strokeWidth="1.6">
        <circle className="fill" cx="24" cy="24" r="17" />
        <path d="M7 24 H41" />
        <circle cx="24" cy="24" r="5.5" />
      </svg>
    );
  }
  if (game === "minecraft") {
    return (
      <svg {...artProps} strokeWidth="1.5">
        <path className="fill" d="M24 7 L41 16 L24 25 L7 16 Z" />
        <path d="M7 16 V33 L24 42 V25 Z" />
        <path d="M41 16 V33 L24 42 V25 Z" />
      </svg>
    );
  }
  return (
    <svg {...artProps} strokeWidth="1.6">
      <path className="fill" d="M24 5 L40 11 V24 C40 33 33 39.5 24 43 C15 39.5 8 33 8 24 V11 Z" />
      <path d="M17 21 L24 29 L31 21" strokeLinecap="round" />
    </svg>
  );
}

/* 티어 메달 — 색은 [data-tier] 가 정합니다(23-profile-hero.css 의 --tier-color). */
function TierEmblem() {
  return (
    <svg aria-hidden="true" className="streamers-media__emblem" fill="none" stroke="currentColor" strokeLinejoin="round" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" strokeWidth="1" />
      <circle cx="24" cy="24" r="15.5" strokeWidth=".6" />
      <path d="M24 11.5 L33 24 L24 36.5 L15 24 Z" strokeWidth="1.4" />
      <path d="M15 24 H33" strokeWidth=".7" />
    </svg>
  );
}

export function StreamerCardMedia({ post, text }: { post: StreamerPost; text: StreamersText }) {
  const lol = post.lolProfile;
  if (lol) {
    return (
      <div className="streamers-media" data-tier={lol.tierCode.toLowerCase()}>
        <div className="streamers-media__frame"><TierEmblem /></div>
        <div className="streamers-media__cap">
          {/* 티어 이름 글자는 티어색이 아니라 본문색입니다 — 밝은 티어색은 라이트에서 무너집니다. */}
          <span className="streamers-media__tier">{lol.tier}</span>
          <span className="streamers-media__lp">{formatStreamersText(text.rankLp, { lp: lol.leaguePoints })}</span>
        </div>
      </div>
    );
  }

  /* 주 게임은 첫 태그입니다 — 목록 칩과 같은 순서라 카드끼리 어긋나지 않습니다. */
  const game = post.games[0];
  if (!game) return null;
  return (
    <div className="streamers-media" data-game={game}>
      <div className="streamers-media__frame"><GameArt game={game} /></div>
      <div className="streamers-media__cap">
        <span className="streamers-media__game">{text[GAME_LABEL_KEYS[game]]}</span>
        {/* LoL 인데 전적이 없으면(Riot ID 미등록·언랭·조회 실패) 빈 액자 대신 이유를 적습니다. */}
        {game === "lol" ? <span className="streamers-media__hint">{text.noRankData}</span> : null}
      </div>
    </div>
  );
}
