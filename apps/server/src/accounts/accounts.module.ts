import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { ACCOUNTS_STORE, AccountsService } from './accounts.service.js';
import { MemoryAccountsStore, PgAccountsStore } from './accounts.store.js';
import { AuthController } from './auth.controller.js';

@Global()
@Module({
  providers: [
    {
      provide: ACCOUNTS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgAccountsStore(db) : new MemoryAccountsStore()),
    },
    AccountsService,
  ],
  controllers: [AuthController],
  exports: [AccountsService],
})
export class AccountsModule {}
