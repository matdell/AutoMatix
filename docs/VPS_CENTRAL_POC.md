# VPS PoC Central + Bank (automatixpay.com)

## Objetivo
Prueba funcional en un unico VPS para validar sync central <-> banco con mTLS y dominios separados.
No representa aislamiento real para produccion.

## Dominios
- Central: https://dev.automatixpay.com
- Banco: https://bank1.automatixpay.com

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

## Nginx
- Central exige mTLS solo en /sync/.
- / y /health quedan publicos.

## Sync (central)
Endpoints expuestos por el PoC:
- GET /sync/batch?bankId=...&entity=...&cursor=...
- POST /sync/ack

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
