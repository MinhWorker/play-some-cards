import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { MATCHES_STORE, MatchesService } from './matches.service.js';
import { MemoryMatchesStore, PgMatchesStore } from './matches.store.js';

@Global()
@Module({
  providers: [
    {
      provide: MATCHES_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgMatchesStore(db) : new MemoryMatchesStore()),
    },
    MatchesService,
  ],
  exports: [MatchesService],
})
export class MatchesModule {}
