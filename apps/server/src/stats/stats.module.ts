import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { STATS_STORE, StatsService } from './stats.service.js';
import { MemoryStatsStore, PgStatsStore } from './stats.store.js';

@Global()
@Module({
  providers: [
    {
      provide: STATS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgStatsStore(db) : new MemoryStatsStore()),
    },
    StatsService,
  ],
  exports: [StatsService],
})
export class StatsModule {}
