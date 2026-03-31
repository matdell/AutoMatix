import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      exposedHeaders: ['x-access-token'],
    },
  });
  app.setGlobalPrefix('api');
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
