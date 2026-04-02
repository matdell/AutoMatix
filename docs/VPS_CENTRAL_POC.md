# VPS PoC Central + Bank (automatixpay.com)

## Objetivo
Prueba funcional en un unico VPS para validar provisionamiento de bancos e instancias separadas por dominio.
No representa aislamiento real para produccion.

## Estado actual (2026-04-02)
- El sync central <-> banco quedo deshabilitado por politica de seguridad del producto.
- La central se usa solo para alta/provisionamiento de bancos.
- Marcas/RS/PDV viven en cada banco y su portabilidad se resuelve por CSV export/import.

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
   - `apps/api/.env`: `DATABASE_URL`, `APP_URL`, `PORT`, `SYNC_*`, `LOGIN_DEFAULT_BANK_SLUG`.
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

Variables recomendadas para provisioning:
- `PROVISIONING_CREDENTIALS_KEY` (recomendado): clave para cifrar credenciales de provisioning en DB.
  - En `production` es obligatoria y debe tener al menos 32 caracteres.
- `PROVISIONING_SSH_KNOWN_HOSTS_PATH` (recomendado): ruta local del `known_hosts` usado por SSH.
- `PROVISIONING_TEMPLATE_DIR` (opcional): template de instancia a clonar. Default: repo actual de la instancia.
- `PROVISIONING_INSTANCE_BASE_DIR` (opcional): carpeta base donde se crean nuevas instancias. Default: parent del template.
- `PROVISIONING_DB_CONTAINER`, `PROVISIONING_DB_USER`, `PROVISIONING_DB_PASSWORD`, `PROVISIONING_DB_HOST`, `PROVISIONING_DB_PORT`, `PROVISIONING_DB_PREFIX`.
- `PROVISIONING_PORT_WEB_START`, `PROVISIONING_PORT_WEB_END` para asignacion automatica de puertos.
- `PROVISIONING_TLS_EMAIL` para Certbot.
- `PROVISIONING_LOCAL_HOSTS` (opcional): lista CSV de hosts considerados locales (ej: `127.0.0.1,localhost,74.208.218.120`) para ejecutar provisioning sin SSH.
- `CORS_ORIGINS` (recomendado): lista CSV de origins permitidos para la API.

## Certificados
- Certificados publicos: Let's Encrypt por dominio.
- mTLS para sync: legacy (no requerido en la arquitectura vigente).

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
- En arquitectura vigente no se expone flujo operativo de sync.
- / y /health quedan publicos.

## Sync (legacy deshabilitado)
Los endpoints de sync se mantienen solo para compatibilidad tecnica y responden `410`.
No usar para operacion.

En banco:
- `SyncModule` removido del runtime principal.
- No hay dependencia operativa de central para datos comerciales.

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
- `POST /api/banks/:bankId/provisioning-requests/:requestId/run`
  - relanza provisioning automatico (solo `VPS_MANAGED`).

## Notas
- El frontend debe consumir API relativa (`NEXT_PUBLIC_API_URL=/api`) para no cruzar dominios entre entornos.
- El login ya no requiere `bankSlug`: la API resuelve banco por `LOGIN_DEFAULT_BANK_SLUG` y/o subdominio.
- Para `VPS_MANAGED`, al crear la solicitud se ejecuta automaticamente: DB + instancia + PM2 + Nginx + Certbot.
- Si `config.host` coincide con `PROVISIONING_LOCAL_HOSTS`, no requiere `sshUser` ni `sshPrivateKey`.
- Export/import de datos comerciales entre bancos se hace por CSV con alcance por rol.

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
