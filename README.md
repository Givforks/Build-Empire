# Build-Empire MVP

Lean appointment MVP with:

- Client signup/login
- Admin login and approval flow
- Appointment request lifecycle
- AI summary generation saved as README.md attachment
- Basic role privacy masking for superuser information
- Pending-only reschedule request support
- Real-time admin-client chat with offline persistence (in-memory for MVP)

## Stack

- API: Node.js, TypeScript, Express, Socket.IO, Zod
- Web: React, TypeScript, Vite
- Tests: Vitest + Supertest (API)

## Quick Start

```bash
cd /home/givenchi/Build-Empire
npm install
npm run test
npm run dev:api
npm run dev:web
```

## Default Admin

- Username: `GivenchiCodes`
- Password: `Givenchi1@@@@@`

## API Highlights

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/admin-login`
- `POST /api/appointments`
- `GET /api/appointments`
- `POST /api/appointments/:id/reschedule`
- `POST /api/admin/appointments/:id/decision`
- `POST /api/ai/deepseek`
- Socket namespace: default, event `chat:send`

## Notes

- This MVP uses in-memory storage for fast validation.
- AI endpoint falls back to deterministic local summary when `OPENAI_API_KEY` is not set.
- Generated files are stored in `apps/api/data/`.