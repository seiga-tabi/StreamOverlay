FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/discord-bot ./apps/discord-bot
RUN npm ci --include=dev
RUN npm run build:shared
RUN npm --workspace apps/discord-bot run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ARG APP_VERSION=0.1.0
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME} \
    DISCORD_BOT_HEALTH_PORT=3100
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/discord-bot/package.json ./apps/discord-bot/package.json
RUN npm ci --omit=dev --include-workspace-root=false \
  --workspace @streamops/shared \
  --workspace @streamops/discord-bot
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/discord-bot/dist ./apps/discord-bot/dist
RUN groupadd --gid 10002 discordbot \
  && useradd --uid 10002 --gid discordbot --home-dir /app --shell /usr/sbin/nologin --no-create-home discordbot
USER discordbot
CMD ["node", "apps/discord-bot/dist/index.js"]
