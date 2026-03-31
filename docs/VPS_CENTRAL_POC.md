# VPS PoC Central + Bank (automatixpay.com)

## Objetivo
Prueba funcional en un unico VPS para validar sync central <-> banco con mTLS y dominios separados.
No representa aislamiento real para produccion.

## Dominios
- Central: https://dev.automatixpay.com
- Banco: https://bank1.automatixpay.com
- Central staging: https://staging.automatixpay.com
- Banco staging: https://bankstaging.automatixpay.com
- Banco dev (instancia separada): https://devbank.automatixpay.com
- Banco dev staging (instancia separada): https://devbankstaging.automatixpay.com

Nota: los dominios staging requieren que existan los registros DNS A/AAAA.

## Servicios
- Bank API: 3001 (PM2 `dev-bank-api`)
- Bank Web: 3000 (PM2 `dev-bank-web`)
- Central API: 4001 (PM2 `dev-bank-central`)
- DevBank API: 3011 (PM2 `devbank-api`)
- DevBank Web: 3010 (PM2 `devbank-web`)
- DevBank Staging API: 3021 (PM2 `devbank-staging-api`)
- DevBank Staging Web: 3020 (PM2 `devbank-staging-web`)

## Paths
- Banco principal: `/home/matias/dev-bank`
- Banco dev separado: `/home/matias/dev-bank-devbank`
- Banco dev staging separado: `/home/matias/dev-bank-devbank-staging`

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
- secrets/mtls/automatixpay/devbank-client.crt
- secrets/mtls/automatixpay/devbank-client.key
- secrets/mtls/automatixpay/devbank-staging-client.crt
- secrets/mtls/automatixpay/devbank-staging-client.key

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
  - SYNC_CLIENT_CERT_PATH=/home/matias/certs/automatixpay/bank1-client.crt
  - SYNC_CLIENT_KEY_PATH=/home/matias/certs/automatixpay/bank1-client.key
  - SYNC_HMAC_SECRET=... (mismo valor que central)

## Script de prueba
`scripts/sync-test.sh`

Ejemplos:
```bash
./scripts/sync-test.sh
MODE=central CENTRAL_BASE_URL=https://staging.automatixpay.com CERT=secrets/mtls/automatixpay/bankstaging-client.crt KEY=secrets/mtls/automatixpay/bankstaging-client.key ./scripts/sync-test.sh
MODE=central CENTRAL_BASE_URL=https://dev.automatixpay.com CERT=secrets/mtls/automatixpay/devbank-client.crt KEY=secrets/mtls/automatixpay/devbank-client.key BANK_ID=devbank ./scripts/sync-test.sh
MODE=central CENTRAL_BASE_URL=https://staging.automatixpay.com CERT=secrets/mtls/automatixpay/devbank-staging-client.crt KEY=secrets/mtls/automatixpay/devbank-staging-client.key BANK_ID=devbank-staging ./scripts/sync-test.sh
MODE=bank TOKEN=... BANK_API_BASE=https://bank1.automatixpay.com/api ./scripts/sync-test.sh
```

## Cron de sync pull
Script:
- `scripts/sync-pull-cron.sh`
- `scripts/sync-pull-cron.env.example`

Instalacion sugerida en cada banco:
```bash
cp scripts/sync-pull-cron.sh /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh
chmod +x /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh
cp scripts/sync-pull-cron.env.example /home/matias/dev-bank-devbank-staging/.sync-cron.env
```

Crontab (cada 5 minutos):
```bash
*/5 * * * * ENV_FILE=/home/matias/dev-bank-devbank-staging/.sync-cron.env /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh >> /home/matias/dev-bank-devbank-staging/logs/sync-pull.log 2>&1
```
