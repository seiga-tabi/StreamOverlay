# YORO.gg Master Checklist

## 1. 목적

이 체크리스트는 Sprint1 시작 전 반드시 확인해야 하는 Master Checklist다. 100개 이상의 항목을 모두 검토한 뒤 Sprint1 작업을 시작한다.

## 2. Product Alignment

- [ ] 001. `Product-Constitution.md`를 읽었다.
- [ ] 002. `Product-Vision.md`를 읽었다.
- [ ] 003. `Product-Principles.md`를 읽었다.
- [ ] 004. `Product-Experience.md`를 읽었다.
- [ ] 005. `North-Star-Loop.md`를 읽었다.
- [ ] 006. 이번 작업이 "스트리머와 시청자가 함께 게임을 즐기는 플랫폼" 방향과 일치한다.
- [ ] 007. 이번 작업이 단순 관리자 페이지화를 강화하지 않는다.
- [ ] 008. Guest/User/Streamer/Admin 중 대상 persona가 명확하다.
- [ ] 009. Streamer와 Viewer 연결을 약화하지 않는다.
- [ ] 010. North Star Loop를 끊는 변경이 없다.

## 3. Architecture Alignment

- [ ] 011. `Architecture-v2.md`를 읽었다.
- [ ] 012. `Migration-Plan.md`를 읽었다.
- [ ] 013. `Execution-Plan.md`를 읽었다.
- [ ] 014. `Architecture-Governance.md`를 읽었다.
- [ ] 015. target layer 방향을 이해했다.
- [ ] 016. `shared`가 `features`를 import하면 안 된다는 규칙을 확인했다.
- [ ] 017. feature 간 직접 import 금지를 확인했다.
- [ ] 018. page는 composition 역할만 해야 함을 확인했다.
- [ ] 019. controller가 Store/file system 직접 조작을 줄여야 함을 확인했다.
- [ ] 020. 현재 Prisma가 없음을 확인했다.

## 4. AI Rules

- [ ] 021. `.ai/AI_DEVELOPMENT_RULES.md`를 읽었다.
- [ ] 022. `.ai/UI_RULES.md`를 읽었다.
- [ ] 023. `.ai/DESIGN_SYSTEM_RULES.md`를 읽었다.
- [ ] 024. `.ai/REFACTOR_RULES.md`를 읽었다.
- [ ] 025. `.ai/GIT_RULES.md`를 읽었다.
- [ ] 026. `.ai/REVIEW_RULES.md`를 읽었다.
- [ ] 027. `.ai/QA_RULES.md`를 읽었다.
- [ ] 028. `.ai/CODING_STANDARDS.md`를 읽었다.
- [ ] 029. `.ai/SECURITY_RULES.md`를 읽었다.
- [ ] 030. `.ai/I18N_RULES.md`를 읽었다.

## 5. Scope Control

- [ ] 031. 이번 Sprint가 Sprint1인지 확인했다.
- [ ] 032. Sprint1 범위를 벗어난 작업이 없다.
- [ ] 033. Big Bang Refactor를 하지 않는다.
- [ ] 034. 파일 이동과 behavior change를 섞지 않는다.
- [ ] 035. CSS token 변경과 redesign을 섞지 않는다.
- [ ] 036. API namespace 변경과 auth 정책 변경을 섞지 않는다.
- [ ] 037. Store abstraction과 Prisma 도입을 섞지 않는다.
- [ ] 038. overlay visual 변경과 socket protocol 변경을 섞지 않는다.
- [ ] 039. Navigation IA 변경과 page content refactor를 섞지 않는다.
- [ ] 040. 관련 없는 formatting을 하지 않는다.

## 6. No-Touch Files

- [ ] 041. `package.json` 수정 금지를 확인했다.
- [ ] 042. lock 파일 수정 금지를 확인했다.
- [ ] 043. `tsconfig*.json` 수정 금지를 확인했다.
- [ ] 044. `vite.config.ts` 수정 금지를 확인했다.
- [ ] 045. `Dockerfile` 수정 금지를 확인했다.
- [ ] 046. `docker-compose*.yml` 수정 금지를 확인했다.
- [ ] 047. `.env*` 수정 금지를 확인했다.
- [ ] 048. DB/Prisma 파일 수정 금지를 확인했다.
- [ ] 049. `apps/bridge/src/*` 수정 금지를 확인했다.
- [ ] 050. `apps/server/src/core/action-dispatcher.ts` 수정 금지를 확인했다.

## 7. Baseline Readiness

- [ ] 051. 현재 `git status`를 확인했다.
- [ ] 052. 기존 사용자 변경사항을 파악했다.
- [ ] 053. 변경 전 build baseline 계획이 있다.
- [ ] 054. 변경 전 typecheck baseline 계획이 있다.
- [ ] 055. 변경 전 test baseline 계획이 있다.
- [ ] 056. public screenshot baseline 계획이 있다.
- [ ] 057. dashboard screenshot baseline 계획이 있다.
- [ ] 058. overlay screenshot baseline 계획이 있다.
- [ ] 059. bundle size baseline 계획이 있다.
- [ ] 060. API latency baseline 계획이 있다.

## 8. Feature Flag Readiness

- [ ] 061. `Feature-Flag-Plan.md`를 읽었다.
- [ ] 062. `YORO_FEATURE_FLAGS_ENABLED` 기준을 확인했다.
- [ ] 063. `YORO_DESIGN_TOKENS_V2_ENABLED` 기준을 확인했다.
- [ ] 064. `YORO_SHARED_UI_V2_ENABLED` 기준을 확인했다.
- [ ] 065. `YORO_DASHBOARD_SHELL_V2_ENABLED` 기준을 확인했다.
- [ ] 066. `YORO_OVERLAY_STUDIO_V2_ENABLED` 기준을 확인했다.
- [ ] 067. `YORO_PUBLIC_SEARCH_V2_ENABLED` 기준을 확인했다.
- [ ] 068. production default는 보수적으로 off임을 확인했다.
- [ ] 069. flag off 시 legacy fallback이 필요함을 확인했다.
- [ ] 070. flag 제거는 100% rollout 이후임을 확인했다.

## 9. Compatibility Readiness

- [ ] 071. `Compatibility-Layer.md`를 읽었다.
- [ ] 072. legacy component wrapper 전략을 확인했다.
- [ ] 073. legacy API adapter 전략을 확인했다.
- [ ] 074. legacy CSS alias 전략을 확인했다.
- [ ] 075. legacy Store JSON adapter 전략을 확인했다.
- [ ] 076. existing OBS URL compatibility를 확인했다.
- [ ] 077. WebSocket parser adapter 필요성을 확인했다.
- [ ] 078. legacy route 즉시 삭제 금지를 확인했다.
- [ ] 079. legacy CSS selector 즉시 삭제 금지를 확인했다.
- [ ] 080. legacy fallback 호출량을 추적해야 함을 확인했다.

## 10. Design System Readiness

- [ ] 081. `Design-System-Constitution.md`를 읽었다.
- [ ] 082. Design Token 없이 새 UI를 만들 수 없음을 확인했다.
- [ ] 083. 8px grid 기준을 확인했다.
- [ ] 084. radius scale 기준을 확인했다.
- [ ] 085. color role 기준을 확인했다.
- [ ] 086. shadow token 기준을 확인했다.
- [ ] 087. typography scale 기준을 확인했다.
- [ ] 088. motion token 기준을 확인했다.
- [ ] 089. 44px touch target 기준을 확인했다.
- [ ] 090. 임의 gradient/shadow 추가 금지를 확인했다.

## 11. UI Readiness

- [ ] 091. Dashboard는 오늘 방송 운영 중심임을 확인했다.
- [ ] 092. Overlay는 OBS 사용 흐름 중심임을 확인했다.
- [ ] 093. Community는 Streamer Community 중심임을 확인했다.
- [ ] 094. Guest 화면 목표를 확인했다.
- [ ] 095. User 화면 목표를 확인했다.
- [ ] 096. Streamer 화면 목표를 확인했다.
- [ ] 097. Admin 화면 목표를 확인했다.
- [ ] 098. 새 페이지 추가보다 삭제/통합 우선임을 확인했다.
- [ ] 099. 모든 interactive UI state 필요성을 확인했다.
- [ ] 100. 일반 관리자 페이지처럼 만들면 안 됨을 확인했다.

## 12. Security Readiness

- [ ] 101. secret 하드코딩 금지를 확인했다.
- [ ] 102. Riot API key는 서버에서만 사용해야 함을 확인했다.
- [ ] 103. Twitch token을 client에 노출하지 않음을 확인했다.
- [ ] 104. overlay token을 log에 남기지 않음을 확인했다.
- [ ] 105. admin 권한은 server-side 검증이 필요함을 확인했다.
- [ ] 106. rate limit 적용 영역을 확인했다.
- [ ] 107. CORS allowlist를 임의로 넓히지 않음을 확인했다.
- [ ] 108. CSRF 보호를 제거하지 않음을 확인했다.
- [ ] 109. viewer input이 unsafe action으로 이어지면 안 됨을 확인했다.
- [ ] 110. OBS/Twitch action allowlist 원칙을 확인했다.

## 13. i18n Readiness

- [ ] 111. 한국어/일본어 동시 지원 기준을 확인했다.
- [ ] 112. UI hardcoding 금지를 확인했다.
- [ ] 113. `data-ko`, `data-ja` 또는 i18n object 구조를 확인했다.
- [ ] 114. fallback은 `ko` 기준임을 확인했다.
- [ ] 115. 날짜/시간/숫자 locale format 필요성을 확인했다.
- [ ] 116. Riot ID/Twitch/OBS 고유명사 번역 금지를 확인했다.
- [ ] 117. 관리자/스트리머/유저 용어 통일표를 확인했다.
- [ ] 118. aria label도 번역 대상임을 확인했다.
- [ ] 119. toast/error message도 번역 대상임을 확인했다.
- [ ] 120. KR/JP 길이 차이 visual check 필요성을 확인했다.

## 14. QA Readiness

- [ ] 121. `QA-Gate.md`를 읽었다.
- [ ] 122. `Visual-Regression-Rule.md`를 읽었다.
- [ ] 123. `Performance-Rule.md`를 읽었다.
- [ ] 124. `Accessibility-Rule.md`를 읽었다.
- [ ] 125. build 검증 계획이 있다.
- [ ] 126. typecheck 검증 계획이 있다.
- [ ] 127. test 검증 계획이 있다.
- [ ] 128. responsive 검증 계획이 있다.
- [ ] 129. accessibility 검증 계획이 있다.
- [ ] 130. rollback test 계획이 있다.

## 15. Release Readiness

- [ ] 131. `Release-Gate.md`를 읽었다.
- [ ] 132. Blue/Green 우선 원칙을 확인했다.
- [ ] 133. overlay runtime rolling 금지를 확인했다.
- [ ] 134. auth/session rolling 금지를 확인했다.
- [ ] 135. participation queue mutation rolling 금지를 확인했다.
- [ ] 136. Store persistence rolling 금지를 확인했다.
- [ ] 137. release rollback owner 필요성을 확인했다.
- [ ] 138. monitoring metric 필요성을 확인했다.
- [ ] 139. Stage smoke 필요성을 확인했다.
- [ ] 140. production flag default 확인 필요성을 확인했다.

## 16. Sprint1 Start Approval

- [ ] 141. `Definition-of-Ready.md` 기준을 모두 충족했다.
- [ ] 142. Sprint1 대상 파일이 확정되었다.
- [ ] 143. Sprint1 금지 파일이 확정되었다.
- [ ] 144. Sprint1 PR 분할 계획이 있다.
- [ ] 145. Sprint1 rollback 기준이 있다.
- [ ] 146. Sprint1 QA baseline 계획이 있다.
- [ ] 147. Sprint1 performance baseline 계획이 있다.
- [ ] 148. Sprint1 visual baseline 계획이 있다.
- [ ] 149. Sprint1 문서 업데이트 계획이 있다.
- [ ] 150. Sprint1 시작 승인 상태다.

