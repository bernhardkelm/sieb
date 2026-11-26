# syntax=docker/dockerfile:1
# The build stage runs on the build platform, its pruned production node_modules hold no native
# modules, so the runtime stage of every target platform can copy them.

FROM --platform=$BUILDPLATFORM node:26.13.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build-only && npm prune --omit=dev

FROM node:26.13.0-alpine3.24
ENV NODE_ENV=production \
    SIEB_SOURCE=incluster \
    SIEB_HOST=0.0.0.0 \
    SIEB_PORT=3100 \
    SIEB_DB_PATH=/data/sieb.db
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY src/core ./src/core
COPY src/server ./src/server
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO /dev/null "http://127.0.0.1:${SIEB_PORT}/api/health" || exit 1
CMD ["node", "src/server/main.ts"]
