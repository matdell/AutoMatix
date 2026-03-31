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
