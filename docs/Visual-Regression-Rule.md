# YORO.gg Visual Regression Rule

## 1. 목적

Visual Regression Rule은 Design Token과 component migration 중 의도하지 않은 UI 손상을 막기 위한 기준이다.

## 2. 비교 대상

필수 screenshot:

- Public Search desktop/mobile
- Public Profile desktop/mobile
- Dashboard desktop/tablet/mobile
- Overlay Studio desktop
- OBS overlay 1920x1080
- OBS overlay 1280x720
- Participation dashboard
- Community
- Tournament
- Login

## 3. Pixel 허용 오차

| 영역 | 허용 오차 |
|---|---:|
| OBS overlay | 0.1% 이하 |
| Dashboard shell | 0.3% 이하 |
| Public Search | 0.3% 이하 |
| Public Profile | 0.5% 이하 |
| Settings/Admin low-risk | 0.8% 이하 |

## 4. 절대 허용 불가

- blank frame
- text clipping
- button label overflow
- card overlap
- primary CTA 사라짐
- mobile horizontal scroll
- focus ring 사라짐
- contrast 저하
- navigation 접근 불가
- KR/JP locale 전환 후 layout collapse

## 5. 허용 가능 변화

문서화된 경우만 허용:

- token alias로 인한 1px rounding
- font rendering platform 차이
- image remote loading 차이
- time/date dynamic text
- live data count 변화

## 6. 비교 절차

1. baseline screenshot 확보
2. 변경 후 screenshot 확보
3. diff 생성
4. 허용 오차 확인
5. 불허 항목 수동 확인
6. PR에 결과 기록

## 7. Sprint별 적용

| Sprint | Visual Gate |
|---|---|
| Sprint1 | baseline only, token alias diff <= 0.3% |
| Sprint2 | dashboard shell diff <= 0.3% |
| Sprint3 | OBS overlay diff <= 0.1%, blank 0 |
| Sprint4 | public search/profile diff <= 0.5% |
| Sprint5 | participation/community/tournament diff <= 0.5% |

