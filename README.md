# Build-Empire

Production-ready MVP for a mediated appointment workflow where admin controls approvals, client can generate an AI brief, and superuser details stay privacy-masked for clients.

## Core Features

- Client signup/login and appointment request creation
- Admin login and full control dashboard
- Admin can create and manage superusers
- Client sees only superuser rank and specializations
- Appointment lifecycle states:
	- `PENDING_ADMIN_REVIEW`
	- `FORWARDED_TO_SUPERUSER`
	- `SUPERUSER_RESPONDED`
	- `APPROVED`
	- `REJECTED`
- DeepSeek-style dialogue endpoint generates:
	- `README.md` meeting brief
	- PDF attachment
- Admin can email summary attachments to superuser with status tracking
- Realtime chat with Socket.IO + offline persistence + delivery/read timestamps
- Pending-only reschedule requests
- Persistent JSON datastore with runtime data directory
- PostgreSQL migration path with schema versioning (`apps/api/migrations`)
- CI/CD pipeline for test/build + container publish (`.github/workflows/ci-cd.yml`)
- Hardened HTTPS reverse proxy profile with secret-file support

## Stack

- API: Node.js + TypeScript + Express + Socket.IO + Zod
- Web: React + TypeScript + Vite
- PDF: PDFKit
- Email: Nodemailer
- Validation/Security: rate limiting + JWT + bcrypt
- Tests: Vitest + Supertest
- Deployment: Docker + Docker Compose + Nginx

## Database Migration Path (Schema Versioning)

The app keeps JSON persistence for fast local MVP usage and now includes a PostgreSQL migration path for production evolution.

- SQL migrations live in `apps/api/migrations`
- Migration runner: `apps/api/src/migrations.ts`
- CLI command:

```bash
cd /home/givenchi/Build-Empire
npm run migrate -w @build-empire/api
```

- Optional auto-run on server start:
	- set `DATABASE_URL`
	- set `AUTO_RUN_MIGRATIONS=true`

## Local Development

```bash
cd /home/givenchi/Build-Empire
npm install
cp apps/api/.env.example apps/api/.env
npm run test
npm run build
npm run smoke
npm run dev:api
npm run dev:web
```

## Recent verification (May 16, 2026)

- Branch: `chore/nodemailer-security-fix`
- Commit: lint + build + test updates; added ESLint/Prettier configs and Postman mock test support.
- PR: https://github.com/Givforks/Build-Empire/pull/new/chore/nodemailer-security-fix

Quick verification commands (already run on CI/local):

```bash
# Run tests (API)
npm run test

# Build workspace (web + api)
npm run build

# Run Postman MCP integration tests with local mock
MCP_AUTO_MOCK=1 node FULL-STACK-HEAVY/postman-mcp-test.js
```

If you want me to open the PR description and add a changelog, tell me and I'll add it to the PR.

Web UI: `http://localhost:5173`
API: `http://localhost:4000`

## Postgres & Smoke Test

For local end-to-end validation using PostgreSQL and the smoke test harness:

- Ensure `DATABASE_URL` is set in your environment or in `apps/api/.env` (example):

```bash
export DATABASE_URL="postgres://build_empire:change-me@localhost:5432/build_empire"
export AUTO_RUN_MIGRATIONS=true
```

- Start services (Compose brings up Postgres in `docker-compose.yml`):

```bash
npm run docker:up
```

- Clear previous smoke run state (avoids signup 409 conflicts):

```bash
rm -rf apps/api/data-smoke/* || true
```

- Run the smoke test (signup -> appointment -> AI flow):

```bash
bash scripts/smoke-test.sh
```

Smoke logs are written to `apps/api/data-smoke/smoke-api.log` and the script exits non-zero on failures.

## Docker Production Run

```bash
cd /home/givenchi/Build-Empire
npm run docker:up
```

Web (Nginx): `http://localhost:8080`

Stop:

```bash
cd /home/givenchi/Build-Empire
npm run docker:down
```

## 🚀 Quick Deploy (Production)

### Local Production Validation

```bash
cd /home/givenchi/Build-Empire

# Step 1: Bootstrap (generates secrets, certs, .env)
npm run bootstrap:prod

# Step 2: Run local production stack with PostgreSQL
npm run docker:up:prod

# Step 3: Validate end-to-end flow
npm run smoke
```

**What bootstrap:prod does:**
- Creates `.env` from `.env.production.example`
- Generates cryptographically random JWT_SECRET
- Creates admin password file (`Givenchi1@@@@@`)
- Generates self-signed HTTPS certificates
- Sets secure file permissions (600)

### Deploy to Cloud (Pick One)

**Render.com** (Easiest, recommended for beginners)
```bash
npm run deploy:render
# Auto-deploys on git push via GitHub integration
```

**Fly.io** (Global edge deployment)
```bash
npm run deploy:fly
# Deploys to 6+ regions globally
```

**DigitalOcean** (Simple, predictable $5-50/month pricing)
```bash
npm run deploy:digitalocean
# YAML-based infrastructure
```

**AWS** (Maximum control, auto-scaling)
```bash
npm run deploy:aws
# ECS + RDS + ALB + CloudFront
```

### Full Deployment Guide

See [**DEPLOYMENT.md**](./DEPLOYMENT.md) for:
- Step-by-step guides for each platform
- Environment variable checklists
- Post-deployment verification
- Rollback procedures
- Troubleshooting

### Pre-Deployment Checklist

See [**PRODUCTION_CHECKLIST.md**](./PRODUCTION_CHECKLIST.md) for:
- Pre-deployment validation steps
- Platform-specific setup
- Post-deployment verification
- Incident response procedures
- Ongoing operations guidelines

## Default Admin Credentials

- Username: `GivenchiCodes`
- Password: `Givenchi1@@@@@`

Override in production by setting `ADMIN_PASSWORD_FILE` or `ADMIN_PASSWORD` env var.

## Docker Commands Reference

```bash
# Start production stack (with PostgreSQL + HTTPS)
npm run docker:up:prod

# Stop production stack
npm run docker:down:prod

# View logs
npm run docker:logs

# Validate compose config
npm run docker:config

# Clean up volumes
docker compose down -v
```

## API Surface (MVP)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`
- `GET /api/me`

### Superusers (Admin)
- `GET /api/admin/superusers`
- `POST /api/admin/superusers`

### Appointments
- `POST /api/appointments` (client)
- `GET /api/appointments`
- `POST /api/appointments/:id/reschedule` (client, pending only)
- `POST /api/admin/appointments/:id/forward` (admin)
- `POST /api/superuser/appointments/:id/respond` (superuser)
- `POST /api/admin/appointments/:id/decision` (admin)

### AI + Attachments + Email
- `POST /api/ai/deepseek` (client)
- `POST /api/admin/appointments/send-summary-email` (admin)

### Chat / Inbox
- `GET /api/inbox`
- `GET /api/chat/thread/:peerUserId`
- `POST /api/chat/send`
- `POST /api/chat/:id/read`
- Socket events: `auth:bind`, `chat:send`, `chat:message`, `chat:delivery`, `chat:read-receipt`

## Production Notes

- Runtime data persists at `apps/api/data` locally, or Docker volume in compose.
- Configure SMTP vars to send real emails. Without SMTP config, emails use transport fallback for safe testing.
- Set a strong `JWT_SECRET` for production.
- CI/CD runs tests + builds on PR and main, and publishes images to GHCR on main pushes.