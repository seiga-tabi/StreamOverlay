/* 최신 패치 버프/너프 배지 — 목업 `lol-champion-buff-nerf.approved-spec.html` §02(A안)에서
 * 정한 규격을 챔피언 목록 카드와 챔피언 상세 스킬 행이 함께 씁니다.
 *
 * 18×18 · r2 · 보더 40% 혼합은 CSS(.public-champion-card-badge)에 있고, 여기 있는 것은
 * 삼각형 path 뿐입니다. 배지는 언제나 aria-hidden 입니다 — 판정을 소리로 전하는 것은
 * 인접 텍스트의 몫입니다(목록은 카드 aria-label, 상세는 판정 태그. 목업 §10).
 */

export type PatchDirection = "buff" | "nerf";

/** 8×7 삼각형. 채움만 판정색이고 위/아래 방향이 색과 무관한 이중화 장치입니다. */
const BADGE_ARROW: Record<PatchDirection, string> = {
  buff: "M4 0.6 L 7.6 6.4 L 0.4 6.4 Z",
  nerf: "M4 6.4 L 0.4 0.6 L 7.6 0.6 Z"
};

export function PatchDirectionBadge({ direction }: { direction: PatchDirection }) {
  return (
    <span aria-hidden="true" className="public-champion-card-badge" data-direction={direction}>
      <svg height="7" viewBox="0 0 8 7" width="8">
        <path d={BADGE_ARROW[direction]} fill="currentColor" />
      </svg>
    </span>
  );
}
