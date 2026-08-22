import { useEffect, useState } from "react";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import type { HomeText } from "../i18n/home-i18n";
import { HOME_GAMES, type HomeGameKey } from "./HomeHeader";
import { TailUnderline } from "./HomeMarks";

/* 히어로 — 목업 「카테고리 선택」(HomeCategoryPicker / -Mobile).
 * 통합 검색 폼 대신 게임 3:4 포스터 격자: 홈에서 게임을 고르는 행위는 이동이라
 * 타일은 <a> 이고 선택 상태가 없습니다 — 표시는 hover/focus 의 테두리 진해짐과
 * 꼬리 밑줄뿐. 그림 위에는 스크림·오버레이를 얹지 않습니다(목업 규칙).
 * 검색은 각 게임 홈이 맡습니다(/lol 히어로의 검색 폼은 그대로). */

const BOXART_KEYS = new Set<HomeGameKey>(["lol", "palworld", "valorant", "minecraft"]);

/* 트위치 박스아트(안 B) — 성공한 게임만 타일 그림을 285×380 박스아트로 승격하고,
 * 실패·미응답·null 은 안 A(키아트·마크 타일) 그대로입니다. 홈의 핵심(카테고리
 * 이동)은 이 응답 없이도 완전히 동작하므로 실패는 조용히 생략합니다. */
function useHomeGameBoxart(): Partial<Record<HomeGameKey, string>> {
  const [boxart, setBoxart] = useState<Partial<Record<HomeGameKey, string>>>({});
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/public/game-boxart", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        if (!response.ok) return;
        const body = await response.json() as { games?: Array<{ key?: unknown; boxArtUrl?: unknown }> };
        const next: Partial<Record<HomeGameKey, string>> = {};
        for (const game of Array.isArray(body?.games) ? body.games : []) {
          if (typeof game?.key !== "string" || !BOXART_KEYS.has(game.key as HomeGameKey)) continue;
          if (typeof game.boxArtUrl !== "string" || !game.boxArtUrl.startsWith("https://")) continue;
          next[game.key as HomeGameKey] = game.boxArtUrl;
        }
        if (Object.keys(next).length > 0) setBoxart(next);
      } catch {
        /* 네트워크 실패·중단은 안 A 로 계속 — 아무 표시도 하지 않습니다. */
      }
    })();
    return () => controller.abort();
  }, []);
  return boxart;
}

export function HomeHero({ text }: { text: HomeText }) {
  const boxart = useHomeGameBoxart();
  return (
    <section className="yoro-home-hero yoro-home-hero--cats">
      <div className="yoro-home-hero-copy">
        <h1 className="yoro-home-headline">{text.heroTitle}</h1>
        <TailUnderline className="yoro-home-headline-tail" height={11} width={170} />
        <p className="yoro-home-hero-sub">{text.heroSub}</p>

        <ul aria-label={text.navGames} className="yoro-home-cats">
          {HOME_GAMES.map((game, index) => (
            <li key={game.key}>
              <a className="yoro-home-cat" href={localizedPublicUrlForCurrentLocale(game.path)}>
                {/* 3:4 포스터. LoL·팰월드는 기존 mobile 키아트를 크롭해 담고(안 A),
                    아트가 없는 게임은 자체 제작 마크를 먹 지면에 올립니다.
                    트위치 박스아트(안 B)가 들어오면 이 슬롯의 src 만 갈아 끼웁니다.
                    alt="" — 바로 아래 게임 이름이 글자로 있어 중복 낭독 방지. */}
                <span className={`yoro-home-cat-art${game.art || boxart[game.key] ? "" : " yoro-home-cat-art--mark"}`}>
                  {boxart[game.key] ? (
                    /* 트위치 박스아트(안 B) — 타일과 같은 3:4 원본이라 크롭이 없습니다. */
                    <img
                      alt=""
                      decoding="sync"
                      height={380}
                      loading="eager"
                      src={boxart[game.key]}
                      width={285}
                    />
                  ) : game.art ? (
                    <picture>
                      <source srcSet={game.art.avif} type="image/avif" />
                      <source srcSet={game.art.webp} type="image/webp" />
                      {/* decoding=sync — 첫 화면 위 폴드 타일이라 페인트와 디코드를
                          묶습니다. async 는 숨김 탭·탭 전환 직후 디코드가 미뤄져
                          타일이 백지로 남는 것을 실측했습니다(2026-08-22). */}
                      <img
                        alt=""
                        decoding="sync"
                        fetchPriority={index === 0 ? "high" : undefined}
                        height={game.art.height}
                        loading="eager"
                        src={game.art.jpg}
                        width={game.art.width}
                      />
                    </picture>
                  ) : game.icon()}
                </span>
                <span className="yoro-home-cat-name">{game.name(text)}</span>
                <TailUnderline className="yoro-home-cat-tail" height={8} width={112} />
                <span className="yoro-home-cat-sub">{game.sub(text)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
