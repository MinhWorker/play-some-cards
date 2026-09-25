import { Controller, Get, Inject } from '@nestjs/common';
import { gameList } from '@psc/shared';
import { sql } from 'drizzle-orm';
import { DB, type Db } from './db/db.module.js';

@Controller('api')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db | null) {}

  @Get('health')
  async health() {
    if (!this.db) return { ok: true, db: 'off' };
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: 'up' };
    } catch {
      return { ok: true, db: 'down' };
    }
  }

  @Get('games')
  games() {
    return gameList;
  }
}
