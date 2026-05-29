Demo checklist and commands for presenting Build-Empire

Quick facts
- Current runnable stack: `api` (Node/Express) + `web` (nginx serving `apps/web/dist`) + optional `postgres`.
- Default local demo uses file-based DB (safe, reproducible). Postgres migrations are available but may need extra steps.

Before the demo
1. Ensure `.env` in repo root contains secrets (I set a strong `JWT_SECRET` locally). Do NOT commit secrets.
2. Start services:

```bash
# from repo root
docker compose up -d --build
```

Health checks

```bash
# API
curl -sS http://localhost:4000/health | jq .

# Web
curl -I http://localhost:8080
```

Demo flow (clickthrough)
1. Health endpoint (show JSON ok).
2. Create a new user (signup):

```bash
curl -sS -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"demo+you@example.com","password":"StrongPassw0rd!","fullName":"Demo User","preferredDates":[{"date":"2026-06-05","timeSlots":["10:00"]}]}' | jq
```

3. Login and capture token:

```bash
TOKEN=$(curl -sS -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"demo+you@example.com","password":"StrongPassw0rd!"}' | jq -r .token)
echo $TOKEN
```

4. Create an appointment (authenticated):

```bash
curl -sS -X POST http://localhost:4000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"Demo appointment","preferredDates":[{"date":"2026-06-08","timeSlots":["09:00"]}]}' | jq
```

Postgres & migrations (optional, advanced)
- To use Postgres for a production-like demo, set `DATABASE_URL` in `.env` to a reachable Postgres instance (compose includes `postgres`).
- Apply migrations:

```bash
# Ensure postgres is up
docker compose up -d postgres

# Apply SQL migration files directly (I used this locally):
docker compose exec -T api sh -lc "cat /app/migrations/*.sql" | docker compose exec -T postgres psql -U ${POSTGRES_USER:-build_empire} -d ${POSTGRES_DB:-build_empire}
```

Verified in-container migration (simpler):

```bash
# Build and start the api (and postgres if using it)
docker compose up -d --build api postgres

# Run the migration runner inside the api container (this runs compiled runner in the image)
docker compose exec -T api sh -lc "npm run migrate"

# Confirm API is running
curl -sS http://localhost:4000/health | jq .
```

Smoke-test admin -> superuser flow (examples)

```bash
# Admin login
ADMIN_TOKEN=$(curl -sS -X POST http://localhost:4000/api/auth/admin-login -H 'Content-Type: application/json' -d '{"username":"GivenchiCodes","password":"Givenchi1@@@@@"}' | jq -r .token)

# Create a superuser (admin)
curl -sS -X POST http://localhost:4000/api/admin/superusers -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"fullName":"Demo Super","email":"su-demo@example.com","password":"SuperPass123!","rank":"Senior","specializations":["Testing"]}' | jq .

# List appointments (admin)
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:4000/api/appointments | jq .

# Forward an appointment to a superuser (replace IDs)
curl -sS -X POST http://localhost:4000/api/admin/appointments/<APPT_ID>/forward -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"superuserId":"<SUPERUSER_ID>"}' | jq .

# Superuser login & respond
SU_TOKEN=$(curl -sS -X POST http://localhost:4000/api/auth/superuser-login -H 'Content-Type: application/json' -d '{"email":"su-demo@example.com","password":"SuperPass123!"}' | jq -r .token)
curl -sS -X POST http://localhost:4000/api/superuser/appointments/<APPT_ID>/respond -H "Authorization: Bearer $SU_TOKEN" -H 'Content-Type: application/json' -d '{"accepted":true}' | jq .

# Admin finalize decision
curl -sS -X POST http://localhost:4000/api/admin/appointments/<APPT_ID>/decision -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"decision":"APPROVED","adminDecidedDateTime":"2026-05-28T18:32:04Z"}' | jq .
```

Notes & caveats
- I configured the compose setup so `DATABASE_URL` in `.env` controls whether the API uses Postgres or the file DB. For demos, file DB is simplest and fully functional.
- If you want a reproducible Postgres-backed demo, I can finalize the migration script and ensure the API login/admin flows work cleanly with Postgres.

Next options (I can do one):
- Finalize Postgres-backed demo (fix DB adapter mapping, run migrations, seed data). — more realistic but extra work.
- Produce a short slide/script and commands for the presentation (I can produce a one-page script). — low-risk.
- Build production images for `api` and `web` and run a full `docker compose up --build` demo. — higher effort.

Contact me which option you prefer and I'll proceed.
