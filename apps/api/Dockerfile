# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/api/package*.json ./apps/api/
COPY prisma ./prisma/
COPY package*.json ./

RUN npm ci --workspace apps/api

COPY apps/api ./apps/api/

RUN cd apps/api && npx prisma generate --schema ../../prisma/schema.prisma
RUN cd apps/api && npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY apps/api/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

RUN addgroup -S taskeasy && adduser -S taskeasy -G taskeasy
USER taskeasy

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/main"]
