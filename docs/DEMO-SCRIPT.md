5-minute Demo Script
====================

Goal: Show a concise user flow demonstrating signup, appointment creation, and AI summary.

Preparation (1 minute)
- Start containers (local) or use docker compose (we have images):

  docker compose up -d --build

- Confirm services:
  - API: http://localhost:4000 (or http://localhost:4010 for smoke)
  - Web: http://localhost:8080

Live demo steps (3 minutes)
1. Open the web app at http://localhost:8080. Briefly show homepage and navigation.
2. Click "Sign up" — create an account (email: demo@example.com, password: DemoPass123!).
3. Create a new appointment: fill topic and preferred date/time; submit.
4. Show the appointment in the user's dashboard and trigger the AI summary (or click "Generate AI summary").
5. Open generated AI brief (downloads/attachments) and highlight key points.

Wrap-up (1 minute)
- Explain architecture: API (Node/Express), Web (Vite/React), Postgres, Docker.
- Mention artifacts: `releases/build-empire-release.zip`, GitHub release `v0.1.0-demo`.
- Next steps: CI/CD image publish, monitoring, backups, and security hardening.
