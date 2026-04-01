# Plan de Pruebas UX + Funcionalidad

## Objetivo
Validar que el flujo operativo de SuperAdmin y Banco funcione de punta a punta en `bank1` y `devbank`, cubriendo:
- Acceso/autenticacion y aislamiento entre bancos.
- UX de listados y acciones de bancos/usuarios.
- Jerarquia comercial (Marca -> Razon Social -> PDV).
- Permisos base por rol.

## Entornos a probar
- `https://bank1.automatixpay.com`
- `https://devbank.automatixpay.com`
- `https://devbankstaging.automatixpay.com` (sanity opcional)

## Criterios de salida
- Sin errores bloqueantes (P0/P1).
- Aislamiento por banco validado.
- Flujos de UX criticos navegables sin dead-ends.
- Permisos de rol alineados con expectativas actuales del producto.

## Fase 0: Smoke tecnico automatizado (API)
Script:
- `scripts/ux-functional-smoke.sh`

Config:
- copiar `scripts/ux-functional-smoke.env.example` a `scripts/ux-functional-smoke.env`
- completar passwords

Ejecucion:
```bash
chmod +x scripts/ux-functional-smoke.sh
ENV_FILE=./scripts/ux-functional-smoke.env ./scripts/ux-functional-smoke.sh
```

Cobertura:
- login correcto en bank1/devbank
- bloqueo de login cross-tenant
- permisos: `BANK_ADMIN` no puede listar `/banks`
- `SUPERADMIN` puede listar bancos con campos extendidos
- listados de usuarios/marcas/razones sociales/PDV via API

## Fase 1: UX SuperAdmin Bancos (manual)
1. Login como SuperAdmin en `devbank`.
2. Ir a `SuperAdmin -> Bancos`.
3. Verificar botones:
   - `Crear banco` abre modal.
   - `Crear sucursal` abre modal.
4. Verificar tabla:
   - paginacion visible y cambio de `25/50/100`.
   - expandir fila (`>`) muestra sucursales.
5. Verificar acciones por banco:
   - editar (modal)
   - desactivar/activar
   - eliminar
6. Verificar seleccion multiple:
   - seleccionar varias filas
   - abrir `Editar seleccion`
   - aplicar cambio masivo y validar persistencia
7. Verificar provisionamiento (nuevo):
   - en una fila de banco, click `Provisionar`
   - elegir destino (`VPS gestionado` / `Cloud cliente` / `On-prem`)
   - completar dominios + credenciales requeridas por destino
   - enviar solicitud y validar que aparezca en historial con estado `RUNNING`
   - esperar refresh automatico del historial y validar transicion a `READY` o `FAILED`
   - si queda `FAILED`, usar `Reintentar` y validar nueva ejecucion

## Fase 2: UX SuperAdmin Usuarios (manual)
1. Ir a `SuperAdmin -> Usuarios`.
2. Verificar switch:
   - `Usuarios Bancos`
   - `Usuarios Marcas`
3. Verificar filtros por nivel (segun vista) y paginacion `25/50/100`.
4. Crear/editar usuario por cada nivel principal:
   - Banco
   - Sucursal bancaria
   - Marca
   - Razon social
   - PDV
5. Validar que los selects dependientes se comporten bien:
   - Marca -> Razon social -> PDV

## Fase 3: Permisos por rol (manual + API)
Matriz minima recomendada:
- `SUPERADMIN`: acceso total.
- `BANK_ADMIN`: C/E/D/A/B dentro de su banco, sin alcance global.
- `BANK_BRANCH_MANAGER`: alcance restringido a su sucursal.
- `BRAND_ADMIN`: solo su arbol comercial.
- `LEGAL_ENTITY_ADMIN`: solo su razon social + PDV asociados.
- `POS_ADMIN`: solo su PDV.

Validar para cada rol:
- menu visible
- acceso permitido/denegado en URL directa
- acciones de escritura dentro/fuera de scope

## Fase 4: Operacion y sync (manual)
1. Confirmar cron activo en VPS para:
   - `/home/matias/dev-bank`
   - `/home/matias/dev-bank-devbank`
   - `/home/matias/dev-bank-devbank-staging`
2. Verificar logs:
```bash
tail -n 20 /home/matias/dev-bank/logs/sync-pull.log
tail -n 20 /home/matias/dev-bank-devbank/logs/sync-pull.log
tail -n 20 /home/matias/dev-bank-devbank-staging/logs/sync-pull.log
```
3. Esperado: `sync brands/legal_entities/points_of_sale ok` sin errores repetidos.

## Ejecucion inicial (realizada)
Fecha: `2026-03-31` (America/New_York)

Estado:
- Fase 0: ejecutada -> OK (0 fallas)
- Fases 1-4: pendientes de ejecucion manual guiada

## Ronda solicitada por producto (2026-03-31)
Scope pedido:
- Plataforma central: crear comercio, crear banco, crear usuarios de banco.
- Banco: crear usuarios, crear sucursales, editar usuarios, editar sucursales.

Resultado funcional (API):
- Crear comercio: OK
- Crear banco: OK
- Crear usuarios de banco: OK
- Banco crear usuarios: OK
- Banco crear sucursales: OK
- Banco editar usuarios: OK
- Banco editar sucursales: OK (resuelto)

Fix aplicado:
- Se implemento `PATCH /api/bank-branches/:id` en API.
- Archivos:
  - `apps/api/src/modules/bank-branches/bank-branches.controller.ts`
  - `apps/api/src/modules/bank-branches/bank-branches.service.ts`
  - `apps/api/src/modules/bank-branches/dto/update-bank-branch.dto.ts`
- Deployado y validado en:
  - `bank1.automatixpay.com`
  - `devbank.automatixpay.com`
  - `devbankstaging.automatixpay.com`

Observacion UX actual:
- `apps/web/app/comercios/page.tsx` es una vista mock (sin CRUD real conectado a API).
- Para creación de comercios hoy la validación se hace por API.
