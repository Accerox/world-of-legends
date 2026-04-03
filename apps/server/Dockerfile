FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install --workspace=@wol/server --workspace=@wol/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Build shared types first, then server
RUN npm run build --workspace=@wol/shared && npm run build --workspace=@wol/server

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Recreate monorepo structure for workspace symlinks to resolve
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 8080

WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
