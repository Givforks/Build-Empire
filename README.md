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

## Stack

- API: Node.js + TypeScript + Express + Socket.IO + Zod
- Web: React + TypeScript + Vite
- PDF: PDFKit
- Email: Nodemailer
- Validation/Security: rate limiting + JWT + bcrypt
- Tests: Vitest + Supertest
- Deployment: Docker + Docker Compose + Nginx

## Local Development

```bash
cd /home/givenchi/Build-Empire
npm install
cp apps/api/.env.example apps/api/.env
npm run test
npm run dev:api
npm run dev:web
```

Web UI: `http://localhost:5173`
API: `http://localhost:4000`

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

## Default Admin Credentials

- Username: `GivenchiCodes`
- Password: `Givenchi1@@@@@`

Override in production using compose/env vars.

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