FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIME
COPY package.json package-lock.json* tsconfig.base.json ./
COPY .git /tmp/yoro-git
COPY scripts/generate-image-release-metadata.mjs ./scripts/generate-image-release-metadata.mjs
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/dashboard ./apps/dashboard
COPY apps/overlay ./apps/overlay
COPY apps/email-worker ./apps/email-worker
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
RUN node scripts/generate-image-release-metadata.mjs /tmp/yoro-release.json /tmp/yoro-git
RUN npm ci --include=dev
RUN npm run build:shared
RUN npm run build:server
RUN node apps/server/dist/scripts/validate-palworld-translations.js \
  --allow-incomplete \
  --reject-machine-assisted
RUN VITE_BASE_PATH=/dashboard/ npm run build:dashboard
# active release manifest에 결합되지 않은 비버전 candidate 작업 아이콘은 runtime 정적 경로에서 제외합니다.
RUN rm -rf /app/apps/dashboard/dist/images/palworld/work
RUN VITE_BASE_PATH=/overlay/ npm run build:overlay
RUN node apps/server/dist/scripts/smoke-palworld-runtime-artifacts.js \
  --prepare-runtime-bundle /app/.palworld-runtime-bundle

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    IMAGE_RELEASE_METADATA_PATH=/app/release.json \
    PORT=3000 \
    PUBLIC_BASE_URL=http://localhost:3000 \
    DASHBOARD_BASE_URL=http://localhost:3000 \
    OVERLAY_BASE_URL=http://localhost:3000/overlay \
    STREAMOPS_LOGS_DIR=/app/logs \
    STREAMOPS_STATE_DIR=/app/.streamops \
    STREAMOPS_REPORTS_DIR=/app/reports \
    DASHBOARD_STATIC_DIR=/app/apps/dashboard/dist \
    OVERLAY_STATIC_DIR=/app/apps/overlay/dist
COPY --from=build /tmp/yoro-release.json /app/release.json
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/bridge/package.json ./apps/bridge/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/overlay/package.json ./apps/overlay/package.json
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev --include-workspace-root=false --workspace @streamops/shared --workspace @streamops/server
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
RUN find /app/node_modules /app/packages/shared/dist /app/apps/server/dist -type f \
  \( -name '*.map' -o -name '*.d.ts' -o -path '*/test/*' -o -path '*/tests/*' \) -delete
COPY --from=build /app/apps/server/config ./apps/server/config
COPY --from=build /app/apps/server/migrations ./apps/server/migrations
COPY --from=build /app/apps/server/data/lol/aram ./apps/server/data/lol/aram
COPY --from=build /app/.palworld-runtime-bundle/apps/server/data/palworld ./apps/server/data/palworld
COPY --from=build /app/.palworld-runtime-bundle/apps/server/src/data/palworld-mappings ./apps/server/src/data/palworld-mappings
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
COPY --from=build /app/apps/overlay/dist ./apps/overlay/dist
RUN node apps/server/dist/scripts/smoke-palworld-runtime-artifacts.js
RUN groupadd --gid 10001 streamops \
  && useradd --uid 10001 --gid streamops --home-dir /app --shell /usr/sbin/nologin --no-create-home streamops \
  && mkdir -p /app/logs /app/.streamops /app/reports \
  && chown -R streamops:streamops /app/logs /app/.streamops /app/reports
USER streamops
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
