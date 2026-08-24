import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const frontendUrl = config.get<string>('app.frontendUrl')!;
  const publicUrl = config.get<string>('app.publicUrl')!;

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // El tunel ngrok tambien es origen valido: sirve el callback de OAuth de ML.
  app.enableCors({
    origin: [frontendUrl, publicUrl],
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 4100);
  // Fuera del contenedor solo se alcanza si no escucha en loopback.
  const bindHost = config.get<string>('app.bindHost', '0.0.0.0');
  await app.listen(port, bindHost);
  new Logger('Bootstrap').log(
    `API en http://localhost:${port}/api | publica en ${publicUrl}/api`,
  );
}

void bootstrap();
