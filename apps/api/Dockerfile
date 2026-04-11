FROM node:20-bullseye AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# 1. Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# 2. Copy ALL workspace code BEFORE install
COPY packages ./packages
COPY apps ./apps

# 3. Install dependencies
RUN pnpm install --frozen-lockfile

# 4. Generate Prisma client (prisma CLI is a devDependency of @learning-analytics/api, not the root)
RUN pnpm --filter @learning-analytics/api run prisma:generate

# 5. Build shared + API
RUN pnpm --filter @learning-analytics/shared run build
RUN pnpm --filter @learning-analytics/api run build

# 6. Prune dev dependencies
RUN pnpm prune --prod

# ---------------- Runner Stage ----------------

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

EXPOSE 3001
ENTRYPOINT ["/bin/sh", "/app/apps/api/docker-entrypoint.sh"]
