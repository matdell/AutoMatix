#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/ux-functional-smoke.env}"

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

require_var "BANK1_API_BASE"
require_var "BANK1_EMAIL"
require_var "BANK1_PASSWORD"
require_var "BANK1_SLUG"
require_var "DEVBANK_API_BASE"
require_var "DEVBANK_EMAIL"
require_var "DEVBANK_PASSWORD"
require_var "DEVBANK_SLUG"

post_json() {
  local url="$1"
  local payload="$2"
  local token="${3:-}"
  if [[ -n "$token" ]]; then
    curl -sS -w "\n%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${token}" \
      -d "$payload"
  else
    curl -sS -w "\n%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$payload"
  fi
}

get_json() {
  local url="$1"
  local token="$2"
  curl -sS -w "\n%{http_code}" -X GET "$url" -H "Authorization: Bearer ${token}"
}

extract_code() { tail -n 1; }
extract_body() { sed '$d'; }

json_count() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const a=JSON.parse(d);process.stdout.write(String(Array.isArray(a)?a.length:0))}catch{process.stdout.write("0")}})'
}

json_token() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(j.accessToken||"")}catch{}})'
}

json_first_bank_id() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const a=JSON.parse(d);process.stdout.write((a[0]&&a[0].id)||"")}catch{}})'
}

json_first_merchant_id() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const a=JSON.parse(d);process.stdout.write((a[0]&&a[0].id)||"")}catch{}})'
}

json_bank_extended_fields_ok() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const a=JSON.parse(d);const b=a[0]||{};const req=["nombre","slug","nombreCompleto","razonSocial","cuit","direccionCasaMatriz","paymentMethods","fechaAlta"];const ok=req.every(k=>Object.prototype.hasOwnProperty.call(b,k));process.stdout.write(ok?"1":"0")}catch{process.stdout.write("0")}})'
}

login() {
  local base="$1"
  local email="$2"
  local pass="$3"
  local slug="$4"
  local payload
  payload="$(cat <<JSON
{"email":"${email}","password":"${pass}","bankSlug":"${slug}"}
JSON
)"
  local resp code body token
  resp="$(post_json "${base}/auth/login" "${payload}")"
  code="$(echo "${resp}" | extract_code)"
  body="$(echo "${resp}" | extract_body)"
  token="$(echo "${body}" | json_token)"
  echo "${code}|${token}|${body}"
}

FAILS=0

assert_eq() {
  local actual="$1"
  local expected="$2"
  local name="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: ${name}"
  else
    echo "FAIL: ${name} (expected ${expected}, got ${actual})"
    FAILS=$((FAILS + 1))
  fi
}

assert_ge() {
  local actual="$1"
  local expected="$2"
  local name="$3"
  if [[ "$actual" -ge "$expected" ]]; then
    echo "PASS: ${name}"
  else
    echo "FAIL: ${name} (expected >= ${expected}, got ${actual})"
    FAILS=$((FAILS + 1))
  fi
}

echo "Running UX/functional smoke tests..."

R="$(login "${BANK1_API_BASE}" "${BANK1_EMAIL}" "${BANK1_PASSWORD}" "${BANK1_SLUG}")"
BANK1_CODE="${R%%|*}"
REST="${R#*|}"
BANK1_TOKEN="${REST%%|*}"
assert_eq "${BANK1_CODE}" "201" "Login bank1"
if [[ -z "${BANK1_TOKEN}" ]]; then
  echo "FAIL: Token bank1 vacio"
  FAILS=$((FAILS + 1))
else
  echo "PASS: Token bank1 generado"
fi

R="$(login "${DEVBANK_API_BASE}" "${DEVBANK_EMAIL}" "${DEVBANK_PASSWORD}" "${DEVBANK_SLUG}")"
DEVBANK_CODE="${R%%|*}"
REST="${R#*|}"
DEVBANK_TOKEN="${REST%%|*}"
assert_eq "${DEVBANK_CODE}" "201" "Login devbank"
if [[ -z "${DEVBANK_TOKEN}" ]]; then
  echo "FAIL: Token devbank vacio"
  FAILS=$((FAILS + 1))
else
  echo "PASS: Token devbank generado"
fi

R="$(login "${BANK1_API_BASE}" "${DEVBANK_EMAIL}" "${DEVBANK_PASSWORD}" "${DEVBANK_SLUG}")"
CROSS_CODE="${R%%|*}"
assert_eq "${CROSS_CODE}" "401" "Aislamiento login cross-tenant"

RESP="$(get_json "${BANK1_API_BASE}/banks" "${BANK1_TOKEN}")"
CODE="$(echo "${RESP}" | extract_code)"
assert_eq "${CODE}" "403" "Permisos /banks para BANK_ADMIN"

RESP="$(get_json "${DEVBANK_API_BASE}/banks" "${DEVBANK_TOKEN}")"
CODE="$(echo "${RESP}" | extract_code)"
BODY="$(echo "${RESP}" | extract_body)"
assert_eq "${CODE}" "200" "Listar bancos devbank"
BANKS_COUNT="$(echo "${BODY}" | json_count)"
assert_ge "${BANKS_COUNT}" 1 "Hay al menos un banco en devbank"
BANK_ID="$(echo "${BODY}" | json_first_bank_id)"
EXTENDED_FIELDS_OK="$(echo "${BODY}" | json_bank_extended_fields_ok)"
assert_eq "${EXTENDED_FIELDS_OK}" "1" "Campos extendidos de bancos presentes en API"

RESP="$(get_json "${DEVBANK_API_BASE}/users?bankId=${BANK_ID}" "${DEVBANK_TOKEN}")"
CODE="$(echo "${RESP}" | extract_code)"
BODY="$(echo "${RESP}" | extract_body)"
assert_eq "${CODE}" "200" "Listar usuarios por bankId"
echo "INFO: usuarios devbank=$(echo "${BODY}" | json_count)"

RESP="$(get_json "${DEVBANK_API_BASE}/brands?bankId=${BANK_ID}" "${DEVBANK_TOKEN}")"
CODE="$(echo "${RESP}" | extract_code)"
BODY="$(echo "${RESP}" | extract_body)"
assert_eq "${CODE}" "200" "Listar marcas por bankId"
echo "INFO: marcas devbank=$(echo "${BODY}" | json_count)"

RESP="$(get_json "${DEVBANK_API_BASE}/merchants?bankId=${BANK_ID}" "${DEVBANK_TOKEN}")"
CODE="$(echo "${RESP}" | extract_code)"
BODY="$(echo "${RESP}" | extract_body)"
assert_eq "${CODE}" "200" "Listar razones sociales por bankId"
echo "INFO: razones-sociales devbank=$(echo "${BODY}" | json_count)"
MERCHANT_ID="$(echo "${BODY}" | json_first_merchant_id)"

if [[ -n "${MERCHANT_ID}" ]]; then
  RESP="$(get_json "${DEVBANK_API_BASE}/merchants/${MERCHANT_ID}/branches" "${DEVBANK_TOKEN}")"
  CODE="$(echo "${RESP}" | extract_code)"
  BODY="$(echo "${RESP}" | extract_body)"
  assert_eq "${CODE}" "200" "Listar PDV por razon social"
  echo "INFO: pdv primer razon-social=$(echo "${BODY}" | json_count)"
else
  echo "INFO: sin razones sociales para validar endpoint de PDV"
fi

if [[ "${FAILS}" -eq 0 ]]; then
  echo "RESULT: OK (0 fallas)"
else
  echo "RESULT: FAIL (${FAILS} fallas)"
  exit 1
fi

