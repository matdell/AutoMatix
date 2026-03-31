# VPS PoC Central + Bank (automatixpay.com)

## Objetivo
Prueba funcional en un unico VPS para validar sync central <-> banco con mTLS y dominios separados.
No representa aislamiento real para produccion.

## Dominios
- Central: https://dev.automatixpay.com
- Banco: https://bank1.automatixpay.com
- Central staging: https://staging.automatixpay.com
- Banco staging: https://bankstaging.automatixpay.com

Nota: los dominios staging requieren que existan los registros DNS A/AAAA.

## Servicios
- Bank API: 3001 (PM2 `dev-bank-api`)
- Bank Web: 3000 (PM2 `dev-bank-web`)
- Central API: 4001 (PM2 `dev-bank-central`)

## Certificados
- Certificados publicos: Let's Encrypt por dominio.
- mTLS: CA interna para validar clientes en /sync/*.

Ubicacion sugerida en VPS
- /etc/nginx/ssl/automatixpay/
  - ca.crt
  - ca.key
  - bank1-client.crt
  - bank1-client.key

Copias locales (este repo, ignorado por git)
- secrets/mtls/automatixpay/ca.crt
- secrets/mtls/automatixpay/bank1-client.crt
- secrets/mtls/automatixpay/bank1-client.key
- secrets/mtls/automatixpay/bankstaging-client.crt
- secrets/mtls/automatixpay/bankstaging-client.key

## Nginx
- Central exige mTLS solo en /sync/.
- / y /health quedan publicos.

## Sync (central)
Endpoints expuestos por el PoC:
- GET /sync/batch?bankId=...&entity=...&cursor=...
- POST /sync/ack

## Sync (banco)
Endpoints en Bank API (requiere JWT de SUPERADMIN o BANK_ADMIN):
- POST /api/sync/pull
  - body: { entity, cursor?, bankId? }
- POST /api/sync/ack
  - body: { entity, batchId, cursor?, status?, error?, bankId? }

## Notas
- El secreto HMAC del sync se define en runtime via env `SYNC_HMAC_SECRET`.
- Las instancias bancarias no consultan central en linea fuera del sync.
- Para el banco, configurar en `apps/api/.env`:
  - CENTRAL_SYNC_BASE_URL=https://dev.automatixpay.com
  - SYNC_BANK_ID=bank1
  - SYNC_CLIENT_CERT_PATH=/etc/nginx/ssl/automatixpay/bank1-client.crt
  - SYNC_CLIENT_KEY_PATH=/etc/nginx/ssl/automatixpay/bank1-client.key
  - SYNC_CA_CERT_PATH=/etc/nginx/ssl/automatixpay/ca.crt
  - SYNC_HMAC_SECRET=... (mismo valor que central)

## Script de prueba
`scripts/sync-test.sh`

Ejemplos:
```bash
./scripts/sync-test.sh
MODE=central CENTRAL_BASE_URL=https://staging.automatixpay.com CERT=secrets/mtls/automatixpay/bankstaging-client.crt KEY=secrets/mtls/automatixpay/bankstaging-client.key ./scripts/sync-test.sh
MODE=bank TOKEN=... BANK_API_BASE=https://bank1.automatixpay.com/api ./scripts/sync-test.sh
```
