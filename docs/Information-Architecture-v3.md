# YORO.gg Information Architecture v3

문서 상태: 공식 IA 기준  
적용 범위: Feature 구조, 권한별 제품 구조, Navigation, Routing 설계

## 1. IA v3 정의

YORO.gg IA v3는 페이지 기준이 아니라 Feature 기준으로 제품을 재구성한다.

기존 구조의 문제는 전적검색, 방송 관리, overlay, 커뮤니티, 대회가 각각 다른 제품처럼 분리되어 보인다는 점이다. IA v3는 모든 기능을 다음 흐름으로 연결한다.

검색 → 발견 → 팔로우 → 참여 → 커뮤니티 → 방송 성장

## 2. Product Areas

YORO.gg는 다섯 개의 제품 영역으로 구성한다.

- Public: 검색, 발견, 공개 프로필, 공개 커뮤니티
- My YORO: 로그인 사용자의 개인화, 팔로우, 즐겨찾기, 참여
- Streamer Studio: 오늘 방송 운영, 시참, 팔로워, 대회 운영
- Overlay Studio: OBS overlay 설정, preview, test, 상태 확인
- Admin: 승인, 시스템 상태, 로그, 보안 설정

## 3. Guest Feature Tree

Guest

- Search
  - Riot ID Search
  - Search Suggestions
  - Recent Search
  - JP / KR Server Context
- Player Profile
  - Rank Summary
  - Match History
  - Champion Performance
  - Role Performance
  - Streamer Indicator
- Streamer Discovery
  - Live Streamer
  - Linked Riot ID
  - Public Streamer Profile
- Public Community
  - Streamer Spaces Preview
  - Party Finder Preview
  - Tournament Preview
- Conversion
  - Twitch Login
  - Favorite Prompt
  - Follow Streamer Prompt
  - Participation Prompt

Guest의 핵심 목표는 “빠른 검색”과 “스트리머 발견”이다.

## 4. User Feature Tree

User

- My YORO
  - Favorite Players
  - Followed Streamers
  - Recent Activity
  - Participation History
- Streamer Relationship
  - Followed Streamer Status
  - Live Now
  - Joinable Participation
  - Streamer Community
- Participation
  - Join Queue
  - Select Role
  - Check Queue Status
  - Cancel Participation
  - Receive Invite Message
- Community
  - Streamer Space
  - Party Finder
  - Server / Clan Recruitment
  - Comments
  - Reputation Signals
- Tournament
  - Tournament List
  - Schedule
  - Teams
  - Bracket
  - Participation Guide

User의 핵심 목표는 “내가 좋아하는 스트리머와 함께 플레이하는 것”이다.

## 5. Streamer Feature Tree

Streamer

- Today Live
  - Broadcast Readiness
  - Twitch Connection
  - OBS / Overlay Status
  - Riot ID Status
  - Participation Status
  - Critical Actions
- Participation Ops
  - Open / Close Queue
  - Queue Display
  - Check-in
  - Invite
  - No-show
  - Played History
- Overlay Studio
  - Source Presets
  - Alerts
  - Chat
  - Participation Queue
  - Solo Rank
  - Subtitles
  - Mission
  - Preview / Test
- Streamer Profile
  - Riot ID
  - Public Profile
  - Stream Status
  - Profile Links
- Community Hub
  - Streamer Space
  - Posts
  - Viewer Participation
  - Party / Server Recruitment
- Tournament Host
  - Create Tournament
  - Teams
  - Schedule
  - Bracket
  - Public Page
- Broadcast Summary
  - Events
  - Viewer Participation
  - Followers
  - Highlights

Streamer의 핵심 목표는 “오늘 방송을 안정적으로 성공시키는 것”이다.

## 6. Admin Feature Tree

Admin

- System Health
  - Server
  - Twitch
  - EventSub
  - Overlay Clients
  - API Keys
  - Errors
- Approvals
  - Streamer Riot ID Requests
  - Dashboard Access
  - Overlay Access
- Safety
  - Allowed Actions
  - Token Status
  - Permission Scope
  - Dangerous Action Guardrails
- Logs
  - Events
  - Actions
  - Failures
  - Audit Trail
- Settings
  - Twitch OAuth
  - Riot API
  - OBS Bridge
  - Overlay Base URL

Admin의 핵심 목표는 “서비스가 안전하게 운영되는지 판단하고 문제를 해결하는 것”이다.

## 7. IA v3 금지 규칙

- 기술 구현 단위 그대로 Navigation에 노출하지 않는다.
- User와 Streamer의 목적지가 같은 이름으로 섞이면 안 된다.
- Admin 전용 기능은 Public 또는 Streamer primary flow에 노출하지 않는다.
- Overlay channel은 URL 목록이 아니라 OBS source preset으로 표현한다.
- Community는 게시판 카테고리가 아니라 관계와 참여 단위로 구성한다.

