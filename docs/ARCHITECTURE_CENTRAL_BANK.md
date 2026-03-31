# Arquitectura Central + Instancias bancarias (fase diseno)

## Resumen
Este documento define el diseno objetivo para pasar del modelo multi-tenant actual a un esquema de instancia dedicada por banco, con una plataforma central de datos maestros y catalogos globales. La plataforma central actua como control-plane y cada banco opera su data-plane propio.

Alcance de esta fase: diseno. No se implementa codigo ni migraciones en este documento.

## Objetivos
- Separacion fisica por banco para datos, secretos, logs y proveedores.
- Plataforma central como fuente de verdad de marcas, razones sociales y PDV.
- Sincronizacion segura pull firmada desde bancos hacia central.
- Tokens emitidos localmente en cada banco (sin tenantId).

## Diagrama de componentes y trust boundaries
```mermaid
flowchart LR
    subgraph central [CentralPlatform - Control Plane]
        masterData[MasterDataHub]
        identityBroker[Identity Broker (opcional)]
        vendorCatalog[SignatureVendorCatalog]
        pricingHub[SignaturePricingHub]
        syncHub[SyncOrchestration]
        auditHub[CentralAuditMetadata]
    end

    subgraph bankA [BankInstance - Data Plane]
        bankAuth[LocalIdentityAndSSO]
        bankApi[LocalBankAPI]
        bankDb[LocalOperationalDB]
        bankSecrets[LocalSecrets]
        bankSig[LocalSignatureProviders]
    end

    masterData --> syncHub
    vendorCatalog --> pricingHub
    pricingHub --> syncHub

    syncHub --> bankApi
    identityBroker --> bankAuth

    bankApi --> auditHub
```

Trust boundaries
- CentralPlatform no accede a datos operativos sensibles del banco.
- BankInstance no consulta en linea datos maestros de otras entidades bancarias.
- Sincronizacion solo por batches firmados y mTLS.

## Modelo de datos
### Central (master)
Entidades maestras y de orquestacion.

- MasterBrand
- MasterLegalEntity
- MasterPointOfSale
- MasterRelationship
- BankSubscription
- SignatureVendorCatalog
- SignaturePricingCatalog
- SyncJob
- SyncCursor

### Banco (local)
Replicas maestras y datos operativos propios.

- LocalBrandReplica
- LocalLegalEntityReplica
- LocalPosReplica
- SignaturePolicy
- SignatureRequest
- SignatureEvent
- Contract
- ContractDocument
- AuditLog

Campos obligatorios en replicas
- masterId
- sourceVersion
- syncedAt
- syncStatus
- bankLocalOverrides (solo flags operativos)

## Matriz de ownership por campo
Regla general
- Master* es central-only.
- Local*Replica solo permite overrides operativos.

Campos ejemplo por entidad
MasterBrand
- name: central-only
- logoUrl: central-only
- rubros: central-only
- website: central-only
- socialLinks: central-only
- email: central-only
- phone: central-only
- paymentProcessor: central-only

MasterLegalEntity
- legalName: central-only
- razonSocial: central-only
- cuit: central-only
- email: central-only
- phone: central-only
- address: central-only
- paymentProcessor: central-only

MasterPointOfSale
- address: central-only
- isInShopping: central-only
- shoppingId: central-only
- establishmentNumbers: central-only

Local*Replica overrides permitidos
- isActive: local-override
- operationalStatus: local-override
- suspensionReason: local-override
- eligibility: local-override
- riskTier: local-override

## Contrato de sincronizacion (pull firmado)
### Principios
- Pull desde bancos hacia central.
- Batches firmados y verificados (HMAC o firma asimetrica).
- Canal mTLS obligatorio.
- Idempotencia por batchId + cursor.

### Central Sync API
GET /sync/batch?bankId=...&entity=...&cursor=...
- Respuesta incluye batchId, nextCursor y payload firmado.

POST /sync/ack
- body: { bankId, batchId, entity, cursor, status, error }
- status: ACK | NACK

Headers sugeridos
- X-Bank-Id
- X-Signature
- X-Signature-Timestamp
- X-Idempotency-Key

SyncCursor
- entity
- lastCursor
- lastSyncedAt
- status

SyncJob
- bankId
- entity
- batchId
- status
- retryCount

## Identidad y acceso
- Tokens emitidos localmente en cada banco.
- Sin tenantId en JWT local.
- Broker central opcional para identidad de marca/RS/PDV.
- El token final siempre lo emite la instancia bancaria.

## Migracion desde el modelo actual
Fase 1: Export
- Exportar datos por tenantId.
- Construir MasterBrand, MasterLegalEntity y MasterPointOfSale.
- Generar masterId y version de origen.

Fase 2: Carga de replicas
- Crear Local*Replica en cada banco con masterId.
- Inicializar SyncCursor por entidad.

Fase 3: Corte
- La instancia bancaria deja de consultar central en linea.
- Solo usa replicas locales.

Fase 4: Rollback
- Mantener snapshot del tenantId original.
- Revertir a esquema anterior si falla el corte.

## Despliegue y seguridad minima
- Instancia single-tenant por banco.
- Secrets, logs, metricas y backups segregados.
- Cifrado en transito con mTLS para sync.
- Cifrado en reposo con claves por banco.
- Webhooks firmados e idempotentes.
- Rotacion de credenciales.

## Interfaces API clave
Central
- CRUD de Master* y BankSubscription.
- Sync API (pull firmado).

Banco
- APIs locales sin tenantId.
- Consultas sobre replicas + overrides operativos.

## Plan de validacion
- Revisar diagrama y trust boundaries con checklist bancario.
- Validar ownership por campo y overrides permitidos.
- Probar idempotencia y reintentos de sync.
- Revisar plan de migracion y ventana de corte.

## Notas de implementacion futura
- Crear nueva app `apps/central-api` para el control-plane.
- Mantener API bancaria en `apps/api` sin tenantId.
- Actualizar Prisma para modelos Central vs Bank en repos separados o esquemas distintos.
