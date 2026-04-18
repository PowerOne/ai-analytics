# Correct Dockerfile for @learning-analytics/api (NestJS)
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy workspace metadata
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for dependency graph resolution
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Copy actual source code
COPY packages/shared packages/shared
COPY apps/api apps/api

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build shared first
RUN pnpm --filter @learning-analytics/shared build

# Build API
RUN pnpm --filter @learning-analytics/api build

# -------------------- Runner Stage --------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy workspace metadata
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Install only production dependencies for the API
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN pnpm install --frozen-lockfile --prod --filter @learning-analytics/api

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
