import { Controller, Get, Inject } from '@nestjs/common';
import { gameList, PROTOCOL_VERSION } from '@psc/shared';
import { sql } from 'drizzle-orm';
import { DB, type Db } from './db/db.module.js';
import { APP_COMMIT, APP_VERSION } from './version.js';

const build = { version: APP_VERSION, commit: APP_COMMIT, protocol: PROTOCOL_VERSION };

@Controller('api')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  @Get('health')
  async health() {
    if (!this.db) return { ok: true, db: 'off', ...build };
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: 'up', ...build };
    } catch {
      return { ok: true, db: 'down', ...build };
    }
  }

  @Get('games')
  games() {
    return gameList;
  }
}
