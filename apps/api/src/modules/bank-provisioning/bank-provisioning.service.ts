import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProvisioningStatus, ProvisioningTarget, Prisma, Role } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { PrismaService } from '../common/prisma.service';
import { CreateBankProvisioningRequestDto } from './dto/create-bank-provisioning-request.dto';
import { UpdateBankProvisioningStatusDto } from './dto/update-bank-provisioning-status.dto';

type JsonMap = Record<string, unknown>;

type ProvisioningRequestRow = {
  id: string;
  bankId: string;
  target: ProvisioningTarget;
  status: ProvisioningStatus;
  provider: string | null;
  domain: string | null;
  apiDomain: string | null;
  region: string | null;
  config: Prisma.JsonValue | null;
  credentials: Prisma.JsonValue | null;
  notes: string | null;
  createdByUserId: string | null;
  processedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VpsSourceUser = {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  role: Role;
  isActive: boolean;
  twoFactorEmailEnabled: boolean;
  twoFactorTotpEnabled: boolean;
  twoFactorTotpSecret: string | null;
};

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

@Injectable()
export class BankProvisioningService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async ensureBank(bankId: string) {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true, nombre: true, slug: true },
    });
    if (!bank) {
      throw new NotFoundException('Banco no encontrado');
    }
    return bank;
  }

  private getEncryptionSecret() {
    return (
      this.config.get<string>('PROVISIONING_CREDENTIALS_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'local-dev-provisioning-key'
    );
  }

  private asJsonMap(value: Prisma.JsonValue | null | undefined): JsonMap {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonMap;
    }
    return {};
  }

  private pickString(map: JsonMap | undefined, key: string) {
    const value = map?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private pickNumber(map: JsonMap | undefined, key: string, fallback: number) {
    const value = map?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private ensureTargetRequirements(dto: CreateBankProvisioningRequestDto) {
    if (!dto.domain?.trim() || !dto.apiDomain?.trim()) {
      throw new BadRequestException('domain y apiDomain son obligatorios');
    }

    const config = dto.config ?? {};
    const credentials = dto.credentials ?? {};

    if (dto.target === ProvisioningTarget.VPS_MANAGED) {
      if (!this.pickString(config, 'host') || !this.pickString(credentials, 'sshUser')) {
        throw new BadRequestException(
          'Para VPS_MANAGED se requiere config.host y credentials.sshUser',
        );
      }
    }

    if (dto.target === ProvisioningTarget.CUSTOMER_CLOUD) {
      if (!dto.provider?.trim()) {
        throw new BadRequestException('Para CUSTOMER_CLOUD se requiere provider');
      }
      const hasRoleArn = Boolean(this.pickString(credentials, 'roleArn'));
      const hasAccessKey = Boolean(this.pickString(credentials, 'accessKeyId'));
      if (!hasRoleArn && !hasAccessKey) {
        throw new BadRequestException(
          'Para CUSTOMER_CLOUD se requiere credentials.roleArn o credentials.accessKeyId',
        );
      }
    }

    if (dto.target === ProvisioningTarget.ON_PREM) {
      if (!this.pickString(config, 'endpoint')) {
        throw new BadRequestException('Para ON_PREM se requiere config.endpoint');
      }
    }
  }

  private encryptCredentials(credentials?: JsonMap): Prisma.InputJsonValue | undefined {
    if (!credentials || Object.keys(credentials).length === 0) {
      return undefined;
    }
    const key = createHash('sha256').update(this.getEncryptionSecret()).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(credentials);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');

    return {
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag,
      data: encrypted,
    };
  }

  private decryptCredentials(value: Prisma.JsonValue | null): JsonMap {
    if (!value) {
      return {};
    }
    const map = this.asJsonMap(value);
    const alg = this.pickString(map, 'alg');
    const ivB64 = this.pickString(map, 'iv');
    const tagB64 = this.pickString(map, 'tag');
    const dataB64 = this.pickString(map, 'data');
    if (alg !== 'aes-256-gcm' || !ivB64 || !tagB64 || !dataB64) {
      return map;
    }

    const key = createHash('sha256').update(this.getEncryptionSecret()).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    let decrypted = decipher.update(dataB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted) as JsonMap;
  }

  private sanitize(request: ProvisioningRequestRow) {
    return {
      id: request.id,
      bankId: request.bankId,
      target: request.target,
      status: request.status,
      provider: request.provider,
      domain: request.domain,
      apiDomain: request.apiDomain,
      region: request.region,
      config: request.config,
      notes: request.notes,
      createdByUserId: request.createdByUserId,
      processedAt: request.processedAt,
      errorMessage: request.errorMessage,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      hasCredentials: request.credentials !== null,
    };
  }

  private shellEscape(value: string) {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
  }

  private trimOutput(value: string, max = 4000) {
    if (value.length <= max) {
      return value;
    }
    return value.slice(value.length - max);
  }

  private buildErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return this.trimOutput(error.message || 'Error de provisioning');
    }
    return 'Error de provisioning';
  }

  private appendNotes(base: string | null, extra: string) {
    const normalized = extra.trim();
    if (!normalized) {
      return base;
    }
    if (!base?.trim()) {
      return normalized;
    }
    return `${base.trim()}\n${normalized}`;
  }

  private runCommand(
    command: string,
    args: string[],
    options?: { input?: string; cwd?: string; timeoutMs?: number },
  ): Promise<CommandResult> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        env: process.env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timeoutMs = options?.timeoutMs ?? 1000 * 60 * 20;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        rejectPromise(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          rejectPromise(new Error(`${command} timeout (${timeoutMs}ms)`));
          return;
        }
        resolvePromise({
          stdout: this.trimOutput(stdout, 120000),
          stderr: this.trimOutput(stderr, 120000),
          code: code ?? 1,
        });
      });

      if (options?.input) {
        child.stdin.write(options.input);
      }
      child.stdin.end();
    });
  }

  private async runRemoteScript(params: {
    host: string;
    sshUser: string;
    sshPort: number;
    sshPrivateKey?: string;
    script: string;
  }) {
    let tempDir: string | null = null;
    let keyPath: string | null = null;

    try {
      if (params.sshPrivateKey?.trim()) {
        tempDir = await mkdtemp(join(tmpdir(), 'bank-provisioning-key-'));
        keyPath = join(tempDir, 'id.key');
        await writeFile(keyPath, params.sshPrivateKey, { mode: 0o600 });
      }

      const args: string[] = [
        '-o',
        'BatchMode=yes',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=20',
        '-p',
        String(params.sshPort),
      ];
      if (keyPath) {
        args.push('-i', keyPath);
      }
      args.push(`${params.sshUser}@${params.host}`, 'bash -s');

      const result = await this.runCommand('ssh', args, {
        input: params.script,
        timeoutMs: 1000 * 60 * 25,
      });
      if (result.code !== 0) {
        throw new Error(`SSH failed (${result.code}): ${result.stderr || result.stdout}`);
      }
      return result.stdout;
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  private buildRemoteProvisionScript(params: {
    bank: {
      id: string;
      nombre: string;
      slug: string;
      nombreCompleto: string | null;
      razonSocial: string | null;
      cuit: string | null;
      direccionCasaMatriz: string | null;
      paymentMethods: string[];
      bines: string[];
      fechaAlta: Date | null;
      activo: boolean;
    };
    users: VpsSourceUser[];
    domain: string;
    apiDomain: string;
    templateDir: string;
    baseDir: string;
    dbContainer: string;
    dbUser: string;
    dbPassword: string;
    dbHost: string;
    dbPort: number;
    dbPrefix: string;
    tlsEmail: string;
    webPortStart: number;
    webPortEnd: number;
  }) {
    const payloadB64 = Buffer.from(
      JSON.stringify({
        bank: params.bank,
        users: params.users,
      }),
      'utf8',
    ).toString('base64');

    const escaped = {
      bankSlug: this.shellEscape(params.bank.slug),
      domain: this.shellEscape(params.domain),
      apiDomain: this.shellEscape(params.apiDomain),
      templateDir: this.shellEscape(params.templateDir),
      baseDir: this.shellEscape(params.baseDir),
      dbContainer: this.shellEscape(params.dbContainer),
      dbUser: this.shellEscape(params.dbUser),
      dbPassword: this.shellEscape(params.dbPassword),
      dbHost: this.shellEscape(params.dbHost),
      dbPort: this.shellEscape(String(params.dbPort)),
      dbPrefix: this.shellEscape(params.dbPrefix),
      tlsEmail: this.shellEscape(params.tlsEmail),
      payloadB64: this.shellEscape(payloadB64),
      webPortStart: this.shellEscape(String(params.webPortStart)),
      webPortEnd: this.shellEscape(String(params.webPortEnd)),
    };

    return `#!/usr/bin/env bash
set -euo pipefail

BANK_SLUG=${escaped.bankSlug}
DOMAIN=${escaped.domain}
API_DOMAIN=${escaped.apiDomain}
TEMPLATE_DIR=${escaped.templateDir}
BASE_DIR=${escaped.baseDir}
DB_CONTAINER=${escaped.dbContainer}
DB_USER=${escaped.dbUser}
DB_PASSWORD=${escaped.dbPassword}
DB_HOST=${escaped.dbHost}
DB_PORT=${escaped.dbPort}
DB_PREFIX=${escaped.dbPrefix}
TLS_EMAIL=${escaped.tlsEmail}
PAYLOAD_B64=${escaped.payloadB64}
WEB_PORT_START=${escaped.webPortStart}
WEB_PORT_END=${escaped.webPortEnd}

TARGET_DIR="$BASE_DIR/dev-bank-$BANK_SLUG"
APP_API="bank-$BANK_SLUG-api"
APP_WEB="bank-$BANK_SLUG-web"

if [ -d "$TARGET_DIR" ]; then
  echo "ERROR: target dir already exists: $TARGET_DIR"
  exit 10
fi

USED_PORTS="$(ss -ltnH | awk '{print $4}' | awk -F: '{print $NF}' | sort -n | uniq || true)"
WEB_PORT=""
API_PORT=""
for candidate in $(seq "$WEB_PORT_START" 10 "$WEB_PORT_END"); do
  api=$((candidate + 1))
  if ! grep -qx "$candidate" <<<"$USED_PORTS" && ! grep -qx "$api" <<<"$USED_PORTS"; then
    WEB_PORT="$candidate"
    API_PORT="$api"
    break
  fi
done
if [ -z "$WEB_PORT" ] || [ -z "$API_PORT" ]; then
  echo "ERROR: no free web/api ports in configured range"
  exit 11
fi

DB_BASENAME="$(echo "$BANK_SLUG" | tr '-' '_')"
DB_NAME="$DB_PREFIX$DB_BASENAME"

DB_EXISTS="$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | tr -d '[:space:]')"
if [ "$DB_EXISTS" = "1" ]; then
  echo "ERROR: database already exists: $DB_NAME"
  exit 12
fi
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"$DB_NAME\\";"

mkdir -p "$TARGET_DIR"
rsync -a --delete --exclude '.git' --exclude 'node_modules' --exclude 'apps/api/dist' --exclude 'apps/web/.next' --exclude 'logs' "$TEMPLATE_DIR/" "$TARGET_DIR/"
mkdir -p "$TARGET_DIR/logs"
if [ ! -e "$TARGET_DIR/node_modules" ] && [ -d "$TEMPLATE_DIR/node_modules" ]; then
  ln -s "$TEMPLATE_DIR/node_modules" "$TARGET_DIR/node_modules"
fi

upsert_env() {
  file="$1"
  key="$2"
  value="$3"
  tmp="$file.tmp"
  if [ -f "$file" ]; then
    grep -v "^$key=" "$file" > "$tmp" || true
  else
    : > "$tmp"
  fi
  printf '%s=%s\\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

API_ENV="$TARGET_DIR/apps/api/.env"
cp "$TEMPLATE_DIR/apps/api/.env" "$API_ENV"
upsert_env "$API_ENV" "DATABASE_URL" "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
upsert_env "$API_ENV" "APP_URL" "https://$DOMAIN"
upsert_env "$API_ENV" "PORT" "$API_PORT"
upsert_env "$API_ENV" "LOGIN_DEFAULT_BANK_SLUG" "$BANK_SLUG"
upsert_env "$API_ENV" "SYNC_BANK_ID" "$BANK_SLUG"

cat > "$TARGET_DIR/apps/web/.env.production" <<EOF
NEXT_PUBLIC_API_URL=/api
EOF

cd "$TARGET_DIR/apps/api"
npx prisma migrate deploy

cd "$TARGET_DIR"
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
export BANK_PROVISION_PAYLOAD="$PAYLOAD_B64"

node - <<'NODE'
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const payloadRaw = Buffer.from(process.env.BANK_PROVISION_PAYLOAD || '', 'base64').toString('utf8');
  const payload = JSON.parse(payloadRaw);
  const bank = payload.bank;
  const users = Array.isArray(payload.users) ? payload.users : [];

  await prisma.bank.upsert({
    where: { id: bank.id },
    update: {
      nombre: bank.nombre,
      nombreCompleto: bank.nombreCompleto,
      razonSocial: bank.razonSocial,
      cuit: bank.cuit,
      direccionCasaMatriz: bank.direccionCasaMatriz,
      paymentMethods: bank.paymentMethods || [],
      bines: bank.bines || [],
      fechaAlta: bank.fechaAlta ? new Date(bank.fechaAlta) : null,
      slug: bank.slug,
      activo: Boolean(bank.activo),
    },
    create: {
      id: bank.id,
      nombre: bank.nombre,
      nombreCompleto: bank.nombreCompleto,
      razonSocial: bank.razonSocial,
      cuit: bank.cuit,
      direccionCasaMatriz: bank.direccionCasaMatriz,
      paymentMethods: bank.paymentMethods || [],
      bines: bank.bines || [],
      fechaAlta: bank.fechaAlta ? new Date(bank.fechaAlta) : null,
      slug: bank.slug,
      activo: Boolean(bank.activo),
    },
  });

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        tenantId: bank.id,
        email: user.email,
        passwordHash: user.passwordHash,
        nombre: user.nombre,
        role: user.role,
        isActive: Boolean(user.isActive),
        bankBranchId: null,
        brandId: null,
        merchantId: null,
        pointOfSaleId: null,
        twoFactorEmailEnabled: Boolean(user.twoFactorEmailEnabled),
        twoFactorTotpEnabled: Boolean(user.twoFactorTotpEnabled),
        twoFactorTotpSecret: user.twoFactorTotpSecret || null,
      },
      create: {
        id: user.id,
        tenantId: bank.id,
        email: user.email,
        passwordHash: user.passwordHash,
        nombre: user.nombre,
        role: user.role,
        isActive: Boolean(user.isActive),
        bankBranchId: null,
        brandId: null,
        merchantId: null,
        pointOfSaleId: null,
        twoFactorEmailEnabled: Boolean(user.twoFactorEmailEnabled),
        twoFactorTotpEnabled: Boolean(user.twoFactorTotpEnabled),
        twoFactorTotpSecret: user.twoFactorTotpSecret || null,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

npm run build --workspace apps/api
npm run build --workspace apps/web

cat > "$TARGET_DIR/ecosystem.provisioned.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "$APP_API",
      cwd: "./apps/api",
      script: "dist/main.js",
      node_args: "-r dotenv/config",
      env_file: "./apps/api/.env",
      env: {
        NODE_ENV: "production",
        PORT: "$API_PORT",
        DOTENV_CONFIG_PATH: ".env",
        DOTENV_CONFIG_OVERRIDE: "true",
      },
    },
    {
      name: "$APP_WEB",
      cwd: "./apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p $WEB_PORT",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "/api",
      },
    },
  ],
};
EOF

pm2 delete "$APP_API" >/dev/null 2>&1 || true
pm2 delete "$APP_WEB" >/dev/null 2>&1 || true
pm2 start "$TARGET_DIR/ecosystem.provisioned.cjs"
pm2 save

NGINX_FILE="/etc/nginx/sites-available/$DOMAIN.conf"
sudo tee "$NGINX_FILE" >/dev/null <<EOF
server {
  listen 80;
  server_name $DOMAIN;

  location /api/ {
    proxy_pass http://127.0.0.1:$API_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:$WEB_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

if [ "$API_DOMAIN" != "$DOMAIN" ]; then
  sudo tee -a "$NGINX_FILE" >/dev/null <<EOF
server {
  listen 80;
  server_name $API_DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:$API_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
fi

sudo ln -sfn "$NGINX_FILE" "/etc/nginx/sites-enabled/$DOMAIN.conf"
sudo nginx -t
sudo systemctl reload nginx

CERTBOT_DOMAINS="-d $DOMAIN"
if [ "$API_DOMAIN" != "$DOMAIN" ]; then
  CERTBOT_DOMAINS="$CERTBOT_DOMAINS -d $API_DOMAIN"
fi
sudo certbot --nginx --non-interactive --agree-tos --keep-until-expiring --redirect -m "$TLS_EMAIL" $CERTBOT_DOMAINS
sudo nginx -t
sudo systemctl reload nginx

echo "__PROVISION_RESULT__ instanceDir=$TARGET_DIR apiPort=$API_PORT webPort=$WEB_PORT dbName=$DB_NAME appApi=$APP_API appWeb=$APP_WEB"
`;
  }

  private async runVpsProvisioning(requestId: string) {
    const request = await this.prisma.bankProvisioningRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return;
    }
    if (request.target !== ProvisioningTarget.VPS_MANAGED) {
      return;
    }

    if (
      request.status !== ProvisioningStatus.REQUESTED &&
      request.status !== ProvisioningStatus.RUNNING
    ) {
      return;
    }

    await this.prisma.bankProvisioningRequest.update({
      where: { id: request.id },
      data: {
        status: ProvisioningStatus.RUNNING,
        errorMessage: null,
        processedAt: null,
      },
    });

    try {
      const bank = await this.prisma.bank.findUnique({
        where: { id: request.bankId },
        select: {
          id: true,
          nombre: true,
          nombreCompleto: true,
          razonSocial: true,
          cuit: true,
          direccionCasaMatriz: true,
          paymentMethods: true,
          bines: true,
          fechaAlta: true,
          slug: true,
          activo: true,
        },
      });
      if (!bank) {
        throw new Error('Banco no encontrado para provisioning');
      }

      const users = await this.prisma.user.findMany({
        where: {
          tenantId: request.bankId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          nombre: true,
          role: true,
          isActive: true,
          twoFactorEmailEnabled: true,
          twoFactorTotpEnabled: true,
          twoFactorTotpSecret: true,
        },
      });
      if (users.length === 0) {
        throw new Error('El banco no tiene usuarios activos para bootstrap inicial');
      }

      const requestConfig = this.asJsonMap(request.config);
      const creds = this.decryptCredentials(request.credentials);
      const host = this.pickString(requestConfig, 'host');
      const sshUser = this.pickString(creds, 'sshUser');
      const sshPort = this.pickNumber(requestConfig, 'sshPort', 22);
      const sshPrivateKey = this.pickString(creds, 'sshPrivateKey');
      if (!host || !sshUser) {
        throw new Error('Faltan credenciales SSH para ejecutar provisioning en VPS');
      }

      const domain = request.domain?.trim();
      const apiDomain = request.apiDomain?.trim();
      if (!domain || !apiDomain) {
        throw new Error('domain/apiDomain no configurados en la solicitud');
      }

      const currentRepoRoot = resolve(process.cwd(), '../..');
      const templateDir = this.config.get<string>('PROVISIONING_TEMPLATE_DIR') || currentRepoRoot;
      const baseDir = this.config.get<string>('PROVISIONING_INSTANCE_BASE_DIR') || dirname(templateDir);
      const dbContainer = this.config.get<string>('PROVISIONING_DB_CONTAINER') || 'dev-bank-postgres';
      const dbUser = this.config.get<string>('PROVISIONING_DB_USER') || 'campanas';
      const dbPassword = this.config.get<string>('PROVISIONING_DB_PASSWORD') || 'campanas123';
      const dbHost = this.config.get<string>('PROVISIONING_DB_HOST') || '127.0.0.1';
      const dbPort = Number(this.config.get<string>('PROVISIONING_DB_PORT') || '5432');
      const dbPrefix = this.config.get<string>('PROVISIONING_DB_PREFIX') || '';
      const tlsEmail =
        this.config.get<string>('PROVISIONING_TLS_EMAIL') ||
        this.config.get<string>('RESEND_FROM') ||
        'infra@automatixpay.com';
      const webPortStart = Number(this.config.get<string>('PROVISIONING_PORT_WEB_START') || '3030');
      const webPortEnd = Number(this.config.get<string>('PROVISIONING_PORT_WEB_END') || '3990');

      const script = this.buildRemoteProvisionScript({
        bank,
        users: users as VpsSourceUser[],
        domain,
        apiDomain,
        templateDir,
        baseDir,
        dbContainer,
        dbUser,
        dbPassword,
        dbHost,
        dbPort,
        dbPrefix,
        tlsEmail,
        webPortStart,
        webPortEnd,
      });

      const stdout = await this.runRemoteScript({
        host,
        sshUser,
        sshPort,
        sshPrivateKey,
        script,
      });
      const summaryLine =
        stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('__PROVISION_RESULT__')) || '';
      const summary = summaryLine.replace('__PROVISION_RESULT__', '').trim();
      const notes = summary ? this.appendNotes(request.notes, `[READY] ${summary}`) : request.notes;

      await this.prisma.bankProvisioningRequest.update({
        where: { id: request.id },
        data: {
          status: ProvisioningStatus.READY,
          processedAt: new Date(),
          errorMessage: null,
          notes: notes ?? undefined,
        },
      });
    } catch (error) {
      const message = this.buildErrorMessage(error);
      const updatedRequest = await this.prisma.bankProvisioningRequest.findUnique({
        where: { id: request.id },
        select: { notes: true },
      });
      await this.prisma.bankProvisioningRequest.update({
        where: { id: request.id },
        data: {
          status: ProvisioningStatus.FAILED,
          errorMessage: message,
          processedAt: new Date(),
          notes: this.appendNotes(updatedRequest?.notes ?? null, `[FAILED] ${message}`) ?? undefined,
        },
      });
    }
  }

  private triggerVpsProvisioning(requestId: string) {
    setTimeout(() => {
      void this.runVpsProvisioning(requestId);
    }, 0);
  }

  async list(bankId: string) {
    await this.ensureBank(bankId);
    const requests = await this.prisma.bankProvisioningRequest.findMany({
      where: { bankId },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request) => this.sanitize(request));
  }

  async create(bankId: string, dto: CreateBankProvisioningRequestDto, userId?: string) {
    await this.ensureBank(bankId);
    this.ensureTargetRequirements(dto);

    const request = await this.prisma.bankProvisioningRequest.create({
      data: {
        bankId,
        target: dto.target,
        status: ProvisioningStatus.REQUESTED,
        provider: dto.provider?.trim() || null,
        domain: dto.domain?.trim() || null,
        apiDomain: dto.apiDomain?.trim() || null,
        region: dto.region?.trim() || null,
        config: (dto.config ?? null) as Prisma.InputJsonValue,
        credentials: this.encryptCredentials(dto.credentials),
        notes: dto.notes?.trim() || null,
        createdByUserId: userId ?? null,
      },
    });

    if (request.target === ProvisioningTarget.VPS_MANAGED) {
      this.triggerVpsProvisioning(request.id);
    }

    return this.sanitize(request);
  }

  async runNow(bankId: string, requestId: string) {
    await this.ensureBank(bankId);
    const existing = await this.prisma.bankProvisioningRequest.findFirst({
      where: { id: requestId, bankId },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud de provisionamiento no encontrada');
    }
    if (existing.target !== ProvisioningTarget.VPS_MANAGED) {
      throw new BadRequestException('Solo se puede ejecutar automatico para VPS_MANAGED');
    }

    const reset = await this.prisma.bankProvisioningRequest.update({
      where: { id: requestId },
      data: {
        status: ProvisioningStatus.REQUESTED,
        errorMessage: null,
        processedAt: null,
      },
    });
    this.triggerVpsProvisioning(requestId);
    return this.sanitize(reset);
  }

  async updateStatus(bankId: string, requestId: string, dto: UpdateBankProvisioningStatusDto) {
    await this.ensureBank(bankId);

    const existing = await this.prisma.bankProvisioningRequest.findFirst({
      where: { id: requestId, bankId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud de provisionamiento no encontrada');
    }

    const finalStatuses = new Set<ProvisioningStatus>([
      ProvisioningStatus.READY,
      ProvisioningStatus.FAILED,
      ProvisioningStatus.CANCELLED,
    ]);

    const updated = await this.prisma.bankProvisioningRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        notes: dto.notes?.trim() || undefined,
        errorMessage: dto.errorMessage?.trim() || null,
        processedAt: finalStatuses.has(dto.status) ? new Date() : null,
      },
    });

    return this.sanitize(updated);
  }
}
