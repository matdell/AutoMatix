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

## Provisionar nuevo banco (entorno propio)
Cuando se crea un banco en la UI de SuperAdmin, se crea la entidad de negocio en base de datos.
Para que ese banco tenga su entorno aislado (app + DB + dominio), hay que provisionar instancia.

Checklist operativo actual (manual):
1. DNS:
   - Crear `A/AAAA` para `bankX.automatixpay.com` apuntando al VPS.
2. Código:
   - Clonar o copiar plantilla de instancia en `/home/matias/dev-bank-<slug>`.
3. Base de datos:
   - Crear DB PostgreSQL dedicada (ej. `bankx`).
4. Variables:
   - `apps/api/.env`: `DATABASE_URL`, `APP_URL`, `PORT`, `SYNC_*`.
   - `apps/web/.env.production`: `NEXT_PUBLIC_API_URL=/api` (obligatorio).
5. Migraciones y build:
   - `npx prisma migrate deploy` en `apps/api`.
   - `npm run build --workspace apps/api`.
   - `npm run build --workspace apps/web`.
6. PM2:
   - Agregar apps API/Web de la nueva instancia con nombre y puertos propios.
7. Nginx:
   - Crear server block para `bankX.automatixpay.com` (web) y `/api` (API).
8. TLS:
   - Emitir certificado Let's Encrypt para el nuevo dominio.
9. Verificación:
   - Login del admin del banco.
   - Healthcheck de API.
   - Sync cron (`scripts/sync-pull-cron.sh`) si aplica.

Variables recomendadas para provisioning:
- `PROVISIONING_CREDENTIALS_KEY` (recomendado): clave para cifrar credenciales de provisioning en DB.
  - Si no se define, el sistema usa `JWT_SECRET` como fallback.

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

## Provisioning API (SuperAdmin)
Endpoints para registrar y seguir solicitudes de provisionamiento por banco:
- `GET /api/banks/:bankId/provisioning-requests`
- `POST /api/banks/:bankId/provisioning-requests`
  - body:
    - `target`: `VPS_MANAGED | CUSTOMER_CLOUD | ON_PREM`
    - `domain`, `apiDomain`
    - `provider?`, `region?`
    - `config` (JSON por tipo de target)
    - `credentials` (JSON sensible, guardado cifrado en DB)
    - `notes?`
- `PATCH /api/banks/:bankId/provisioning-requests/:requestId/status`
  - body: `{ status, notes?, errorMessage? }`

## Notas
- El secreto HMAC del sync se define en runtime via env `SYNC_HMAC_SECRET`.
- Las instancias bancarias no consultan central en linea fuera del sync.
- El frontend debe consumir API relativa (`NEXT_PUBLIC_API_URL=/api`) para no cruzar dominios entre entornos.
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
cp scripts/sync-pull-cron.sh /home/matias/dev-bank/scripts/sync-pull-cron.sh
cp scripts/sync-pull-cron.sh /home/matias/dev-bank-devbank/scripts/sync-pull-cron.sh
cp scripts/sync-pull-cron.sh /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh
chmod +x /home/matias/dev-bank/scripts/sync-pull-cron.sh
chmod +x /home/matias/dev-bank-devbank/scripts/sync-pull-cron.sh
chmod +x /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh
cp scripts/sync-pull-cron.env.example /home/matias/dev-bank/.sync-cron.env
cp scripts/sync-pull-cron.env.example /home/matias/dev-bank-devbank/.sync-cron.env
cp scripts/sync-pull-cron.env.example /home/matias/dev-bank-devbank-staging/.sync-cron.env
```

Crontab (cada 5 minutos):
```bash
*/5 * * * * ENV_FILE=/home/matias/dev-bank/.sync-cron.env /home/matias/dev-bank/scripts/sync-pull-cron.sh >> /home/matias/dev-bank/logs/sync-pull.log 2>&1
*/5 * * * * ENV_FILE=/home/matias/dev-bank-devbank/.sync-cron.env /home/matias/dev-bank-devbank/scripts/sync-pull-cron.sh >> /home/matias/dev-bank-devbank/logs/sync-pull.log 2>&1
*/5 * * * * ENV_FILE=/home/matias/dev-bank-devbank-staging/.sync-cron.env /home/matias/dev-bank-devbank-staging/scripts/sync-pull-cron.sh >> /home/matias/dev-bank-devbank-staging/logs/sync-pull.log 2>&1
```

## Nota PM2 + Prisma en VPS
- En este VPS `dev-bank-devbank` y `dev-bank-devbank-staging` comparten `node_modules` via symlink a `/home/matias/dev-bank/node_modules`.
- Prisma puede terminar tomando un `.env` equivocado si no se inyecta `DATABASE_URL` antes de levantar Node.
- Para evitar mezcla entre instancias, el proceso API se levanta con preload de dotenv:
  - `node_args: '-r dotenv/config'`
  - `DOTENV_CONFIG_PATH=.env`
  - `DOTENV_CONFIG_OVERRIDE=true`
- Si se reinicia manualmente una API fuera de PM2 ecosystem, usar:
```bash
cd /home/matias/<instancia>/apps/api
set -a; source ./.env; set +a
pm2 restart <api-name> --update-env
```
