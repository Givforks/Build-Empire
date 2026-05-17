Deployment Runbook (Minimal)
============================

Purpose: steps to deploy and rollback the Build-Empire service using Docker Compose and GHCR images.

Prerequisites
- Docker Engine and Docker Compose
- Environment secrets set (see `docs/SECRETS.md`)

Deploy (simple)
---------------
1. Pull latest images (from GHCR):

   docker pull ghcr.io/<owner>/build-empire-api:latest
   docker pull ghcr.io/<owner>/build-empire-web:latest

2. Update `docker-compose.yml` to reference image tags instead of build (optional).

3. Start services:

   docker compose up -d

Rollback
--------
1. Identify previous working tag (from registry or GitHub release).
2. Update `docker-compose.yml` image tag to the previous tag and run:

   docker compose pull
   docker compose up -d

Health checks
-------------
- Use `/health` for readiness and `/metrics` for monitoring.
