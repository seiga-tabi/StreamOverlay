# YORO.gg Product Principles v1

문서 상태: 공식 제품 원칙  
적용 범위: 기능 기획, UX, UI, 개발, 운영 의사결정

## Product Principles

1. YORO.gg는 전적검색 사이트가 아니라 스트리머와 시청자가 함께 게임을 즐기는 플랫폼이다.
2. 검색은 시작점이고 관계가 목적이다.
3. 모든 기능은 Streamer와 Viewer를 연결해야 한다.
4. 기능보다 사용 경험을 우선한다.
5. 페이지 추가보다 기존 flow 개선을 우선한다.
6. 새로운 CSS보다 기존 Component를 사용한다.
7. 기존 Component로 해결할 수 없을 때만 새 Component를 만든다.
8. 방송 준비는 1분 안에 끝나야 한다.
9. OBS 설정은 3클릭 안에 끝나야 한다.
10. 방송 중 사용하는 기능은 실패해도 방송을 망치지 않아야 한다.
11. 시청자 입력은 절대로 임의 실행 권한으로 이어지면 안 된다.
12. 위험한 action은 명확한 위계와 확인 절차를 가진다.
13. Guest, User, Streamer, Admin 중 누구를 위한 기능인지 명확해야 한다.
14. Guest에게는 검색과 발견을 먼저 제공한다.
15. User에게는 팔로우, 참여, 커뮤니티를 먼저 제공한다.
16. Streamer에게는 오늘 방송 운영을 먼저 제공한다.
17. Admin에게는 안정성, 승인, 로그를 먼저 제공한다.
18. Dashboard는 관리 화면이 아니라 오늘 방송을 성공시키는 화면이다.
19. Overlay는 설정 화면이 아니라 방송 화면이다.
20. Community는 게시판이 아니라 Streamer Community Experience이다.
21. Tournament는 콘텐츠 관리가 아니라 스트리머 이벤트 경험이다.
22. Empty State는 막힌 상태가 아니라 다음 행동을 안내하는 상태여야 한다.
23. Loading State는 사용자의 불안을 줄여야 한다.
24. Error State는 원인, 영향, 해결 행동을 제공해야 한다.
25. Hover만으로 중요한 기능을 숨기지 않는다.
26. Focus는 항상 보이고 키보드로 이동 가능해야 한다.
27. 모든 주요 터치 target은 최소 44px를 지켜야 한다.
28. 8px spacing grid를 기본으로 한다.
29. Radius, shadow, color는 token을 벗어나지 않는다.
30. KR / JP 다국어 구조는 기능 완료 조건이다.
31. 영어 문구는 기술 고유명사를 제외하고 사용자 문구로 남기지 않는다.
32. 시각적 장식은 정보 이해를 방해하면 제거한다.
33. 방송 화면 overlay는 게임 화면을 침범하지 않아야 한다.
34. Streamer가 방송 중 실수하지 않도록 action hierarchy를 명확히 한다.
35. Admin 기능은 일반 사용자 flow와 섞지 않는다.
36. 데이터가 없는 화면도 제품 경험의 일부이다.
37. 커뮤니티 기능은 익명 게시판이 아니라 스트리머와 시청자 관계를 강화해야 한다.
38. 대회 기능은 생성보다 참여와 공유 경험을 우선한다.
39. 제품 품질은 UI polish만이 아니라 journey의 짧음과 명확성으로 판단한다.
40. YORO.gg의 모든 결정은 North Star Loop를 강화해야 한다.

## Principle Conflict Resolution

원칙이 충돌할 때는 다음 순서로 판단한다.

1. 방송 안전성
2. 사용자 journey 명확성
3. Streamer와 Viewer 연결 기여도
4. Design System 일관성
5. 개발 비용
6. 시각적 장식

