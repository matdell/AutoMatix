# Plataforma multi-tenant de campanas (Bancos + Comercios)

Solucion SaaS para gestionar campanas promocionales entre bancos y comercios, con aislamiento por tenant, JWT y RBAC.

## Stack
- Frontend: Next.js (App Router)
- Backend: NestJS + Node.js
- DB: PostgreSQL + Prisma
- Auth: JWT + Roles
- Storage: Cloudflare R2 (S3 compatible)
- Email: Resend
- Firma digital: DocuSign

## Estructura
- `apps/api`: API NestJS
- `apps/web`: UI Next.js

## Requisitos
- Node.js 18+
- PostgreSQL

## Configuracion
1. Copiar variables de entorno para la API:
   - `apps/api/.env.example` -> `apps/api/.env`
2. Ajustar `DATABASE_URL` y claves de servicios externos.
3. (Opcional) Configurar variables para la web:
   - `apps/web/.env.example` -> `apps/web/.env`
   - `NEXT_PUBLIC_API_URL` apunta a `http://localhost:3001/api`

## Base de datos
```bash
cd apps/api
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Desarrollo local
```bash
npm install
npm run dev
```
- API: `http://localhost:3001/api`
- Web: `http://localhost:3000`

## Seguridad multi-tenant
- Cada banco es un tenant (`Bank`).
- Todas las entidades relevantes incluyen `tenantId`.
- Los JWT incluyen `tenantId` y `role`.
- Las consultas se filtran por tenant en cada servicio.

## Endpoints principales (API)
- Auth
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/registro`
- Bancos
  - `POST /api/banks`
  - `GET /api/banks/me`
  - `PUT /api/banks/me`
  - `POST /api/banks/me/logo`
- Comercios
  - `GET /api/merchants`
  - `POST /api/merchants`
  - `GET /api/merchants/:id`
  - `PUT /api/merchants/:id`
  - `DELETE /api/merchants/:id`
  - `POST /api/merchants/import`
  - `GET /api/merchants/export/csv`
- Sucursales
  - `GET /api/merchants/:merchantId/branches`
  - `POST /api/merchants/:merchantId/branches`
  - `PUT /api/branches/:id`
  - `DELETE /api/branches/:id`
- Campanas
  - `GET /api/campaigns`
  - `POST /api/campaigns`
  - `GET /api/campaigns/:id`
  - `PUT /api/campaigns/:id`
  - `GET /api/campaigns/export/csv`
- Invitaciones
  - `GET /api/invitations`
  - `POST /api/invitations`
  - `POST /api/invitations/:token/accept`
  - `POST /api/invitations/:token/reject`
- Validaciones
  - `POST /api/validations/run`
  - `GET /api/validations/errors`
  - `POST /api/validations/errors/:id/resolve`
- Auditoria
  - `GET /api/audit-logs`

## Despliegue en Railway
- Crear servicio para PostgreSQL.
- Configurar `DATABASE_URL` en el servicio de API.
- Configurar variables `JWT_SECRET`, `R2_*`, `RESEND_*`, `DOCUSIGN_*` y `GOOGLE_PLACES_API_KEY`.
- Para el frontend, definir `NEXT_PUBLIC_API_URL` si se agrega consumo directo.

## Datos de seed
Se crean bancos, usuarios y campanas de prueba. Password de ejemplo: `Admin123!`.

## Notas
- La UI esta en espanol (Latam / Argentina).
- La integracion de DocuSign y R2 es funcional con credenciales reales.
- El motor de validacion bloquea comercios con `merchantNumber` invalido.
