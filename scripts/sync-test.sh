#!/usr/bin/env bash
set -euo pipefail

MODE=${MODE:-central}
CENTRAL_BASE_URL=${CENTRAL_BASE_URL:-https://staging.automatixpay.com}
BANK_API_BASE=${BANK_API_BASE:-https://bank1.automatixpay.com/api}
BANK_ID=${BANK_ID:-bank1}
ENTITY=${ENTITY:-brands}
CURSOR=${CURSOR:-0}

CERT=${CERT:-secrets/mtls/automatixpay/bank1-client.crt}
KEY=${KEY:-secrets/mtls/automatixpay/bank1-client.key}

if [[ "$MODE" == "bank" ]]; then
  if [[ -z "${TOKEN:-}" ]]; then
    echo "TOKEN requerido para modo bank" >&2
    exit 1
  fi
  payload=$(cat <<JSON
{"entity":"${ENTITY}","cursor":"${CURSOR}","bankId":"${BANK_ID}"}
JSON
)
  curl -s \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST "${BANK_API_BASE}/sync/pull" \
    -d "$payload"
  echo
  exit 0
fi

curl -s \
  --cert "$CERT" \
  --key "$KEY" \
  "${CENTRAL_BASE_URL}/sync/batch?bankId=${BANK_ID}&entity=${ENTITY}&cursor=${CURSOR}"

echo
