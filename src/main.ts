import 'dotenv/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Global unhandled rejection handler — prevents server crash on unhandled promises
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : reason}`,
      reason instanceof Error ? reason.stack : undefined,
    );
  });

  // Global uncaught exception handler — prevents server crash on sync errors
  process.on('uncaughtException', (error) => {
    logger.error(
      `Uncaught Exception: ${error.message}`,
      error.stack,
    );
    // Don't exit — let the server continue running
  });

  const app = await NestFactory.create(AppModule);

  // Apply one response shape to successful and failed API requests.
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Cookie parser middleware for reading cookies
  app.use(cookieParser());

  // Allowed origins for CORS
  const allowedOrigins = [
    'https://staging-test.toprankmd.com',
    'https://usmle-review.vercel.app',
    'https://api.toprankmd.com',
    'http://localhost:3000',
    'http://localhost:4000',     // adding this here for cors error check 
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // / custome error message  for frontend so that we can figure out exact error 
        callback(new Error(`Origin ${origin} not allowed by CORS`)); 
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('TopRankMed API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addCookieAuth('access_token', {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token stored in httpOnly cookie (access_token)',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  // Prevent premature timeout on long-running requests (e.g., AI question generation
  // which can take 90+ seconds). Node's default server timeout is 0 (no timeout),
  // but we explicitly raise it to be safe (~5 minutes).
  const server = app.getHttpServer();
  server.setTimeout(300000);          // 5 minutes socket timeout
  server.requestTimeout = 300000;     // 5 minutes request timeout
  server.keepAliveTimeout = 65000;    // keep-alive for long requests (>60s)

  await app.listen(4000);
}

bootstrap();