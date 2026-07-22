FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG APP_VERSION=0.1.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/dashboard ./apps/dashboard
COPY apps/overlay ./apps/overlay
COPY apps/email-worker ./apps/email-worker
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
RUN npm ci --include=dev
RUN npm run build:shared
RUN npm run build:server
RUN VITE_BASE_PATH=/dashboard/ npm run build:dashboard
RUN VITE_BASE_PATH=/overlay/ npm run build:overlay

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ARG APP_VERSION=0.1.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="YORO.gg StreamOps" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_TIME}"
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME} \
    PORT=3000 \
    PUBLIC_BASE_URL=http://localhost:3000 \
    DASHBOARD_BASE_URL=http://localhost:3000 \
    OVERLAY_BASE_URL=http://localhost:3000/overlay \
    STREAMOPS_LOGS_DIR=/app/logs \
    STREAMOPS_STATE_DIR=/app/.streamops \
    STREAMOPS_REPORTS_DIR=/app/reports \
    DASHBOARD_STATIC_DIR=/app/apps/dashboard/dist \
    OVERLAY_STATIC_DIR=/app/apps/overlay/dist
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/bridge/package.json ./apps/bridge/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY apps/overlay/package.json ./apps/overlay/package.json
RUN npm ci --omit=dev --include-workspace-root=false --workspace @streamops/shared --workspace @streamops/server
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/config ./apps/server/config
COPY --from=build /app/apps/server/data/palworld/1.0.1 ./apps/server/data/palworld/1.0.1
COPY --from=build /app/apps/server/src/data/palworld-mappings ./apps/server/src/data/palworld-mappings
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
