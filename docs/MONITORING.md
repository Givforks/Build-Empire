# Monitoring & Alerts

This document explains how to configure Sentry and basic alerting for Build-Empire.

- Sentry DSN: set `SENTRY_DSN` as a secret in your production environment and in GitHub Actions (`Secrets`).
- Sentry release tracking: set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` in GitHub Secrets so CI can publish releases and upload source maps.
- GitHub Actions: the `ci-cd.yml` workflow includes an optional step to run database migrations when `DATABASE_URL` secret is present.

Quick setup:

1. Create a Sentry project for Build-Empire.
2. Copy the DSN and add it to your production environment variables as `SENTRY_DSN` and to GitHub Secrets.
3. Configure alert rules in Sentry to notify your team (Slack, email, or webhook).
4. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` secrets to publish releases from CI.

Recommended alerting rules:

- New issue severity: error -> notify on-call Slack channel
- Regression detection: notify via email + create ticket in tracker
- Deployment health: set release tracking via GitHub releases and Sentry releases

Local development:

- Do not set `SENTRY_DSN` locally; the server safely skips initialization when DSN is missing.

Migrations:

- To run migrations manually: from repository root run `npm run migrate -w @build-empire/api` with `DATABASE_URL` env set.
- CI: the workflow will run migrations automatically if `DATABASE_URL` secret is configured in the repo.

If you want, I can add a Sentry release step to CI to create releases and upload source maps.
