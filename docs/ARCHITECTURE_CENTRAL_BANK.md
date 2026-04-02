# Arquitectura actual: Central minima + bancos aislados

## Decision vigente
A partir de esta etapa, la plataforma central NO administra datos comerciales (marcas, razones sociales, PDV) ni sincroniza datos entre bancos.

La central queda limitada a:
- alta de bancos
- provisionamiento de nuevas instancias bancarias
- operacion solo por usuarios `SUPERADMIN`

Cada banco mantiene de forma local y aislada:
- marcas
- razones sociales
- puntos de venta
- usuarios
- campanas
- contratos y operacion

## Principios
- Aislamiento por banco: no compartir base de datos operativa entre bancos.
- Sin lectura cruzada: una instancia bancaria no consulta datos de otro banco.
- Central sin datos operativos sensibles: solo metadatos de provisioning y gobierno tecnico.
- Portabilidad por archivo: intercambio entre bancos via export/import CSV controlado por rol.

## Donde se dan de alta los datos
- Bancos: en la capa central de superadmin.
- Marcas/RS/PDV: en cada instancia bancaria.

## Portabilidad de datos (entre bancos)
Se usa export/import CSV por roles administrativos comerciales:
- `BRAND_ADMIN`
- `LEGAL_ENTITY_ADMIN`
- `MERCHANT_ADMIN`

Capacidades:
- Descargar mis datos
- Importar datos
- Opcion `includeBankSpecificData` para incluir o excluir datos especificos del banco.

Cuando `includeBankSpecificData=false`, se exporta/importa solo informacion portable (estructura comercial).
Cuando `includeBankSpecificData=true`, se incluyen tambien campos operativos del banco (por ejemplo, procesador y numeros operativos).

## Estado tecnico
- El modulo de sync central->banco queda desactivado para operacion normal.
- Los endpoints legacy de sync en central responden `410` (disabled by policy).
- La app bancaria mantiene el modelo local para marcas/RS/PDV.

## Proximos pasos recomendados
1. Completar UX de "Descargar mis datos" e "Importar datos" en vistas de Marca y Razon Social.
2. Agregar validaciones fuertes de import (duplicados, formato, limites por archivo).
3. Agregar trazabilidad completa en auditoria para export/import.
4. Ejecutar auditoria de seguridad integral (authz, secretos, logs, hardening de endpoints).
