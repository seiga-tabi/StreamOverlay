FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY .git /tmp/yoro-git
COPY scripts/generate-image-release-metadata.mjs ./scripts/generate-image-release-metadata.mjs
COPY packages/shared ./packages/shared
COPY apps/discord-bot ./apps/discord-bot
RUN node scripts/generate-image-release-metadata.mjs /tmp/yoro-release.json /tmp/yoro-git
RUN npm ci --include=dev
RUN npm run build:shared
RUN npm --workspace apps/discord-bot run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    IMAGE_RELEASE_METADATA_PATH=/app/release.json \
    DISCORD_BOT_HEALTH_PORT=3100
COPY --from=build /tmp/yoro-release.json /app/release.json
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/discord-bot/package.json ./apps/discord-bot/package.json
RUN npm ci --omit=dev --include-workspace-root=false \
  --workspace @streamops/shared \
  --workspace @streamops/discord-bot
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/discord-bot/dist ./apps/discord-bot/dist
RUN find /app/node_modules /app/packages/shared/dist /app/apps/discord-bot/dist -type f \
  \( -name '*.map' -o -name '*.d.ts' -o -path '*/test/*' -o -path '*/tests/*' \) -delete
RUN groupadd --gid 10002 discordbot \
  && useradd --uid 10002 --gid discordbot --home-dir /app --shell /usr/sbin/nologin --no-create-home discordbot
USER discordbot
CMD ["node", "apps/discord-bot/dist/index.js"]
