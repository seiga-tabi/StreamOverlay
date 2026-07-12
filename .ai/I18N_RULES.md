# YORO.gg i18n Rules

## 1. 기준 언어

YORO.gg는 한국어와 일본어를 기준으로 한다.

- Korean: `ko`
- Japanese: `ja`

UI text는 한국어/일본어 구조를 함께 가져야 한다.

## 2. 하드코딩 문자열 금지

금지:

- JSX에 한국어/일본어 문자열 직접 삽입
- 영어 안내 문구만 추가
- placeholder, aria label, toast, error message 누락
- 한 언어만 추가

기존 코드에 영어 안내 문구가 있으면 한국어 번역을 함께 추가한다.

## 3. UI Text 구조

허용 구조:

- `data-ko`, `data-ja`
- `i18n` object
- locale별 dictionary
- 기존 프로젝트의 `dashboardI18n`, `createDashboardLocaleProxy` 패턴

## 4. Key Naming 규칙

권장:

```text
surface.feature.element.state
```

예:

```text
dashboard.overlay.status.title
public.search.input.placeholder
community.post.empty.title
participation.queue.error.full
```

## 5. Fallback 규칙

- locale이 없으면 `ko`를 fallback으로 사용한다.
- key 누락 시 빈 문자열보다 안전한 fallback을 사용한다.
- fallback 발생은 개발 중 발견 가능해야 한다.
- production에서 key 이름이 그대로 노출되지 않도록 한다.

## 6. 날짜/시간/숫자 포맷

- `Intl.DateTimeFormat` 사용을 우선한다.
- `Intl.NumberFormat` 사용을 우선한다.
- 한국/일본 locale 차이를 고려한다.
- 상대 시간은 locale별 표현을 사용한다.
- timezone이 중요한 경우 명시한다.

## 7. Riot ID/게임 용어 번역 규칙

번역하지 않는 용어:

- Riot ID
- Twitch
- OBS
- Overlay
- Solo Rank
- LP
- KDA
- Tier
- Queue
- Champion

한국어/일본어 표현이 확정된 용어만 번역한다.

## 8. Persona 용어 통일

| 의미 | 한국어 | 일본어 |
|---|---|---|
| Guest | 게스트 | ゲスト |
| User | 유저 | ユーザー |
| Streamer | 스트리머 | 配信者 |
| Admin | 관리자 | 管理者 |
| Viewer | 시청자 | 視聴者 |
| Community | 커뮤니티 | コミュニティ |
| Participation | 시참 | 参加 |
| Tournament | 대회 | 大会 |

## 9. Error/Toast 규칙

- user-facing message는 친절하고 짧게 작성한다.
- internal error detail을 그대로 노출하지 않는다.
- action 가능성을 알려준다.
- 한국어/일본어 모두 작성한다.

## 10. 검증

i18n 변경 시 확인:

- 모든 UI text key 존재
- ko/ja 길이 차이에 따른 layout 확인
- mobile text overflow 없음
- aria label 번역 존재
- toast/modal/dropdown text 번역 존재

