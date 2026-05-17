Secrets & Environment Configuration
=================================

Store secrets in your environment or a secrets manager (do NOT commit to the repo).

Recommended GitHub Secrets:
- `JWT_SECRET` — JWT signing secret
- `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` — DB creds for production
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — email sending
- `SENTRY_DSN` — Sentry project DSN for error tracking
- `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` — if using Docker Hub (optional)

Local development:
- Use a `.env` file (gitignored). Example `.env`:

  NODE_ENV=development
  PORT=4000
  JWT_SECRET=change-me-locally
  DATABASE_URL=postgresql://build_empire:change-me@localhost:5432/build_empire

Never store production secrets in plaintext in the repo or docs.
