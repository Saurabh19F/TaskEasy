# TaskEasy — DevOps Engineer Audit (Refreshed 2026-07-02)

**Role:** DevOps · **Scope:** Docker · CI/CD · Deploy · Monitoring · Secrets

**Verification method:** Static audit of `docker-compose.yml`, `apps/{api,web}/Dockerfile`, `.github/workflows/ci.yml`, `.gitignore`, `apps/api/.env.example`.

---

## 1. Infra Snapshot

| Piece | Location | State |
|---|---|---|
| Local dev stack | `docker-compose.yml` | ✅ mongo7, redis7, api, web — healthchecks present |
| API image | `apps/api/Dockerfile` | ✅ multi-stage, non-root, node:20-alpine |
| Web image | `apps/web/Dockerfile` | ✅ multi-stage, non-root, standalone Next output |
| CI | `.github/workflows/ci.yml` | ✅ 4 jobs: api, web, docker, e2e |
| Env template | `apps/api/.env.example` | ✅ complete (73 lines) |
| Cloud target | Not committed | 🔴 Missing |
| Monitoring | Not committed | 🔴 Missing |
| Secrets mgmt | Not committed | 🔴 Missing |
| Backup policy | Not committed | 🔴 Missing |

---

## 2. Critical / High DevOps Issues

### 🔴 DO-01 — Real `.env` file committed in repo
- **File:** `apps/api/.env` (visible in the directory listing).
- `.gitignore` excludes `.env` and `apps/**/.env` — so it's untracked locally, but **verify with `git ls-files apps/api/.env`** before demo. If it was ever committed historically, secrets are in git history.
- **Fix:** Run `git log --all -- apps/api/.env`. If any commit exists, rotate every secret in that file (JWT, SMTP, Cloudinary, WhatsApp token, Google service account, Mistral) and use `git filter-repo` to purge history.

### 🔴 DO-02 — No production deployment target committed
- No `railway.json`, `render.yaml`, `vercel.json`, or Terraform.
- Manual deploy = each release re-invents wheels; drift guaranteed.
- **Fix:** Choose one PaaS (Railway is a natural fit for Nest+Redis+Mongo, Vercel for Next). Commit:
  - `railway.json` for API + BullMQ worker.
  - `vercel.json` for Web with env references.
  - `.env.production.example` documenting production env vars.

### 🔴 DO-03 — No monitoring / observability
- No Sentry, Datadog, New Relic, or logging aggregator config.
- Once deployed, first error will be discovered by a user, not you.
- **Fix (minimum):**
  - Add `@sentry/nestjs` to API (`main.ts` init + APP_FILTER for error capture).
  - Add `@sentry/nextjs` to Web (`sentry.client.config.ts` + `sentry.server.config.ts`).
  - Point both to a project DSN via env; free tier is enough for launch.

### 🔴 DO-04 — CI `next lint` swallows failures
- [ci.yml:101](.github/workflows/ci.yml:101): `npx next lint --max-warnings 0 || true`
- The trailing `|| true` makes lint failures pass silently.
- **Fix:** Remove `|| true`. If there are existing violations, fix them or add an explicit `.eslintignore` for legacy files, but do not silently swallow.

### 🟡 DO-05 — Dockerfiles lack `HEALTHCHECK`
- Compose has host-level healthchecks but the images don't. When deployed to Kubernetes or Railway, orchestrators can't self-heal.
- **Fix:**
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:4000/health || exit 1
  ```
- Also verify `/health` endpoint exists in `apps/api/src/main.ts` or an `AppController`.

### 🟡 DO-06 — API Dockerfile copies whole `apps/api/` context — including `.env` if present
- Build context is `./apps/api`. If a developer runs `docker build` locally after creating `.env`, it will be included in the layer.
- **Fix:** Add `apps/api/.dockerignore` with `.env*`, `node_modules`, `dist`, `test`, `coverage`.
- Do the same for `apps/web/.dockerignore`.

### 🟡 DO-07 — E2E job runs only on `main` — regressions land pre-merge undetected
- [ci.yml:154](.github/workflows/ci.yml:154): `if: github.ref == 'refs/heads/main'`
- PRs merge without E2E; regressions only detected after merge.
- **Fix:** Move E2E to run on PR as well; if too slow, keep a "smoke" subset that runs on PR and full on main.

### 🟡 DO-08 — CI Node version pinned to major 20 only, no lockfile-version guarantee
- `actions/setup-node@v4` with `node-version: '20'` picks any 20.x → non-reproducible builds.
- **Fix:** Pin to `.nvmrc` file at repo root and reference it in setup-node.

### 🟡 DO-09 — No DB backup automation
- Mongo Atlas free tier includes automated snapshots, but nothing in this repo documents it.
- **Fix:** In `ARCHITECTURE.md` (or `RUNBOOK.md` — new file), document Atlas snapshot policy, retention, and manual restore steps.

### 🟢 DO-10 — Docker-compose secrets hardcoded
- Mongo password `taskeasy_dev` inline in compose.
- Fine for local dev. Add a `.env` template alongside compose (`.env.docker.example`) for team consistency.

### 🟢 DO-11 — No cache warming or graceful shutdown
- BullMQ workers should trap SIGTERM and finish in-flight jobs.
- **Fix:** In `queue/*.processor.ts`, register `worker.on('closing')` and drain.

### 🟢 DO-12 — Playwright artifact upload set to 7 days
- May be too short for post-mortem on flaky tests. Set to 30 days.

---

## 3. Deploy-Readiness Checklist

Before staging deploy:

- [ ] `apps/api/.env.production` prepared (from `.env.example`).
- [ ] `apps/web/.env.production` prepared with `NEXT_PUBLIC_API_URL` pointing to staging API.
- [ ] JWT_SECRET is 64+ random chars, not the `.env.example` placeholder.
- [ ] JWT_REFRESH_SECRET is different from JWT_SECRET.
- [ ] Cloudinary account created, keys added.
- [ ] Email provider chosen (SMTP / SendGrid / SES) and credentials tested.
- [ ] Mongo Atlas cluster provisioned; IP allowlist includes deploy host.
- [ ] Redis provisioned (Upstash / Redis Cloud); URL configured.
- [ ] `SEED_*` credentials for first admin login (or run seed script and delete after).
- [ ] `.dockerignore` files added (DO-06).
- [ ] Sentry DSNs configured (DO-03).
- [ ] `/health` endpoint verified reachable.

Before production deploy:

- [ ] Load test on staging (100 concurrent users, dashboard read).
- [ ] Backup + restore drill (drop a collection on staging Mongo, restore from snapshot).
- [ ] Rate-limit thresholds sanity-checked in Throttler config.
- [ ] Rollback plan documented (previous image tag, DB migration reversibility).
- [ ] Monitoring alerts wired (Sentry error rate, Mongo Atlas alerts, Redis memory).
- [ ] Log retention policy (Cloudwatch/Loki/etc.) 30+ days.
- [ ] SSL/TLS cert via PaaS auto-provision.
- [ ] Uptime monitoring (BetterUptime / UptimeRobot free tier) hitting `/health`.

---

## 4. Suggested `.env.production` Structure (safe placeholder)

```dotenv
DATABASE_URL=mongodb+srv://<prod-user>:<prod-pass>@<prod-cluster>/taskeasy?retryWrites=true&w=majority
REDIS_HOST=<upstash-host>
REDIS_PORT=6379
REDIS_PASSWORD=<upstash-password>
JWT_SECRET=<64-char-random>
JWT_REFRESH_SECRET=<different-64-char-random>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://app.taskeasy.example
SENTRY_DSN=<from-sentry>
SEED_SUPER_ADMIN_EMAIL=<real-email>
SEED_SUPER_ADMIN_PASSWORD=<one-time-strong-password>
# Delete SEED_* after first login.
```

---

## 5. Fix Roadmap (DevOps)

Sprint 4 (before demo):

1. **DO-01** Verify `.env` never committed; rotate any leaked secrets.
2. **DO-02** Commit at least one deployment target (Railway or Render for API + Vercel for Web).
3. **DO-03** Wire Sentry to API + Web with free-tier DSNs.
4. **DO-04** Remove `|| true` from `next lint` and fix violations.
5. **DO-05** Add `HEALTHCHECK` to both Dockerfiles + create `/health` route if missing.
6. **DO-06** Add `.dockerignore` to both apps.
7. **DO-08** Add `.nvmrc` pinning `20.x.y`.

Post-demo:

8. **DO-07** Move E2E smoke tests to PR pipeline.
9. **DO-09** Document backup/restore runbook.
10. **DO-11** BullMQ graceful-shutdown handlers.
11. Migrate secrets to a manager (Doppler, AWS Secrets Manager, or hosted PaaS env).
12. Add CI job publishing coverage badge to README.

---

## 6. DevOps Sign-off Gates

- [ ] `docker compose up -d` starts full local stack cleanly.
- [ ] CI is green on `main`; all 4 jobs pass.
- [ ] `git ls-files` shows no `.env*` file in the tree.
- [ ] Both Docker images build under 500 MB.
- [ ] Sentry receives a synthetic error from both API and Web in staging.
- [ ] Deploy runs from a fresh `git clone` with a single command per app.
- [ ] Rollback tested end-to-end.

---

*Document Owner: DevOps Engineer · Last Refreshed: 2026-07-02 · Version: 2.0*
