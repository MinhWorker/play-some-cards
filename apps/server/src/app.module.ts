import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AccountsModule } from './accounts/accounts.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { RoomsModule } from './rooms/rooms.module.js';

// In production (`npm run build && npm start`) the server also serves the built web app,
// so you only need to host one process. In dev, Vite serves the web app instead.
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

@Module({
  imports: [
    DbModule,
    AccountsModule,
    RoomsModule,
    ...(existsSync(webDist)
      ? [ServeStaticModule.forRoot({ rootPath: webDist, exclude: ['/api/{*path}'] })]
      : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
