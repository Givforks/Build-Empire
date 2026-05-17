Deployment & Monitoring Notes
============================

Monitoring
----------
- Sentry is already included via `@sentry/node` in the API; set `SENTRY_DSN` in production environment to enable error reporting.
- Collect simple access and health logs (written to `logs/access.log` and `logs/health.log`). Consider piping these to a central log system (CloudWatch/ELK).
- For metrics, add Prometheus exporter or use a hosted APM.

Deployment
----------
- Docker Compose is provided (`docker-compose.yml`) for simple deployments.
- For production, build and push images using the `Publish Docker Images` workflow (GHCR).
- Use the example env vars in `DEMO.md` and `SECRETS.md` to configure production secrets.

Health checks
-------------
- The API exposes `/health` which returns `{ ok: true, env, time }`.
- Configure your orchestrator (Kubernetes, ECS) to use `/health` as a readiness/liveness probe.
