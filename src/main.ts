import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://garutin.com',
    'https://www.garutin.com',
    'https://cms.garutin.com',
    ...(process.env.CMS_URL ? [process.env.CMS_URL] : []),
    ...(process.env.WEB_URL ? [process.env.WEB_URL] : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          field: error.property,
          errors: Object.values(error.constraints || {}),
        }));
        return new BadRequestException({
          statusCode: 400,
          error: 'Validation Error',
          message: 'Dữ liệu không hợp lệ',
          details: messages,
        });
      },
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4001;
  await app.listen(port, '0.0.0.0');
  console.log(`GaRutin Backend running on: http://0.0.0.0:${port}/api`);
}
bootstrap();
