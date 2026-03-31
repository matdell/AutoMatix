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
