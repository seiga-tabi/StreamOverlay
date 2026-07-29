FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/agent ./apps/agent
RUN npm ci --include=dev
RUN npm run build:shared
RUN npm --workspace apps/agent run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ARG APP_VERSION
ARG GIT_SHA
ARG BUILD_TIME
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME} \
    YORO_AGENT_STATE_DIR=/var/lib/yoro-agent \
    YORO_AGENT_HEALTH_HOST=127.0.0.1 \
    YORO_AGENT_HEALTH_PORT=3200
RUN node -e "const value={version:process.env.APP_VERSION,gitSha:process.env.GIT_SHA,builtAt:process.env.BUILD_TIME}; if(!/^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.version)||!(/^[a-f0-9]{7,40}$/i.test(value.gitSha))||!(/^\\d{4}-\\d{2}-\\d{2}T/.test(value.builtAt))||!Number.isFinite(Date.parse(value.builtAt))) throw new Error('유효한 APP_VERSION, GIT_SHA, BUILD_TIME build args가 필요합니다.')"
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/agent/package.json ./apps/agent/package.json
RUN npm ci --omit=dev --include-workspace-root=false \
  --workspace @streamops/shared \
  --workspace @streamops/agent
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/agent/dist ./apps/agent/dist
RUN find /app/packages/shared/dist /app/apps/agent/dist -type f \
  \( -name '*.d.ts' -o -name '*.d.ts.map' -o -name '*.js.map' \) -delete
RUN groupadd --gid 10003 yoroagent \
  && useradd --uid 10003 --gid yoroagent --home-dir /app --shell /usr/sbin/nologin --no-create-home yoroagent \
  && mkdir -p /var/lib/yoro-agent \
  && chown yoroagent:yoroagent /var/lib/yoro-agent \
  && chmod 0700 /var/lib/yoro-agent
VOLUME ["/var/lib/yoro-agent"]
USER yoroagent
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.YORO_AGENT_HEALTH_PORT+'/health/live').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/agent/dist/index.js"]
