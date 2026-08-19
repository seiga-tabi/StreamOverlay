/* 홈 시그니처 그래픽 — 목업 캔버스 "YORO 홈 리디자인" v8 의 SVG path 를 그대로 옮겼습니다.
 *
 * - 먹 번짐: 그라디언트가 아니라 불규칙 SVG 덩어리 2겹(수묵 명도 층).
 * - 꼬리 밑줄: 끝이 가늘어지는 붓질 한 획 — 헤드라인 밑줄·검색 탭 활성·게임 메뉴
 *   활성 표시에 같은 path 하나를 폭만 바꿔 씁니다(시그니처 요소).
 * - 노리개: 백자 메달 + 매듭 + 술 3가닥 — 섹션 표식과 마크 장식.
 * 색은 전부 currentColor/CSS 변수로 받아 라이트/다크를 함께 지원합니다. */

export function TailUnderline({ width, height, className }: {
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} height={height} viewBox="0 0 180 12" width={width}>
      <path d="M2 5.5 C 50 1.5, 100 11, 176 5.2 C 120 8.4, 55 7.5, 2 9 Z" fill="currentColor" />
    </svg>
  );
}

export function NorigaeMark({ width, height, className }: {
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} height={height} viewBox="0 0 18 36" width={width}>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="9" cy="9" r="7" />
        <circle cx="9" cy="9" r="2.2" />
        <path d="M9 17.5 L 11.5 20 9 22.5 6.5 20 Z" />
        <path d="M6.5 23 C 6 27 5.5 31 5 34" />
        <path d="M9 23 L 9 34" />
        <path d="M11.5 23 C 12 27 12.5 31 13 34" />
      </g>
    </svg>
  );
}

/* 마크에 끈으로 매달리는 변형 — 상단 걸이 선이 있는 노리개(viewBox 0 0 18 50). */
function HangingNorigae({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 18 50">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M9 0 L 9 5" />
        <circle cx="9" cy="13" r="7" />
        <circle cx="9" cy="13" r="2.2" />
        <path d="M9 21.5 L 11.5 24 9 26.5 6.5 24 Z" />
        <path d="M6.5 27 C 6 33 5.5 40 5 47" />
        <path d="M9 27 L 9 47" />
        <path d="M11.5 27 C 12 33 12.5 40 13 47" />
      </g>
    </svg>
  );
}

function InkBlobs() {
  return (
    <svg aria-hidden="true" className="yoro-home-ink" fill="none" viewBox="0 0 320 360">
      <path
        d="M212 38c46-14 92 6 118 44 21 31 10 63 30 94 22 34 12 78-18 104-36 31-74 16-116 32-38 14-84 24-120 0-33-22-44-66-36-106 7-36 34-50 42-88 8-40 52-66 100-80Z"
        fill="var(--home-blob1)"
      />
      <path
        d="M244 96c28 4 48 30 50 62 2 26-12 44-8 70 4 30-14 54-42 60-30 7-52-12-84-10-28 2-56-8-64-36-7-26 8-46 12-72 4-28 24-46 52-52 30-7 56-26 84-22Z"
        fill="var(--home-blob2)"
        opacity=".38"
      />
    </svg>
  );
}

/* YORO 시그니처 마크: 붓글씨(Yuji Boku) 레터링 + 매달린 노리개 + 꼬리 획.
 * 먹 번짐 2겹 위에 -2° 기울여 서명처럼 올립니다. */
export function HomeSignatureMark() {
  return (
    <div aria-hidden="true" className="yoro-home-mark">
      <InkBlobs />
      <div className="yoro-home-mark-inner">
        <span className="yoro-home-mark-word">
          YORO
          <HangingNorigae className="yoro-home-mark-norigae" />
        </span>
        <TailUnderline className="yoro-home-mark-tail" height={14} width={180} />
      </div>
    </div>
  );
}

/* 방송 없음 빈 상태의 잠든 백호 한 획. */
export function SleepingTiger({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.2"
      viewBox="0 0 96 50"
    >
      <path d="M14 38 C 16 24, 34 16, 52 18 C 72 20, 84 30, 82 40" />
      <path d="M52 18 C 56 12, 66 12, 70 18" />
      <path d="M60 24 h8" />
      <path d="M14 38 C 6 40, 2 34, 6 28" />
      <path d="M30 26 c2 2 6 2 8 0" />
    </svg>
  );
}
