# Tests pendientes

## Bancos
- API: crear banco con nombre completo, razon social, CUIT, direccion casa matriz y fecha de alta (POST /banks).
- API: editar banco con los nuevos campos y validar auditoria (PATCH /banks/:id).
- UI: formulario de alta/edicion persiste los nuevos campos.
- UI: listado muestra la fecha de alta cuando esta definida.

## Marcas / Razones sociales / PDV
- API: crear/editar marcas con rubros, redes sociales y procesador (POST/PATCH /brands).
- API: crear/editar razon social con razonSocial, direccionSocial y processor (POST/PATCH /merchants).
- API: crear/editar PDV con nuevos campos de direccion y shopping (POST/PATCH /merchants/:id/branches).
- Import: CSV con columnas legacy crea Marca + RS + PDV y vinculos (POST /merchants/import).
- Import: nro de establecimiento se persiste en BranchEstablishment (CardNetwork=OTRA).

## Arquitectura central (futuro)
- Sync: GET /sync/batch firma valida y payload inalterado.
- Sync: POST /sync/ack idempotente por batchId.
- Sync: cursor incremental por entidad no salta ni duplica registros.
- Sync: BankSubscription filtra solo entidades autorizadas.
- Replicas: solo permite overrides operativos (isActive, operationalStatus, etc).
- Auth: tokens locales sin tenantId en instancia bancaria.
- Seguridad: mTLS requerido en endpoints de sync.

## Seguridad (prioridad alta)
- Auth: API no inicia en `NODE_ENV=production` si `JWT_SECRET` falta o tiene menos de 32 caracteres.
- Auth: API no inicia en `NODE_ENV=production` si `PROVISIONING_CREDENTIALS_KEY` falta o tiene menos de 32 caracteres.
- Auth: `MERCHANT_USER` no puede acceder endpoints de `LEGAL_ENTITY_ADMIN` ni `POS_ADMIN` (RolesGuard estricto).
- Auth: `POST /auth/2fa/totp/disable` rechaza desactivar 2FA sin `currentPassword` o `totpCode`.
- Auth: `PATCH /auth/2fa/email` rechaza desactivar 2FA email sin `currentPassword` o `totpCode`.
- Auth: codigo 2FA email usa generacion criptografica (`crypto.randomInt`) y no repite secuencias predecibles.
- Auth: `JwtStrategy` invalida token cuando `isActive=false` en BD.
- Notificaciones: `Notification.payload` no persiste tokens de invitacion, reset de password ni codigos 2FA.
- Auth: email de bienvenida no contiene password en claro y envia link de alta de password de un solo uso.
- Rate limit: `POST /auth/login`, `/auth/2fa/verify`, `/auth/2fa/resend`, `/auth/forgot-password` y `/invitations/:token/accept` responden `429` tras superar umbral.
- Uploads: endpoints con `FileInterceptor('file')` rechazan archivos > 5MB.
- Uploads: logos rechazan contenido no imagen por magic-bytes; imports rechazan no-CSV.
- Provisioning: conexiones SSH remotas fallan cuando host key no coincide (sin `StrictHostKeyChecking=no`).
- Validaciones: `POST /validations/run` exige `merchantId` y no ejecuta barrido de tenant completo.
