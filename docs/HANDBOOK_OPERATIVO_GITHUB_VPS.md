# Handbook operativo (GitHub + VPS)

## 1) Objetivo
Este documento permite que otro agente (o dev) pueda:
- entender la arquitectura actual del proyecto,
- trabajar con el repositorio GitHub,
- desplegar cambios en el VPS sin romper instancias activas.

## 2) Repositorio
- Repo: `git@github.com:matdell/AutoMatix.git`
- Rama principal: `main`
- Monorepo npm workspaces.

Estructura:
- `apps/api`: API NestJS + Prisma
- `apps/web`: frontend Next.js
- `apps/central-api`: servicio central legacy (PoC)
- `docs/`: documentacion operativa y arquitectura

## 3) Arquitectura funcional vigente

### 3.1 Central (MVP)
- La central se usa para:
  - alta de bancos,
  - provisionamiento de entornos,
  - usuarios `SUPERADMIN`.
- No gestiona operacion comercial diaria de bancos.

### 3.2 Bancos
Cada banco corre en su propia instancia (app + DB) en el VPS.
Operan localmente sus usuarios/sucursales/operacion.

## 4) Topologia actual en VPS
- Host: `matias@74.208.218.120`
- Sistema: Ubuntu 24.04 x86_64
- Proceso manager: PM2
- Reverse proxy: Nginx
- DB: PostgreSQL en Docker (`dev-bank-postgres`)

Instancias activas:

1. Central operativa (MVP)
- Dominio: `https://devbank.automatixpay.com`
- Path: `/home/matias/dev-bank-devbank`
- PM2: `devbank-api` (3011), `devbank-web` (3010)
- DB: `devbank`

2. Banco Comafi
- Dominio: `https://comafi.automatixpay.com`
- Path: `/home/matias/dev-bank-comafi`
- PM2: `bank-comafi-api` (3031), `bank-comafi-web` (3030)
- DB: `comafi`

3. Banco Nacion
- Dominio: `https://dev-nacion.automatixpay.com`
- Path: `/home/matias/dev-bank-nacion`
- PM2: `bank-nacion-api` (3041), `bank-nacion-web` (3040)
- DB: `nacion`

Instancias auxiliares PoC:
- `bank1.automatixpay.com` -> `/home/matias/dev-bank`
- `devbankstaging.automatixpay.com` -> `/home/matias/dev-bank-devbank-staging`
- `dev.automatixpay.com` y `staging.automatixpay.com` (central-api legacy en `:4001`)

## 5) Flujo de trabajo GitHub (recomendado)
1. Sincronizar:
```bash
git checkout main
git pull origin main
```

2. Crear rama de trabajo:
```bash
git checkout -b feat/<nombre-cambio>
```

3. Implementar + validar local:
```bash
npm run build --workspace apps/api
npm run build --workspace apps/web
```

4. Confirmar que no viajan secretos:
```bash
git status --short
```
No debe aparecer ningun `.env`, claves, ni archivos en `secrets/`.

5. Commit y push:
```bash
git add .
git commit -m "feat: <descripcion>"
git push -u origin feat/<nombre-cambio>
```

6. Merge a `main` y despliegue.

## 6) Despliegue a VPS (estado actual)
Importante: las carpetas de despliegue del VPS hoy **no** son clones git; se actualizan por copia (rsync/scp).

### 6.1 Paso A: copiar codigo al VPS
Ejemplo para Comafi:
```bash
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'apps/api/dist' \
  ./ matias@74.208.218.120:/home/matias/dev-bank-comafi/
```

Repetir cambiando destino para cada instancia impactada:
- `/home/matias/dev-bank-devbank`
- `/home/matias/dev-bank-comafi`
- `/home/matias/dev-bank-nacion`

### 6.2 Paso B: instalar deps si corresponde
Solo si cambian `package.json` / `package-lock.json`:
```bash
ssh matias@74.208.218.120 "cd /home/matias/dev-bank-comafi && npm ci"
```

### 6.3 Paso C: migraciones + build
```bash
ssh matias@74.208.218.120 "
  cd /home/matias/dev-bank-comafi/apps/api &&
  npx prisma migrate deploy &&
  cd /home/matias/dev-bank-comafi &&
  npm run build --workspace apps/api &&
  npm run build --workspace apps/web
"
```

### 6.4 Paso D: reiniciar PM2 de esa instancia
Comafi:
```bash
ssh matias@74.208.218.120 "
  cd /home/matias/dev-bank-comafi &&
  pm2 startOrRestart ecosystem.provisioned.config.js --only bank-comafi-api,bank-comafi-web --update-env
"
```

Nacion:
```bash
ssh matias@74.208.218.120 "
  cd /home/matias/dev-bank-nacion &&
  pm2 startOrRestart ecosystem.provisioned.config.js --only bank-nacion-api,bank-nacion-web --update-env
"
```

Central MVP (devbank):
```bash
ssh matias@74.208.218.120 "
  cd /home/matias/dev-bank-devbank &&
  pm2 startOrRestart ecosystem.config.cjs --only devbank-api,devbank-web --update-env
"
```

### 6.5 Paso E: smoke rapido
```bash
curl -I https://devbank.automatixpay.com
curl -I https://comafi.automatixpay.com
curl -I https://dev-nacion.automatixpay.com
```

Ver procesos/logs:
```bash
ssh matias@74.208.218.120 "pm2 ls"
ssh matias@74.208.218.120 "pm2 logs bank-comafi-api --lines 100"
ssh matias@74.208.218.120 "pm2 logs devbank-api --lines 100"
```

## 7) Provisionar un banco nuevo (desde central)
Flujo esperado:
1. Ingresar a central (`devbank.automatixpay.com`) como `SUPERADMIN`.
2. Crear banco.
3. Abrir modal `Provisionar entorno`.
4. Elegir `VPS gestionado` + modo `Este VPS (automatico)`.
5. Definir dominio web y API del banco.
6. Crear solicitud y esperar estado `READY`.

Si falla:
- revisar historial en UI,
- revisar logs API de central,
- revisar Nginx/PM2 en VPS.

## 8) Requisitos para que otro agente trabaje
Accesos minimos:
1. GitHub con permiso al repo `matdell/AutoMatix`.
2. SSH al VPS (`matias@74.208.218.120`).
3. Permisos sudo en VPS para Nginx/certbot si va a crear dominios.

Checklist inicial de onboarding:
1. Confirmar `git remote -v`.
2. Confirmar `ssh matias@74.208.218.120`.
3. Confirmar `pm2 ls` en VPS.
4. Confirmar que puede desplegar a una instancia de prueba (`devbankstaging`).

## 9) Reglas operativas de seguridad
- Nunca commitear `.env` ni claves privadas.
- Mantener secretos solo en VPS/entorno seguro.
- Verificar `git status` antes de cada commit.
- No ejecutar comandos destructivos (`git reset --hard`) sobre cambios de otros.
- Ante duda, desplegar primero en staging y luego en productivo.

## 10) Mejora pendiente recomendada
Para simplificar colaboracion multi-agente:
- convertir carpetas del VPS en clones git reales del repo,
- desplegar con `git pull + build + restart` (en vez de copiar archivos por rsync),
- agregar script de deploy por instancia (`scripts/deploy-vps-instance.sh`).
