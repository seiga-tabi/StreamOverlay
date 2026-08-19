import { useEffect, useMemo, useState } from "react";
import { createStreamerPost, lookupStreamerChannel, type StreamerChannelOwner } from "../api/streamers";
import { formatStreamersText, type StreamersText } from "../i18n/streamers-i18n";
import {
  STREAMER_GAMES,
  STREAMER_PLATFORMS,
  streamerChannelKey,
  type StreamerGame,
  type StreamerPlatform,
} from "../types/streamer-post";
import { setStreamersUrl, streamerPostPath, streamersHref, streamersPathForPage } from "../utils/routes";

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
 * 리그 오브 레전드를 고르면 Riot ID 칸이 열립니다(전적 프로필이 붙는 조건).
 *
 * 한 채널은 글 하나입니다. 같은 채널을 여러 사람이 각자 올리면 목록이 같은
 * 이름으로 갈라지고 추천 수도 흩어지므로, 이미 있는 채널은 등록 대신 그 글로
 * 보냅니다. 판정은 서버(409)가 하고 여기서는 미리 알려 주기만 합니다. */
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
  const [notice, setNotice] = useState("");
  const [duplicate, setDuplicate] = useState<StreamerChannelOwner | null | undefined>(null);

  const channelKey = useMemo(() => streamerChannelKey(channelUrl), [channelUrl]);

  /* 타이핑 도중 매 글자를 조회하지 않습니다 — 멈춘 뒤에 한 번 묻습니다. */
  useEffect(() => {
    setDuplicate(null);
    if (!channelKey) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void lookupStreamerChannel(channelKey, controller.signal)
        .then((owner) => { if (!controller.signal.aborted && owner) setDuplicate(owner); })
        /* 조회가 실패해도 막지 않습니다 — 등록 시 서버가 다시 봅니다. */
        .catch(() => undefined);
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [channelKey]);

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

  /* duplicate: null 없음 · undefined 중복이지만 글을 모름 · 값 중복 + 글.
     "모름" 도 중복이므로 등록을 막습니다. */
  const ready = Boolean(streamerName.trim() && channelUrl.trim() && games.length > 0) && duplicate === null;

  const submit = async () => {
    const result = await createStreamerPost({
      streamerName: streamerName.trim(),
      platform,
      channelUrl: channelUrl.trim(),
      games,
      ...(games.includes("lol") && riotId.trim() ? { riotId: riotId.trim() } : {}),
    });
    if (result.ok) {
      setStreamersUrl(streamersPathForPage("list"));
      return;
    }
    if (result.reason === "duplicate_channel") {
      /* 서버가 최종 판정입니다 — 미리 조회가 못 잡은 중복도 여기서 걸립니다. */
      setDuplicate(result.existing ?? undefined);
      setNotice("");
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
          <input
            aria-describedby={duplicate ? "streamers-compose-duplicate" : undefined}
            aria-invalid={duplicate ? true : undefined}
            onChange={(event) => setChannelUrl(event.target.value)}
            placeholder="https://"
            type="url"
            value={channelUrl}
          />
          <small>{text.composeChannelHint}</small>
        </label>

        {duplicate !== null ? (
          <p className="streamers-state streamers-state--warn" id="streamers-compose-duplicate" role="alert">
            <strong>
              {duplicate?.streamerName
                ? formatStreamersText(text.composeDuplicateNamed, { name: duplicate.streamerName })
                : text.composeDuplicate}
            </strong>
            <a
              href={streamersHref(duplicate ? streamerPostPath(duplicate.postId) : streamersPathForPage("list"))}
              onClick={(event) => {
                event.preventDefault();
                setStreamersUrl(duplicate ? streamerPostPath(duplicate.postId) : streamersPathForPage("list"));
              }}
            >
              {duplicate ? text.composeDuplicateOpen : text.composeDuplicateList}
            </a>
          </p>
        ) : null}

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

        {notice ? <p className="streamers-state" role="alert">{notice}</p> : null}

        <div className="streamers-form__actions">
          <button onClick={() => setStreamersUrl(streamersPathForPage("list"))} type="button">{text.cancel}</button>
          <button data-primary="true" disabled={!ready} type="submit">{text.composeSubmit}</button>
        </div>
      </form>
    </div>
  );
}
