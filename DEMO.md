Demo & Quick Start
==================

This file contains quick steps to run the Build-Empire demo locally and produce release artifacts.

Run locally (development)
-------------------------

1. Install dependencies:

   npm install

2. Start the API (dev/watch):

   npm run dev:api

3. Start the web (dev):

   npm run dev:web

Build for production / Preview
------------------------------

1. Build API and Web:

   npm run build -w @build-empire/api
   npm run build -w @build-empire/web

2. Start API (from dist):

   npm run start:api

3. Preview web build (vite preview):

   npm run preview -w @build-empire/web

Smoke test (end-to-end)
-----------------------

Run the included smoke script which will start the API on a temporary port, exercise signup, appointment creation, and AI endpoints:

   npm run smoke

Release artifacts
-----------------

- A release ZIP containing `apps/api/dist` and `apps/web/dist` is at `releases/build-empire-release.zip`.

Docker / Deployment
-------------------

This repo includes `docker-compose.yml` and `docker-compose.prod.yml`. To use Docker you must have Docker Engine available and the daemon running. Example:

   docker compose up -d --build

If Docker is not available locally (seen during automated checks), build artifacts are provided in `releases/` for manual handoff.

Ports
-----

- API default: http://localhost:4000 (production start)
- Smoke API (temporary): http://localhost:4010 (used by `npm run smoke`)
- Web preview: http://localhost:4173/

Notes
-----
- Formatting was applied with Prettier across the repository.
- If you want me to commit and push these changes and create a GitHub release/tag, say so and I will do it.
