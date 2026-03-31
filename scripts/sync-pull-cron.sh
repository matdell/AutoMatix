#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../.sync-cron.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

require_var() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env var: ${key}" >&2
    exit 1
  fi
}

require_var "BANK_API_BASE_URL"
require_var "LOGIN_EMAIL"
require_var "LOGIN_PASSWORD"
require_var "BANK_SLUG"
require_var "BANK_ID"

ENTITIES="${ENTITIES:-brands}"

now() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

log() {
  echo "[$(now)] $*"
}

LOGIN_PAYLOAD="$(cat <<JSON
{"email":"${LOGIN_EMAIL}","password":"${LOGIN_PASSWORD}","bankSlug":"${BANK_SLUG}"}
JSON
)"

LOGIN_RESPONSE="$(
  curl -sS --max-time 30 \
    -X POST "${BANK_API_BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "${LOGIN_PAYLOAD}"
)"

TOKEN="$(
  echo "${LOGIN_RESPONSE}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);if(j.requiresTwoFactor){process.stderr.write("LOGIN_REQUIRES_2FA\n");process.exit(2)}process.stdout.write(j.accessToken||"")}catch{process.exit(1)}});'
)"

if [[ -z "${TOKEN}" ]]; then
  log "login failed: ${LOGIN_RESPONSE}"
  exit 1
fi

for entity in ${ENTITIES}; do
  PULL_PAYLOAD="$(cat <<JSON
{"entity":"${entity}","cursor":"0","bankId":"${BANK_ID}"}
JSON
)"

  PULL_RESPONSE="$(
    curl -sS --max-time 30 \
      -X POST "${BANK_API_BASE_URL}/sync/pull" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${PULL_PAYLOAD}"
  )"

  STATUS_CODE="$(
    echo "${PULL_RESPONSE}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(String(j.statusCode||""))}catch{process.stdout.write("")}});'
  )"
  BATCH_ID="$(
    echo "${PULL_RESPONSE}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.data&&j.data.batchId)||"")}catch{process.stdout.write("")}});'
  )"

  if [[ "${STATUS_CODE}" != "200" || -z "${BATCH_ID}" ]]; then
    log "pull ${entity} failed: ${PULL_RESPONSE}"
    continue
  fi

  ACK_PAYLOAD="$(cat <<JSON
{"entity":"${entity}","batchId":"${BATCH_ID}","cursor":"0","status":"ACK","bankId":"${BANK_ID}"}
JSON
)"

  ACK_RESPONSE="$(
    curl -sS --max-time 30 \
      -X POST "${BANK_API_BASE_URL}/sync/ack" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${ACK_PAYLOAD}"
  )"

  ACK_STATUS="$(
    echo "${ACK_RESPONSE}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(String(j.statusCode||""))}catch{process.stdout.write("")}});'
  )"

  if [[ "${ACK_STATUS}" != "200" ]]; then
    log "ack ${entity} failed: ${ACK_RESPONSE}"
    continue
  fi

  log "sync ${entity} ok batch=${BATCH_ID}"
done
