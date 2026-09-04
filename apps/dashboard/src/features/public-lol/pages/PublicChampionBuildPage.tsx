import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { type LolChampionBuildStatsPosition, type LolChampionSummary } from "@streamops/shared";
import { NorigaeMark, TailUnderline } from "../../public-home/components/HomeMarks";
import { fetchChampionBuildStats, getPublicLolChampions } from "../api/lol";
import {
  GlobalBuildStatsBody,
  GlobalBuildStatsPositionTabs,
  globalBuildStatsPillText,
  type GlobalBuildStatsHelpers,
  type GlobalBuildStatsState
} from "../components/GlobalBuildStatsPanel";
import { t } from "../i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";
import { PUBLIC_CHAMPIONS_PATH, setPublicPath } from "../utils/routes";

/* 챔피언 단독 글로벌 빌드 통계(/lol/champions/<championId>).
 *
 * 전적 검색 흐름의 GlobalBuildStatsPanel 과 데이터 원천(/api/lol/champion-build-stats)은
 * 같지만 진입 경로가 다릅니다 — 저쪽은 검색된 프로필의 숙련도·최근 챔피언 중에서
 * 고르는 패널이고, 이 화면에는 프로필이 없어 챔피언 하나만 놓고 봅니다.
 * 룬·아이템·스펠 표시와 포지션 탭은 그 패널에서 뽑아낸 공용 조각을 그대로 씁니다. */

/* 기본 포지션 — 프로필이 없어 "이 사람이 가장 많이 한 라인"을 알 수 없고, 챔피언별
   대표 라인 데이터도 없습니다. 그래서 고정값으로 열고 탭으로 옮기게 둡니다.
   포지션 탭에는 포지션 비중(%)이 함께 나오므로 주 라인이 어디인지 바로 보입니다. */
const DEFAULT_CHAMPION_BUILD_POSITION: LolChampionBuildStatsPosition = "MIDDLE";

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PublicChampionBuildPage({ championId, helpers }: {
  championId: number;
  helpers: GlobalBuildStatsHelpers;
}) {
  const [champion, setChampion] = useState<LolChampionSummary>();
  /* 챔피언 이름·아이콘은 목록 API 에서 옵니다(서버가 1시간 캐시). 목록 요청 자체가
     실패(네트워크 오류·일시 장애)했을 때는 "주소가 잘못됨"과 구분해야 합니다 —
     실패면 이름 없이 "Champion 266" 으로 통계를 그대로 열고, 목록이 정상 도착했는데
     그 안에 없을 때만 notFound 로 봅니다(Fable5.1 리뷰 High 수정 — 이전에는 실패도
     championResolved=true 로 접혀 notFound 로 오판했습니다). */
  const [championListStatus, setChampionListStatus] = useState<"pending" | "ready" | "failed">("pending");
  const [position, setPosition] = useState<LolChampionBuildStatsPosition>(DEFAULT_CHAMPION_BUILD_POSITION);
  const [state, setState] = useState<GlobalBuildStatsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setChampion(undefined);
    setChampionListStatus("pending");
    void getPublicLolChampions(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setChampion(response.champions.find((entry) => entry.championId === championId));
        setChampionListStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setChampionListStatus("failed");
      });
    return () => controller.abort();
  }, [championId]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchChampionBuildStats(championId, position, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error && error.message ? error.message : t().globalBuildStatsErrorTitle });
      });
    return () => controller.abort();
  }, [championId, position, attempt]);

  const ready = state.status === "ready" ? state.data : undefined;
  const positionGames = useMemo(
    () => (ready ? new Map(ready.positions.map((entry) => [entry.teamPosition, entry.games])) : undefined),
    [ready]
  );

  /* 목록이 아직 안 왔을 때는 이름을 지어내지 않고 Data Dragon 의 숫자 id 를 그대로 씁니다. */
  const name = champion ? helpers.championName(champion) : `Champion ${championId}`;
  /* 목록을 받아 왔는데 그 안에 없는 championId 면 주소가 잘못된 것입니다.
     통계만 비어 있는 화면(표본 부족과 구분이 안 됨) 대신 그 사실을 말합니다. */
  const notFound = championListStatus === "ready" && !champion;

  const backLink = (
    <a
      className="public-champion-build-back"
      href={localizedPublicUrlForCurrentLocale(PUBLIC_CHAMPIONS_PATH)}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        setPublicPath(PUBLIC_CHAMPIONS_PATH);
      }}
    >
      {t().championDetailBack}
    </a>
  );

  if (notFound) {
    return (
      <section aria-labelledby="public-champion-build-title" className="public-champion-build-page">
        {backLink}
        <div className="public-champ-empty" role="alert">
          <strong id="public-champion-build-title">{t().championDetailNotFoundTitle}</strong>
          <span>{t().championDetailNotFoundDescription}</span>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="public-champion-build-title" className="public-champion-build-page">
      {backLink}
      {/* 머리는 목록과 같은 3겹이되, 노리개 자리에 챔피언 아이콘이 있으면 그 얼굴을 씁니다. */}
      <header className="yoro-champions-head">
        {champion?.iconUrl ? (
          <span aria-hidden="true" className="public-champion-build-face">
            <img alt="" decoding="async" height="48" src={champion.iconUrl} width="48" />
          </span>
        ) : (
          <NorigaeMark className="yoro-champions-head-norigae" height={34} width={16} />
        )}
        <div className="yoro-champions-head-copy">
          <p className="yoro-champions-head-eyebrow">{t().championListEyebrow}</p>
          <h1 className="yoro-champions-head-title" id="public-champion-build-title">
            <span className="yoro-champions-head-title-word">
              {name}
              <TailUnderline className="yoro-champions-head-tail" height={9} width={92} />
            </span>
          </h1>
          <p className="yoro-champions-head-desc">{t().globalBuildStatsFoot}</p>
        </div>
      </header>

      <section className="public-champ-panel public-gbs-panel" id="public-global-build-stats">
        <div className="public-champ-head">
          <h2>{t().globalBuildStatsTitle}</h2>
          <span className="public-champ-pill">{globalBuildStatsPillText(ready)}</span>
        </div>
        <div className="public-gbs-controls">
          <GlobalBuildStatsPositionTabs
            helpers={helpers}
            onPositionChange={setPosition}
            position={position}
            positionGames={positionGames}
          />
        </div>
        <div id="public-gbs-body" role="tabpanel">
          <GlobalBuildStatsBody
            championLabel={name}
            helpers={helpers}
            onRetry={() => setAttempt((value) => value + 1)}
            state={state}
          />
        </div>
      </section>
    </section>
  );
}
