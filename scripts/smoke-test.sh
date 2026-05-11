#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="4010"
DATA_DIR="./apps/api/data-smoke"
LOG_FILE="./apps/api/data-smoke/smoke-api.log"
mkdir -p "$DATA_DIR"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

PORT="$API_PORT" \
JWT_SECRET="smoke-secret-123456" \
ADMIN_USERNAME="GivenchiCodes" \
ADMIN_PASSWORD="Givenchi1@@@@@" \
DATA_DIR="$DATA_DIR" \
node ./apps/api/dist/index.js >"$LOG_FILE" 2>&1 &
API_PID=$!

for _ in {1..25}; do
  if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.4
 done

HEALTH="$(curl -fsS "http://localhost:${API_PORT}/health")"
if [[ -z "$HEALTH" ]]; then
  echo "Health check failed"
  exit 1
fi

SIGNUP_JSON="$(curl -fsS -X POST "http://localhost:${API_PORT}/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-client@example.com","password":"ClientPass123!","fullName":"Smoke Client","preferredDates":[{"date":"2026-08-10","timeSlots":["10:00"]}]}'
)"

TOKEN="$(printf '%s' "$SIGNUP_JSON" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(d.token||"")')"
if [[ -z "$TOKEN" ]]; then
  echo "Failed to obtain token"
  exit 1
fi

APPOINTMENT_JSON="$(curl -fsS -X POST "http://localhost:${API_PORT}/api/appointments" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"topic":"Smoke test appointment for product strategy validation.","preferredDates":[{"date":"2026-08-11","timeSlots":["11:00"]}]}'
)"

APPOINTMENT_ID="$(printf '%s' "$APPOINTMENT_JSON" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(d.id||"")')"
if [[ -z "$APPOINTMENT_ID" ]]; then
  echo "Failed to create appointment"
  exit 1
fi

AI_JSON="$(curl -fsS -X POST "http://localhost:${API_PORT}/api/ai/deepseek" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"appointmentId\":\"${APPOINTMENT_ID}\",\"prompt\":\"I need to discuss market strategy, team alignment, and launch sequencing.\"}"
)"

ATTACH_COUNT="$(printf '%s' "$AI_JSON" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(String((d.attachments||[]).length))')"
if [[ "$ATTACH_COUNT" -lt 2 ]]; then
  echo "AI output missing attachments"
  exit 1
fi

echo "Smoke test passed."
echo "Health: $HEALTH"
echo "Appointment: $APPOINTMENT_ID"
