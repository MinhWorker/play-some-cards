import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { LEDGER_STORE, LedgerService } from './ledger.service.js';
import { MemoryLedgerStore, PgLedgerStore } from './ledger.store.js';

@Global()
@Module({
  providers: [
    {
      provide: LEDGER_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgLedgerStore(db) : new MemoryLedgerStore()),
    },
    LedgerService,
  ],
  exports: [LedgerService],
})
export class LedgerModule {}
