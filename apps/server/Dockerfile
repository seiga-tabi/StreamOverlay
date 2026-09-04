FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIME
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
# ── 의존성 설치 레이어 — manifest만 먼저 복사합니다 ──────────────────────────
# npm workspaces가 package.json을 찾을 수 있도록 각 워크스페이스의 manifest만
# 먼저 들여오고, 전체 소스는 npm ci 이후에 복사합니다. 순서를 바꾸면(소스를
# 먼저 넣으면) 코드 한 줄만 바뀌어도 이 COPY 레이어가 깨지면서 그 아래
# npm ci 레이어까지 매번 무효화됩니다 — lockfile이 그대로여도 재설치가
# 발생하던 원인이었습니다(2026-09-04 빌드 지연 조사).
# email-worker는 server 런타임이 참조하지 않는 별개 Cloudflare Worker라
# manifest만 들여 workspace 해석에 쓰고, 전체 소스는 복사하지 않습니다.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/email-worker/package.json ./apps/email-worker/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --include=dev
# ── 소스 복사 — npm ci 이후. 코드 변경은 이 지점부터만 캐시를 깹니다 ────────
COPY .git /tmp/yoro-git
COPY scripts/generate-image-release-metadata.mjs ./scripts/generate-image-release-metadata.mjs
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/dashboard ./apps/dashboard
RUN node scripts/generate-image-release-metadata.mjs /tmp/yoro-release.json /tmp/yoro-git
RUN npm run build:shared
RUN npm run build:server
RUN node apps/server/dist/scripts/validate-palworld-translations.js \
  --allow-incomplete \
  --reject-machine-assisted
RUN VITE_BASE_PATH=/dashboard/ npm run build:dashboard
# active release manifest에 결합되지 않은 비버전 candidate 작업 아이콘은 runtime 정적 경로에서 제외합니다.
RUN rm -rf /app/apps/dashboard/dist/images/palworld/work
RUN node apps/server/dist/scripts/smoke-palworld-runtime-artifacts.js \
  --prepare-runtime-bundle /app/.palworld-runtime-bundle

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    IMAGE_RELEASE_METADATA_PATH=/app/release.json \
    PORT=3000 \
    PUBLIC_BASE_URL=http://localhost:3000 \
    DASHBOARD_BASE_URL=http://localhost:3000 \
    STREAMOPS_LOGS_DIR=/app/logs \
    STREAMOPS_STATE_DIR=/app/.streamops \
    STREAMOPS_REPORTS_DIR=/app/reports \
    DASHBOARD_STATIC_DIR=/app/apps/dashboard/dist
COPY --from=build /tmp/yoro-release.json /app/release.json
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*
COPY apps/server/assets/fonts/yuji-boku.ttf /usr/share/fonts/truetype/yuji-boku/yuji-boku.ttf
RUN fc-cache -f
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --include-workspace-root=false --workspace @streamops/shared --workspace @streamops/server
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
RUN find /app/node_modules /app/packages/shared/dist /app/apps/server/dist -type f \
  \( -name '*.map' -o -name '*.d.ts' -o -path '*/test/*' -o -path '*/tests/*' \) -delete
COPY --from=build /app/apps/server/config ./apps/server/config
COPY --from=build /app/apps/server/migrations ./apps/server/migrations
COPY --from=build /app/apps/server/data/lol/aram ./apps/server/data/lol/aram
COPY --from=build /app/apps/server/data/minecraft ./apps/server/data/minecraft
COPY --from=build /app/apps/server/data/valorant ./apps/server/data/valorant
COPY --from=build /app/.palworld-runtime-bundle/apps/server/data/palworld ./apps/server/data/palworld
COPY --from=build /app/.palworld-runtime-bundle/apps/server/src/data/palworld-mappings ./apps/server/src/data/palworld-mappings
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
RUN node apps/server/dist/scripts/smoke-palworld-runtime-artifacts.js
RUN groupadd --gid 10001 streamops \
  && useradd --uid 10001 --gid streamops --home-dir /app --shell /usr/sbin/nologin --no-create-home streamops \
  && mkdir -p /app/logs /app/.streamops /app/reports \
  && chown -R streamops:streamops /app/logs /app/.streamops /app/reports
USER streamops
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
