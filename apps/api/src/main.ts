import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function parseAllowedOrigins(isProduction: boolean) {
  const configured =
    process.env.FRONTEND_ORIGINS ??
    process.env.FRONTEND_URL ??
    (isProduction ? '' : 'http://localhost:3000');

  const origins = configured
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (isProduction && origins.length === 0) {
    throw new Error(
      'FRONTEND_ORIGINS or FRONTEND_URL must be configured in production.',
    );
  }

  return new Set(origins);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins(isProduction);

  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(cookieParser());
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  const rateWindowMs = 60_000;
  const configuredRateLimit = Number(
    process.env.API_RATE_LIMIT_PER_MINUTE ?? '300',
  );
  const rateLimitPerMinute =
    Number.isFinite(configuredRateLimit) && configuredRateLimit >= 30
      ? Math.min(Math.floor(configuredRateLimit), 10_000)
      : 300;
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    const key = request.ip || 'unknown';
    const current = rateBuckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + rateWindowMs }
        : current;

    bucket.count += 1;
    rateBuckets.set(key, bucket);

    if (rateBuckets.size > 10_000) {
      for (const [bucketKey, value] of rateBuckets) {
        if (value.resetAt <= now) rateBuckets.delete(bucketKey);
      }
    }

    response.setHeader('X-RateLimit-Limit', String(rateLimitPerMinute));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, rateLimitPerMinute - bucket.count)),
    );

    if (bucket.count > rateLimitPerMinute) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
      );
      response.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again shortly.',
      });
      return;
    }

    next();
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    if (isProduction) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  });

  app.enableCors({
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'));
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      stopAtFirstError: false,
    }),
  );

  const enableSwagger =
    !isProduction || process.env.ENABLE_SWAGGER === 'true';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Unicolors Workspace API')
      .setDescription(
        'API documentation for the Unicolors Internal Task and Project Management System',
      )
      .addBearerAuth()
      .setVersion('1.0')
      .addTag('Health')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      customSiteTitle: 'Unicolors API Documentation',
    });
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(Number.isFinite(port) ? port : 4000);

  if (!isProduction) {
    console.log(`API: http://localhost:${port}/api/v1`);
    if (enableSwagger) {
      console.log(`Swagger: http://localhost:${port}/api/docs`);
    }
  }
}

void bootstrap();
