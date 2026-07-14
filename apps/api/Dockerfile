# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma/

RUN npm ci --workspace apps/api

COPY apps/api ./apps/api/

RUN cd apps/api && npx prisma generate --schema ../../prisma/schema.prisma
RUN cd apps/api && npm run build

# Prune dev dependencies for a clean production node_modules
RUN npm prune --omit=dev --workspace apps/api

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY apps/api/package.json ./package.json

RUN addgroup -S taskeasy && adduser -S taskeasy -G taskeasy
USER taskeasy

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/src/main.js"]
