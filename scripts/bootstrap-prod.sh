#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p secrets infra/certs

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example"
fi

if [[ ! -f secrets/jwt_secret.txt ]]; then
  openssl rand -hex 32 > secrets/jwt_secret.txt
  echo "Generated secrets/jwt_secret.txt"
fi

if [[ ! -f secrets/admin_password.txt ]]; then
  echo "Givenchi1@@@@@" > secrets/admin_password.txt
  echo "Generated secrets/admin_password.txt"
fi

if [[ ! -f secrets/smtp_password.txt ]]; then
  echo "change-me" > secrets/smtp_password.txt
  echo "Generated secrets/smtp_password.txt"
fi

if [[ ! -f infra/certs/fullchain.pem || ! -f infra/certs/privkey.pem ]]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
    -keyout infra/certs/privkey.pem \
    -out infra/certs/fullchain.pem \
    -subj "/CN=localhost"
  echo "Generated self-signed TLS certs in infra/certs"
fi

chmod 600 secrets/*.txt

echo "Bootstrap complete."
echo "Next: npm run docker:up:prod"
