import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { INVENTORY_STORE, InventoryService } from './inventory.service.js';
import { MemoryInventoryStore, PgInventoryStore } from './inventory.store.js';

@Global()
@Module({
  providers: [
    {
      provide: INVENTORY_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgInventoryStore(db) : new MemoryInventoryStore()),
    },
    InventoryService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
