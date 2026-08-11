# AI 작업 Handoff — 발로란트 공개 페이지 (Claude Code → Codex)

## 작업 목적

- 사용자 목표: `docs/mockups/valorant-page-design.html` 목업을 실제 코드로 적용.
- 범위: 프런트엔드 셸(phase-0) — 라우트, 헤더·탭바, i18n(ko·ja), 디자인 토큰, 홈(정책 3단 모델 소개), 데이터 화면의 정직한 준비 중 상태.
- 최초 phase-0 범위 밖이었던 server API, RSO OAuth, 로컬 카탈로그, 서버 SEO 메타는 아래 Codex 갱신 범위에서 구현했습니다. Riot 프로덕션 승인 pitch와 실승인 후 운영 활성화는 여전히 범위 밖입니다. "가짜 endpoint 금지" 원칙(AI_WORKFLOW §2.6)에 따라 프런트 데이터 화면은 shared contract를 소비하는 다음 작업으로 남깁니다.

## 변경 사항

- 변경 파일: `features/public-valorant/*`(신규), `pages/PublicValorantPage.tsx`(신규), `App.tsx`(분기), `styles/pages/public-valorant/*`(신규 lazy chunk), `styles/foundation/tokens.css`(`--yoro-color-valorant-primary` 1개), `PublicGameSelector`·`public-lol-i18n`·`public-lol` 라우트 유틸(발로란트 항목), `public/images/games/valorant-mark.svg`(자체 제작 V 모노그램 — Riot 상표 로고 아님).
- route 또는 화면: `/valorant`(홈) · `/valorant/{agents,weapons,maps,ranked}`(준비 중 상태) · 404. ko·ja prefix(`/ja/valorant`) 지원.
- 동작 변경: 게임 선택기에 발로란트 4번째 항목(부제 "경쟁전 도우미" — 기존 i18n placeholder 키 재사용). LoL·Palworld ↔ 발로란트 SPA 전환.

## 진행 상황 갱신 (2026-08-11)

- ✅ **RSO 계정 연결 완료(Codex)** — 연결 전용 identity(`link_identity`), migration `0020`, feature flag `features.riotRso`, PUUID 비노출·access token 즉시 폐기. `docs/RIOT_RSO.md` 참고.
- ✅ **전적 공개 동의(opt-in) 완료(Codex)** — Riot 연결과 분리된 migration `0021`, 최근 Twitch 인증+CSRF 동의 API, 연결 해제 자동 철회, 공개 cache 무효화를 구현했습니다.
- ⏳ 운영 차단: 법적 고지 확정(noindex 제거) → Riot Production 심사 제출이 임계 경로. **아래 B·C 는 승인 전에 전부 구현·배포 가능**합니다(승인 게이트 상태를 반환하면 되므로, 프런트가 화면을 미리 완성해 두었다가 승인 시 켭니다).

## Contract (구현 요청 — Codex)

관례는 기존 공개 API 를 따릅니다: **HTTP 200 + `state` 판별자 union**(palworld-map.ts 패턴),
`offset/limit/total/returned/hasMore` 페이지네이션, 응답 shared schema 는 `packages/shared/src/valorant.ts` 신설.
모든 이름 필드는 `{ ko, ja }` 병기, 이미지 URL 은 로컬 `/images/valorant/<release>/...` 만(외부 origin 금지).
rate limit 은 기존 팰월드 public 그룹 방식(`/api/valorant/*` 그룹) 재사용을 제안합니다.

### A. 전적 공개 동의(opt-in) — 서버 선행 작업

| 항목 | 요구 |
|---|---|
| 저장 | Riot identity 에 대한 **명시적 동의 + 동의 시각** (스키마 형태는 Codex 재량; 연결 자체와 반드시 분리) |
| 쓰기 API | `POST /api/account/riot/valorant-record-consent` `{ enabled: boolean }` — Dashboard 인증 + 기존 RSO 와 동일한 "최근 Twitch 인증" 요건 |
| 읽기 | 기존 계정/identity 응답에 `valorantRecordConsent: boolean` 노출(PUUID 는 계속 비노출) |
| 철회 | `enabled:false` 즉시 공개 프로필·검색에서 제거(캐시 무효화 포함). **Riot 연결 해제 시 자동 철회** |
| 게이트 | 공개 노출 조건 = 방송인 등록 ∧ Riot 연결 ∧ 동의 ∧ 프로덕션 승인 (4중, 서버측 검증) |

### B. 공개 카탈로그 (승인 불필요 — val-content-v1 자유 사용)

`GET /api/valorant/agents` · `/weapons` · `/maps` — 빌드 타임 수집 → 서버 로컬 서빙(Palworld 프록시 패턴).

```
응답: { state: "ready", items: [...], metadata } | { state: "data_unavailable" }
agent  항목: { id, name:{ko,ja}, role:{ id, name:{ko,ja} }, description:{ko,ja},
              skills:[{ key:"Q"|"E"|"C"|"X", name:{ko,ja}, description:{ko,ja} }], imageUrl? }
weapon 항목: { id, name:{ko,ja}, category:{ id, name:{ko,ja} }, creditCost:number|null, imageUrl? }
map    항목: { id, name:{ko,ja}, sites:["A","B","C"...], note?:{ko,ja}, imageUrl? }
metadata: palworld 와 동일 형태(gameVersion, sourceName, sourceUrl, extractedAt, verifiedAt, license)
```

- 이미지 파이프라인이 늦으면 `imageUrl` 생략 가능 — UI 는 텍스트 카드로 렌더(목업 §05 무기·맵 카드가 이미 텍스트 우선).
- ko·ja 명칭은 인게임 공식 표기 검수 필수(목업 §08 i18n 초안이 시드).

### C. 리더보드 (승인 게이트 — val-ranked-v1, RSO 불필요)

`GET /api/valorant/leaderboard?region=kr|ap|na&act=<actId>` (act 생략 시 현재 act)

```
{ state: "approval_pending" }                      // 승인 전 — 배포 가능 상태
| { state: "data_unavailable" }
| { state: "ready",
    act: { id, name:{ko,ja} },
    acts: [{ id, name:{ko,ja} }],                   // 셀렉터용, 최근 N개
    region: "kr"|"ap"|"na",
    entries: [{ rank:number, anonymous:boolean,
                riotId?: string,                    // anonymous=true 면 생략
                rankedRating:number, wins:number }],
    updatedAt: string }
```

- 캐시 제안: act 별 5분 TTL + stale-while-revalidate. 상위 500 고정(페이지네이션 불필요)이면 `entries` 통짜, 아니면 표준 페이지네이션.
- `anonymous` 는 Riot 응답의 익명화 플래그 그대로 — 프런트는 "비공개 플레이어" 라벨로 렌더(이미 i18n 준비됨).

### D. 스트리머 전적 (승인 + opt-in 게이트 — val-match-v1)

`GET /api/valorant/streamers` — 공개 동의 스트리머 목록(홈 카드용)
```
{ state:"approval_pending" } | { state:"ready", streamers:[{ id, displayName, riotTag?:string }] }
```

`GET /api/valorant/streamers/<id>/matches?offset=0&limit=20`
```
{ state:"approval_pending" }
| 404 { error:"not_found" }                        // 미등록·미동의·철회 모두 동일 — 존재 여부 비노출
| { state:"ready",
    profile: { displayName, riotTag, consentBadge:true },   // PUUID 절대 미포함
    offset, limit, total, returned, hasMore,
    matches: [{
      matchId, queue:{ id, name:{ko,ja} },
      map:{ id, name:{ko,ja} }, agent:{ id, name:{ko,ja} },
      win:boolean, roundsWon:number, roundsLost:number,
      kills:number, deaths:number, assists:number,
      headshotPercent:number|null,
      startedAt:string, durationSeconds:number,
      detail?: { adr:number|null, firstKills:number|null,
                 plants:number|null, defuses:number|null,
                 halves?: [{ won:number, lost:number }] }   // 목업 매치 상세 확장용 — 2차 가능
    }] }
```

- `matches[].detail` 은 optional — 1차는 행 정보(승패·스코어·시간·KDA·HS%)만으로 UI 성립(목업 §05 매치 행).
- 타 사용자 노출이므로 응답에 상대 팀원·채팅 등 제3자 정보 금지. Riot 원문 응답은 로그에 남기지 않음.
- 캐시 제안: 스트리머별 60초 TTL + 철회 시 즉시 무효화. timeout·abort·bounded retry 는 AI_WORKFLOW §5.

### E. 공통 safe error / 상태 ↔ UI 매핑 (프런트 구현 예정)

| 상태 | UI (이미 설계됨 — 목업 §05·§06) |
|---|---|
| feature flag off | 404 → 발로란트 404 화면 |
| `approval_pending` | "Riot 승인 진행 중" 안내(현 준비 중 화면 변형) |
| `data_unavailable` | 데이터 없음 안내 + 재시도 |
| `not_found`(미동의 포함) | 미동의 안내 화면 — "본인 동의 계정만 공개" + 내 전적 로그인 CTA |
| `ready` | 실데이터 렌더 |

### 기타 선행 의존 (변동 없음)

- 서버 SEO: `/valorant/*` 라우트 메타(현재 클라이언트 title·canonical 만).
- ja prefix 서버 서빙 확인: `/ja/valorant/*` 가 dashboard index 로 서빙되는지(클라이언트 allowlist 는 반영 완료).

## UI 상태 (현재 구현)

- loading: App lazy chunk Suspense skeleton.
- empty: 데이터 화면 4종은 준비 중 EmptyState(가짜 표본 없음) + 홈 복귀 버튼.
- error: `ValorantPageErrorBoundary`(원문 오류 미노출, 새로고침 복구).
- success: 홈 — 전적 3단 모델(스트리머 opt-in·내 전적·리더보드) + RSO 정책 경계 설명.
- responsive: 데스크톱 상단 nav 5항목 / ≤768px 하단 탭바 5칸(더보기 없음). 360–1440 가로 overflow 0 검증.
- i18n: `valorant-i18n.ts` ko·ja 전 키 동시 관리.
- accessibility: `aria-current="page"`, 44px 탭 타깃(공용 `.public-bottom-tab-bar`), 컷 코너는 drop-shadow 테두리(포커스 링 잘림 없음).

## 데이터 및 운영

- migration: `0020_yoro_riot_rso_identity.sql`, `0021_yoro_valorant_record_consent.sql`.
- runtime config: `features.riotRso`, `features.valorantPublic`, `riot.valorantProductionApproved`, `riot.valorantCurrentActId`.
- secret: 승인 전 카탈로그에는 추가 secret이 필요하지 않습니다. RSO는 `riot_rso_client_secret`, 승인 후 Riot API는 기존 `riot_api_key` secret file을 사용합니다.
- rollback: 공개 surface는 `features.valorantPublic=false`로 404 전환할 수 있습니다. migration 적용 뒤에는 구 image가 future-schema mismatch로 fail-closed하므로 image-only rollback을 금지하고 사전 DB backup 복원 또는 forward-fix migration을 사용합니다.

## 검증

- 실행한 명령: `npm run lint` · `npm run typecheck` · `npm run build` · `npm run validate:config` · `npm run test:run` · `npm run check:tokens` · `npm run check:css-overrides` · `npm run check:budgets` · Playwright 전체 · `git diff --check`
- 통과한 테스트: dashboard 단위 291건(발로란트 render 7건 신규), `qa/visual-regression/valorant-functional.spec.ts` 데스크톱·모바일.
- Codex 서버 갱신 검증: shared/server/dashboard typecheck·build, 발로란트 shared contract·HTTP·service·migration·SEO 표적 테스트, production Compose config를 실행했습니다. 실제 PostgreSQL migration apply와 승인된 Riot Production API 호출은 staging/승인 전이므로 실행하지 않았습니다.
- 남은 위험: CSS gzip 예산 178,287/180,000(여유 1.7KB) — 다음 CSS 작업 시 주의.

## Codex 서버 구현 완료 갱신 (2026-08-11)

- ✅ A: `0021_yoro_valorant_record_consent`, 최근 Twitch 인증+CSRF 동의 API, Riot unlink 자동 철회, session identity consent 공개.
- ✅ B: 공식 Public Content Catalog `12.08`의 ko·ja 로컬 artifact와 agents/weapons/maps API. 표준 page 필드는 응답 최상위에 둡니다.
- ✅ C: leaderboard endpoint, 승인 전 `approval_pending`, 승인 후 top 500·5분 TTL/30분 SWR. `riot.valorantCurrentActId`를 사용합니다.
- ✅ D: opt-in 스트리머 목록·matchlist/detail endpoint, 매 요청 4중 gate, safe public ID, PUUID·제3자 정보 비노출, 60초 process cache.
- ✅ E: exact shared validator와 feature off 404·safe 상태 매핑.
- 계약 보정: 공식 catalog 원문에 없는 weapon cost는 `null`, map sites는 `[]`로 반환합니다. role은 공식 agent page 검수 mapping을 generator에서 fail-closed로 결합합니다.
- 운영 전 필수: `0021` staging 적용 검증, 법적 문구 확정, Riot Production 승인 후 approval flag와 공식 current act UUID 설정.
- 상세 운영·API 계약: `docs/VALORANT_PUBLIC_API.md`.

## 다음 담당자

- 담당 도구: Codex
- 다음 작업: Claude Code가 `packages/shared/src/valorant.ts`와 `docs/VALORANT_PUBLIC_API.md`를 기준으로 도감·리더보드·전적 화면의 loading/approval_pending/data_unavailable/not_found/ready 상태를 연결합니다.
- 수정하면 안 되는 사용자 변경: `apps/dashboard/src/features/public-lol/*`·`apps/server/*` 의 병행 작업 변경분(작업 트리에 존재).
