import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// Local secrets (DATABASE_URL) live in apps/server/.env; on Render they are set in the dashboard.
try {
  process.loadEnvFile();
} catch {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 8033);
  // 0.0.0.0 so friends on the same Wi-Fi can connect to your machine.
  await app.listen(port, '0.0.0.0');
  console.log(`Server listening on http://localhost:${port}`);
}

void bootstrap();
