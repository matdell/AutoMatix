import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './modules/app.module';

function parseCorsOrigins(raw?: string) {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertCriticalSecurityConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET es obligatorio.');
  }
  if (isProduction && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
  }
  const provisioningKey = process.env.PROVISIONING_CREDENTIALS_KEY?.trim();
  if (isProduction && (!provisioningKey || provisioningKey.length < 32)) {
    throw new Error(
      'PROVISIONING_CREDENTIALS_KEY es obligatoria y debe tener al menos 32 caracteres en produccion.',
    );
  }
}

async function bootstrap() {
  assertCriticalSecurityConfig();
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const isProduction = process.env.NODE_ENV === 'production';
  const corsConfig =
    corsOrigins.length > 0
      ? {
          origin: corsOrigins,
          exposedHeaders: ['x-access-token'],
        }
      : isProduction
        ? false
        : {
            origin: [
              /^https?:\/\/localhost(:\d+)?$/,
              /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
            ],
            exposedHeaders: ['x-access-token'],
          };

  const app = await NestFactory.create(AppModule, {
    cors: corsConfig,
  });
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  return port;
}

bootstrap()
  .then((port) => {
    // Log simple para confirmar arranque y puerto en desarrollo
    // eslint-disable-next-line no-console
    console.log(`API escuchando en http://localhost:${port}/api`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Error al iniciar la API', err);
    process.exit(1);
  });
