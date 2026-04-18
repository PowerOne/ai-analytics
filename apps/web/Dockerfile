# Monorepo root: docker build -f apps/web/Dockerfile .
# Does not copy apps/api or other apps; install is limited to the web package graph (shared + npm deps).
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_USE_MOCK=false
ENV NEXT_PUBLIC_USE_MOCK=${NEXT_PUBLIC_USE_MOCK}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/web/.env apps/web/.env

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @learning-analytics/shared build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @learning-analytics/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Runtime (docker-compose): set API_INTERNAL_URL so the Next server reaches the `api` service (not localhost).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
