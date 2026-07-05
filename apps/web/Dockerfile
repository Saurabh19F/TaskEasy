FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/web/package*.json ./apps/web/
COPY package*.json ./

RUN npm ci --workspace apps/web

COPY apps/web ./apps/web/

RUN cd apps/web && npm run build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S taskeasy && adduser -S taskeasy -G taskeasy

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static

USER taskeasy
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
