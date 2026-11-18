import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Increase payload limit for base64 image uploads (avatars & server icons)
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  // Serve static assets (HTML/CSS/JS Discord Web UI)
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe for all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Discord v10 API prefix (excluding root and health)
  const prefix = process.env.API_PREFIX || 'api/v10';
  app.setGlobalPrefix(prefix, {
    exclude: ['/', 'health', 'download', 'download/windows'],
  });

  // =========================================================================
  // Swagger / OpenAPI 3.0 Documentation Setup
  // =========================================================================
  const config = new DocumentBuilder()
    .setTitle('SyncCord API')
    .setDescription(
      'Complete production-ready SyncCord v10 REST API and WebSocket Gateway.\n\n' +
      'Built with NestJS Hexagonal Architecture (Ports & Adapters), TypeScript, Jest, ' +
      'and PostgreSQL (Compatible with Docker local, Neon.tech Serverless, and Supabase).',
    )
    .setVersion('10.0.0')
    .addTag('Authentication', 'User registration, login, and profile operations')
    .addTag('Guilds', 'Server creation, member management, and discovery')
    .addTag('Channels', 'Text, Voice, and Category channel operations')
    .addTag('Messages', 'Real-time chat messaging, history pagination')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SyncCord API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 SyncCord Server is running on: http://localhost:${port}/${prefix}`);
  logger.log(`📖 Swagger API Documentation is available at: http://localhost:${port}/api/docs`);
  logger.log(`⚡ WebSocket Gateway is ready on port ${port} (Namespace: /)`);
}

bootstrap();
