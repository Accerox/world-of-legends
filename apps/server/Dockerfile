FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install --workspace=@wol/server --workspace=@wol/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

# Build
RUN npm run build --workspace=@wol/server

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy built output and dependencies
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
