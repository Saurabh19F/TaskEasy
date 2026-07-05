# TaskEasy — Local Development Quickstart

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| MongoDB | ≥ 7 (Community) | https://www.mongodb.com/try/download/community |
| Redis | ≥ 7 | https://redis.io/docs/install/ (or use Docker) |

> **Quick Redis via Docker** (if you don't want to install Redis natively):
> ```bash
> docker run -d -p 6379:6379 --name redis redis:7-alpine
> ```

---

## 1 — Clone & install

```bash
git clone <your-repo-url>
cd TaskEasyApp
npm install
```

---

## 2 — Configure environment

### API (`apps/api/.env`)

Copy the file already provided and fill in real values:

```
# Database
DATABASE_URL="mongodb://127.0.0.1:27017/taskeasy"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=4000
NODE_ENV=development

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-me
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-change-me
JWT_REFRESH_EXPIRES_IN=30d

# Cloudinary (upload optional — app works without it)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

```

### Web (`apps/web/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
```

---

## 3 — Start MongoDB

Make sure mongod is running locally:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB
```

---

## 4 — Generate Prisma client & push schema

```bash
cd apps/api
npx prisma generate
npx prisma db push
```

---

## 5 — Create your first users

Use the app's admin/user management flows to create your initial tenant users, projects, hierarchy, and workflow records.

---

## 6 — Start the servers

Open two terminals:

**Terminal 1 — API (NestJS)**
```bash
cd apps/api
npm run start:dev
```
→ API ready at http://localhost:4000/api  
→ Swagger docs at http://localhost:4000/docs

**Terminal 2 — Web (Next.js)**
```bash
cd apps/web
npm run dev
```
→ App ready at http://localhost:3000

---

## 7 — Login

Open http://localhost:3000 and log in with the users you created in the admin screens.

---

## Useful commands

```bash
# Prisma Studio (visual DB browser)
cd apps/api && npx prisma studio

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build
```

---

## Troubleshooting

**`Cannot connect to MongoDB`**  
→ Make sure `mongod` is running and `DATABASE_URL` matches the port.

**`Redis connection refused`**  
→ Start Redis or the Docker container: `docker start redis`

**`Module not found` errors after pull**  
→ Run `npm install` again from the root.

**`Prisma: Unknown field` errors**  
→ Run `npx prisma generate` inside `apps/api` to regenerate the client.

**WebSocket not connecting**  
→ Make sure both API (port 4000) and web (port 3000) are running and `NEXT_PUBLIC_API_URL` is set correctly.
