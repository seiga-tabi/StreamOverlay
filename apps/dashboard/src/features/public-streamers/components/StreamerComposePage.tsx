import { useState } from "react";
import { createStreamerPost } from "../api/streamers";
import type { StreamersText } from "../i18n/streamers-i18n";
import { STREAMER_GAMES, STREAMER_PLATFORMS, type StreamerGame, type StreamerPlatform } from "../types/streamer-post";
import { setStreamersUrl, streamersPathForPage } from "../utils/routes";

const GAME_LABEL_KEYS: Record<StreamerGame, keyof StreamersText> = {
  lol: "scopeLol",
  valorant: "scopeValorant",
  palworld: "scopePalworld",
  minecraft: "scopeMinecraft",
};

const PLATFORM_LABEL_KEYS: Record<StreamerPlatform, keyof StreamersText> = {
  twitch: "filterTwitch",
  chzzk: "filterChzzk",
  youtube: "filterYoutube",
};

/* 구조화된 등록 폼 — 채널 주소와 주력 게임이 목록 필터의 원본입니다.
 * 리그 오브 레전드를 고르면 Riot ID 칸이 열립니다(전적 프로필이 붙는 조건). */
export function StreamerComposePage({
  canPost,
  onLogin,
  text,
}: {
  canPost: boolean;
  onLogin: () => void;
  text: StreamersText;
}) {
  const [streamerName, setStreamerName] = useState("");
  const [platform, setPlatform] = useState<StreamerPlatform>("twitch");
  const [channelUrl, setChannelUrl] = useState("");
  const [games, setGames] = useState<readonly StreamerGame[]>([]);
  const [riotId, setRiotId] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");

  if (!canPost) {
    return (
      <div className="streamers-state" role="status">
        <strong>{text.composeLoginRequired}</strong>
        <button onClick={onLogin} type="button">{text.loginWithTwitch}</button>
      </div>
    );
  }

  const toggleGame = (game: StreamerGame) => {
    setGames((current) => current.includes(game) ? current.filter((item) => item !== game) : [...current, game]);
  };

  const ready = Boolean(streamerName.trim() && channelUrl.trim() && reason.trim() && games.length > 0);

  const submit = async () => {
    const result = await createStreamerPost({
      streamerName: streamerName.trim(),
      platform,
      channelUrl: channelUrl.trim(),
      games,
      ...(games.includes("lol") && riotId.trim() ? { riotId: riotId.trim() } : {}),
      reason: reason.trim(),
    });
    if (result.ok) {
      setStreamersUrl(streamersPathForPage("list"));
      return;
    }
    setNotice(result.reason === "login_required" ? text.composeLoginRequired : text.composeUnavailable);
  };

  return (
    <div className="streamers-page streamers-compose">
      <header className="streamers-page__head">
        <div>
          <h1>{text.compose}</h1>
          <p>{text.seoDescriptionCompose}</p>
        </div>
      </header>

      <form className="streamers-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="streamers-form__row">
          <label>
            <span>{text.composeName}</span>
            <input
              onChange={(event) => setStreamerName(event.target.value)}
              placeholder={text.composeNamePlaceholder}
              type="text"
              value={streamerName}
            />
          </label>
          <label>
            <span>{text.composePlatform}</span>
            <select onChange={(event) => setPlatform(event.target.value as StreamerPlatform)} value={platform}>
              {STREAMER_PLATFORMS.map((item) => (
                <option key={item} value={item}>{text[PLATFORM_LABEL_KEYS[item]]}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>{text.composeChannel}</span>
          <input onChange={(event) => setChannelUrl(event.target.value)} placeholder="https://" type="url" value={channelUrl} />
          <small>{text.composeChannelHint}</small>
        </label>

        <fieldset className="streamers-form__games">
          <legend>{text.composeGames}</legend>
          {STREAMER_GAMES.map((game) => (
            <label className="streamers-chip streamers-chip--input" data-game={game} key={game}>
              {/* 셸 전역 터치 규칙이 모든 input 에 44px 최소 높이를 !important 로 걸어
                  네이티브 상자가 칩을 무너뜨립니다. 입력은 접근성용으로 숨기고
                  표시는 직접 그립니다 — 손가락 목표는 칩 라벨 전체입니다. */}
              <input
                checked={games.includes(game)}
                className="yoro-u-sr-only"
                onChange={() => toggleGame(game)}
                type="checkbox"
              />
              <span aria-hidden="true" className="streamers-chip__check" />
              {text[GAME_LABEL_KEYS[game]]}
            </label>
          ))}
        </fieldset>

        {/* Riot ID 는 리그 오브 레전드를 고른 글에만 묻습니다. */}
        {games.includes("lol") ? (
          <label>
            <span>{text.composeRiotId}</span>
            <input onChange={(event) => setRiotId(event.target.value)} placeholder="게임이름#태그" type="text" value={riotId} />
            <small>{text.composeRiotIdHint}</small>
          </label>
        ) : null}

        <label>
          <span>{text.composeReason}</span>
          <textarea maxLength={600} onChange={(event) => setReason(event.target.value)} rows={5} value={reason} />
          <small>{`${text.composeReasonHint} (${reason.length} / 600)`}</small>
        </label>

        {notice ? <p className="streamers-state" role="alert">{notice}</p> : null}

        <div className="streamers-form__actions">
          <button onClick={() => setStreamersUrl(streamersPathForPage("list"))} type="button">{text.cancel}</button>
          <button data-primary="true" disabled={!ready} type="submit">{text.composeSubmit}</button>
        </div>
      </form>
    </div>
  );
}
